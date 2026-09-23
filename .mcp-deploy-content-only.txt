import { createClient } from 'npm:@supabase/supabase-js@2'

const TELEGRAM_API_BASE = 'https://api.telegram.org'
const REPLY_TEXT = 'ок'
const BOARDS_BUTTON_TEXT = 'Список досок'
const CREATE_TASK_BUTTON_TEXT = 'Создать задачу'
const MAX_BOARDS_IN_MESSAGE = 30
const MAX_INLINE_BOARDS = 20
const BOARD_CALLBACK_PREFIX = 'board:'
const SESSION_STATE_IDLE = 'idle'
const SESSION_STATE_AWAIT_TASK = 'await_task'
const SESSION_STATE_PROCESSING = 'processing'

const MSG_NO_TELEGRAM_USERNAME =
  'У вашего Telegram-аккаунта нет username. Задайте его в настройках Telegram или укажите username в веб-приложении в разделе «Настройки».'
const MSG_PROFILE_NOT_LINKED =
  'Telegram username не привязан к профилю. Откройте «Настройки» в веб-приложении и укажите ваш @username.'

type TelegramChat = { id: number }
type TelegramUser = { username?: string; id?: number }

type TelegramMessage = {
  chat?: TelegramChat
  from?: TelegramUser
  text?: string
  message_id?: number
}

type TelegramCallbackQuery = {
  id: string
  from?: TelegramUser
  message?: TelegramMessage
  data?: string
}

