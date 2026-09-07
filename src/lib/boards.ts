import type { Json, Tables } from './database.types'
import { supabase } from './supabase'

export type BoardRow = Tables<'boards'>
export type BoardColumnRow = Tables<'board_columns'>

export type BoardColumn = {
  id: string
  title: string
  cards: string[]
}

export type Board = {
  id: string
  title: string
  description: string
  createdAt: string
  updatedAt: string
  columns: BoardColumn[]
}

const DEFAULT_COLUMN_TITLES = ['К выполнению', 'В работе', 'Готово'] as const

function parseCards(value: Json): string[] {
  if (!Array.isArray(value)) return []

  return value.filter((item): item is string => typeof item === 'string')
}

function mapColumnRow(row: BoardColumnRow): BoardColumn {
  return {
    id: row.id,
    title: row.title,
    cards: parseCards(row.cards),
  }
}

function mapBoardRow(row: BoardRow, columns: BoardColumnRow[]): Board {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    columns: [...columns].sort((a, b) => a.position - b.position).map(mapColumnRow),
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

export async function listBoards(): Promise<Board[]> {
  const { data: boardRows, error: boardsError } = await supabase
    .from('boards')
    .select('id, owner_id, title, description, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (boardsError) throw new Error(boardsError.message)
  if (!boardRows || boardRows.length === 0) return []

  const boardIds = boardRows.map((board) => board.id)

  const { data: columnRows, error: columnsError } = await supabase
    .from('board_columns')
    .select('id, board_id, title, position, cards, created_at, updated_at')
    .in('board_id', boardIds)
    .order('position', { ascending: true })

  if (columnsError) throw new Error(columnsError.message)

  const columnsByBoardId = new Map<string, BoardColumnRow[]>()
  for (const column of columnRows ?? []) {
    const existing = columnsByBoardId.get(column.board_id) ?? []
    existing.push(column)
    columnsByBoardId.set(column.board_id, existing)
  }

  return boardRows.map((board) => mapBoardRow(board, columnsByBoardId.get(board.id) ?? []))
}

export async function createBoard(payload: {
  title: string
  description: string
}): Promise<Board> {
  const ownerId = await requireUserId()

  const { data: boardRow, error: boardError } = await supabase
    .from('boards')
    .insert({
      owner_id: ownerId,
      title: payload.title,
      description: payload.description,
    })
    .select('id, owner_id, title, description, created_at, updated_at')
    .single()

  if (boardError) throw new Error(boardError.message)

  const columnInserts = DEFAULT_COLUMN_TITLES.map((title, index) => ({
    board_id: boardRow.id,
    title,
    position: index,
    cards: [] as Json,
  }))

  const { data: columnRows, error: columnsError } = await supabase
    .from('board_columns')
    .insert(columnInserts)
    .select('id, board_id, title, position, cards, created_at, updated_at')

  if (columnsError) throw new Error(columnsError.message)

  return mapBoardRow(boardRow, columnRows ?? [])
}

export async function updateBoard(
  boardId: string,
  payload: { title: string; description: string },
): Promise<Board> {
  const { data: boardRow, error: boardError } = await supabase
    .from('boards')
    .update({
      title: payload.title,
      description: payload.description,
    })
    .eq('id', boardId)
    .select('id, owner_id, title, description, created_at, updated_at')
    .single()

  if (boardError) throw new Error(boardError.message)

  const { data: columnRows, error: columnsError } = await supabase
    .from('board_columns')
    .select('id, board_id, title, position, cards, created_at, updated_at')
    .eq('board_id', boardId)
    .order('position', { ascending: true })

  if (columnsError) throw new Error(columnsError.message)

  return mapBoardRow(boardRow, columnRows ?? [])
}

export async function deleteBoard(boardId: string): Promise<void> {
  const { error } = await supabase.from('boards').delete().eq('id', boardId)

  if (error) throw new Error(error.message)
}
