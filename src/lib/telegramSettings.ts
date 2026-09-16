import type { Tables } from './database.types'
import { supabase } from './supabase'

type ProfileTelegramRow = Pick<Tables<'profiles'>, 'telegram_username'>

const USERNAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/

export function normalizeTelegramUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '')
}

export function validateTelegramUsername(username: string): string | null {
  const normalized = normalizeTelegramUsername(username)

  if (!normalized) {
    return 'Введите Telegram username.'
  }

  if (normalized.length < 5) {
    return 'Username должен содержать минимум 5 символов.'
  }

  if (normalized.length > 32) {
    return 'Username не может быть длиннее 32 символов.'
  }

  if (!USERNAME_PATTERN.test(normalized)) {
    return 'Username может содержать только латинские буквы, цифры и _, и начинаться с буквы.'
  }

  return null
}

function mapTelegramError(message: string): string {
  const normalized = message.toLowerCase()

  if (normalized.includes('profiles_telegram_username_unique_idx')) {
    return 'Этот Telegram username уже привязан к другому профилю.'
  }

  return message
}

export async function getTelegramUsername(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Пользователь не авторизован.')
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('telegram_username')
    .eq('id', user.id)
    .maybeSingle()
    .returns<ProfileTelegramRow>()

  if (error) {
    throw new Error(error.message)
  }

  return data?.telegram_username ?? ''
}

export async function saveTelegramUsername(username: string): Promise<void> {
  const normalized = normalizeTelegramUsername(username)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Пользователь не авторизован.')
  }

  const { error } = await supabase
    .from('profiles')
    .update({ telegram_username: normalized })
    .eq('id', user.id)

  if (error) {
    throw new Error(mapTelegramError(error.message))
  }
}
