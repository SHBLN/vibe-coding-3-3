import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowUpRightIcon, StarIcon } from './ui'

const features = [
  {
    icon: StarIcon,
    tag: 'РАЗБИВКА ЗАДАЧ С ИИ',
    title: 'От «надо бы» до «сделано».',
    description:
      'Опишите цель — ИИ разобьёт её на конкретные подзадачи с исполнителями и сроками.',
    showGoal: true,
  },
  {
    icon: ArrowUpRightIcon,
    tag: 'УМНЫЙ KANBAN',
    title: 'Видьте поток, а не просто списки.',
    description:
      'Колонки по статусам, drag-and-drop и live-обновления — как в Trello, но умнее.',
    showGoal: false,
  },
  {
    icon: () => (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    tag: 'ИИ-ROADMAP',
    title: 'Знайте, что будет дальше.',
    description:
      'Roadmap строится из тех же задач: эпики, зависимости и сроки на одной временной шкале.',
    showGoal: false,
  },
]

export function FeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const target = sectionRef.current
    if (!target || isVisible) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.2 },
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [isVisible])

  return (
    <section ref={sectionRef} id="продукт" className="relative bg-surface pb-24 pt-24">
      <div className="section-shell">
        <div className="mb-14 text-center">
          <p className="mb-4 text-xs font-black uppercase tracking-[0.25em] text-accent">
            ✦ Одна цель. Чёткий путь вперёд.
          </p>
          <h2 className="mx-auto max-w-4xl text-4xl font-black leading-[1.02] tracking-[-0.045em] text-navy sm:text-5xl lg:text-6xl">
            Доска, которая двигает работу <span className="text-accent">вперёд.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-navy/55">
            Большинство инструментов просто хранят задачи. AiVibeBoard понимает результат,
            к которому вы стремитесь, и помогает команде его достичь.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {features.map((feature, index) => (
            <article
              key={feature.tag}
              className={`group flex min-h-[410px] flex-col overflow-hidden rounded-2xl border border-white/10 p-8 shadow-card transition duration-300 hover:-translate-y-2 ${
                index === 1 ? 'bg-navy-light md:translate-y-8' : 'bg-navy'
              } ${isVisible ? 'motion-stagger' : 'opacity-0 translate-y-2'}`}
              style={
                isVisible ? ({ '--stagger-delay': `${index * 55}ms` } as CSSProperties) : undefined
              }
            >
              <div className="mb-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-accent transition group-hover:rotate-6 group-hover:bg-accent group-hover:text-white">
                <feature.icon className="h-4 w-4" />
              </div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40">
                {feature.tag}
              </p>
              <h3 className="mb-4 text-2xl font-black leading-tight tracking-tight text-white">{feature.title}</h3>
              <p className="mb-6 flex-1 text-sm leading-relaxed text-white/55">
                {feature.description}
              </p>

              {feature.showGoal && (
                <div className="rounded-xl border border-white/10 bg-navy-light p-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-white/40">
                    Ваша цель
                  </p>
                  <p className="mb-3 text-sm font-semibold text-white">
                    Запустить новую брендовую кампанию
                  </p>
                  <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-2/3 rounded-full bg-accent" />
                  </div>
                  <p className="text-[11px] text-white/40">
                    Анализ объёма → создано 14 задач
                  </p>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
