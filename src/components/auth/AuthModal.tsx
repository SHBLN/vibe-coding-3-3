import { useMemo, useState } from 'react'

type AuthView = 'login' | 'register'

type AuthModalProps = {
  isOpen: boolean
  defaultView?: AuthView
  onClose: () => void
}

const roleOptions = [
  'Frontend Developer',
  'Backend Developer',
  'Fullstack Developer',
  'QA Engineer',
  'DevOps Engineer',
  'Project Manager',
  'Product Designer',
]

function FieldLabel({ children }: { children: string }) {
  return <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-navy/45">{children}</label>
}

export function AuthModal({ isOpen, defaultView = 'login', onClose }: AuthModalProps) {
  const [activeView, setActiveView] = useState<AuthView>(defaultView)

  const title = useMemo(() => {
    return activeView === 'login' ? 'Вход в аккаунт' : 'Создать аккаунт'
  }, [activeView])

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Закрыть окно авторизации"
        className="absolute inset-0 bg-navy/55 backdrop-blur-sm"
        onClick={onClose}
      />

      <section className="relative w-full max-w-xl overflow-hidden rounded-5xl border border-navy/10 bg-surface-card shadow-hero">
        <header className="flex items-center justify-between border-b border-navy/10 px-6 py-5 sm:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-navy/45">AI VIBE</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-navy">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-navy/15 px-3 py-1.5 text-sm font-bold text-navy/65 transition hover:border-navy hover:text-navy"
          >
            Закрыть
          </button>
        </header>

        <div className="p-6 sm:p-8">
          <div className="mb-7 grid grid-cols-2 gap-2 rounded-full border border-navy/10 bg-white p-1">
            <button
              type="button"
              onClick={() => setActiveView('login')}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                activeView === 'login' ? 'bg-navy text-white' : 'text-navy/65 hover:text-navy'
              }`}
            >
              Войти
            </button>
            <button
              type="button"
              onClick={() => setActiveView('register')}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                activeView === 'register' ? 'bg-navy text-white' : 'text-navy/65 hover:text-navy'
              }`}
            >
              Регистрация
            </button>
          </div>

          {activeView === 'login' ? (
            <form className="space-y-5">
              <div>
                <FieldLabel>Почта</FieldLabel>
                <input
                  type="email"
                  placeholder="team@company.com"
                  className="w-full rounded-2xl border border-navy/15 bg-white px-4 py-3 text-sm font-medium text-navy outline-none transition focus:border-accent"
                />
              </div>
              <div>
                <FieldLabel>Пароль</FieldLabel>
                <input
                  type="password"
                  placeholder="Введите пароль"
                  className="w-full rounded-2xl border border-navy/15 bg-white px-4 py-3 text-sm font-medium text-navy outline-none transition focus:border-accent"
                />
              </div>
              <button
                type="button"
                className="w-full rounded-full bg-accent px-5 py-3 text-sm font-black text-white shadow-button transition hover:-translate-y-0.5 hover:bg-accent-light"
              >
                Войти
              </button>
            </form>
          ) : (
            <form className="space-y-5">
              <div>
                <FieldLabel>Имя</FieldLabel>
                <input
                  type="text"
                  placeholder="Алексей Смирнов"
                  className="w-full rounded-2xl border border-navy/15 bg-white px-4 py-3 text-sm font-medium text-navy outline-none transition focus:border-accent"
                />
              </div>
              <div>
                <FieldLabel>Почта</FieldLabel>
                <input
                  type="email"
                  placeholder="team@company.com"
                  className="w-full rounded-2xl border border-navy/15 bg-white px-4 py-3 text-sm font-medium text-navy outline-none transition focus:border-accent"
                />
              </div>
              <div>
                <FieldLabel>Роль</FieldLabel>
                <select className="w-full rounded-2xl border border-navy/15 bg-white px-4 py-3 text-sm font-medium text-navy outline-none transition focus:border-accent">
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Пароль</FieldLabel>
                  <input
                    type="password"
                    placeholder="Введите пароль"
                    className="w-full rounded-2xl border border-navy/15 bg-white px-4 py-3 text-sm font-medium text-navy outline-none transition focus:border-accent"
                  />
                </div>
                <div>
                  <FieldLabel>Подтверждение пароля</FieldLabel>
                  <input
                    type="password"
                    placeholder="Повторите пароль"
                    className="w-full rounded-2xl border border-navy/15 bg-white px-4 py-3 text-sm font-medium text-navy outline-none transition focus:border-accent"
                  />
                </div>
              </div>
              <button
                type="button"
                className="w-full rounded-full bg-accent px-5 py-3 text-sm font-black text-white shadow-button transition hover:-translate-y-0.5 hover:bg-accent-light"
              >
                Создать аккаунт
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
