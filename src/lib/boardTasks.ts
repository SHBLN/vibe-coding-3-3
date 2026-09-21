import type { Json, Tables } from './database.types'
import { fetchBoardMemberIds } from './boardMembers'
import { getProfileInitials } from './profiles'
import { supabase } from './supabase'
import {
  BACKLOG_STATUS_KEY,
  type BoardTask,
  type BoardViewColumn,
  type BoardViewData,
  type TaskKind,
  type TaskPriority,
  type TaskStatus,
} from '../mocks/boardViewMock'

export type TaskRow = Tables<'tasks'>
export type BoardColumnRow = Tables<'board_columns'>
export type BoardRow = Tables<'boards'>

export { BACKLOG_STATUS_KEY }

type TaskAssigneeJoin = {
  profile_id: string
  profiles: {
    id: string
    display_name: string
  } | null
}

type TaskWithAssignees = TaskRow & {
  task_assignees: TaskAssigneeJoin[]
}

function parseCards(value: Json): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function parseTags(value: Json): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function isTaskKind(value: string): value is TaskKind {
  return value === 'task' || value === 'epic'
}

function isTaskPriority(value: string): value is TaskPriority {
  return value === 'low' || value === 'medium' || value === 'high'
}

function normalizeTaskPriority(value: string | null | undefined): TaskPriority {
  if (value && isTaskPriority(value)) return value
  return 'medium'
}

function slugifyStatusKey(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)

  return base || 'column'
}

function uniqueStatusKey(title: string, existingKeys: Set<string>): string {
  const base = slugifyStatusKey(title)
  if (!existingKeys.has(base)) return base

  let index = 2
  while (existingKeys.has(`${base}_${index}`)) {
    index += 1
  }

  return `${base}_${index}`
}

function mapTaskRow(row: TaskWithAssignees, parentTitles: Map<string, string>): BoardTask {
  const assigneeIds = row.task_assignees.map((item) => item.profile_id)
  const assigneeNames = row.task_assignees
    .map((item) => item.profiles?.display_name ?? null)
    .filter((name): name is string => Boolean(name))
  const primaryName = assigneeNames[0] ?? null

  return {
    id: row.id,
    title: row.title,
    status: row.status,
    kind: isTaskKind(row.kind) ? row.kind : 'task',
    priority: normalizeTaskPriority(row.priority),
    description: row.description,
    assigneeId: assigneeIds[0] ?? null,
    assigneeIds,
    assigneeName: primaryName,
    assigneeNames,
    assigneeInitials: primaryName ? getProfileInitials(primaryName) : null,
    dueAt: row.due_at,
    parentTitle: row.parent_id ? parentTitles.get(row.parent_id) : undefined,
    tags: parseTags(row.tags),
  }
}

function mapColumnRow(column: BoardColumnRow, tasks: BoardTask[]): BoardViewColumn {
  const statusKey = column.status_key

  return {
    id: column.id,
    title: column.title,
    statusKey,
    status: statusKey,
    tasks,
  }
}

function buildColumns(
  columnRows: BoardColumnRow[],
  taskRows: TaskWithAssignees[],
): BoardViewColumn[] {
  const parentTitles = new Map(taskRows.map((task) => [task.id, task.title]))
  const tasksByColumnId = new Map<string, BoardTask[]>()

  for (const column of columnRows) {
    tasksByColumnId.set(column.id, [])
  }

  for (const taskRow of [...taskRows].sort((a, b) => a.position - b.position)) {
    const mappedTask = mapTaskRow(taskRow, parentTitles)
    const columnTasks = tasksByColumnId.get(taskRow.column_id)
    if (columnTasks) {
      columnTasks.push(mappedTask)
    }
  }

  return [...columnRows]
    .sort((a, b) => a.position - b.position)
    .map((column) => mapColumnRow(column, tasksByColumnId.get(column.id) ?? []))
}

