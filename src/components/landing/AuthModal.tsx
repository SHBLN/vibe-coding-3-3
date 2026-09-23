import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { signInWithEmail, signInWithGoogle, signUpWithProfile } from '../../lib/auth'
import { IT_ROLES } from '../../lib/roles'
import { isSupabaseConfigured } from '../../lib/supabase'
import { ButtonPrimary, LogoIcon } from './ui'

export type AuthTab = 'login' | 'register'

type AuthModalProps = {
  isOpen: boolean
  activeTab: AuthTab
  onTabChange: (tab: AuthTab) => void
  onClose: () => void
  onAuthSuccess?: () => void | Promise<void>
}

function CloseIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Field({
  id,
  label,
  type = 'text',
  placeholder,
  autoComplete,
  value,
  onChange,
  required = true,
  disabled = false,
  children,
}: {
  id: string
  label: string
  type?: string
  placeholder?: string
  autoComplete?: string
  value?: string
  onChange?: (value: string) => void
  required?: boolean
  disabled?: boolean
  children?: ReactNode
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-navy">
        {label}
      </label>
      {children ?? (
        <input
          id={id}
          name={id}
          type={type}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
          className="w-full rounded-xl border border-navy/15 bg-surface px-4 py-3 text-sm text-navy outline-none transition placeholder:text-navy/35 focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
        />
      )}
    </div>
  )
}

function AuthMessage({
  error,
  success,
}: {
  error: string | null
  success: string | null
}) {
  if (!error && !success) return null

  return (
    <div
      className={`rounded-xl px-4 py-3 text-sm ${
        error
          ? 'border border-red-400/40 bg-red-500/10 text-red-700'
          : 'border border-emerald-400/40 bg-emerald-500/10 text-emerald-700'
      }`}
      role={error ? 'alert' : 'status'}
    >
      {error ?? success}
    </div>
  )
}

function LoginForm({
  loading,
  onSwitchToRegister,
  onGoogleLogin,
  onSubmit,
}: {
  loading: boolean
  onSwitchToRegister: () => void
  onGoogleLogin: () => Promise<void>
  onSubmit: (payload: { email: string; password: string }) => Promise<void>
}) {
  const formId = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <form
      id={formId}
      className="space-y-4"
      onSubmit={async (event: FormEvent) => {
        event.preventDefault()
        await onSubmit({ email, password })
      }}
    >
      <Field
        id={`${formId}-email`}
        label="Email"
        type="email"
        placeholder="you@company.com"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        disabled={loading}
      />
      <Field
        id={`${formId}-password`}
        label="Пароль"
        type="password"
        placeholder="••••••••"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        disabled={loading}
      />

      <div className="flex items-center justify-between pt-1">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-navy/60">
          <input
            type="checkbox"
            disabled={loading}
            className="h-4 w-4 rounded border-navy/20 text-accent focus:ring-accent/30"
          />
          Запомнить меня
        </label>
        <button
          type="button"
          disabled={loading}
          className="text-sm font-semibold text-accent hover:text-accent-light disabled:opacity-60"
        >
          Забыли пароль?
        </button>
      </div>

      <ButtonPrimary type="submit" disabled={loading} className="mt-2 w-full justify-center py-3.5">
        {loading ? 'Входим…' : 'Войти'}
      </ButtonPrimary>

      <button
        type="button"
        onClick={() => void onGoogleLogin()}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-navy/15 bg-white px-4 py-3 text-sm font-semibold text-navy transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span
          aria-hidden
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-navy/20 bg-white text-xs font-bold text-navy/70"
        >
          G
        </span>
        Войти или зарегистрироваться через Google
      </button>

      <p className="text-center text-sm text-navy/55">
        Нет аккаунта?{' '}
        <button
          type="button"
          onClick={onSwitchToRegister}
          disabled={loading}
          className="font-bold text-accent hover:text-accent-light disabled:opacity-60"
        >
          Зарегистрироваться
        </button>
      </p>
    </form>
  )
}

