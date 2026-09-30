import { supabase } from './supabase'
import { mapR2FunctionErrorMessage } from './errorMapping'
import { toResult, type Result, unwrapResult } from './result'

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
] as const

export type AllowedAttachmentMimeType = (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number]

export type PresignedUploadResponse = {
  uploadUrl: string
  publicUrl: string
  objectKey: string
}

export type AttachmentMeta = {
  url: string
  name: string
  size: number
  mime: string
}

function resolveContentType(file: File): string {
  if (file.type) return file.type

  const extension = file.name.split('.').pop()?.toLowerCase()
  const byExtension: Record<string, AllowedAttachmentMimeType> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    pdf: 'application/pdf',
    txt: 'text/plain',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    zip: 'application/zip',
  }

  return byExtension[extension ?? ''] ?? ''
}

export function validateAttachmentFile(file: File): void {
  if (file.size <= 0) {
    throw new Error('Файл пустой.')
  }

  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new Error('Файл слишком большой. Максимум 10 МБ.')
  }

  const contentType = resolveContentType(file)
  if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(contentType as AllowedAttachmentMimeType)) {
    throw new Error('Неподдерживаемый тип файла.')
  }
}

export async function requestPresignedUpload(
  taskId: string,
  file: File,
): Promise<PresignedUploadResponse> {
  const result = await requestPresignedUploadResult(taskId, file)
  return unwrapResult(result)
}

export async function requestPresignedUploadResult(
  taskId: string,
  file: File,
): Promise<Result<PresignedUploadResponse>> {
  return toResult(async () => {
    validateAttachmentFile(file)
    const contentType = resolveContentType(file)

    const { data, error } = await supabase.functions.invoke<PresignedUploadResponse>('r2-upload-url', {
      body: {
        taskId,
        fileName: file.name,
        contentType,
        fileSize: file.size,
      },
    })

    if (error) {
      throw new Error(await mapR2FunctionErrorMessage(error))
    }

    if (!data?.uploadUrl || !data.publicUrl) {
      throw new Error('Сервер вернул некорректный ответ для загрузки.')
    }

    return data
  }, 'Не удалось получить ссылку для загрузки.')
}

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024

const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const

export function validateAvatarFile(file: File): void {
  if (file.size <= 0) {
    throw new Error('Файл пустой.')
  }

  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    throw new Error('Аватар слишком большой. Максимум 2 МБ.')
  }

  const contentType = resolveContentType(file)
  if (!AVATAR_MIME_TYPES.includes(contentType as (typeof AVATAR_MIME_TYPES)[number])) {
    throw new Error('Загрузите изображение: JPEG, PNG, GIF или WebP.')
  }
}

export async function uploadProfileAvatar(file: File): Promise<string> {
  const result = await uploadProfileAvatarResult(file)
  return unwrapResult(result)
}

export async function uploadProfileAvatarResult(file: File): Promise<Result<string>> {
  return toResult(async () => {
    validateAvatarFile(file)
    const contentType = resolveContentType(file)

    const { data, error } = await supabase.functions.invoke<PresignedUploadResponse>('r2-upload-url', {
      body: {
        purpose: 'profile_avatar',
        fileName: file.name,
        contentType,
        fileSize: file.size,
      },
    })

    if (error) {
      throw new Error(await mapR2FunctionErrorMessage(error))
    }

    if (!data?.uploadUrl || !data.publicUrl) {
      throw new Error('Сервер вернул некорректный ответ для загрузки.')
    }

    const uploadResponse = await fetch(data.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: file,
    })

    if (!uploadResponse.ok) {
      throw new Error('Не удалось загрузить аватар.')
    }

    return data.publicUrl
  }, 'Не удалось загрузить аватар.')
}

export async function uploadFileToR2(taskId: string, file: File): Promise<AttachmentMeta> {
  const result = await uploadFileToR2Result(taskId, file)
  return unwrapResult(result)
}

export async function uploadFileToR2Result(taskId: string, file: File): Promise<Result<AttachmentMeta>> {
  return toResult(async () => {
    const { uploadUrl, publicUrl } = await requestPresignedUpload(taskId, file)

    const contentType = resolveContentType(file)

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: file,
    })

    if (!uploadResponse.ok) {
      throw new Error('Не удалось загрузить файл в хранилище.')
    }

    return {
      url: publicUrl,
      name: file.name,
      size: file.size,
      mime: file.type,
    }
  }, 'Не удалось загрузить файл в хранилище.')
}