async function fetchTaskRows(boardId: string): Promise<TaskWithAssignees[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(
      `
      id,
      board_id,
      column_id,
      title,
      status,
      kind,
      priority,
      description,
      due_at,
      parent_id,
      position,
      tags,
      created_at,
      updated_at,
      task_assignees (
        profile_id,
        profiles (
          id,
          display_name
        )
      )
    `,
    )
    .eq('board_id', boardId)
    .order('position', { ascending: true })
    .returns<TaskWithAssignees[]>()

  if (error) throw new Error(error.message)
  return data ?? []
}

async function fetchColumnRows(boardId: string): Promise<BoardColumnRow[]> {
  const { data, error } = await supabase
    .from('board_columns')
    .select('id, board_id, title, position, status_key, cards, created_at, updated_at')
    .eq('board_id', boardId)
    .order('position', { ascending: true })
    .returns<BoardColumnRow[]>()

  if (error) throw new Error(error.message)
  return data ?? []
}

async function seedTasksFromLegacyCards(
  boardId: string,
  columnRows: BoardColumnRow[],
): Promise<void> {
  const { count, error: countError } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('board_id', boardId)

  if (countError) throw new Error(countError.message)
  if ((count ?? 0) > 0) return

  const inserts = [...columnRows]
    .sort((a, b) => a.position - b.position)
    .flatMap((column) => {
      const cards = parseCards(column.cards)
      const status = column.status_key

      return cards.map((title, index) => ({
        board_id: boardId,
        column_id: column.id,
        title,
        status,
        kind: 'task' as const,
        position: index,
        tags: [] as Json,
      }))
    })

  if (inserts.length === 0) return

  const { error: insertError } = await supabase.from('tasks').insert(inserts)
  if (insertError) throw new Error(insertError.message)
}

export async function fetchBoardView(boardId: string): Promise<BoardViewData | null> {
  const { data: boardRow, error: boardError } = await supabase
    .from('boards')
    .select('id, title, description, updated_at')
    .eq('id', boardId)
    .maybeSingle()
    .returns<Pick<BoardRow, 'id' | 'title' | 'description' | 'updated_at'>>()

  if (boardError) throw new Error(boardError.message)
  if (!boardRow) return null

  const columnRows = await fetchColumnRows(boardId)
  if (columnRows.length === 0) return null

  await seedTasksFromLegacyCards(boardId, columnRows)

  const taskRows = await fetchTaskRows(boardId)

  const memberIds = await fetchBoardMemberIds(boardId)

  return {
    id: boardRow.id,
    title: boardRow.title,
    description: boardRow.description,
    updatedAt: boardRow.updated_at,
    memberIds,
    columns: buildColumns(columnRows, taskRows),
  }
}

export async function saveBoardColumnsState(
  boardId: string,
  columns: BoardViewColumn[],
): Promise<void> {
  const updates = columns.flatMap((column) =>
    column.tasks.map((task, index) => ({
      id: task.id,
      column_id: column.id,
      status: column.statusKey,
      position: index,
    })),
  )

  for (const update of updates) {
    const { error } = await supabase
      .from('tasks')
      .update({
        column_id: update.column_id,
        status: update.status,
        position: update.position,
      })
      .eq('id', update.id)
      .eq('board_id', boardId)

    if (error) throw new Error(error.message)
  }
}

export async function reindexBoardColumns(
  boardId: string,
  orderedColumnIds: string[],
): Promise<void> {
  for (let index = 0; index < orderedColumnIds.length; index += 1) {
    const { error } = await supabase
      .from('board_columns')
      .update({ position: index })
      .eq('id', orderedColumnIds[index])
      .eq('board_id', boardId)

    if (error) throw new Error(error.message)
  }
}

export async function createBoardColumn(
  boardId: string,
  title: string,
): Promise<BoardViewColumn> {
  const trimmed = title.trim()
  if (!trimmed) throw new Error('Название колонки обязательно.')

  const existingColumns = await fetchColumnRows(boardId)
  const existingKeys = new Set(existingColumns.map((column) => column.status_key))
  const statusKey = uniqueStatusKey(trimmed, existingKeys)
  const nextPosition = existingColumns.length

  const { data, error } = await supabase
    .from('board_columns')
    .insert({
      board_id: boardId,
      title: trimmed,
      status_key: statusKey,
      position: nextPosition,
      cards: [] as Json,
    })
    .select('id, board_id, title, position, status_key, cards, created_at, updated_at')
    .single()
    .returns<BoardColumnRow>()

  if (error) throw new Error(error.message)

  return mapColumnRow(data, [])
}