type TelegramUpdate = {
  update_id: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
  channel_post?: TelegramMessage
  callback_query?: TelegramCallbackQuery
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

type ProfileRow = {
  id: string
}

type TaskSessionRow = {
  chat_id: number
  profile_id: string
  selected_board_id: string | null
  state: string
}

type ReplyKeyboardMarkup = {
  keyboard: Array<Array<{ text: string }>>
  resize_keyboard: boolean
  one_time_keyboard: boolean
}

type InlineKeyboardMarkup = {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>
}

type AiSplitResponse = {
  epic?: { title: string }
  subtasks?: Array<{ assigneeName: string; task: { title: string } }>
  boardTitle?: string
  error?: string
}

const MAIN_KEYBOARD: ReplyKeyboardMarkup = {
  keyboard: [[{ text: BOARDS_BUTTON_TEXT }, { text: CREATE_TASK_BUTTON_TEXT }]],
  resize_keyboard: true,
  one_time_keyboard: false,
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
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

function extractChatIdFromMessage(message: TelegramMessage | null): number | null {
  return typeof message?.chat?.id === 'number' ? message.chat.id : null
}

function extractChatId(update: TelegramUpdate): number | null {
  if (update.callback_query?.message) {
    return extractChatIdFromMessage(update.callback_query.message)
  }
  return extractChatIdFromMessage(extractMessage(update))
}

function extractMessageText(update: TelegramUpdate): string {
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

function isStartCommand(text: string): boolean {
  return text === '/start' || text.startsWith('/start ')
}

function isCancelCommand(text: string): boolean {
  return text === '/cancel' || text === 'Отмена'
}

function isBoardsRequest(text: string): boolean {
  return text === BOARDS_BUTTON_TEXT || text === '/boards'
}

function isCreateTaskRequest(text: string): boolean {
  return text === CREATE_TASK_BUTTON_TEXT || text === '/task' || text === '/create_task'
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

async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
  replyMarkup?: ReplyKeyboardMarkup | InlineKeyboardMarkup,
): Promise<void> {
  const body: Record<string, unknown> = { chat_id: chatId, text }
  if (replyMarkup) body.reply_markup = replyMarkup
  await callTelegramApi(botToken, 'sendMessage', body)
}

async function answerCallbackQuery(botToken: string, callbackQueryId: string): Promise<void> {
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

async function fetchBoardsForOwner(
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

async function fetchBoardForOwner(
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

function formatBoardList(boards: BoardRow[]): string {
  if (boards.length === 0) return 'У вас пока нет досок.'

  const visibleBoards = boards.slice(0, MAX_BOARDS_IN_MESSAGE)
  const lines = visibleBoards.map(
    (board, index) => `${index + 1}. ${board.title} (${board.id})`,
  )

  const remaining = boards.length - visibleBoards.length
  if (remaining > 0) lines.push(`и еще ${remaining}...`)

  return ['Ваши доски:', ...lines].join('\n')
}

function buildBoardInlineKeyboard(boards: BoardRow[]): InlineKeyboardMarkup {
  return {
    inline_keyboard: boards.slice(0, MAX_INLINE_BOARDS).map((board) => [{
      text: board.title.slice(0, 64),
      callback_data: `${BOARD_CALLBACK_PREFIX}${board.id}`,
    }]),
  }
}

async function loadTaskSession(
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

async function saveTaskSession(
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

async function clearTaskSession(
  supabase: ReturnType<typeof createClient>,
  chatId: number,
): Promise<void> {
  const { error } = await supabase
    .from('telegram_task_sessions')
    .delete()
    .eq('chat_id', chatId)

  if (error) throw new Error(error.message)
}

async function isUpdateAlreadyProcessed(
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

async function markUpdateProcessed(
  supabase: ReturnType<typeof createClient>,
  updateId: number,
  chatId: number,
): Promise<void> {
  const { error } = await supabase
    .from('telegram_processed_updates')
    .insert({ update_id: updateId, chat_id: chatId })

  if (error) throw new Error(error.message)
}

async function markSessionProcessing(
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

async function upsertTelegramProfileLink(
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

async function touchTelegramProfileLink(
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

async function resolveLinkedProfile(
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

function formatTaskCreationSummary(result: AiSplitResponse, boardTitle: string): string {
  const epicTitle = result.epic?.title ?? 'Без названия'
  const subtaskCount = result.subtasks?.length ?? 0
  const assigneeNames = [...new Set((result.subtasks ?? []).map((item) => item.assigneeName))]

  const lines = [
    `Задача создана на доске «${boardTitle}»`,
    `Эпик: ${epicTitle}`,
    `Подзадач: ${subtaskCount}`,
  ]

  if (assigneeNames.length > 0) {
    lines.push(`Исполнители: ${assigneeNames.join(', ')}`)
  }

  return lines.join('\n')
}

async function invokeAiTaskSplit(
  supabaseUrl: string,
  serviceRoleKey: string,
  profileId: string,
  boardId: string,
  title: string,
): Promise<AiSplitResponse> {
  const internalSecret = Deno.env.get('TELEGRAM_INTERNAL_SECRET')
  if (!internalSecret) {
    throw new Error('TELEGRAM_INTERNAL_SECRET is not configured')
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/anymodel-chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
      'x-telegram-internal-secret': internalSecret,
    },
    body: JSON.stringify({
      profileId,
      boardId,
      title,
      description: title,
    }),
  })

  const result = (await response.json()) as AiSplitResponse
  if (!response.ok) {
    throw new Error(result.error ?? `AI split failed (${response.status})`)
  }

  return result
}

async function startCreateTaskFlow(
  botToken: string,
  chatId: number,
  profile: ProfileRow,
  supabase: ReturnType<typeof createClient>,
): Promise<{ action: string }> {
  const boards = await fetchBoardsForOwner(supabase, profile.id)
  if (boards.length === 0) {
    await sendTelegramMessage(botToken, chatId, 'У вас пока нет досок. Сначала создайте доску в веб-приложении.', MAIN_KEYBOARD)
    return { action: 'create_task_no_boards' }
  }

  if (boards.length === 1) {
    await saveTaskSession(supabase, {
      chat_id: chatId,
      profile_id: profile.id,
      selected_board_id: boards[0].id,
      state: SESSION_STATE_AWAIT_TASK,
    })
    await sendTelegramMessage(
      botToken,
      chatId,
      `Доска «${boards[0].title}» выбрана.\nОтправьте текст глобальной задачи.\n\n/cancel — отменить.`,
      MAIN_KEYBOARD,
    )
    return { action: 'create_task_auto_board' }
  }

  await clearTaskSession(supabase, chatId)
  await sendTelegramMessage(
    botToken,
    chatId,
    'Выберите доску для новой задачи:',
    buildBoardInlineKeyboard(boards),
  )
  return { action: 'create_task_pick_board' }
}

async function handleBoardSelectionCallback(
  botToken: string,
  chatId: number,
  callbackQuery: TelegramCallbackQuery,
  supabase: ReturnType<typeof createClient>,
): Promise<{ action: string }> {
  await answerCallbackQuery(botToken, callbackQuery.id)

  const linked = await resolveLinkedProfile(supabase, { callback_query: callbackQuery } as TelegramUpdate)
  if ('error' in linked) {
    await sendTelegramMessage(botToken, chatId, linked.error, MAIN_KEYBOARD)
    return { action: 'create_task_profile_error' }
  }

  await upsertTelegramProfileLink(
    supabase,
    linked.profile.id,
    chatId,
    linked.telegramUsername,
  )

  const callbackData = callbackQuery.data ?? ''
  if (!callbackData.startsWith(BOARD_CALLBACK_PREFIX)) {
    await sendTelegramMessage(botToken, chatId, 'Неизвестная команда.', MAIN_KEYBOARD)
    return { action: 'callback_unknown' }
  }

  const boardId = callbackData.slice(BOARD_CALLBACK_PREFIX.length)
  const board = await fetchBoardForOwner(supabase, boardId, linked.profile.id)
  if (!board) {
    await sendTelegramMessage(botToken, chatId, 'Доска не найдена или недоступна.', MAIN_KEYBOARD)
    return { action: 'create_task_board_denied' }
  }

  await saveTaskSession(supabase, {
    chat_id: chatId,
    profile_id: linked.profile.id,
    selected_board_id: board.id,
    state: SESSION_STATE_AWAIT_TASK,
  })

  await sendTelegramMessage(
    botToken,
    chatId,
    `Доска «${board.title}» выбрана.\nОтправьте текст глобальной задачи.\n\n/cancel — отменить.`,
    MAIN_KEYBOARD,
  )
  return { action: 'create_task_board_selected' }
}

async function handleAwaitTaskText(
  botToken: string,
  chatId: number,
  text: string,
  updateId: number,
  session: TaskSessionRow,
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<{ action: string; count?: number }> {
  if (await isUpdateAlreadyProcessed(supabase, updateId)) {
    return { action: 'create_task_duplicate_update' }
  }

  if (session.state === SESSION_STATE_PROCESSING) {
    return { action: 'create_task_already_processing' }
  }

  if (!session.selected_board_id) {
    await clearTaskSession(supabase, chatId)
    await sendTelegramMessage(botToken, chatId, 'Доска не выбрана. Нажмите «Создать задачу» снова.', MAIN_KEYBOARD)
    return { action: 'create_task_missing_board' }
  }

  const board = await fetchBoardForOwner(supabase, session.selected_board_id, session.profile_id)
  if (!board) {
    await clearTaskSession(supabase, chatId)
    await sendTelegramMessage(botToken, chatId, 'Доска недоступна. Выберите другую.', MAIN_KEYBOARD)
    return { action: 'create_task_board_denied' }
  }

  const locked = await markSessionProcessing(supabase, session)
  if (!locked) {
    return { action: 'create_task_already_processing' }
  }

  await sendTelegramMessage(botToken, chatId, 'Обрабатываю задачу через AI...', MAIN_KEYBOARD)

  try {
    const result = await invokeAiTaskSplit(
      supabaseUrl,
      serviceRoleKey,
      session.profile_id,
      board.id,
      text,
    )
    await markUpdateProcessed(supabase, updateId, chatId)
    await clearTaskSession(supabase, chatId)
    await sendTelegramMessage(
      botToken,
      chatId,
      formatTaskCreationSummary(result, result.boardTitle ?? board.title),
      MAIN_KEYBOARD,
    )
    return { action: 'create_task_success', count: result.subtasks?.length ?? 0 }
  } catch (err) {
    await clearTaskSession(supabase, chatId)
    const message = err instanceof Error ? err.message : 'Не удалось создать задачу через AI'
    const userMessage = message.includes('No profiles with selected roles')
      ? 'Не удалось распределить задачи: в системе нет профилей с выбранными ролями.'
      : `Не удалось создать задачу: ${message}`
    await sendTelegramMessage(botToken, chatId, userMessage, MAIN_KEYBOARD)
    return { action: 'create_task_failed' }
  }
}

async function handleIncomingMessage(
  botToken: string,
  chatId: number,
  text: string,
  update: TelegramUpdate,
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<{ action: string; count?: number }> {
  const session = await loadTaskSession(supabase, chatId)

  try {
    await touchTelegramProfileLink(supabase, update, chatId)
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'Failed to upsert telegram profile link')
  }

  if (isCancelCommand(text)) {
    await clearTaskSession(supabase, chatId)
    await sendTelegramMessage(botToken, chatId, 'Создание задачи отменено.', MAIN_KEYBOARD)
    return { action: 'create_task_cancelled' }
  }

  if (
    session &&
    (session.state === SESSION_STATE_AWAIT_TASK || session.state === SESSION_STATE_PROCESSING) &&
    text &&
    !isStartCommand(text) &&
    !isBoardsRequest(text) &&
    !isCreateTaskRequest(text)
  ) {
    return handleAwaitTaskText(
      botToken,
      chatId,
      text,
      update.update_id,
      session,
      supabase,
      supabaseUrl,
      serviceRoleKey,
    )
  }

  if (isStartCommand(text)) {
    await clearTaskSession(supabase, chatId)
    await sendTelegramMessage(
      botToken,
      chatId,
      'Привет! Здесь можно посмотреть ваши доски или создать глобальную задачу через AI.',
      MAIN_KEYBOARD,
    )
    return { action: 'start' }
  }

  if (isBoardsRequest(text)) {
    const linked = await resolveLinkedProfile(supabase, update)
    if ('error' in linked) {
      await sendTelegramMessage(botToken, chatId, linked.error, MAIN_KEYBOARD)
      return { action: 'boards_list_profile_error' }
    }

    const boards = await fetchBoardsForOwner(supabase, linked.profile.id)
    await sendTelegramMessage(botToken, chatId, formatBoardList(boards), MAIN_KEYBOARD)
    return { action: 'boards_list', count: boards.length }
  }

  if (isCreateTaskRequest(text)) {
    const linked = await resolveLinkedProfile(supabase, update)
    if ('error' in linked) {
      await sendTelegramMessage(botToken, chatId, linked.error, MAIN_KEYBOARD)
      return { action: 'create_task_profile_error' }
    }

    return startCreateTaskFlow(botToken, chatId, linked.profile, supabase)
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

  if (update.callback_query) {
    const chatId = extractChatId(update)
    if (chatId === null) {
      return jsonResponse({ ok: true, skipped: 'no chat id in callback' })
    }

    try {
      const result = await handleBoardSelectionCallback(
        botToken,
        chatId,
        update.callback_query,
        supabase,
      )
      return jsonResponse({ ok: true, mode: 'webhook', ...result })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to handle callback'
      console.error(message)
      return jsonResponse({ error: message }, 502)
    }
  }

  const chatId = extractChatId(update)
  if (chatId === null) {
    return jsonResponse({ ok: true, skipped: 'no chat id' })
  }

  const text = extractMessageText(update)

  try {
    const result = await handleIncomingMessage(
      botToken,
      chatId,
      text,
      update,
      supabase,
      supabaseUrl!,
      serviceRoleKey!,
    )
    return jsonResponse({ ok: true, mode: 'webhook', ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send Telegram message'
    console.error(message)
    return jsonResponse({ error: message }, 502)
  }
})
