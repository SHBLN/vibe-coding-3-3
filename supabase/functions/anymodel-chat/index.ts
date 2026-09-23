import { createClient } from 'npm:@supabase/supabase-js@2'
import { type AnyModelConfig, callAnyModelChat, readAnyModelConfig } from '../_shared/anymodel.ts'
import { getAiSplitDenialReason } from '../_shared/planLimits.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-telegram-internal-secret',
}

const DONE_STATUS = 'done'
const DEFAULT_UNSELECTED_ROLE = 'Team Member'

const IT_ROLES = [
  'Frontend разработчик',
  'Backend разработчик',
  'Fullstack разработчик',
  'QA инженер',
  'DevOps инженер',
  'Product Manager',
  'UI/UX дизайнер',
  'Team Lead',
] as const

type ProfileRow = {
  id: string
  display_name: string
  role: string
}

type TaskRow = {
  id: string
  board_id: string
  column_id: string
  title: string
  status: string
  kind: string
  priority: string
  description: string | null
  due_at: string | null
  parent_id: string | null
  position: number
  created_at: string
  updated_at: string
}

type SplitGlobalTaskRequest = {
  boardId?: string
  columnId?: string
  status?: string
  title?: string
  description?: string
  dueAt?: string | null
  profileId?: string
}

type AiSubtask = {
  title: string
  description?: string
  target_role: string
  priority?: 'low' | 'medium' | 'high'
  due_at?: string | null
}

type AiSplitResponse = {
  subtasks: AiSubtask[]
}

type CreatedSubtask = {
  task: TaskRow
  assigneeId: string
  assigneeName: string
  targetRole: string
  matchedRole: boolean
}

type SplitResult = {
  epic: TaskRow
  subtasks: CreatedSubtask[]
  boardTasks: Array<Record<string, unknown>>
  backlogColumnId: string
  backlogStatus: string
  unmatchedRoles: string[]
  warnings: string[]
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function normalizeRole(value: string): string {
  return value.trim().toLowerCase()
}

function isValidPriority(value: unknown): value is 'low' | 'medium' | 'high' {
  return value === 'low' || value === 'medium' || value === 'high'
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1]?.trim() ?? trimmed

  try {
    return JSON.parse(candidate)
  } catch {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1))
    }
    throw new Error('Model response is not valid JSON')
  }
}

function buildSystemPrompt(profiles: ProfileRow[]): string {
  const teamLines = profiles
    .filter((profile) => profile.role !== DEFAULT_UNSELECTED_ROLE)
    .map((profile) => `- ${profile.display_name}: ${profile.role}`)
    .join('\n')

  return [
    'Ты планировщик задач для IT-команды.',
    'Разбей глобальную задачу на 3-8 конкретных подзадач.',
    'Для каждой подзадачи выбери target_role строго из списка доступных ролей.',
    'Верни ТОЛЬКО JSON без markdown и пояснений.',
    'Формат ответа:',
    '{"subtasks":[{"title":"...","description":"...","target_role":"Backend разработчик","priority":"medium","due_at":null}]}',
    '',
    'Доступные роли:',
    IT_ROLES.map((role) => `- ${role}`).join('\n'),
    '',
    'Команда:',
    teamLines || '- команда пока не заполнена, используй роли из списка',
  ].join('\n')
}

function buildUserPrompt(payload: SplitGlobalTaskRequest): string {
  const parts = [`Глобальная задача: ${payload.title}`]
  if (payload.description) parts.push(`Описание: ${payload.description}`)
  if (payload.dueAt) parts.push(`Общий дедлайн эпика: ${payload.dueAt}`)
  parts.push('Сформируй подзадачи с учетом ролей команды и распредели работу по специализациям.')
  return parts.join('\n')
}

