import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ButtonPrimary, LogoIcon } from '../components/landing/ui'
import { useAuth } from '../hooks/useAuth'
import { updateProfile } from '../lib/auth'
import { IT_ROLES } from '../lib/roles'

export function OnboardingPage() {
  const navigate = useNavigate()
  const { account, loading, profileComplete, refresh } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <span className="text-sm text-navy/50">Загрузка…</span>
      </div>
    )
  }

  if (!account) {
    return <Navigate to="/" replace />
  }

  if (profileComplete) {
    return <Navigate to="/boards" replace />
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!role) {
      setError('Выберите роль в команде.')
      return
    }

    setSubmitting(true)

    try {
      await updateProfile({
        displayName: displayName.trim() || account.displayName,
        role,
      })
      await refresh()
      navigate('/boards', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить профиль.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-surface to-surface-alt p-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-navy/10 bg-white shadow-hero">
        <div className="border-b border-navy/10 bg-navy px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-light text-accent">
              <LogoIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-100">
                Завершите регистрацию
              </h1>
              <p className="text-xs text-slate-400">
                Выберите роль в команде, чтобы продолжить работу с доской
              </p>
            </div>
          </div>
        </div>

        <form className="space-y-4 bg-white px-6 py-6" onSubmit={(event) => void handleSubmit(event)}>
          {error ? (
            <div
              className="rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <div className="space-y-2">
            <label htmlFor="onboarding-name" className="block text-sm font-semibold text-navy">
              Имя
            </label>
            <input
              id="onboarding-name"
              name="displayName"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={account.displayName}
              autoComplete="name"
              disabled={submitting}
              className="w-full rounded-xl border border-navy/15 bg-surface px-4 py-3 text-sm text-navy outline-none transition placeholder:text-navy/40 focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="onboarding-role" className="block text-sm font-semibold text-navy">
              Роль в команде
            </label>
            <select
              id="onboarding-role"
              name="role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              required
              disabled={submitting}
              className="w-full appearance-none rounded-xl border border-navy/15 bg-surface px-4 py-3 text-sm text-navy outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="" disabled>
                Выберите роль
              </option>
              {IT_ROLES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <ButtonPrimary
            type="submit"
            disabled={submitting}
            className="mt-2 w-full justify-center py-3.5"
          >
            {submitting ? 'Сохраняем…' : 'Продолжить'}
          </ButtonPrimary>
        </form>
      </div>
    </div>
  )
}