export async function updateBoardColumn(
  columnId: string,
  title: string,
): Promise<{ id: string; title: string }> {
  const trimmed = title.trim()
  if (!trimmed) throw new Error('Название колонки обязательно.')

  const { data, error } = await supabase
    .from('board_columns')
    .update({ title: trimmed })
    .eq('id', columnId)
    .select('id, title')
    .single()
    .returns<{ id: string; title: string }>()

  if (error) throw new Error(error.message)

  return data
}

export async function deleteBoardColumn(
  boardId: string,
  columnId: string,
  columns: BoardViewColumn[],
): Promise<BoardViewColumn[]> {
  const columnToDelete = columns.find((column) => column.id === columnId)
  if (!columnToDelete) throw new Error('Колонка не найдена.')
  if (columnToDelete.statusKey === BACKLOG_STATUS_KEY) {
    throw new Error('Колонку Backlog нельзя удалить.')
  }

  const backlogColumn = columns.find((column) => column.statusKey === BACKLOG_STATUS_KEY)
  if (!backlogColumn) throw new Error('Колонка Backlog не найдена.')

  const backlogStartPosition = backlogColumn.tasks.length

  for (let index = 0; index < columnToDelete.tasks.length; index += 1) {
    const task = columnToDelete.tasks[index]
    const { error } = await supabase
      .from('tasks')
      .update({
        column_id: backlogColumn.id,
        status: backlogColumn.statusKey,
        position: backlogStartPosition + index,
      })
      .eq('id', task.id)
      .eq('board_id', boardId)

    if (error) throw new Error(error.message)
  }

  const { error: deleteError } = await supabase
    .from('board_columns')
    .delete()
    .eq('id', columnId)
    .eq('board_id', boardId)

  if (deleteError) throw new Error(deleteError.message)

  const remainingColumns = columns.filter((column) => column.id !== columnId)
  await reindexBoardColumns(
    boardId,
    remainingColumns.map((column) => column.id),
  )

  const movedTasks = columnToDelete.tasks.map((task) => ({
    ...task,
    status: backlogColumn.statusKey,
  }))

  return remainingColumns.map((column) => {
    if (column.id === backlogColumn.id) {
      return {
        ...column,
        tasks: [...column.tasks, ...movedTasks],
      }
    }

    return column
  })
}

export type CreateTaskPayload = {
  boardId: string
  columnId: string
  status: TaskStatus
  title: string
  priority?: TaskPriority
  description?: string | null
  dueAt?: string | null
  assigneeIds?: string[]
}

export type UpdateTaskPayload = {
  taskId: string
  boardId: string
  title: string
  priority?: TaskPriority
  description?: string | null
  dueAt?: string | null
  assigneeIds?: string[]
}

async function fetchTaskById(taskId: string, boardId: string): Promise<BoardTask> {
  const { data, error } = await supabase
    .from('tasks')
    .select(
      `
      id,
      board_id,
      column_id,
      title,
      status,
      kind,
      priority,
      description,
      due_at,
      parent_id,
      position,
      tags,
      created_at,
      updated_at,
      task_assignees (
        profile_id,
        profiles (
          id,
          display_name
        )
      )
    `,
    )
    .eq('id', taskId)
    .eq('board_id', boardId)
    .maybeSingle()
    .returns<TaskWithAssignees>()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Задача не найдена.')

  const parentTitles = new Map([[data.id, data.title]])
  return mapTaskRow(data, parentTitles)
}

async function normalizeColumnPositions(
  boardId: string,
  columnId: string,
  status: TaskStatus,
  orderedTaskIds: string[],
): Promise<void> {
  for (let index = 0; index < orderedTaskIds.length; index += 1) {
    const { error } = await supabase
      .from('tasks')
      .update({
        position: index,
        status,
        column_id: columnId,
      })
      .eq('id', orderedTaskIds[index])
      .eq('board_id', boardId)

    if (error) throw new Error(error.message)
  }
}

