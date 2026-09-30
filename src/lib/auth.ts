import { apiPublicRequest, apiRequest, isPythonApiEnabled } from './apiClient'
import { DEFAULT_UNSELECTED_ROLE, isRoleSelected } from './roles'
import { supabase } from './supabase'
import { getAuthUserOrNull, getAuthUserOrThrow, getDefaultDisplayNameFromUser } from './authSession'
import { mapAuthErrorMessage } from './errorMapping'
import { toResult, unwrapResult, type Result } from './result'

export { isRoleSelected } from './roles'

export type ProfileRow = {
  id: string
  display_name: string
  role: string
  created_at: string
  avatar_preset: string | null
  avatar_url: string | null
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

type BackendAuthSessionResponse = {
  accessToken: string | null
  refreshToken: string | null
  user: { id: string; email: string | null } | null
  needsEmailConfirmation: boolean
}

async function applyBackendAuthSession(response: BackendAuthSessionResponse): Promise<void> {
  if (!response.accessToken || !response.refreshToken) {
    return
  }

  const { error } = await supabase.auth.setSession({
    access_token: response.accessToken,
    refresh_token: response.refreshToken,
  })

  if (error) {
    throw new Error(mapAuthErrorMessage(error.message))
  }
}

export async function signInWithEmail({ email, password }: LoginPayload) {
  return unwrapResult(await signInWithEmailResult({ email, password }))
}

export async function signInWithEmailResult({
  email,
  password,
}: LoginPayload): Promise<Result<Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['data']>> {
  return toResult(async () => {
    if (isPythonApiEnabled()) {
      const response = await apiPublicRequest<BackendAuthSessionResponse>('/auth/signin', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      await applyBackendAuthSession(response)

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Не удалось сохранить сессию после входа.')
      }

      return { session, user: session.user }
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      throw new Error(mapAuthErrorMessage(error.message))
    }

    return data
  }, 'Не удалось выполнить вход.')
}

function getOAuthRedirectTo() {
  if (typeof window === 'undefined') return undefined
  return `${window.location.origin}/boards`
}

export async function signInWithGoogle() {
  return unwrapResult(await signInWithGoogleResult())
}

export async function signInWithGoogleResult(): Promise<
  Result<Awaited<ReturnType<typeof supabase.auth.signInWithOAuth>>['data']>
> {
  return toResult(async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getOAuthRedirectTo(),
      },
    })

    if (error) {
      throw new Error(mapAuthErrorMessage(error.message))
    }

    return data
  }, 'Не удалось войти через Google.')
}

export async function signUpWithProfile({
  email,
  password,
  displayName,
  role,
}: RegisterPayload) {
  if (isPythonApiEnabled()) {
    const response = await apiPublicRequest<BackendAuthSessionResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        displayName,
        role,
      }),
    })

    await applyBackendAuthSession(response)

    return {
      user: response.user
        ? {
            id: response.user.id,
            email: response.user.email ?? undefined,
          }
        : null,
      needsEmailConfirmation: response.needsEmailConfirmation,
    }
  }

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
    throw new Error(mapAuthErrorMessage(error.message))
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

type ProfileRowBase = Pick<ProfileRow, 'id' | 'display_name' | 'role' | 'created_at'>

function isMissingAvatarColumnsError(message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes('avatar_preset') || normalized.includes('avatar_url')
}

async function fetchProfileRow(userId: string): Promise<ProfileRow | null> {
  const extended = await supabase
    .from('profiles')
    .select('id, display_name, role, created_at, avatar_preset, avatar_url')
    .eq('id', userId)
    .maybeSingle()

  if (!extended.error) {
    if (!extended.data) return null
    return {
      ...extended.data,
      avatar_preset: extended.data.avatar_preset ?? null,
      avatar_url: extended.data.avatar_url ?? null,
    }
  }

  if (!isMissingAvatarColumnsError(extended.error.message)) {
    throw new Error(extended.error.message)
  }

  const basic = await supabase
    .from('profiles')
    .select('id, display_name, role, created_at')
    .eq('id', userId)
    .maybeSingle()
    .returns<ProfileRowBase>()

  if (basic.error) {
    throw new Error(basic.error.message)
  }

  const row = basic.data
  if (!row) return null

  return {
    ...row,
    avatar_preset: null,
    avatar_url: null,
  }
}

