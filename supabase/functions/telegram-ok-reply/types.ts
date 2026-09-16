export type TelegramChat = { id: number }
export type TelegramUser = { username?: string; id?: number }

export type TelegramMessage = {
  chat?: TelegramChat
  from?: TelegramUser
  text?: string
  message_id?: number
}

export type TelegramCallbackQuery = {
  id: string
  from?: TelegramUser
  message?: TelegramMessage
  data?: string
}

export type TelegramUpdate = {
  update_id: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
  channel_post?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}

export type BotSecretsRow = {
  bot_token: string | null
  poll_secret: string | null
}

export type BoardRow = {
  id: string
  title: string
  created_at: string
}

export type ProfileRow = {
  id: string
}

export type TaskSessionRow = {
  chat_id: number
  profile_id: string
  selected_board_id: string | null
  state: string
}

export type ReplyKeyboardMarkup = {
  keyboard: Array<Array<{ text: string }>>
  resize_keyboard: boolean
  one_time_keyboard: boolean
}

export type InlineKeyboardMarkup = {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>
}

export type AiSplitResponse = {
  epic?: { title: string }
  subtasks?: Array<{ assigneeName: string; task: { title: string } }>
  boardTitle?: string
  error?: string
}
