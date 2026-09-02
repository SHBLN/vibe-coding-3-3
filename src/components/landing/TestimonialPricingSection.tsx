import { useState } from 'react'
import { CheckIcon, OrangeUnderline } from './ui'

const plans = [
  {
    name: 'СТАРТ',
    price: 'Бесплатно',
    description: 'Для небольших команд и личных проектов',
    features: ['До 3 участников', '1 проект', 'Базовый Kanban', 'Telegram-бот'],
    popular: false,
  },
  {
    name: 'РОСТ',
    price: '990 ₽',
    period: '/мес',
    description: 'Для растущих команд с ИИ-разбиением',
    features: [
      'До 15 участников',
      'Безлимит проектов',
      'ИИ-разбиение задач',
      'Roadmap',
      'Приоритетная поддержка',
    ],
    popular: true,
  },
  {
    name: 'МАСШТАБ',
    price: 'Обсудим',
    description: 'Для крупных организаций',
    features: [
      'Безлимит участников',
      'SSO и RBAC',
      'Выделенный менеджер',
      'SLA 99.9%',
      'Кастомные интеграции',
    ],
    popular: false,
  },
]

export function TestimonialPricingSection() {
  const [annual, setAnnual] = useState(true)

  return (
    <section id="тарифы" className="bg-surface py-24">
      <div className="section-shell">
        <blockquote className="relative mb-24 overflow-hidden rounded-[2.5rem] bg-accent px-6 py-14 text-center shadow-button sm:px-12 sm:py-20">
          <span aria-hidden="true" className="absolute left-8 top-2 text-[8rem] font-black leading-none text-white/20">“</span>
          <p className="relative mx-auto mb-8 max-w-4xl text-3xl font-black leading-tight tracking-[-0.035em] text-navy sm:text-5xl">
            «Впервые наш инструмент для проектов ощущается как проактивный напарник — а не
            ещё одно место для отчётов»
          </p>
          <footer className="flex items-center justify-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
              НС
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-navy">Нина Солано</p>
              <p className="text-xs text-navy/50">Сооснователь, Artefact Studio</p>
            </div>
          </footer>
        </blockquote>

        <div className="mb-10 text-center">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-accent">
            Простые и честные тарифы
          </p>
          <h2 className="text-4xl font-black tracking-[-0.04em] text-navy sm:text-6xl">
            Начните с малого. <OrangeUnderline>Стройте большое.</OrangeUnderline>
          </h2>

          <div className="mt-8 inline-flex rounded-full border border-navy/10 bg-white p-1">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                !annual ? 'bg-navy text-white' : 'text-navy/60 hover:text-navy'
              }`}
            >
              Ежемесячно
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                annual ? 'bg-navy text-white' : 'text-navy/60 hover:text-navy'
              }`}
            >
              Ежегодно
              <span className="ml-1.5 text-xs text-accent">Экономия 20%</span>
            </button>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`relative flex min-h-[450px] flex-col rounded-[2.5rem] p-8 shadow-hero transition duration-300 hover:-translate-y-2 ${
                plan.popular ? 'bg-navy-light ring-4 ring-accent' : 'bg-navy'
              }`}
            >
              {plan.popular && (
                <span className="absolute right-6 top-6 text-[10px] font-bold uppercase tracking-wider text-accent">
                  Самый популярный
                </span>
              )}
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-white/40">
                {plan.name}
              </p>
              <p className="mb-2 text-4xl font-black tracking-tight text-white">
                {plan.price}
                {plan.period && (
                  <span className="text-base font-medium text-white/40">{plan.period}</span>
                )}
              </p>
              <p className="mb-6 text-sm text-white/40">{plan.description}</p>
              <ul className="mt-auto space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-navy">
                      <CheckIcon />
                    </span>
                    <span className="text-sm text-white/80">{feature}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
