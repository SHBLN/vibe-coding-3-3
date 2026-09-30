import type { User } from '@supabase/supabase-js'
import { isPythonApiEnabled } from './apiClient'
import { supabase } from './supabase'

const NOT_AUTHORIZED_MESSAGE = 'Пользователь не авторизован.'

async function readSessionUser(): Promise<User | null> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    throw new Error(error.message)
  }

  return session?.user ?? null
}

async function readValidatedUser(): Promise<User | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    throw new Error(error.message)
  }

  return user
}

export async function getAuthUserOrNull(): Promise<User | null> {
  if (isPythonApiEnabled()) {
    return readSessionUser()
  }

  return readValidatedUser()
}

export async function getAuthUserOrThrow(): Promise<User> {
  const user = await getAuthUserOrNull()
  if (!user) {
    throw new Error(NOT_AUTHORIZED_MESSAGE)
  }
  return user
}

export function getDefaultDisplayNameFromUser(user: User): string {
  return user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? 'Пользователь'
}
