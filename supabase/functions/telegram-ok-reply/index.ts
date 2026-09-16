import { createClient } from 'npm:@supabase/supabase-js@2'

const TELEGRAM_API_BASE = 'https://api.telegram.org'
const REPLY_TEXT = 'ок'

type TelegramChat = {
  id: number
}

type TelegramMessage = {
  chat?: TelegramChat
}

type TelegramUpdate = {
  update_id: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
  channel_post?: TelegramMessage
}

type BotSecretsRow = {
  bot_token: string | null
  poll_secret: string | null
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function extractChatId(update: TelegramUpdate): number | null {
  const chat =
    update.message?.chat ??
    update.edited_message?.chat ??
    update.channel_post?.chat

  return typeof chat?.id === 'number' ? chat.id : null
}

async function readBotSecrets(
  supabase: ReturnType<typeof createClient>,
): Promise<{ botToken: string; webhookSecret: string }> {
  const envBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const envWebhookSecret =
    Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? Deno.env.get('TELEGRAM_POLL_SECRET')

  if (envBotToken && envWebhookSecret) {
    return { botToken: envBotToken, webhookSecret: envWebhookSecret }
  }

  const { data, error } = await supabase
    .rpc('get_telegram_bot_secrets')
    .maybeSingle()
    .returns<BotSecretsRow>()

  if (error) throw new Error(error.message)

  const botToken = data?.bot_token ?? envBotToken
  const webhookSecret = data?.poll_secret ?? envWebhookSecret
  if (!botToken || !webhookSecret) {
    throw new Error('Telegram bot secrets are not configured')
  }

  return { botToken, webhookSecret }
}

async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
): Promise<void> {
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Telegram sendMessage failed (${response.status}): ${errorText}`)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'GET') {
    return new Response('ok', { status: 200 })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  const missingKeys: string[] = []
  if (!supabaseUrl) missingKeys.push('SUPABASE_URL')
  if (!serviceRoleKey) missingKeys.push('SUPABASE_SERVICE_ROLE_KEY')

  if (missingKeys.length > 0) {
    return jsonResponse({ error: 'Server is not configured', missingKeys }, 500)
  }

  const supabase = createClient(supabaseUrl!, serviceRoleKey!)

  let botToken: string
  let webhookSecret: string
  try {
    const secrets = await readBotSecrets(supabase)
    botToken = secrets.botToken
    webhookSecret = secrets.webhookSecret
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Telegram bot secrets are not configured'
    return jsonResponse({ error: message }, 500)
  }

  const incomingSecret = req.headers.get('x-telegram-bot-api-secret-token')
  if (incomingSecret !== webhookSecret) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  let update: TelegramUpdate
  try {
    update = (await req.json()) as TelegramUpdate
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const chatId = extractChatId(update)
  if (chatId === null) {
    return jsonResponse({ ok: true, skipped: 'no chat id' })
  }

  try {
    await sendTelegramMessage(botToken, chatId, REPLY_TEXT)
    return jsonResponse({ ok: true, mode: 'webhook' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send Telegram message'
    console.error(message)
    return jsonResponse({ error: message }, 502)
  }
})
