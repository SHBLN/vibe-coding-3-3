import { createClient } from 'npm:@supabase/supabase-js@2'
import type {
  AiSplitResponse,
  BoardRow,
  BotSecretsRow,
  InlineKeyboardMarkup,
  ProfileRow,
  ReplyKeyboardMarkup,
  TaskSessionRow,
  TelegramCallbackQuery,
  TelegramMessage,
  TelegramUpdate,
  TelegramUser,
} from './types.ts'

export const TELEGRAM_API_BASE = 'https://api.telegram.org'
export const REPLY_TEXT = 'ок'
export const BOARDS_BUTTON_TEXT = 'Список досок'
export const CREATE_TASK_BUTTON_TEXT = 'Создать задачу'
export const MAX_BOARDS_IN_MESSAGE = 30
export const MAX_INLINE_BOARDS = 20
export const BOARD_CALLBACK_PREFIX = 'board:'
export const SESSION_STATE_AWAIT_TASK = 'await_task'
export const SESSION_STATE_PROCESSING = 'processing'

export const MSG_NO_TELEGRAM_USERNAME =
  'У вашего Telegram-аккаунта нет username. Задайте его в настройках Telegram или укажите username в веб-приложении в разделе «Настройки».'
export const MSG_PROFILE_NOT_LINKED =
  'Telegram username не привязан к профилю. Откройте «Настройки» в веб-приложении и укажите ваш @username.'

export const MAIN_KEYBOARD: ReplyKeyboardMarkup = {
  keyboard: [[{ text: BOARDS_BUTTON_TEXT }, { text: CREATE_TASK_BUTTON_TEXT }]],
  resize_keyboard: true,
  one_time_keyboard: false,
}

export function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function normalizeTelegramUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '')
}

function extractMessage(update: TelegramUpdate): TelegramMessage | null {
  return update.message ?? update.edited_message ?? update.channel_post ?? null
}

export function extractChatIdFromMessage(message: TelegramMessage | null): number | null {
  return typeof message?.chat?.id === 'number' ? message.chat.id : null
}

export function extractChatId(update: TelegramUpdate): number | null {
  if (update.callback_query?.message) {
    return extractChatIdFromMessage(update.callback_query.message)
  }
  return extractChatIdFromMessage(extractMessage(update))
}

export function extractMessageText(update: TelegramUpdate): string {
  const message = extractMessage(update)
  return typeof message?.text === 'string' ? message.text.trim() : ''
}

function extractTelegramUsernameFromUser(user?: TelegramUser): string | null {
  if (typeof user?.username !== 'string') return null
  const normalized = normalizeTelegramUsername(user.username)
  return normalized.length > 0 ? normalized : null
}

function extractTelegramUsername(update: TelegramUpdate): string | null {
  const message = update.message ?? update.edited_message
  return extractTelegramUsernameFromUser(message?.from)
}

export function isStartCommand(text: string): boolean {
  return text === '/start' || text.startsWith('/start ')
}

export function isCancelCommand(text: string): boolean {
  return text === '/cancel' || text === 'Отмена'
}

export function isBoardsRequest(text: string): boolean {
  return text === BOARDS_BUTTON_TEXT || text === '/boards'
}

export function isCreateTaskRequest(text: string): boolean {
  return text === CREATE_TASK_BUTTON_TEXT || text === '/task' || text === '/create_task'
}

