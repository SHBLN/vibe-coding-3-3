import type { Tables } from './database.types'
import { getProfileInitials } from './profiles'
import { supabase } from './supabase'

export const AVATAR_PRESETS = [
  {
    id: 'preset-1',
    label: 'Океан',
    className: 'bg-gradient-to-br from-accent to-accent-dark',
  },
  {
    id: 'preset-2',
    label: 'Ночь',
    className: 'bg-gradient-to-br from-navy to-navy-light',
  },
  {
    id: 'preset-3',
    label: 'Лайм',
    className: 'bg-gradient-to-br from-emerald-500 to-teal-600',
  },
  {
    id: 'preset-4',
    label: 'Ирис',
    className: 'bg-gradient-to-br from-violet-500 to-indigo-600',
  },
  {
    id: 'preset-5',
    label: 'Закат',
    className: 'bg-gradient-to-br from-orange-500 to-rose-500',
  },
] as const

export type AvatarPresetId = (typeof AVATAR_PRESETS)[number]['id']

const PRESET_IDS = new Set<string>(AVATAR_PRESETS.map((item) => item.id))

export type ProfileAvatarFields = Pick<Tables<'profiles'>, 'avatar_preset' | 'avatar_url'>

export type AvatarDisplaySource = {
  displayName: string
  avatarPreset?: string | null
  avatarUrl?: string | null
}

export function isAvatarPresetId(value: string): value is AvatarPresetId {
  return PRESET_IDS.has(value)
}

export function resolveAvatarPresetClass(presetId: string | null | undefined): string {
  const match = AVATAR_PRESETS.find((item) => item.id === presetId)
  return match?.className ?? AVATAR_PRESETS[0].className
}

export async function getProfileAvatarFields(): Promise<ProfileAvatarFields> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Пользователь не авторизован.')
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('avatar_preset, avatar_url')
    .eq('id', user.id)
    .maybeSingle()
    .returns<ProfileAvatarFields>()

  if (error) throw new Error(error.message)

  return {
    avatar_preset: data?.avatar_preset ?? null,
    avatar_url: data?.avatar_url ?? null,
  }
}

export async function saveProfileAvatarPreset(presetId: AvatarPresetId): Promise<void> {
  if (!isAvatarPresetId(presetId)) {
    throw new Error('Неизвестный аватар.')
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Пользователь не авторизован.')
  }

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_preset: presetId, avatar_url: null })
    .eq('id', user.id)

  if (error) throw new Error(error.message)
}

export async function saveProfileAvatarUrl(url: string): Promise<void> {
  const trimmed = url.trim()
  if (!trimmed) {
    throw new Error('URL аватара пустой.')
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Пользователь не авторизован.')
  }

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: trimmed, avatar_preset: null })
    .eq('id', user.id)

  if (error) throw new Error(error.message)
}

export function getProfileInitialsFromName(displayName: string): string {
  return getProfileInitials(displayName)
}