function parseAiSplitResponse(content: string): AiSplitResponse {
  const parsed = extractJsonObject(content) as Partial<AiSplitResponse>
  if (!parsed || !Array.isArray(parsed.subtasks) || parsed.subtasks.length === 0) {
    throw new Error('Model returned empty or invalid subtasks array')
  }

  const subtasks: AiSubtask[] = []
  for (const item of parsed.subtasks) {
    if (!item || typeof item !== 'object') continue
    const candidate = item as Record<string, unknown>
    const title = typeof candidate.title === 'string' ? candidate.title.trim() : ''
    const targetRole = typeof candidate.target_role === 'string' ? candidate.target_role.trim() : ''
    if (!title || !targetRole) continue

    subtasks.push({
      title,
      description: typeof candidate.description === 'string' ? candidate.description.trim() : undefined,
      target_role: targetRole,
      priority: isValidPriority(candidate.priority) ? candidate.priority : 'medium',
      due_at: typeof candidate.due_at === 'string' ? candidate.due_at : null,
    })
  }

  if (subtasks.length === 0) {
    throw new Error('Model returned no valid subtasks')
  }

  return { subtasks }
}

function buildWorkloadMap(
  profiles: ProfileRow[],
  rows: Array<{ profile_id: string; tasks: { status: string } | null }>,
): Map<string, number> {
  const workload = new Map<string, number>()
  for (const profile of profiles) {
    workload.set(profile.id, 0)
  }

  for (const row of rows) {
    if (!row.tasks || row.tasks.status === DONE_STATUS) continue
    workload.set(row.profile_id, (workload.get(row.profile_id) ?? 0) + 1)
  }

  return workload
}

function pickAssignee(
  targetRole: string,
  profiles: ProfileRow[],
  workload: Map<string, number>,
): { profile: ProfileRow; matchedRole: boolean } {
  const eligibleProfiles = profiles.filter((profile) => profile.role !== DEFAULT_UNSELECTED_ROLE)
  if (eligibleProfiles.length === 0) {
    throw new Error('No eligible profiles found for assignment')
  }

  const normalizedTarget = normalizeRole(targetRole)
  const roleMatches = eligibleProfiles.filter((profile) => normalizeRole(profile.role) === normalizedTarget)

  const candidates = roleMatches.length > 0 ? roleMatches : eligibleProfiles
  const sorted = [...candidates].sort((left, right) => {
    const leftLoad = workload.get(left.id) ?? 0
    const rightLoad = workload.get(right.id) ?? 0
    if (leftLoad !== rightLoad) return leftLoad - rightLoad
    return left.display_name.localeCompare(right.display_name, 'ru')
  })

  const selected = sorted[0]
  workload.set(selected.id, (workload.get(selected.id) ?? 0) + 1)

  return {
    profile: selected,
    matchedRole: roleMatches.length > 0,
  }
}

async function getNextPosition(
  supabase: ReturnType<typeof createClient>,
  boardId: string,
  columnId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('board_id', boardId)
    .eq('column_id', columnId)

  if (error) throw new Error(error.message)
  return count ?? 0
}

async function rollbackCreatedTasks(
  supabase: ReturnType<typeof createClient>,
  taskIds: string[],
): Promise<void> {
  if (taskIds.length === 0) return
  await supabase.from('tasks').delete().in('id', taskIds)
}

async function resolveBacklogColumn(
  supabase: ReturnType<typeof createClient>,
  boardId: string,
  columnId?: string,
  status?: string,
): Promise<{ columnId: string; status: string }> {
  let resolvedColumnId = columnId
  let resolvedStatus = status

  if (!resolvedColumnId || !resolvedStatus) {
    const { data: backlogColumn, error: backlogError } = await supabase
      .from('board_columns')
      .select('id, status_key')
      .eq('board_id', boardId)
      .eq('status_key', 'backlog')
      .maybeSingle()

    if (backlogError) throw new Error(backlogError.message)
    if (!backlogColumn) throw new Error('Backlog column not found on this board')

    resolvedColumnId = backlogColumn.id
    resolvedStatus = backlogColumn.status_key
  }

  const { data: column, error: columnError } = await supabase
    .from('board_columns')
    .select('id, status_key')
    .eq('id', resolvedColumnId)
    .eq('board_id', boardId)
    .maybeSingle()

  if (columnError) throw new Error(columnError.message)
  if (!column) throw new Error('Column not found on this board')

  return { columnId: column.id, status: column.status_key }
}

