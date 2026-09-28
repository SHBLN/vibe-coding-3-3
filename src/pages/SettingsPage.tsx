import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AvatarPicker } from '../components/settings/AvatarPicker'
import { RoleSelectField } from '../components/RoleSelectField'
import { AccountBadge } from '../components/landing/AccountBadge'
import { ButtonPrimary, LogoIcon, TelegramIcon } from '../components/landing/ui'
import { useAuth } from '../hooks/useAuth'
import {
  getCurrentProfile,
  updateProfile,
  updateUserPassword,
  userHasEmailPasswordLogin,
} from '../lib/auth'
import { IT_ROLES } from '../lib/roles'
import {
  getTelegramUsername,
  normalizeTelegramUsername,
  saveTelegramUsername,
  validateTelegramUsername,
} from '../lib/telegramSettings'
import { supabase } from '../lib/supabase'

const fieldClassName =
  'w-full rounded-xl border border-navy/15 bg-surface px-4 py-3 text-sm text-navy outline-none transition placeholder:text-navy/40 focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60'

function BackIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M5 12l6-6M5 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SettingsAlert({
  error,
  success,
}: {
  error: string | null
  success: string | null
}) {
  return (
    <>
      {error ? (
        <div
          className="rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      {success ? (
        <div
          className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          {success}
        </div>
      ) : null}
    </>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const { account, loading, signOut, refresh } = useAuth()

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

    async function loadSettings(currentAccount: NonNullable<typeof account>) {
      setSettingsLoading(true)

      try {
        const [profile, telegram, authUser] = await Promise.all([
          getCurrentProfile(),
          getTelegramUsername(),
          supabase.auth.getUser(),
        ])

        if (cancelled) return

        const resolvedName =
          profile?.display_name ?? currentAccount.displayName ?? ''
        const resolvedRole = profile?.role ?? currentAccount.role ?? ''

        setDisplayName(resolvedName)
        setSavedDisplayName(resolvedName)
        setRole(resolvedRole)
        setSavedRole(resolvedRole)
        setUsername(telegram)
        setSavedUsername(telegram)
        setAvatarPreset(profile?.avatar_preset ?? currentAccount.avatarPreset ?? null)
        setAvatarUrl(profile?.avatar_url ?? currentAccount.avatarUrl ?? null)

        const user = authUser.data.user
        setCanChangePassword(Boolean(user && userHasEmailPasswordLogin(user)))
      } catch (err) {
        if (!cancelled) {
          setProfileError(
            err instanceof Error ? err.message : 'Не удалось загрузить настройки.',
          )
        }
      } finally {
        if (!cancelled) setSettingsLoading(false)
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

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const handleProfileSubmit = async (event: FormEvent) => {
    event.preventDefault()
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
    try {
      await updateProfile({ displayName: trimmedName, role })
      setDisplayName(trimmedName)
      setSavedDisplayName(trimmedName)
      setSavedRole(role)
      await refresh()
      setProfileSuccess('Профиль обновлён.')
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Не удалось сохранить профиль.')
    } finally {
      setProfileSubmitting(false)
    }
  }

  const handleTelegramSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setTelegramError(null)
    setTelegramSuccess(null)

    const validationError = validateTelegramUsername(username)
    if (validationError) {
      setTelegramError(validationError)
      return
    }

    const normalized = normalizeTelegramUsername(username)

    setTelegramSubmitting(true)
    try {
      await saveTelegramUsername(normalized)
      setUsername(normalized)
      setSavedUsername(normalized)
      setTelegramSuccess(`Telegram @${normalized} сохранён.`)
    } catch (err) {
      setTelegramError(err instanceof Error ? err.message : 'Не удалось сохранить username.')
    } finally {
      setTelegramSubmitting(false)
    }
  }

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)

    if (newPassword !== confirmPassword) {
      setPasswordError('Пароли не совпадают.')
      return
    }

    setPasswordSubmitting(true)
    try {
      await updateUserPassword(newPassword)
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess('Новый пароль сохранён.')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Не удалось сменить пароль.')
    } finally {
      setPasswordSubmitting(false)
    }
  }

  if (loading || !account || settingsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <span className="text-sm text-navy/50">Загрузка…</span>
      </div>
    )
  }

  const profileDirty =
    displayName.trim() !== savedDisplayName.trim() || role !== savedRole
  const telegramDirty = normalizeTelegramUsername(username) !== savedUsername

  return (
    <div className="min-h-screen bg-gradient-to-b from-surface to-surface-alt">
      <header className="sticky top-0 z-30 border-b border-navy/10 bg-surface/95 backdrop-blur">
        <div className="section-shell flex h-20 items-center justify-between">
          <Link to="/" aria-label="AiVibeBoard — на главную" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 rotate-3 items-center justify-center rounded-2xl bg-navy text-accent shadow-card">
              <LogoIcon />
            </div>
            <span className="text-xl font-black tracking-[-0.04em] text-navy">
              AI VIBE<span className="text-accent">.</span>
            </span>
          </Link>

          <AccountBadge account={account} onSignOut={handleSignOut} />
        </div>
      </header>

      <main className="section-shell py-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <Link
            to="/boards"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy/50 transition hover:text-accent"
          >
            <BackIcon />
            К доскам
          </Link>

          <div>
            <h1 className="text-3xl font-black tracking-[-0.04em] text-navy">Настройки</h1>
            <p className="mt-2 text-sm text-navy/60">
              Профиль, Telegram и безопасность аккаунта.
            </p>
          </div>

          <section id="profile-settings" className="panel-shell scroll-mt-24 p-6">
            <h2 className="text-base font-bold text-navy">Профиль</h2>
            <p className="mt-1 text-xs text-navy/55">
              Имя и должность видны команде при назначении задач.
            </p>

            <form className="mt-5 space-y-4" onSubmit={(event) => void handleProfileSubmit(event)}>
              <SettingsAlert error={profileError} success={profileSuccess} />

              <div id="avatar-settings" className="scroll-mt-24">
              <AvatarPicker
                displayName={displayName || account.displayName}
                avatarPreset={avatarPreset}
                avatarUrl={avatarUrl}
                disabled={profileSubmitting}
                onUpdated={async (next) => {
                  setAvatarPreset(next.avatarPreset)
                  setAvatarUrl(next.avatarUrl)
                  await refresh()
                }}
                onError={setProfileError}
                onSuccess={setProfileSuccess}
              />
              </div>

              <div className="space-y-2">
                <label htmlFor="settings-email" className="block text-sm font-semibold text-navy">
                  Email
                </label>
                <input
                  id="settings-email"
                  type="email"
                  value={account.email}
                  readOnly
                  className={`${fieldClassName} bg-white/80 text-navy/60`}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="settings-display-name" className="block text-sm font-semibold text-navy">
                  Имя
                </label>
                <input
                  id="settings-display-name"
                  type="text"
                  value={displayName}
                  onChange={(event) => {
                    setDisplayName(event.target.value)
                    setProfileError(null)
                    setProfileSuccess(null)
                  }}
                  autoComplete="name"
                  disabled={profileSubmitting}
                  className={fieldClassName}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="settings-role" className="block text-sm font-semibold text-navy">
                  Должность в команде
                </label>
                <RoleSelectField
                  id="settings-role"
                  value={role}
                  options={roleOptions}
                  disabled={profileSubmitting}
                  onChange={(nextRole) => {
                    setRole(nextRole)
                    setProfileError(null)
                    setProfileSuccess(null)
                  }}
                />
              </div>

              <ButtonPrimary
                type="submit"
                disabled={profileSubmitting || !profileDirty}
                className="w-full justify-center py-3 sm:w-auto sm:min-w-[160px]"
              >
                {profileSubmitting ? 'Сохраняем…' : 'Сохранить профиль'}
              </ButtonPrimary>
            </form>
          </section>

          <section id="telegram-settings" className="panel-shell scroll-mt-24 p-6">
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#229ED9]/25 bg-[#229ED9]/8 px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#229ED9] text-white shadow-sm">
                <TelegramIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-navy">Telegram</h2>
                <p className="mt-1 text-xs leading-relaxed text-navy/60">
                  Username для бота: постановка задач и уведомления.
                </p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={(event) => void handleTelegramSubmit(event)}>
              <SettingsAlert error={telegramError} success={telegramSuccess} />

              <div className="space-y-2">
                <label
                  htmlFor="telegram-username"
                  className="flex items-center gap-2 text-sm font-semibold text-navy"
                >
                  <TelegramIcon className="h-4 w-4 text-[#229ED9]" aria-hidden="true" />
                  Telegram username
                </label>
                <div className="flex overflow-hidden rounded-2xl border border-navy/15 bg-surface transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
                  <span className="flex items-center border-r border-navy/10 bg-white px-4 text-sm font-semibold text-navy/45">
                    @
                  </span>
                  <input
                    id="telegram-username"
                    name="telegramUsername"
                    type="text"
                    value={username}
                    onChange={(event) => {
                      setUsername(event.target.value)
                      setTelegramError(null)
                      setTelegramSuccess(null)
                    }}
                    placeholder="username"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={telegramSubmitting}
                    className="min-w-0 flex-1 bg-surface px-4 py-3 text-sm text-navy outline-none placeholder:text-navy/40 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
                <p className="text-xs text-navy/45">
                  5–32 символа: латиница, цифры и подчёркивание.
                </p>
              </div>

              {savedUsername ? (
                <p className="text-xs text-navy/50">
                  Сейчас в профиле: <span className="font-semibold text-navy">@{savedUsername}</span>
                </p>
              ) : null}

              <ButtonPrimary
                type="submit"
                disabled={telegramSubmitting || !telegramDirty}
                className="w-full justify-center py-3 sm:w-auto sm:min-w-[160px]"
              >
                {telegramSubmitting ? (
                  'Сохраняем…'
                ) : (
                  <>
                    <TelegramIcon className="h-4 w-4" aria-hidden="true" />
                    Сохранить Telegram
                  </>
                )}
              </ButtonPrimary>
            </form>
          </section>

          <section id="security-settings" className="panel-shell scroll-mt-24 p-6">
            <h2 className="text-base font-bold text-navy">Безопасность</h2>
            <p className="mt-1 text-xs text-navy/55">Смена пароля для входа по email.</p>

            {canChangePassword ? (
              <form className="mt-5 space-y-4" onSubmit={(event) => void handlePasswordSubmit(event)}>
                <SettingsAlert error={passwordError} success={passwordSuccess} />

                <div className="space-y-2">
                  <label htmlFor="settings-new-password" className="block text-sm font-semibold text-navy">
                    Новый пароль
                  </label>
                  <input
                    id="settings-new-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => {
                      setNewPassword(event.target.value)
                      setPasswordError(null)
                      setPasswordSuccess(null)
                    }}
                    autoComplete="new-password"
                    disabled={passwordSubmitting}
                    className={fieldClassName}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="settings-confirm-password"
                    className="block text-sm font-semibold text-navy"
                  >
                    Повторите пароль
                  </label>
                  <input
                    id="settings-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value)
                      setPasswordError(null)
                      setPasswordSuccess(null)
                    }}
                    autoComplete="new-password"
                    disabled={passwordSubmitting}
                    className={fieldClassName}
                  />
                </div>

                <p className="text-xs text-navy/45">Минимум 6 символов.</p>

                <ButtonPrimary
                  type="submit"
                  disabled={
                    passwordSubmitting || !newPassword || newPassword !== confirmPassword
                  }
                  className="w-full justify-center py-3 sm:w-auto sm:min-w-[160px]"
                >
                  {passwordSubmitting ? 'Сохраняем…' : 'Сменить пароль'}
                </ButtonPrimary>
              </form>
            ) : (
              <p className="mt-4 rounded-xl border border-navy/10 bg-surface-alt/50 px-4 py-3 text-sm text-navy/60">
                Вы вошли через Google — пароль в приложении не используется. Для смены пароля
                используйте настройки Google-аккаунта.
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
