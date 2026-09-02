import { ArrowUpRightIcon, ButtonPrimary, CheckIcon, OrangeUnderline } from './ui'

const benefits = [
  'Ставьте задачи голосом или текстом прямо в чате',
  'Получайте саммари просрочек для руководства',
  'Открывайте проект одним нажатием из уведомления',
]

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-full max-w-xs">
      <div className="overflow-hidden rounded-[2.5rem] border-4 border-navy bg-navy p-1 shadow-hero">
        <div className="overflow-hidden rounded-[2rem] bg-[#172554]">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white">
              б
            </div>
            <span className="text-xs font-semibold text-white">AiVibeBoard Bot</span>
          </div>
          <div className="space-y-3 p-4">
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white p-3">
              <p className="text-xs leading-relaxed text-navy">
                Новая задача: «Запустить Q4-кампанию». Разбить на подзадачи?
              </p>
            </div>
            <div className="ml-auto w-fit rounded-xl bg-navy-light px-4 py-2 text-xs font-medium text-white">
              Показать ↗
            </div>
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white p-3">
              <p className="mb-2 text-xs text-navy">Создано 8 подзадач. Назначены исполнители.</p>
              <button
                type="button"
                className="rounded-lg bg-navy px-3 py-1.5 text-[10px] font-semibold text-white"
              >
                Открыть проект ↗
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function TelegramSection() {
  return (
    <section className="bg-surface py-24">
      <div className="section-shell grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="relative flex items-center justify-center">
          <div className="dot-grid absolute inset-0 rounded-4xl opacity-50" />
          <div className="relative -rotate-2 rounded-[3rem] bg-navy p-8 shadow-hero sm:p-12">
            <PhoneMockup />
          </div>
        </div>

        <article className="rounded-[2.5rem] border border-navy/10 bg-surface p-8 shadow-card lg:p-12">
          <p className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-accent">
            Telegram — ваш новый напарник
          </p>
          <h2 className="mb-6 text-4xl font-black leading-[1.02] tracking-[-0.04em] text-navy sm:text-5xl">
            Ваши проекты могут{' '}
            <OrangeUnderline>общаться с вами.</OrangeUnderline>
          </h2>
          <p className="mb-8 text-base leading-relaxed text-navy/55">
            Ставьте задачи, получайте обновления и контролируйте просрочки — не выходя
            из мессенджера, которым пользуется вся команда.
          </p>

          <ul className="mb-8 space-y-4">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                  <CheckIcon />
                </span>
                <span className="text-sm text-navy/70">{benefit}</span>
              </li>
            ))}
          </ul>

          <ButtonPrimary className="w-full justify-center py-4 text-base">
            Подключить Telegram
            <ArrowUpRightIcon />
          </ButtonPrimary>
        </article>
      </div>
    </section>
  )
}
