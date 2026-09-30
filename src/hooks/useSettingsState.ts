import { useEffect, useMemo, useState } from 'react'
import type { AuthAccount } from '../lib/auth'
import { getCurrentProfile, updateProfile, updateUserPassword, userHasEmailPasswordLogin } from '../lib/auth'
import { getAuthUserOrNull } from '../lib/authSession'
import { toResult } from '../lib/result'
import { IT_ROLES } from '../lib/roles'
import { getTelegramUsername, normalizeTelegramUsername, saveTelegramUsername, validateTelegramUsername } from '../lib/telegramSettings'

type UseSettingsStateParams = {
  account: AuthAccount | null
  refreshAccount: () => Promise<void>
}

export function useSettingsState({ account, refreshAccount }: UseSettingsStateParams) {
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [canChangePassword, setCanChangePassword] = useState(false)

  const [displayName, setDisplayName] = useState('')
  const [savedDisplayName, setSavedDisplayName] = useState('')
  const [role, setRole] = useState('')
  const [savedRole, setSavedRole] = useState('')
  const [profileSubmitting, setProfileSubmitting] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null)
  const [avatarPreset, setAvatarPreset] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const [username, setUsername] = useState('')
  const [savedUsername, setSavedUsername] = useState('')
  const [telegramSubmitting, setTelegramSubmitting] = useState(false)
  const [telegramError, setTelegramError] = useState<string | null>(null)
  const [telegramSuccess, setTelegramSuccess] = useState<string | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!account) return

    let cancelled = false

    async function loadSettings(currentAccount: AuthAccount) {
      setSettingsLoading(true)

      const loaded = await toResult(async () => {
        const [profile, telegram, authUser] = await Promise.all([
          getCurrentProfile(),
          getTelegramUsername(),
          getAuthUserOrNull(),
        ])
        return { profile, telegram, authUser }
      }, 'Не удалось загрузить настройки.')

      if (!cancelled) {
        if (!loaded.ok) {
          setProfileError(loaded.error)
        } else {
          const { profile, telegram, authUser } = loaded.data
          const resolvedName = profile?.display_name ?? currentAccount.displayName ?? ''
          const resolvedRole = profile?.role ?? currentAccount.role ?? ''

          setDisplayName(resolvedName)
          setSavedDisplayName(resolvedName)
          setRole(resolvedRole)
          setSavedRole(resolvedRole)
          setUsername(telegram)
          setSavedUsername(telegram)
          setAvatarPreset(profile?.avatar_preset ?? currentAccount.avatarPreset ?? null)
          setAvatarUrl(profile?.avatar_url ?? currentAccount.avatarUrl ?? null)

          setCanChangePassword(Boolean(authUser && userHasEmailPasswordLogin(authUser)))
        }
        setSettingsLoading(false)
      }
    }

    void loadSettings(account)

    return () => {
      cancelled = true
    }
  }, [account])

  const roleOptions = useMemo(() => {
    const options: string[] = [...IT_ROLES]
    if (savedRole && !options.includes(savedRole)) {
      options.push(savedRole)
    }
    return options
  }, [savedRole])

  const profileDirty = displayName.trim() !== savedDisplayName.trim() || role !== savedRole
  const telegramDirty = normalizeTelegramUsername(username) !== savedUsername

  const updateDisplayNameDraft = (value: string) => {
    setDisplayName(value)
    setProfileError(null)
    setProfileSuccess(null)
  }

  const updateRoleDraft = (nextRole: string) => {
    setRole(nextRole)
    setProfileError(null)
    setProfileSuccess(null)
  }

  const updateUsernameDraft = (value: string) => {
    setUsername(value)
    setTelegramError(null)
    setTelegramSuccess(null)
  }

  const updateNewPasswordDraft = (value: string) => {
    setNewPassword(value)
    setPasswordError(null)
    setPasswordSuccess(null)
  }

  const updateConfirmPasswordDraft = (value: string) => {
    setConfirmPassword(value)
    setPasswordError(null)
    setPasswordSuccess(null)
  }

  const submitProfile = async () => {
    setProfileError(null)
    setProfileSuccess(null)

    const trimmedName = displayName.trim()
    if (!trimmedName) {
      setProfileError('Укажите имя.')
      return
    }

    if (!role) {
      setProfileError('Выберите должность в команде.')
      return
    }

    setProfileSubmitting(true)
    const result = await toResult(async () => {
      await updateProfile({ displayName: trimmedName, role })
      setDisplayName(trimmedName)
      setSavedDisplayName(trimmedName)
      setSavedRole(role)
      await refreshAccount()
    }, 'Не удалось сохранить профиль.')

    if (result.ok) {
      setProfileSuccess('Профиль обновлён.')
    } else {
      setProfileError(result.error)
    }
    setProfileSubmitting(false)
  }

  const submitTelegram = async () => {
    setTelegramError(null)
    setTelegramSuccess(null)

    const validationError = validateTelegramUsername(username)
    if (validationError) {
      setTelegramError(validationError)
      return
    }

    const normalized = normalizeTelegramUsername(username)

    setTelegramSubmitting(true)
    const result = await toResult(async () => {
      await saveTelegramUsername(normalized)
      setUsername(normalized)
      setSavedUsername(normalized)
    }, 'Не удалось сохранить username.')

    if (result.ok) {
      setTelegramSuccess(`Telegram @${normalized} сохранён.`)
    } else {
      setTelegramError(result.error)
    }
    setTelegramSubmitting(false)
  }

  const submitPassword = async () => {
    setPasswordError(null)
    setPasswordSuccess(null)

    if (newPassword !== confirmPassword) {
      setPasswordError('Пароли не совпадают.')
      return
    }

    setPasswordSubmitting(true)
    const result = await toResult(async () => {
      await updateUserPassword(newPassword)
      setNewPassword('')
      setConfirmPassword('')
    }, 'Не удалось сменить пароль.')

    if (result.ok) {
      setPasswordSuccess('Новый пароль сохранён.')
    } else {
      setPasswordError(result.error)
    }
    setPasswordSubmitting(false)
  }

  const handleAvatarUpdated = async (next: { avatarPreset: string | null; avatarUrl: string | null }) => {
    setAvatarPreset(next.avatarPreset)
    setAvatarUrl(next.avatarUrl)
    await refreshAccount()
  }

  return {
    settingsLoading,
    canChangePassword,
    roleOptions,
    profileDirty,
    telegramDirty,
    displayName,
    role,
    profileSubmitting,
    profileError,
    profileSuccess,
    avatarPreset,
    avatarUrl,
    username,
    savedUsername,
    telegramSubmitting,
    telegramError,
    telegramSuccess,
    newPassword,
    confirmPassword,
    passwordSubmitting,
    passwordError,
    passwordSuccess,
    updateDisplayNameDraft,
    updateRoleDraft,
    updateUsernameDraft,
    updateNewPasswordDraft,
    updateConfirmPasswordDraft,
    submitProfile,
    submitTelegram,
    submitPassword,
    handleAvatarUpdated,
    setProfileError,
    setProfileSuccess,
  }
}
