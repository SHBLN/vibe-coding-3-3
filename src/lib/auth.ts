import { supabase } from './supabase'

export type ProfileRow = {
  id: string
  display_name: string
  role: string
  created_at: string
}

export type RegisterPayload = {
  email: string
  password: string
  displayName: string
  role: string
}

export type LoginPayload = {
  email: string
  password: string
}

function mapAuthError(message: string): string {
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid login credentials')) {
    return 'Неверный email или пароль.'
  }
  if (normalized.includes('user already registered')) {
    return 'Пользователь с таким email уже зарегистрирован.'
  }
  if (normalized.includes('password should be at least')) {
    return 'Пароль должен быть не короче 6 символов.'
  }
  if (normalized.includes('email not confirmed')) {
    return 'Подтвердите email перед входом.'
  }

  return message
}

export async function signInWithEmail({ email, password }: LoginPayload) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    throw new Error(mapAuthError(error.message))
  }

  return data
}

function getOAuthRedirectTo() {
  if (typeof window === 'undefined') return undefined
  return `${window.location.origin}/boards`
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getOAuthRedirectTo(),
    },
  })

  if (error) {
    throw new Error(mapAuthError(error.message))
  }

  return data
}

export async function signUpWithProfile({
  email,
  password,
  displayName,
  role,
}: RegisterPayload) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        role,
      },
    },
  })

  if (error) {
    throw new Error(mapAuthError(error.message))
  }

  if (data.session && data.user) {
    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: data.user.id,
        display_name: displayName,
        role,
      },
      { onConflict: 'id' },
    )

    if (profileError) {
      throw new Error(profileError.message)
    }
  }

  return {
    user: data.user,
    needsEmailConfirmation: !data.session,
  }
}

export async function getCurrentProfile(): Promise<ProfileRow | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, role, created_at')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export type AuthAccount = {
  id: string
  email: string
  displayName: string
  role: string
}

export async function getAuthAccount(): Promise<AuthAccount | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const profile = await getCurrentProfile()

  return {
    id: user.id,
    email: user.email ?? '',
    displayName: profile?.display_name ?? user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? 'Пользователь',
    role: profile?.role ?? user.user_metadata?.role ?? 'Team Member',
  }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    throw new Error(error.message)
  }
}