export async function createTask(payload: CreateTaskPayload): Promise<BoardTask> {
  const {
    boardId,
    columnId,
    status,
    title,
    priority = 'medium',
    description = null,
    dueAt = null,
    assigneeIds = [],
  } = payload

  const { count, error: countError } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('board_id', boardId)
    .eq('column_id', columnId)

  if (countError) throw new Error(countError.message)

  const { data: row, error: insertError } = await supabase
    .from('tasks')
    .insert({
      board_id: boardId,
      column_id: columnId,
      title,
      status,
      kind: 'task',
      priority,
      description,
      due_at: dueAt,
      position: count ?? 0,
      tags: [] as Json,
    })
    .select('id')
    .single()
    .returns<{ id: string }>()

  if (insertError) throw new Error(insertError.message)

  if (assigneeIds.length > 0) {
    await syncTaskAssignees(row.id, assigneeIds)
  }

  return fetchTaskById(row.id, boardId)
}

export async function updateTask(payload: UpdateTaskPayload): Promise<BoardTask> {
  const {
    taskId,
    boardId,
    title,
    priority = 'medium',
    description = null,
    dueAt = null,
    assigneeIds = [],
  } = payload

  const { error: updateError } = await supabase
    .from('tasks')
    .update({
      title,
      priority,
      description,
      due_at: dueAt,
    })
    .eq('id', taskId)
    .eq('board_id', boardId)

  if (updateError) throw new Error(updateError.message)

  await syncTaskAssignees(taskId, assigneeIds)

  return fetchTaskById(taskId, boardId)
}

export async function deleteTask(
  taskId: string,
  boardId: string,
  columnId: string,
  status: TaskStatus,
  remainingTaskIds: string[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('board_id', boardId)

  if (deleteError) throw new Error(deleteError.message)

  await normalizeColumnPositions(boardId, columnId, status, remainingTaskIds)
}

export async function deleteTasks(
  boardId: string,
  taskIds: string[],
  columns: BoardViewColumn[],
): Promise<void> {
  if (taskIds.length === 0) return

  const idsToDelete = new Set(taskIds)

  const { error: deleteError } = await supabase
    .from('tasks')
    .delete()
    .eq('board_id', boardId)
    .in('id', [...idsToDelete])

  if (deleteError) throw new Error(deleteError.message)

  const affectedColumnIds = new Set<string>()
  for (const column of columns) {
    if (column.tasks.some((task) => idsToDelete.has(task.id))) {
      affectedColumnIds.add(column.id)
    }
  }

  for (const columnId of affectedColumnIds) {
    const column = columns.find((item) => item.id === columnId)
    if (!column) continue

    const remainingTaskIds = column.tasks
      .filter((task) => !idsToDelete.has(task.id))
      .map((task) => task.id)

    await normalizeColumnPositions(boardId, columnId, column.statusKey, remainingTaskIds)
  }
}

export async function syncTaskAssignees(taskId: string, assigneeIds: string[]): Promise<void> {
  const { data: existingRows, error: existingError } = await supabase
    .from('task_assignees')
    .select('profile_id')
    .eq('task_id', taskId)
    .returns<Array<{ profile_id: string }>>()

  if (existingError) throw new Error(existingError.message)

  const existingIds = new Set((existingRows ?? []).map((row) => row.profile_id))
  const nextIds = new Set(assigneeIds)

  const toDelete = [...existingIds].filter((id) => !nextIds.has(id))
  const toInsert = [...nextIds]
    .filter((id) => !existingIds.has(id))
    .map((profileId) => ({ task_id: taskId, profile_id: profileId }))

  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('task_assignees')
      .delete()
      .eq('task_id', taskId)
      .in('profile_id', toDelete)

    if (deleteError) throw new Error(deleteError.message)
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from('task_assignees').insert(toInsert)
    if (insertError) throw new Error(insertError.message)
  }
}
