import { createClient } from 'npm:@supabase/supabase-js@2'
import { PutObjectCommand, S3Client } from 'npm:@aws-sdk/client-s3@3'
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

const ALLOWED_MIME_TYPES = new Set([
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
])

type UploadRequest = {
  taskId?: string
  purpose?: 'task_attachment' | 'profile_avatar'
  fileName?: string
  contentType?: string
  fileSize?: number
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

function sanitizeFileName(fileName: string): string {
  const baseName = fileName.split(/[/\\]/).pop() ?? 'file'
  const sanitized = baseName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120)
  return sanitized || 'file'
}

function buildTaskObjectKey(taskId: string, fileName: string): string {
  const safeName = sanitizeFileName(fileName)
  const randomPart = crypto.randomUUID().slice(0, 8)
  return `tasks/${taskId}/${Date.now()}-${randomPart}-${safeName}`
}

function buildProfileAvatarObjectKey(userId: string, fileName: string): string {
  const safeName = sanitizeFileName(fileName)
  const randomPart = crypto.randomUUID().slice(0, 8)
  return `profiles/${userId}/avatar/${Date.now()}-${randomPart}-${safeName}`
}

const PROFILE_AVATAR_MAX_BYTES = 2 * 1024 * 1024

const PROFILE_AVATAR_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
])

function buildPublicUrl(baseUrl: string, objectKey: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '')
  return `${normalizedBase}/${objectKey}`
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
  const accountId = Deno.env.get('R2_ACCOUNT_ID')
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
  const bucketName = Deno.env.get('R2_BUCKET_NAME')
  const publicBaseUrl = Deno.env.get('R2_PUBLIC_BASE_URL')

  const missingKeys: string[] = []
  if (!supabaseUrl) missingKeys.push('SUPABASE_URL')
  if (!supabaseAnonKey) missingKeys.push('SUPABASE_ANON_KEY')
  if (!accountId) missingKeys.push('R2_ACCOUNT_ID')
  if (!accessKeyId) missingKeys.push('R2_ACCESS_KEY_ID')
  if (!secretAccessKey) missingKeys.push('R2_SECRET_ACCESS_KEY')
  if (!bucketName) missingKeys.push('R2_BUCKET_NAME')
  if (!publicBaseUrl) missingKeys.push('R2_PUBLIC_BASE_URL')

  if (missingKeys.length > 0) {
    return jsonResponse(
      {
        error: 'Server storage is not configured',
        missingKeys,
      },
      500,
    )
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  let payload: UploadRequest
  try {
    payload = (await req.json()) as UploadRequest
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const { taskId, purpose = 'task_attachment', fileName, contentType, fileSize } = payload

  if (!fileName || !contentType || typeof fileSize !== 'number') {
    return jsonResponse({ error: 'fileName, contentType and fileSize are required' }, 400)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  })

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    return jsonResponse({ error: userError.message }, 500)
  }

  if (!user) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  let objectKey: string

  if (purpose === 'profile_avatar') {
    if (fileSize <= 0 || fileSize > PROFILE_AVATAR_MAX_BYTES) {
      return jsonResponse(
        { error: `Avatar size must be between 1 byte and ${PROFILE_AVATAR_MAX_BYTES} bytes` },
        400,
      )
    }

    if (!PROFILE_AVATAR_MIME_TYPES.has(contentType)) {
      return jsonResponse({ error: 'Avatar must be an image (jpeg, png, gif, webp)' }, 400)
    }

    objectKey = buildProfileAvatarObjectKey(user.id, fileName)
  } else {
    if (!taskId) {
      return jsonResponse({ error: 'taskId is required for task attachments' }, 400)
    }

    if (fileSize <= 0 || fileSize > MAX_FILE_SIZE_BYTES) {
      return jsonResponse(
        { error: `File size must be between 1 byte and ${MAX_FILE_SIZE_BYTES} bytes` },
        400,
      )
    }

    if (!ALLOWED_MIME_TYPES.has(contentType)) {
      return jsonResponse({ error: 'Unsupported file type' }, 400)
    }

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id')
      .eq('id', taskId)
      .maybeSingle()

    if (taskError) {
      return jsonResponse({ error: taskError.message }, 500)
    }

    if (!task) {
      return jsonResponse({ error: 'Task not found or access denied' }, 403)
    }

    objectKey = buildTaskObjectKey(taskId, fileName)
  }

  const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
    ContentType: contentType,
  })

  try {
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 })
    const publicUrl = buildPublicUrl(publicBaseUrl!, objectKey)

    return jsonResponse({
      uploadUrl,
      publicUrl,
      objectKey,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create upload URL'
    return jsonResponse({ error: message }, 500)
  }
})
