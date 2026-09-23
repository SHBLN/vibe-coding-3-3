import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { LANDING_HOW_IT_WORKS_ID } from '../../lib/landingAnchors'
import { ArrowUpRightIcon, OrangeUnderline } from './ui'

const stats = [
  { value: '68%', label: 'меньше времени на планирование' },
  { value: '2.4×', label: 'быстрее выход к результату' },
  { value: '91%', label: 'задач выполнены в срок' },
]

const steps = [
  {
    num: '01',
    title: 'Расскажите, куда идём',
    description: 'Опишите цель в свободной форме — через веб или Telegram.',
  },
  {
    num: '02',
    title: 'ИИ разбивает и назначает',
    description: 'Получите эпик с подзадачами, исполнителями и сроками.',
  },
  {
    num: '03',
    title: 'Команда движется вперёд',
    description: 'Доска, roadmap и уведомления держат всех в фокусе.',
  },
]

export function ResultsSection() {
  const stepsRef = useRef<HTMLDivElement>(null)
  const [stepsVisible, setStepsVisible] = useState(false)

  useEffect(() => {
    const target = stepsRef.current
    if (!target || stepsVisible) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setStepsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.2 },
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [stepsVisible])

  return (
    <section className="bg-surface pb-24 pt-8">
      <div className="section-shell rounded-3xl bg-navy px-5 py-8 shadow-hero sm:p-10 lg:p-14">
        <div className="mb-8 grid gap-5 lg:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-navy-light p-8 lg:p-10">
            <h2 className="mb-5 text-4xl font-black leading-[1.02] tracking-tight text-white sm:text-5xl">
              <OrangeUnderline variant="light">Больше</OrangeUnderline> результатов.
              <br />
              Меньше хаоса.
            </h2>
            <p className="mb-6 max-w-md text-sm leading-relaxed text-white/50">
              Команды, которые перешли на AiVibeBoard, тратят меньше времени на координацию
              и больше — на работу, которая двигает проект вперёд.
            </p>
            <a
              href={`#${LANDING_HOW_IT_WORKS_ID}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-white transition hover:text-accent"
            >
              Смотреть рабочий процесс команды
              <ArrowUpRightIcon />
            </a>
          </article>

          <div className="grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-navy-light p-5 sm:p-8">
            {stats.map((stat) => (
              <div key={stat.value} className="flex flex-col items-center px-2 text-center">
                <p className="mb-2 text-2xl font-black text-accent sm:text-5xl">{stat.value}</p>
                <p className="mb-4 text-[11px] leading-snug text-white/40">{stat.label}</p>
                <div className="h-2 w-2 rounded-full bg-accent" />
              </div>
            ))}
          </div>
        </div>

        <div id={LANDING_HOW_IT_WORKS_ID} className="grid gap-5 lg:grid-cols-2">
          <article className="dot-grid rounded-2xl border border-navy/10 bg-surface p-8 lg:p-10">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-navy/40">
              Как это работает
            </p>
            <h2 className="text-4xl font-black leading-[1.02] tracking-tight text-navy sm:text-5xl">
              Принесите амбиции.
              <br />
              <OrangeUnderline>Мы принесём план.</OrangeUnderline>
            </h2>
          </article>

          <div ref={stepsRef} className="flex flex-col gap-3">
            {steps.map((step, index) => (
              <article
                key={step.num}
                className={`group relative rounded-2xl border border-navy/10 bg-surface p-6 shadow-card transition hover:translate-x-2 ${
                  stepsVisible ? 'motion-stagger' : 'opacity-0 translate-y-2'
                }`}
                style={
                  stepsVisible ? ({ '--stagger-delay': `${index * 55}ms` } as CSSProperties) : undefined
                }
              >
                <span className="absolute right-5 top-5 text-accent">
                  <ArrowUpRightIcon className="h-4 w-4 rotate-90" />
                </span>
                <p className="mb-2 text-xs font-black text-accent">{step.num} / 03</p>
                <h3 className="mb-1 text-lg font-black text-navy">{step.title}</h3>
                <p className="text-sm text-navy/50">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
