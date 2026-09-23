import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ButtonPrimary, CheckIcon, OrangeUnderline, TelegramIcon } from './ui'

export type PricingPlanId = 'light' | 'pro' | 'enterprise'

const plans: {
  id: PricingPlanId
  name: string
  price: string
  period: string
  description: string
  features: string[]
  popular: boolean
}[] = [
  {
    id: 'light',
    name: 'LIGHT',
    price: '$9.99',
    period: '/мес',
    description: 'Для небольших команд и личных проектов',
    features: ['До 3 участников', '1 проект', 'Базовый Kanban', 'Telegram-бот'],
    popular: false,
  },
  {
    id: 'pro',
    name: 'PRO',
    price: '$19.99',
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
    id: 'enterprise',
    name: 'ENTERPRISE',
    price: '$29.99',
    period: '/мес',
    description: 'Для крупных организаций',
    features: [
      'Безлимит участников',
      'Безлимит проектов',
      'ИИ-разбиение задач',
      'SSO и RBAC',
      'Выделенный менеджер',
      'SLA 99.9%',
      'Кастомные интеграции',
    ],
    popular: false,
  },
]

type TestimonialPricingSectionProps = {
  isAuthenticated: boolean
  authLoading?: boolean
  onPayPlan: (planId: PricingPlanId) => void
}

export function TestimonialPricingSection({
  isAuthenticated,
  authLoading = false,
  onPayPlan,
}: TestimonialPricingSectionProps) {
  const pricingGridRef = useRef<HTMLDivElement>(null)
  const [isPricingVisible, setIsPricingVisible] = useState(false)

  useEffect(() => {
    const target = pricingGridRef.current
    if (!target || isPricingVisible) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsPricingVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.2 },
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [isPricingVisible])

  return (
    <section id="тарифы" className="bg-surface py-24">
      <div className="section-shell">
        <blockquote className="panel-shell relative mb-24 overflow-hidden bg-surface-alt px-6 py-14 text-center sm:px-12 sm:py-20">
          <span aria-hidden="true" className="absolute left-8 top-2 text-[8rem] font-black leading-none text-navy/10">“</span>
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

          <p className="mt-4 text-sm font-semibold text-navy/55">Все цены указаны за месяц.</p>
        </div>

        <div ref={pricingGridRef} className="grid gap-5 md:grid-cols-3">
          {plans.map((plan, index) => (
            <article
              key={plan.name}
              className={`relative flex min-h-[450px] flex-col rounded-2xl border p-8 shadow-card transition duration-300 hover:-translate-y-2 ${
                plan.popular ? 'border-accent/50 bg-navy-light ring-2 ring-accent/50' : 'border-navy/10 bg-navy'
              } ${isPricingVisible ? 'motion-stagger' : 'opacity-0 translate-y-2'}`}
              style={
                isPricingVisible
                  ? ({ '--stagger-delay': `${index * 55}ms` } as CSSProperties)
                  : undefined
              }
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
              <ul className="mb-6 mt-auto space-y-3">
                {plan.features.map((feature) => {
                  const isTelegramFeature = feature.toLowerCase().includes('telegram')
                  return (
                    <li key={feature} className="flex items-center gap-3">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          isTelegramFeature ? 'bg-[#229ED9] text-white' : 'bg-accent text-navy'
                        }`}
                      >
                        {isTelegramFeature ? (
                          <TelegramIcon className="h-3 w-3" />
                        ) : (
                          <CheckIcon />
                        )}
                      </span>
                      <span className="text-sm text-white/80">{feature}</span>
                    </li>
                  )
                })}
              </ul>
              <ButtonPrimary
                type="button"
                disabled={authLoading}
                onClick={() => onPayPlan(plan.id)}
                className="w-full justify-center py-3"
              >
                {authLoading ? 'Загрузка…' : isAuthenticated ? 'Оплатить' : 'Войти и оплатить'}
              </ButtonPrimary>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
