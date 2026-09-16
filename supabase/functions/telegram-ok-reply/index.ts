import { createClient } from 'npm:@supabase/supabase-js@2'

const TELEGRAM_API_BASE = 'https://api.telegram.org'
const REPLY_TEXT = 'ок'
const BOARDS_BUTTON_TEXT = 'Список досок'
const MAX_BOARDS_IN_MESSAGE = 30

type TelegramChat = {
  id: number
}

type TelegramMessage = {
  chat?: TelegramChat
  text?: string
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

type BoardRow = {
  id: string
  title: string
  created_at: string
}

type ReplyMarkup = {
  keyboard: Array<Array<{ text: string }>>
  resize_keyboard: boolean
  one_time_keyboard: boolean
}

const MAIN_KEYBOARD: ReplyMarkup = {
  keyboard: [[{ text: BOARDS_BUTTON_TEXT }]],
  resize_keyboard: true,
  one_time_keyboard: false,
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function extractMessage(update: TelegramUpdate): TelegramMessage | null {
  return update.message ?? update.edited_message ?? update.channel_post ?? null
}

function extractChatId(update: TelegramUpdate): number | null {
  const message = extractMessage(update)
  return typeof message?.chat?.id === 'number' ? message.chat.id : null
}

function extractMessageText(update: TelegramUpdate): string {
  const message = extractMessage(update)
  return typeof message?.text === 'string' ? message.text.trim() : ''
}

function isStartCommand(text: string): boolean {
  return text === '/start' || text.startsWith('/start ')
}

function isBoardsRequest(text: string): boolean {
  return text === BOARDS_BUTTON_TEXT || text === '/boards'
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
  replyMarkup?: ReplyMarkup,
): Promise<void> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
  }

  if (replyMarkup) {
    body.reply_markup = replyMarkup
  }

  const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Telegram sendMessage failed (${response.status}): ${errorText}`)
  }
}

async function fetchAllBoards(
  supabase: ReturnType<typeof createClient>,
): Promise<BoardRow[]> {
  const { data, error } = await supabase
    .from('boards')
    .select('id, title, created_at')
    .order('created_at', { ascending: true })
    .returns<BoardRow[]>()

  if (error) throw new Error(error.message)
  return data ?? []
}

function formatBoardList(boards: BoardRow[]): string {
  if (boards.length === 0) {
    return 'Досок пока нет.'
  }

  const visibleBoards = boards.slice(0, MAX_BOARDS_IN_MESSAGE)
  const lines = visibleBoards.map(
    (board, index) => `${index + 1}. ${board.title} (${board.id})`,
  )

  const remaining = boards.length - visibleBoards.length
  if (remaining > 0) {
    lines.push(`и еще ${remaining}...`)
  }

  return ['Доски в системе:', ...lines].join('\n')
}

async function handleIncomingMessage(
  botToken: string,
  chatId: number,
  text: string,
  supabase: ReturnType<typeof createClient>,
): Promise<{ action: string; count?: number }> {
  if (isStartCommand(text)) {
    await sendTelegramMessage(
      botToken,
      chatId,
      'Привет! Нажми кнопку ниже, чтобы получить список всех досок.',
      MAIN_KEYBOARD,
    )
    return { action: 'start' }
  }

  if (isBoardsRequest(text)) {
    const boards = await fetchAllBoards(supabase)
    await sendTelegramMessage(botToken, chatId, formatBoardList(boards), MAIN_KEYBOARD)
    return { action: 'boards_list', count: boards.length }
  }

  await sendTelegramMessage(botToken, chatId, REPLY_TEXT, MAIN_KEYBOARD)
  return { action: 'fallback_ok' }
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

  const text = extractMessageText(update)

  try {
    const result = await handleIncomingMessage(botToken, chatId, text, supabase)
    return jsonResponse({ ok: true, mode: 'webhook', ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send Telegram message'
    console.error(message)
    return jsonResponse({ error: message }, 502)
  }
})
