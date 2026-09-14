import type { Tables } from './database.types'
import { getProfileInitials } from './profiles'
import { supabase } from './supabase'
import {
  BACKLOG_STATUS_KEY,
  type BoardTask,
  type TaskKind,
  type TaskPriority,
} from '../mocks/boardViewMock'

export type BoardMessageRow = Tables<'board_messages'>
export type AiRunStatus = 'processing' | 'success' | 'error'

export type BoardMessage = {
  id: string
  boardId: string
  authorId: string
  authorName: string
  body: string
  aiRunStatus: AiRunStatus
  aiResultSummary: string | null
  createdAt: string
}

type BoardMessageWithAuthor = BoardMessageRow & {
  profiles: {
    id: string
    display_name: string
  } | null
}

type AiSplitBoardTask = {
  id: string
  title: string
  status: string
  kind: string
  priority: string
  description: string | null
  dueAt: string | null
  parentId: string | null
  assigneeId: string | null
  assigneeName: string | null
  parentTitle?: string
}

export type AiSplitResult = {
  epic: {
    id: string
    title: string
  }
  boardTasks: AiSplitBoardTask[]
  backlogColumnId: string
  backlogStatus: string
  warnings: string[]
  unmatchedRoles: string[]
}

const BOARD_MESSAGE_SELECT = `
  id,
  board_id,
  author_id,
  body,
  ai_run_status,
  ai_result_summary,
  created_at,
  profiles (
    id,
    display_name
  )
`

function isAiRunStatus(value: string): value is AiRunStatus {
  return value === 'processing' || value === 'success' || value === 'error'
}

function isTaskKind(value: string): value is TaskKind {
  return value === 'task' || value === 'epic'
}

function isTaskPriority(value: string): value is TaskPriority {
  return value === 'low' || value === 'medium' || value === 'high'
}

function mapMessageRow(row: BoardMessageWithAuthor): BoardMessage {
  return {
    id: row.id,
    boardId: row.board_id,
    authorId: row.author_id,
    authorName: row.profiles?.display_name ?? 'Пользователь',
    body: row.body,
    aiRunStatus: isAiRunStatus(row.ai_run_status) ? row.ai_run_status : 'processing',
    aiResultSummary: row.ai_result_summary,
    createdAt: row.created_at,
  }
}

async function requireUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) throw new Error(error.message)
  if (!user) throw new Error('Пользователь не авторизован.')

  return user.id
}

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: Response }).context
    if (context instanceof Response) {
      try {
        const body = (await context.clone().json()) as { error?: string }
        if (body.error) return body.error
      } catch {
        // ignore parse errors
      }
    }
  }

  if (error instanceof Error) return error.message
  return 'Не удалось выполнить AI-разбиение задачи.'
}

export async function listBoardMessages(boardId: string): Promise<BoardMessage[]> {
  const { data, error } = await supabase
    .from('board_messages')
    .select(BOARD_MESSAGE_SELECT)
    .eq('board_id', boardId)
    .order('created_at', { ascending: true })
    .returns<BoardMessageWithAuthor[]>()

  if (error) throw new Error(error.message)

  return (data ?? []).map(mapMessageRow)
}

export async function createBoardMessage(boardId: string, body: string): Promise<BoardMessage> {
  const trimmedBody = body.trim()
  if (!trimmedBody) {
    throw new Error('Введите текст задачи.')
  }

  const authorId = await requireUserId()

  const { data, error } = await supabase
    .from('board_messages')
    .insert({
      board_id: boardId,
      author_id: authorId,
      body: trimmedBody,
      ai_run_status: 'processing',
    })
    .select(BOARD_MESSAGE_SELECT)
    .single()
    .returns<BoardMessageWithAuthor>()

  if (error) throw new Error(error.message)

  return mapMessageRow(data)
}

export async function updateBoardMessageAiStatus(
  messageId: string,
  status: AiRunStatus,
  summary: string | null = null,
): Promise<BoardMessage> {
  const { data, error } = await supabase
    .from('board_messages')
    .update({
      ai_run_status: status,
      ai_result_summary: summary,
    })
    .eq('id', messageId)
    .select(BOARD_MESSAGE_SELECT)
    .single()
    .returns<BoardMessageWithAuthor>()

  if (error) throw new Error(error.message)

  return mapMessageRow(data)
}

export function subscribeBoardMessages(
  boardId: string,
  onChange: (message: BoardMessage, event: 'insert' | 'update') => void,
): () => void {
  const channel = supabase
    .channel(`board-messages:${boardId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'board_messages',
        filter: `board_id=eq.${boardId}`,
      },
      async (payload) => {
        const row = payload.new as BoardMessageRow
        const { data } = await supabase
          .from('board_messages')
          .select(BOARD_MESSAGE_SELECT)
          .eq('id', row.id)
          .single()
          .returns<BoardMessageWithAuthor>()

        if (data) onChange(mapMessageRow(data), 'insert')
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'board_messages',
        filter: `board_id=eq.${boardId}`,
      },
      async (payload) => {
        const row = payload.new as BoardMessageRow
        const { data } = await supabase
          .from('board_messages')
          .select(BOARD_MESSAGE_SELECT)
          .eq('id', row.id)
          .single()
          .returns<BoardMessageWithAuthor>()

        if (data) onChange(mapMessageRow(data), 'update')
      },
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

export async function runBoardMessageAiSplit(payload: {
  boardId: string
  title: string
  description?: string
  dueAt?: string | null
}): Promise<AiSplitResult> {
  const { data, error } = await supabase.functions.invoke('anymodel-chat', {
    body: {
      boardId: payload.boardId,
      title: payload.title,
      description: payload.description,
      dueAt: payload.dueAt ?? null,
    },
  })

  if (error) {
    throw new Error(await getFunctionErrorMessage(error))
  }

  const result = data as Partial<AiSplitResult> & { error?: string }
  if (!result || result.error) {
    throw new Error(result?.error ?? 'AI вернул пустой ответ.')
  }

  if (!result.epic?.id || !Array.isArray(result.boardTasks) || !result.backlogColumnId) {
    throw new Error('AI вернул неполный результат.')
  }

  return {
    epic: {
      id: result.epic.id,
      title: result.epic.title,
    },
    boardTasks: result.boardTasks,
    backlogColumnId: result.backlogColumnId,
    backlogStatus: result.backlogStatus ?? BACKLOG_STATUS_KEY,
    warnings: result.warnings ?? [],
    unmatchedRoles: result.unmatchedRoles ?? [],
  }
}

export function mapAiSplitToBoardTasks(result: AiSplitResult): BoardTask[] {
  return result.boardTasks.map((task) => {
    const kind = isTaskKind(task.kind) ? task.kind : 'task'
    const priority = isTaskPriority(task.priority) ? task.priority : 'medium'
    const assigneeName = task.assigneeName

    return {
      id: task.id,
      title: task.title,
      status: task.status,
      kind,
      priority,
      description: task.description,
      assigneeId: task.assigneeId,
      assigneeIds: task.assigneeId ? [task.assigneeId] : [],
      assigneeName,
      assigneeNames: assigneeName ? [assigneeName] : [],
      assigneeInitials: assigneeName ? getProfileInitials(assigneeName) : null,
      dueAt: task.dueAt,
      parentTitle: task.parentTitle,
      tags: [],
    }
  })
}