export async function readBotSecrets(
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

async function callTelegramApi(
  botToken: string,
  method: string,
  body: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Telegram ${method} failed (${response.status}): ${errorText}`)
  }
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
  replyMarkup?: ReplyKeyboardMarkup | InlineKeyboardMarkup,
): Promise<void> {
  const body: Record<string, unknown> = { chat_id: chatId, text }
  if (replyMarkup) body.reply_markup = replyMarkup
  await callTelegramApi(botToken, 'sendMessage', body)
}

export async function answerCallbackQuery(botToken: string, callbackQueryId: string): Promise<void> {
  await callTelegramApi(botToken, 'answerCallbackQuery', { callback_query_id: callbackQueryId })
}

async function resolveProfileByTelegramUsername(
  supabase: ReturnType<typeof createClient>,
  telegramUsername: string,
): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .ilike('telegram_username', telegramUsername)
    .maybeSingle()
    .returns<ProfileRow>()

  if (error) throw new Error(error.message)
  return data
}

export async function fetchBoardsForOwner(
  supabase: ReturnType<typeof createClient>,
  ownerId: string,
): Promise<BoardRow[]> {
  const { data, error } = await supabase
    .from('boards')
    .select('id, title, created_at')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: true })
    .returns<BoardRow[]>()

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function fetchBoardForOwner(
  supabase: ReturnType<typeof createClient>,
  boardId: string,
  ownerId: string,
): Promise<BoardRow | null> {
  const { data, error } = await supabase
    .from('boards')
    .select('id, title, created_at')
    .eq('id', boardId)
    .eq('owner_id', ownerId)
    .maybeSingle()
    .returns<BoardRow>()

  if (error) throw new Error(error.message)
  return data
}

export function formatBoardList(boards: BoardRow[]): string {
  if (boards.length === 0) return 'У вас пока нет досок.'

  const visibleBoards = boards.slice(0, MAX_BOARDS_IN_MESSAGE)
  const lines = visibleBoards.map(
    (board, index) => `${index + 1}. ${board.title} (${board.id})`,
  )

  const remaining = boards.length - visibleBoards.length
  if (remaining > 0) lines.push(`и еще ${remaining}...`)

  return ['Ваши доски:', ...lines].join('\n')
}

export function buildBoardInlineKeyboard(boards: BoardRow[]): InlineKeyboardMarkup {
  return {
    inline_keyboard: boards.slice(0, MAX_INLINE_BOARDS).map((board) => [{
      text: board.title.slice(0, 64),
      callback_data: `${BOARD_CALLBACK_PREFIX}${board.id}`,
    }]),
  }
}

export async function loadTaskSession(
  supabase: ReturnType<typeof createClient>,
  chatId: number,
): Promise<TaskSessionRow | null> {
  const { data, error } = await supabase
    .from('telegram_task_sessions')
    .select('chat_id, profile_id, selected_board_id, state')
    .eq('chat_id', chatId)
    .maybeSingle()
    .returns<TaskSessionRow>()

  if (error) throw new Error(error.message)
  return data
}

export async function saveTaskSession(
  supabase: ReturnType<typeof createClient>,
  session: TaskSessionRow,
): Promise<void> {
  const { error } = await supabase
    .from('telegram_task_sessions')
    .upsert({
      chat_id: session.chat_id,
      profile_id: session.profile_id,
      selected_board_id: session.selected_board_id,
      state: session.state,
      updated_at: new Date().toISOString(),
    })

  if (error) throw new Error(error.message)
}

export async function clearTaskSession(
  supabase: ReturnType<typeof createClient>,
  chatId: number,
): Promise<void> {
  const { error } = await supabase
    .from('telegram_task_sessions')
    .delete()
    .eq('chat_id', chatId)

  if (error) throw new Error(error.message)
}

export async function isUpdateAlreadyProcessed(
  supabase: ReturnType<typeof createClient>,
  updateId: number,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('telegram_processed_updates')
    .select('update_id')
    .eq('update_id', updateId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data !== null
}

export async function markUpdateProcessed(
  supabase: ReturnType<typeof createClient>,
  updateId: number,
  chatId: number,
): Promise<void> {
  const { error } = await supabase
    .from('telegram_processed_updates')
    .insert({ update_id: updateId, chat_id: chatId })

  if (error) throw new Error(error.message)
}

export async function markSessionProcessing(
  supabase: ReturnType<typeof createClient>,
  session: TaskSessionRow,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('telegram_task_sessions')
    .update({
      state: SESSION_STATE_PROCESSING,
      updated_at: new Date().toISOString(),
    })
    .eq('chat_id', session.chat_id)
    .eq('state', SESSION_STATE_AWAIT_TASK)
    .select('chat_id')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data !== null
}

export async function upsertTelegramProfileLink(
  supabase: ReturnType<typeof createClient>,
  profileId: string,
  chatId: number,
  telegramUsername: string,
): Promise<void> {
  const { error } = await supabase
    .from('telegram_profile_links')
    .upsert({
      profile_id: profileId,
      chat_id: chatId,
      telegram_username: telegramUsername,
      last_seen_at: new Date().toISOString(),
    })

  if (error) throw new Error(error.message)
}

export async function touchTelegramProfileLink(
  supabase: ReturnType<typeof createClient>,
  update: TelegramUpdate,
  chatId: number,
): Promise<void> {
  const linked = await resolveLinkedProfile(supabase, update)
  if ('error' in linked) return

  await upsertTelegramProfileLink(
    supabase,
    linked.profile.id,
    chatId,
    linked.telegramUsername,
  )
}

export async function resolveLinkedProfile(
  supabase: ReturnType<typeof createClient>,
  update: TelegramUpdate,
): Promise<{ profile: ProfileRow; telegramUsername: string } | { error: string }> {
  const telegramUsername = update.callback_query
    ? extractTelegramUsernameFromUser(update.callback_query.from)
    : extractTelegramUsername(update)

  if (!telegramUsername) {
    return { error: MSG_NO_TELEGRAM_USERNAME }
  }

  const profile = await resolveProfileByTelegramUsername(supabase, telegramUsername)
  if (!profile) {
    return { error: MSG_PROFILE_NOT_LINKED }
  }

  return { profile, telegramUsername }
}