async function splitGlobalTask(
  supabase: ReturnType<typeof createClient>,
  payload: SplitGlobalTaskRequest,
  anyModelConfig: AnyModelConfig,
): Promise<SplitResult> {
  const { boardId, columnId, status, title, description, dueAt } = payload
  if (!boardId || !title?.trim()) {
    throw new Error('boardId and title are required')
  }

  const { columnId: resolvedColumnId, status: resolvedStatus } = await resolveBacklogColumn(
    supabase,
    boardId,
    columnId,
    status,
  )

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, display_name, role')
    .returns<ProfileRow[]>()

  if (profilesError) throw new Error(profilesError.message)

  const eligibleProfiles = (profiles ?? []).filter((profile) => profile.role !== DEFAULT_UNSELECTED_ROLE)
  if (eligibleProfiles.length === 0) {
    throw new Error('No profiles with selected roles found')
  }

  const { data: assigneeRows, error: workloadError } = await supabase
    .from('task_assignees')
    .select('profile_id, tasks(status)')
    .returns<Array<{ profile_id: string; tasks: { status: string } | null }>>()

  if (workloadError) throw new Error(workloadError.message)

  const workload = buildWorkloadMap(eligibleProfiles, assigneeRows ?? [])
  const warnings: string[] = []
  const unmatchedRoles: string[] = []

  const aiContent = await callAnyModelChat(
    anyModelConfig,
    buildSystemPrompt(eligibleProfiles),
    buildUserPrompt({ ...payload, title: title.trim() }),
  )
  const aiSplit = parseAiSplitResponse(aiContent)

  const createdTaskIds: string[] = []
  let epic: TaskRow | null = null
  const createdSubtasks: CreatedSubtask[] = []

  try {
    const epicPosition = await getNextPosition(supabase, boardId, resolvedColumnId)
    const { data: epicRow, error: epicError } = await supabase
      .from('tasks')
      .insert({
        board_id: boardId,
        column_id: resolvedColumnId,
        title: title.trim(),
        status: resolvedStatus,
        kind: 'epic',
        priority: 'high',
        description: description?.trim() ?? null,
        due_at: dueAt ?? null,
        position: epicPosition,
        tags: [],
      })
      .select('*')
      .single()
      .returns<TaskRow>()

    if (epicError || !epicRow) {
      throw new Error(epicError?.message ?? 'Failed to create epic')
    }

    epic = epicRow
    createdTaskIds.push(epicRow.id)

    for (const [index, subtask] of aiSplit.subtasks.entries()) {
      const { profile, matchedRole } = pickAssignee(subtask.target_role, eligibleProfiles, workload)
      if (!matchedRole) {
        unmatchedRoles.push(subtask.target_role)
        warnings.push(
          `Role "${subtask.target_role}" not found; assigned "${profile.display_name}" (${profile.role})`,
        )
      }

      const subtaskPosition = epicPosition + index + 1
      const { data: taskRow, error: taskError } = await supabase
        .from('tasks')
        .insert({
          board_id: boardId,
          column_id: resolvedColumnId,
          title: subtask.title,
          status: resolvedStatus,
          kind: 'task',
          priority: subtask.priority ?? 'medium',
          description: subtask.description ?? null,
          due_at: subtask.due_at ?? dueAt ?? null,
          parent_id: epicRow.id,
          position: subtaskPosition,
          tags: [],
        })
        .select('*')
        .single()
        .returns<TaskRow>()

      if (taskError || !taskRow) {
        throw new Error(taskError?.message ?? `Failed to create subtask "${subtask.title}"`)
      }

      createdTaskIds.push(taskRow.id)

      const { error: assigneeError } = await supabase
        .from('task_assignees')
        .insert({
          task_id: taskRow.id,
          profile_id: profile.id,
        })

      if (assigneeError) throw new Error(assigneeError.message)

      createdSubtasks.push({
        task: taskRow,
        assigneeId: profile.id,
        assigneeName: profile.display_name,
        targetRole: subtask.target_role,
        matchedRole,
      })
    }
  } catch (err) {
    await rollbackCreatedTasks(supabase, createdTaskIds)
    throw err
  }

  const boardTasks = [
    {
      id: epic!.id,
      title: epic!.title,
      status: epic!.status,
      kind: epic!.kind,
      priority: epic!.priority,
      description: epic!.description,
      dueAt: epic!.due_at,
      parentId: epic!.parent_id,
      assigneeId: null,
      assigneeName: null,
    },
    ...createdSubtasks.map((entry) => ({
      id: entry.task.id,
      title: entry.task.title,
      status: entry.task.status,
      kind: entry.task.kind,
      priority: entry.task.priority,
      description: entry.task.description,
      dueAt: entry.task.due_at,
      parentId: entry.task.parent_id,
      assigneeId: entry.assigneeId,
      assigneeName: entry.assigneeName,
      parentTitle: epic!.title,
    })),
  ]

  return {
    epic: epic!,
    subtasks: createdSubtasks,
    boardTasks,
    backlogColumnId: resolvedColumnId,
    backlogStatus: resolvedStatus,
    unmatchedRoles: [...new Set(unmatchedRoles)],
    warnings,
  }
}

