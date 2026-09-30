import type { Tables } from './database.types'
import { getAuthUserOrThrow } from './authSession'
import { getProfileInitials } from './profiles'
import { toResult, unwrapResult, type Result } from './result'
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
  return unwrapResult(await getProfileAvatarFieldsResult())
}

export async function getProfileAvatarFieldsResult(): Promise<Result<ProfileAvatarFields>> {
  return toResult(async () => {
    const user = await getAuthUserOrThrow()

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
  }, 'Не удалось загрузить настройки аватара.')
}

export async function saveProfileAvatarPreset(presetId: AvatarPresetId): Promise<void> {
  await unwrapResult(await saveProfileAvatarPresetResult(presetId))
}

export async function saveProfileAvatarPresetResult(presetId: AvatarPresetId): Promise<Result<void>> {
  return toResult(async () => {
    if (!isAvatarPresetId(presetId)) {
      throw new Error('Неизвестный аватар.')
    }

    const user = await getAuthUserOrThrow()

    const { error } = await supabase
      .from('profiles')
      .update({ avatar_preset: presetId, avatar_url: null })
      .eq('id', user.id)

    if (error) throw new Error(error.message)
  }, 'Не удалось сохранить аватар.')
}

export async function saveProfileAvatarUrl(url: string): Promise<void> {
  await unwrapResult(await saveProfileAvatarUrlResult(url))
}

export async function saveProfileAvatarUrlResult(url: string): Promise<Result<void>> {
  return toResult(async () => {
    const trimmed = url.trim()
    if (!trimmed) {
      throw new Error('URL аватара пустой.')
    }

    const user = await getAuthUserOrThrow()

    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: trimmed, avatar_preset: null })
      .eq('id', user.id)

    if (error) throw new Error(error.message)
  }, 'Не удалось сохранить аватар.')
}

export function getProfileInitialsFromName(displayName: string): string {
  return getProfileInitials(displayName)
}