export async function getCurrentProfile(): Promise<ProfileRow | null> {
  const user = await getAuthUserOrNull()
  if (!user) return null

  return fetchProfileRow(user.id)
}

export type AuthAccount = {
  id: string
  email: string
  displayName: string
  role: string
  profileComplete: boolean
  avatarPreset: string | null
  avatarUrl: string | null
}

export type UpdateProfilePayload = {
  displayName?: string
  role: string
}

export function isProfileComplete(profile: ProfileRow | null, role?: string | null): boolean {
  const resolvedRole = profile?.role ?? role ?? null
  return isRoleSelected(resolvedRole)
}

export async function updateProfile({ displayName, role }: UpdateProfilePayload) {
  const user = await getAuthUserOrThrow()

  if (!isRoleSelected(role)) {
    throw new Error('Выберите роль в команде.')
  }

  const existingProfile = await getCurrentProfile()
  const resolvedDisplayName =
    displayName?.trim() ||
    existingProfile?.display_name ||
    getDefaultDisplayNameFromUser(user)

  const profilePayload = {
    id: user.id,
    role,
    display_name: resolvedDisplayName,
  }

  const { error: profileError } = existingProfile
    ? await supabase.from('profiles').update(profilePayload).eq('id', user.id)
    : await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' })

  if (profileError) {
    throw new Error(profileError.message)
  }

  const metadataUpdate: { role: string; display_name?: string } = { role }
  if (displayName?.trim()) {
    metadataUpdate.display_name = displayName.trim()
  }

  const { error: metadataError } = await supabase.auth.updateUser({
    data: metadataUpdate,
  })

  if (metadataError) {
    throw new Error(metadataError.message)
  }
}

export async function getAuthAccount(): Promise<AuthAccount | null> {
  const user = await getAuthUserOrNull()
  if (!user) return null

  if (isPythonApiEnabled()) {
    try {
      const account = await apiRequest<AuthAccount>('/auth/me')
      return {
        ...account,
        email: account.email || user.email || '',
      }
    } catch {
      return null
    }
  }

  let profile: ProfileRow | null = null
  try {
    profile = await fetchProfileRow(user.id)
  } catch {
    profile = null
  }

  const metadataRole = user.user_metadata?.role as string | undefined
  const role = profile?.role ?? metadataRole ?? DEFAULT_UNSELECTED_ROLE

  return {
    id: user.id,
    email: user.email ?? '',
    displayName:
      profile?.display_name ??
      getDefaultDisplayNameFromUser(user),
    role,
    profileComplete: isProfileComplete(profile, role),
    avatarPreset: profile?.avatar_preset ?? null,
    avatarUrl: profile?.avatar_url ?? null,
  }
}

export async function signOut() {
  await unwrapResult(await signOutResult())
}

export async function signOutResult(): Promise<Result<void>> {
  return toResult(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      throw new Error(error.message)
    }
  }, 'Не удалось выйти из аккаунта.')
}

export function userHasEmailPasswordLogin(
  user: { identities?: { provider: string }[] | null },
): boolean {
  return user.identities?.some((identity) => identity.provider === 'email') ?? false
}

export async function updateUserPassword(password: string): Promise<void> {
  await unwrapResult(await updateUserPasswordResult(password))
}

export async function updateUserPasswordResult(password: string): Promise<Result<void>> {
  return toResult(async () => {
    if (password.length < 6) {
      throw new Error('Пароль должен быть не короче 6 символов.')
    }

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      throw new Error(mapAuthErrorMessage(error.message))
    }
  }, 'Не удалось обновить пароль.')
}