function isTelegramInternalRequest(req: Request): boolean {
  const internalSecret = Deno.env.get('TELEGRAM_INTERNAL_SECRET')
  if (!internalSecret) return false
  return req.headers.get('x-telegram-internal-secret') === internalSecret
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anyModelEnv = readAnyModelConfig()

  const missingKeys: string[] = []
  if (!supabaseUrl) missingKeys.push('SUPABASE_URL')
  if (!supabaseAnonKey) missingKeys.push('SUPABASE_ANON_KEY')
  if ('missingKeys' in anyModelEnv) missingKeys.push(...anyModelEnv.missingKeys)

  if (missingKeys.length > 0) {
    return jsonResponse({ error: 'Server is not configured', missingKeys }, 500)
  }

  const anyModelConfig = anyModelEnv as AnyModelConfig

  let payload: SplitGlobalTaskRequest
  try {
    payload = (await req.json()) as SplitGlobalTaskRequest
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const { boardId, title, profileId } = payload
  if (!boardId || !title?.trim()) {
    return jsonResponse({ error: 'boardId and title are required' }, 400)
  }

  const telegramMode = isTelegramInternalRequest(req)

  if (telegramMode) {
    if (!supabaseServiceRoleKey) {
      return jsonResponse({ error: 'Server is not configured', missingKeys: ['SUPABASE_SERVICE_ROLE_KEY'] }, 500)
    }
    if (!profileId) {
      return jsonResponse({ error: 'profileId is required for Telegram mode' }, 400)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('id, owner_id, title')
      .eq('id', boardId)
      .maybeSingle()

    if (boardError) return jsonResponse({ error: boardError.message }, 500)
    if (!board || board.owner_id !== profileId) {
      return jsonResponse({ error: 'Board not found or access denied' }, 403)
    }

    const aiDenial = await getAiSplitDenialReason(supabase, board.owner_id)
    if (aiDenial) {
      return jsonResponse({ error: aiDenial, code: 'ai_split_plan_required' }, 403)
    }

    try {
      const result = await splitGlobalTask(supabase, payload, anyModelConfig)
      return jsonResponse({ ...result, boardTitle: board.title, source: 'telegram' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to split task with AI'
      const status = message.includes('No profiles with selected roles') ? 422 : message.includes('AnyModel') || message.includes('Model') ? 502 : 500
      return jsonResponse({ error: message }, status)
    }
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  })

  const { data: board, error: boardError } = await supabase
    .from('boards')
    .select('id, owner_id')
    .eq('id', boardId)
    .maybeSingle()

  if (boardError) return jsonResponse({ error: boardError.message }, 500)
  if (!board) return jsonResponse({ error: 'Board not found or access denied' }, 403)

  if (!supabaseServiceRoleKey) {
    return jsonResponse({ error: 'Server is not configured', missingKeys: ['SUPABASE_SERVICE_ROLE_KEY'] }, 500)
  }

  const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey)
  const aiDenial = await getAiSplitDenialReason(adminSupabase, board.owner_id)
  if (aiDenial) {
    return jsonResponse({ error: aiDenial, code: 'ai_split_plan_required' }, 403)
  }

  try {
    const result = await splitGlobalTask(supabase, payload, anyModelConfig)
    return jsonResponse({ ...result, source: 'web' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to split task with AI'
    const status = message.includes('No profiles with selected roles') ? 422 : message.includes('AnyModel') || message.includes('Model') ? 502 : 500
    return jsonResponse({ error: message, rolledBack: message.includes('Failed to create') }, status)
  }
})
