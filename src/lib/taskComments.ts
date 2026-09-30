import type { Tables } from './database.types'
import { apiRequest, isPythonApiEnabled } from './apiClient'
import { getAuthUserOrThrow } from './authSession'
import { uploadFileToR2, type AttachmentMeta } from './r2Uploads'
import { toResult, unwrapResult, type Result } from './result'
import { supabase } from './supabase'

export type TaskCommentRow = Tables<'task_comments'>

export type TaskComment = {
  id: string
  taskId: string
  authorId: string
  authorName: string
  body: string
  attachmentUrl: string | null
  attachmentName: string | null
  attachmentSize: number | null
  attachmentMime: string | null
  createdAt: string
}

type TaskCommentWithAuthor = TaskCommentRow & {
  profiles: {
    id: string
    display_name: string
  } | null
}

function mapCommentRow(row: TaskCommentWithAuthor): TaskComment {
  return {
    id: row.id,
    taskId: row.task_id,
    authorId: row.author_id,
    authorName: row.profiles?.display_name ?? 'Пользователь',
    body: row.body,
    attachmentUrl: row.attachment_url,
    attachmentName: row.attachment_name,
    attachmentSize: row.attachment_size,
    attachmentMime: row.attachment_mime,
    createdAt: row.created_at,
  }
}

export async function listTaskComments(taskId: string): Promise<TaskComment[]> {
  return unwrapResult(await listTaskCommentsResult(taskId))
}

export async function listTaskCommentsResult(taskId: string): Promise<Result<TaskComment[]>> {
  return toResult(async () => {
    if (isPythonApiEnabled()) {
      return apiRequest<TaskComment[]>(`/tasks/${taskId}/comments`)
    }

    const { data, error } = await supabase
      .from('task_comments')
      .select(
        `
        id,
        task_id,
        author_id,
        body,
        attachment_url,
        attachment_name,
        attachment_size,
        attachment_mime,
        created_at,
        profiles (
          id,
          display_name
        )
      `,
      )
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })
      .returns<TaskCommentWithAuthor[]>()

    if (error) throw new Error(error.message)

    return (data ?? []).map(mapCommentRow)
  }, 'Не удалось загрузить комментарии.')
}

export type CreateTaskCommentPayload = {
  taskId: string
  body: string
  file?: File | null
}

async function requireUserId(): Promise<string> {
  const user = await getAuthUserOrThrow()
  return user.id
}

export async function createTaskComment(payload: CreateTaskCommentPayload): Promise<TaskComment> {
  return unwrapResult(await createTaskCommentResult(payload))
}

export async function createTaskCommentResult(
  payload: CreateTaskCommentPayload,
): Promise<Result<TaskComment>> {
  return toResult(async () => {
    const trimmedBody = payload.body.trim()
    const file = payload.file ?? null

    if (!trimmedBody && !file) {
      throw new Error('Введите комментарий или прикрепите файл.')
    }

    const authorId = await requireUserId()

    let attachment: AttachmentMeta | null = null
    if (file) {
      attachment = await uploadFileToR2(payload.taskId, file)
    }

    if (isPythonApiEnabled()) {
      return apiRequest<TaskComment>(`/tasks/${payload.taskId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          body: trimmedBody,
          attachmentUrl: attachment?.url ?? null,
          attachmentName: attachment?.name ?? null,
          attachmentSize: attachment?.size ?? null,
          attachmentMime: attachment?.mime ?? null,
        }),
      })
    }

    const { data, error } = await supabase
      .from('task_comments')
      .insert({
        task_id: payload.taskId,
        author_id: authorId,
        body: trimmedBody,
        attachment_url: attachment?.url ?? null,
        attachment_name: attachment?.name ?? null,
        attachment_size: attachment?.size ?? null,
        attachment_mime: attachment?.mime ?? null,
      })
      .select(
        `
        id,
        task_id,
        author_id,
        body,
        attachment_url,
        attachment_name,
        attachment_size,
        attachment_mime,
        created_at,
        profiles (
          id,
          display_name
        )
      `,
      )
      .single()
      .returns<TaskCommentWithAuthor>()

    if (error) throw new Error(error.message)

    return mapCommentRow(data)
  }, 'Не удалось отправить комментарий.')
}

export async function deleteTaskComment(commentId: string): Promise<void> {
  await unwrapResult(await deleteTaskCommentResult(commentId))
}

export async function deleteTaskCommentResult(commentId: string): Promise<Result<void>> {
  return toResult(async () => {
    if (isPythonApiEnabled()) {
      await apiRequest<void>(`/comments/${commentId}`, { method: 'DELETE' })
      return
    }

    const { error } = await supabase.from('task_comments').delete().eq('id', commentId)

    if (error) throw new Error(error.message)
  }, 'Не удалось удалить комментарий.')
}
