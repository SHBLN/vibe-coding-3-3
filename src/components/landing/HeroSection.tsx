import { ArrowUpRightIcon, ButtonPrimary, OrangeUnderline, PlayIcon, StarIcon } from './ui'

function DashboardMockup() {
  const columns = [
    {
      title: 'В работе',
      tasks: [
        { label: 'Дизайн', title: 'Макеты лендинга', color: 'bg-purple-400' },
        { label: 'Разработка', title: 'API интеграция', color: 'bg-blue-400' },
      ],
    },
    {
      title: 'На проверке',
      tasks: [{ label: 'Маркетинг', title: 'Контент-план', color: 'bg-accent' }],
    },
    {
      title: 'Готово',
      tasks: [{ label: 'Аналитика', title: 'Настройка метрик', color: 'bg-emerald-400' }],
    },
  ]

  return (
    <div className="-rotate-1 overflow-hidden rounded-3xl border-[6px] border-white/10 bg-white shadow-hero transition duration-500 hover:rotate-0">
      <div className="flex">
        <aside className="hidden w-16 shrink-0 flex-col items-center gap-4 bg-navy py-5 sm:flex">
          {[StarIcon, StarIcon, StarIcon, StarIcon].map((Icon, i) => (
            <div key={i} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40">
              <Icon className="h-4 w-4" />
            </div>
          ))}
        </aside>
        <div className="min-w-0 flex-1 bg-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-navy">Доска проекта</span>
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
              12 задач
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {columns.map((col) => (
              <div key={col.title} className="rounded-xl bg-white/70 p-2.5">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-navy/50">
                  {col.title}
                </p>
                {col.tasks.map((task) => (
                  <div
                    key={task.title}
                    className="mb-2 rounded-lg border border-navy/5 bg-white p-2 shadow-sm last:mb-0"
                  >
                    <span
                      className={`mb-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-medium text-white ${task.color}`}
                    >
                      {task.label}
                    </span>
                    <p className="text-[11px] font-medium leading-tight text-navy">{task.title}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

type HeroSectionProps = {
  isAuthenticated: boolean
  onRegisterClick: () => void
  onGoToBoards: () => void
  onHowItWorksClick: () => void
}

export function HeroSection({
  isAuthenticated,
  onRegisterClick,
  onGoToBoards,
  onHowItWorksClick,
}: HeroSectionProps) {
  const handlePrimaryCta = () => {
    if (isAuthenticated) {
      onGoToBoards()
      return
    }
    onRegisterClick()
  }

  return (
    <section className="section-shell pb-5">
      <div className="relative overflow-hidden rounded-3xl bg-navy shadow-hero">
        <div className="dot-grid absolute inset-0 opacity-20" />
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-accent/20 blur-[100px]" />
        <div className="relative grid min-h-[650px] items-center gap-12 p-7 sm:p-10 lg:grid-cols-[1.05fr_.95fr] lg:p-16">
          <div className="max-w-2xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white/75">
              <StarIcon className="h-3 w-3 text-accent" />
              Операционная система для амбициозных команд
            </div>

            <h1 className="mb-7 text-[2.75rem] font-black leading-[.95] tracking-[-0.055em] text-white sm:text-6xl lg:text-[5rem]">
              Большие цели.
              <br />
              <OrangeUnderline variant="light">Чёткие действия.</OrangeUnderline>
            </h1>

            <p className="mb-9 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">
              AiVibeBoard превращает ваши амбиции в структурированные, назначенные и
              отслеживаемые задачи — чтобы команда всегда знала, что делать дальше.
            </p>

            <div className="mb-8 flex flex-wrap items-center gap-4">
              <ButtonPrimary className="px-6 py-3.5" onClick={handlePrimaryCta}>
                {isAuthenticated ? 'Открыть доски' : 'Начать бесплатно'}
                <ArrowUpRightIcon />
              </ButtonPrimary>
              <button
                type="button"
                onClick={onHowItWorksClick}
                className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 transition hover:text-white"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10">
                  <PlayIcon className="h-3.5 w-3.5 text-navy" />
                </span>
                Как это работает
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {['АК', 'МС', 'ДВ', 'ЕЛ'].map((initials) => (
                  <div
                    key={initials}
                    className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-navy bg-surface text-[10px] font-bold text-navy"
                  >
                    {initials}
                  </div>
                ))}
              </div>
              <p className="text-sm text-white/45">
                <span className="font-semibold text-white">4.9/5</span> от команд, которые
                создают будущее
              </p>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -right-4 -top-4 h-40 w-40 rounded-full bg-accent/25 blur-3xl" />
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  )
}