function RegisterForm({
  loading,
  onSwitchToLogin,
  onGoogleLogin,
  onSubmit,
}: {
  loading: boolean
  onSwitchToLogin: () => void
  onGoogleLogin: () => Promise<void>
  onSubmit: (payload: {
    displayName: string
    email: string
    password: string
    confirmPassword: string
    role: string
  }) => Promise<void>
}) {
  const formId = useId()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState('')

  return (
    <form
      id={formId}
      className="space-y-4"
      onSubmit={async (event: FormEvent) => {
        event.preventDefault()
        await onSubmit({ displayName, email, password, confirmPassword, role })
      }}
    >
      <Field
        id={`${formId}-name`}
        label="Имя"
        type="text"
        placeholder="Алексей"
        autoComplete="name"
        value={displayName}
        onChange={setDisplayName}
        disabled={loading}
      />
      <Field
        id={`${formId}-email`}
        label="Email"
        type="email"
        placeholder="you@company.com"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        disabled={loading}
      />
      <Field
        id={`${formId}-password`}
        label="Пароль"
        type="password"
        placeholder="Минимум 6 символов"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        disabled={loading}
      />
      <Field
        id={`${formId}-confirm-password`}
        label="Подтверждение пароля"
        type="password"
        placeholder="Повторите пароль"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        disabled={loading}
      />
      <Field id={`${formId}-role`} label="Роль в команде">
        <select
          id={`${formId}-role`}
          name="role"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          required
          disabled={loading}
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
      </Field>

      <ButtonPrimary type="submit" disabled={loading} className="mt-2 w-full justify-center py-3.5">
        {loading ? 'Создаём аккаунт…' : 'Создать аккаунт'}
      </ButtonPrimary>

      <button
        type="button"
        onClick={() => void onGoogleLogin()}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-navy/15 bg-white px-4 py-3 text-sm font-semibold text-navy transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span
          aria-hidden
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-navy/20 bg-white text-xs font-bold text-navy/70"
        >
          G
        </span>
        Зарегистрироваться через Google
      </button>

      <p className="text-center text-sm text-navy/55">
        Уже есть аккаунт?{' '}
        <button
          type="button"
          onClick={onSwitchToLogin}
          disabled={loading}
          className="font-bold text-accent hover:text-accent-light disabled:opacity-60"
        >
          Войти
        </button>
      </p>
    </form>
  )
}

export function AuthModal({
  isOpen,
  activeTab,
  onTabChange,
  onClose,
  onAuthSuccess,
}: AuthModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    dialogRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, loading, onClose])

  useEffect(() => {
    if (!isOpen) {
      setError(null)
      setSuccess(null)
      setLoading(false)
    }
  }, [isOpen])

  useEffect(() => {
    setError(null)
    setSuccess(null)
  }, [activeTab])

  const handleLogin = async ({ email, password }: { email: string; password: string }) => {
    if (!isSupabaseConfigured()) {
      setError(
        'Supabase не настроен. Локально — .env.local; на Cloudflare — VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в Variables.',
      )
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      await signInWithEmail({ email, password })
      setSuccess('Вы успешно вошли.')
      await onAuthSuccess?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить вход.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async ({
    displayName,
    email,
    password,
    confirmPassword,
    role,
  }: {
    displayName: string
    email: string
    password: string
    confirmPassword: string
    role: string
  }) => {
    if (!isSupabaseConfigured()) {
      setError(
        'Supabase не настроен. Локально — .env.local; на Cloudflare — VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в Variables.',
      )
      return
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают.')
      return
    }

    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов.')
      return
    }

    if (!role) {
      setError('Выберите роль в команде.')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await signUpWithProfile({
        email,
        password,
        displayName: displayName.trim(),
        role,
      })

      if (result.needsEmailConfirmation) {
        setSuccess('Аккаунт создан. Проверьте почту и подтвердите email, затем войдите.')
        onTabChange('login')
        return
      }

      setSuccess('Аккаунт создан. Добро пожаловать!')
      await onAuthSuccess?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать аккаунт.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    if (!isSupabaseConfigured()) {
      setError(
        'Supabase не настроен. Локально — .env.local; на Cloudflare — VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в Variables.',
      )
      return
    }

    setLoading(true)
    setError(null)
    setSuccess('Перенаправляем в Google...')

    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить вход через Google.')
      setSuccess(null)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (!loading && event.target === event.currentTarget) onClose()
      }}
    >
      <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm modal-overlay" aria-hidden />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="modal-panel relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-navy/10 bg-white shadow-hero outline-none"
      >
        <div className="flex items-start justify-between border-b border-navy/10 bg-navy px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-light text-accent">
              <LogoIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 id={titleId} className="text-lg font-black tracking-tight text-slate-100">
                {activeTab === 'login' ? 'Вход в AiVibeBoard' : 'Регистрация'}
              </h2>
              <p className="text-xs text-slate-400">
                {activeTab === 'login'
                  ? 'Войдите, чтобы продолжить работу с доской'
                  : 'Создайте аккаунт для вашей IT-команды'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Закрыть"
            className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="border-b border-navy/10 bg-white px-6 py-3">
          <div className="flex rounded-xl bg-surface p-1">
            <button
              type="button"
              disabled={loading}
              onClick={() => onTabChange('login')}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-bold transition disabled:opacity-60 ${
                activeTab === 'login'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-navy/60 hover:text-navy'
              }`}
            >
              Вход
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => onTabChange('register')}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-bold transition disabled:opacity-60 ${
                activeTab === 'register'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-navy/60 hover:text-navy'
              }`}
            >
              Регистрация
            </button>
          </div>
        </div>

        <div className="max-h-[min(70vh,640px)] space-y-4 overflow-y-auto bg-white px-6 py-6">
          <AuthMessage error={error} success={success} />
          {activeTab === 'login' ? (
            <LoginForm
              loading={loading}
              onSwitchToRegister={() => onTabChange('register')}
              onGoogleLogin={handleGoogleLogin}
              onSubmit={handleLogin}
            />
          ) : (
            <RegisterForm
              loading={loading}
              onSwitchToLogin={() => onTabChange('login')}
              onGoogleLogin={handleGoogleLogin}
              onSubmit={handleRegister}
            />
          )}
        </div>
      </div>
    </div>
  )
}
