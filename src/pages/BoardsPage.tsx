import { useNavigate } from 'react-router-dom'
import { AccountBadge } from '../components/landing/AccountBadge'
import { LogoIcon } from '../components/landing/ui'
import { useAuth } from '../hooks/useAuth'

const columns = [
  {
    title: 'К выполнению',
    cards: ['Разработать API для задач', 'Настроить RLS-политики'],
  },
  {
    title: 'В работе',
    cards: ['Сверстать доску задач'],
  },
  {
    title: 'Готово',
    cards: ['Подключить Supabase Auth'],
  },
]

export function BoardsPage() {
  const navigate = useNavigate()
  const { account, loading, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  if (loading || !account) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <span className="text-sm text-navy/50">Загрузка…</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-navy/10 bg-surface">
        <div className="section-shell flex h-20 items-center justify-between">
          <a
            href="/"
            aria-label="AiVibeBoard — на главную"
            className="flex items-center gap-2.5"
          >
            <div className="flex h-10 w-10 rotate-3 items-center justify-center rounded-2xl bg-navy text-accent shadow-card">
              <LogoIcon />
            </div>
            <span className="text-xl font-black tracking-[-0.04em] text-navy">
              AI VIBE<span className="text-accent">.</span>
            </span>
          </a>

          <AccountBadge account={account} onSignOut={handleSignOut} />
        </div>
      </header>

      <main className="section-shell py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-[-0.04em] text-navy">Доска задач</h1>
          <p className="mt-2 text-navy/60">
            Добро пожаловать, {account.displayName}. Здесь будут ваши колонки и карточки.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {columns.map((column) => (
            <section
              key={column.title}
              className="rounded-3xl border border-navy/10 bg-surface-alt p-4 shadow-sm"
            >
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-navy/50">
                {column.title}
              </h2>
              <ul className="space-y-3">
                {column.cards.map((card) => (
                  <li
                    key={card}
                    className="rounded-2xl border border-navy/10 bg-white p-4 text-sm font-semibold text-navy shadow-sm"
                  >
                    {card}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
