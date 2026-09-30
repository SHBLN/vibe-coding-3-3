import type { Tables } from './database.types'
import { getAuthUserOrThrow } from './authSession'
import { mapTelegramErrorMessage } from './errorMapping'
import { toResult, unwrapResult, type Result } from './result'
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

export async function getTelegramUsername(): Promise<string> {
  return unwrapResult(await getTelegramUsernameResult())
}

export async function getTelegramUsernameResult(): Promise<Result<string>> {
  return toResult(async () => {
  const user = await getAuthUserOrThrow()

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
  }, 'Не удалось загрузить Telegram username.')
}

export async function saveTelegramUsername(username: string): Promise<void> {
  await unwrapResult(await saveTelegramUsernameResult(username))
}

export async function saveTelegramUsernameResult(username: string): Promise<Result<void>> {
  return toResult(async () => {
    const normalized = normalizeTelegramUsername(username)
    const user = await getAuthUserOrThrow()

    const { error } = await supabase
      .from('profiles')
      .update({ telegram_username: normalized })
      .eq('id', user.id)

    if (error) {
      throw new Error(mapTelegramErrorMessage(error.message))
    }
  }, 'Не удалось сохранить Telegram username.')
}
