import { isSupabaseConfigured } from './lib/supabase'

const features = [
  {
    title: 'Доска задач',
    description: 'Колонки и карточки в духе Trello/Jira со статусами, исполнителями и сроками.',
  },
  {
    title: 'ИИ-разбиение',
    description: 'Глобальная задача автоматически дробится на подзадачи и назначается команде.',
  },
  {
    title: 'Roadmap',
    description: 'Временная шкала строится из тех же задач: эпики, сроки и зависимости.',
  },
  {
    title: 'Telegram',
    description: 'Постановка задач и саммари просрочек для руководства через бота.',
  },
]

function App() {
  const supabaseReady = isSupabaseConfigured()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      <header className="border-b border-white/10 bg-slate-950/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500 font-bold text-white">
              V3
            </div>
            <span className="text-lg font-semibold tracking-tight">Vibe-coding 3</span>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              supabaseReady
                ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
                : 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
            }`}
          >
            {supabaseReady ? 'Supabase подключён' : 'Supabase: задайте .env.local'}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <section className="mb-16 text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-indigo-400">
            Доска задач для команды
          </p>
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Планируйте, разбивайте и&nbsp;контролируйте работу
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-400">
            Стартовый каркас готов. Дальше — доска с колонками, ИИ-разбиение глобальных задач,
            roadmap и интеграция с Telegram.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur transition hover:border-indigo-500/40 hover:bg-white/10"
            >
              <h2 className="mb-2 text-lg font-semibold text-white">{feature.title}</h2>
              <p className="text-sm leading-relaxed text-slate-400">{feature.description}</p>
            </article>
          ))}
        </section>

        <section className="mt-16 rounded-xl border border-dashed border-white/15 bg-slate-900/50 p-8 text-center">
          <h2 className="mb-2 text-xl font-semibold text-white">Локальный запуск</h2>
          <p className="mb-4 text-sm text-slate-400">
            Скопируйте <code className="rounded bg-slate-800 px-1.5 py-0.5 text-indigo-300">.env.example</code>{' '}
            в <code className="rounded bg-slate-800 px-1.5 py-0.5 text-indigo-300">.env.local</code> и
            заполните ключи Supabase.
          </p>
          <div className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 font-mono text-sm text-emerald-400">
            npm run dev
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-6 text-center text-xs text-slate-500">
        React + TypeScript + Tailwind + Supabase
      </footer>
    </div>
  )
}

export default App
