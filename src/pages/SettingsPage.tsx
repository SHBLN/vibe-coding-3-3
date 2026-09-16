import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AccountBadge } from '../components/landing/AccountBadge'
import { ButtonPrimary, LogoIcon } from '../components/landing/ui'
import { useAuth } from '../hooks/useAuth'
import {
  getTelegramUsername,
  normalizeTelegramUsername,
  saveTelegramUsername,
  validateTelegramUsername,
} from '../lib/telegramSettings'

function BackIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M5 12l6-6M5 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const { account, loading, signOut } = useAuth()

  const [username, setUsername] = useState('')
  const [savedUsername, setSavedUsername] = useState('')
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!account) return

    let cancelled = false

    async function loadSettings() {
      setSettingsLoading(true)
      setError(null)

      try {
        const stored = await getTelegramUsername()
        if (cancelled) return

        setUsername(stored)
        setSavedUsername(stored)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Не удалось загрузить username.')
        }
      } finally {
        if (!cancelled) setSettingsLoading(false)
      }
    }

    void loadSettings()

    return () => {
      cancelled = true
    }
  }, [account])

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const validationError = validateTelegramUsername(username)
    if (validationError) {
      setError(validationError)
      return
    }

    const normalized = normalizeTelegramUsername(username)

    setSubmitting(true)
    try {
      await saveTelegramUsername(normalized)
      setUsername(normalized)
      setSavedUsername(normalized)
      setSuccess(`Username @${normalized} сохранён в профиле.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить username.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !account || settingsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <span className="text-sm text-navy/50">Загрузка…</span>
      </div>
    )
  }

  const hasChanges = normalizeTelegramUsername(username) !== savedUsername

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
        <div className="mx-auto max-w-xl">
          <Link
            to="/boards"
            className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-navy/50 transition hover:text-accent"
          >
            <BackIcon />
            К доскам
          </Link>

          <div className="mb-6">
            <h1 className="text-3xl font-black tracking-[-0.04em] text-navy">Настройки</h1>
            <p className="mt-2 text-sm text-navy/60">
              Привяжите Telegram, чтобы получать уведомления и ставить задачи через бота.
            </p>
          </div>

          <section className="panel-shell p-6">
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-lg">
                ✈
              </div>
              <div>
                <h2 className="text-sm font-bold text-navy">Telegram</h2>
                <p className="mt-1 text-xs leading-relaxed text-navy/60">
                  Укажите ваш username в Telegram — он сохранится в профиле и будет использоваться
                  для связи с ботом.
                </p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
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

              <div className="space-y-2">
                <label htmlFor="telegram-username" className="block text-sm font-semibold text-navy">
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
                      setError(null)
                      setSuccess(null)
                    }}
                    placeholder="username"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={submitting}
                    className="min-w-0 flex-1 bg-surface px-4 py-3 text-sm text-navy outline-none placeholder:text-navy/40 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
                <p className="text-xs text-navy/45">
                  5–32 символа: латиница, цифры и подчёркивание. Можно вводить с @ или без.
                </p>
              </div>

              {savedUsername ? (
                <p className="text-xs text-navy/50">
                  Текущее сохранённое значение:{' '}
                  <span className="font-semibold text-navy">@{savedUsername}</span>
                </p>
              ) : null}

              <div className="flex gap-3 pt-2">
                <ButtonPrimary
                  type="submit"
                  disabled={submitting || !hasChanges}
                  className="flex-1 justify-center py-3"
                >
                  {submitting ? 'Сохраняем…' : 'Сохранить'}
                </ButtonPrimary>
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  )
}
