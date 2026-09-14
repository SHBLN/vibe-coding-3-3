import type { Tables } from './database.types'
import { uploadFileToR2, type AttachmentMeta } from './r2Uploads'
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
}

export type CreateTaskCommentPayload = {
  taskId: string
  body: string
  file?: File | null
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

export async function createTaskComment(payload: CreateTaskCommentPayload): Promise<TaskComment> {
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
}

export async function deleteTaskComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('task_comments').delete().eq('id', commentId)

  if (error) throw new Error(error.message)
}
