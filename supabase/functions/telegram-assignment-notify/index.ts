import { createClient } from 'npm:@supabase/supabase-js@2'

const TELEGRAM_API_BASE = 'https://api.telegram.org'
const MAX_BATCH_SIZE = 50
const MAX_ATTEMPTS = 3

type BotSecretsRow = {
  bot_token: string | null
  poll_secret: string | null
}

type NotificationRow = {
  id: string
  task_id: string
  profile_id: string
  chat_id: number
  status: string
  attempts: number
}

type TaskContextRow = {
  id: string
  title: string
  due_at: string | null
  board_id: string
  parent_id: string | null
  boards: { title: string } | null
  parent: { title: string } | null
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function isAuthorized(req: Request): boolean {
  const internalSecret = Deno.env.get('TELEGRAM_INTERNAL_SECRET')
  if (!internalSecret) return false
  return req.headers.get('x-telegram-internal-secret') === internalSecret
}

function formatDueDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  })
}

function buildAssignmentMessage(task: TaskContextRow): string {
  const boardTitle = task.boards?.title ?? 'Доска'
  const lines = [
    'Вам назначена задача',
    `Доска: ${boardTitle}`,
    `Задача: ${task.title}`,
  ]

  if (task.parent?.title) {
    lines.push(`Эпик: ${task.parent.title}`)
  }

  if (task.due_at) {
    lines.push(`Срок: ${formatDueDate(task.due_at)}`)
  }

  return lines.join('\n')
}

async function readBotToken(
  supabase: ReturnType<typeof createClient>,
): Promise<string> {
  const envBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  if (envBotToken) return envBotToken

  const { data, error } = await supabase
    .rpc('get_telegram_bot_secrets')
    .maybeSingle()
    .returns<BotSecretsRow>()

  if (error) throw new Error(error.message)

  const botToken = data?.bot_token
  if (!botToken) {
    throw new Error('Telegram bot token is not configured')
  }

  return botToken
}

async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
): Promise<void> {
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Telegram sendMessage failed (${response.status}): ${errorText}`)
  }
}

async function loadTaskContext(
  supabase: ReturnType<typeof createClient>,
  taskId: string,
): Promise<TaskContextRow | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      id,
      title,
      due_at,
      board_id,
      parent_id,
      boards ( title ),
      parent:tasks!tasks_parent_id_fkey ( title )
    `)
    .eq('id', taskId)
    .maybeSingle()
    .returns<TaskContextRow>()

  if (error) throw new Error(error.message)
  return data
}

async function claimPendingNotifications(
  supabase: ReturnType<typeof createClient>,
): Promise<NotificationRow[]> {
  const { data: pendingRows, error: pendingError } = await supabase
    .from('telegram_assignment_notifications')
    .select('id, task_id, profile_id, chat_id, status, attempts')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(MAX_BATCH_SIZE)
    .returns<NotificationRow[]>()

  if (pendingError) throw new Error(pendingError.message)

  const { data: retryRows, error: retryError } = await supabase
    .from('telegram_assignment_notifications')
    .select('id, task_id, profile_id, chat_id, status, attempts')
    .eq('status', 'failed')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(MAX_BATCH_SIZE)
    .returns<NotificationRow[]>()

  if (retryError) throw new Error(retryError.message)

  const merged = [...(pendingRows ?? []), ...(retryRows ?? [])]
  const unique = new Map<string, NotificationRow>()
  for (const row of merged) {
    unique.set(row.id, row)
  }

  return [...unique.values()].slice(0, MAX_BATCH_SIZE)
}

async function markNotificationSent(
  supabase: ReturnType<typeof createClient>,
  notificationId: string,
  attempts: number,
): Promise<void> {
  const { error } = await supabase
    .from('telegram_assignment_notifications')
    .update({
      status: 'sent',
      attempts: attempts + 1,
      sent_at: new Date().toISOString(),
      error: null,
    })
    .eq('id', notificationId)

  if (error) throw new Error(error.message)
}

async function markNotificationFailed(
  supabase: ReturnType<typeof createClient>,
  notificationId: string,
  attempts: number,
  message: string,
): Promise<void> {
  const nextAttempts = attempts + 1
  const { error } = await supabase
    .from('telegram_assignment_notifications')
    .update({
      status: nextAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
      attempts: nextAttempts,
      error: message.slice(0, 500),
    })
    .eq('id', notificationId)

  if (error) throw new Error(error.message)
}

Deno.serve(async (req) => {
  if (req.method === 'GET') {
    return new Response('ok', { status: 200 })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  if (!isAuthorized(req)) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Server is not configured' }, 500)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  let botToken: string
  try {
    botToken = await readBotToken(supabase)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Telegram bot token is not configured'
    return jsonResponse({ error: message }, 500)
  }

  const notifications = await claimPendingNotifications(supabase)

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const notification of notifications) {
    try {
      const task = await loadTaskContext(supabase, notification.task_id)
      if (!task) {
        await markNotificationSent(supabase, notification.id, notification.attempts)
        skipped += 1
        continue
      }

      await sendTelegramMessage(
        botToken,
        notification.chat_id,
        buildAssignmentMessage(task),
      )
      await markNotificationSent(supabase, notification.id, notification.attempts)
      sent += 1
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send Telegram notification'
      await markNotificationFailed(supabase, notification.id, notification.attempts, message)
      failed += 1
    }
  }

  return jsonResponse({
    ok: true,
    processed: notifications.length,
    sent,
    failed,
    skipped,
  })
})
