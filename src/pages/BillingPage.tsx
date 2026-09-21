import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AccountBadge } from '../components/landing/AccountBadge'
import { ButtonPrimary, CheckIcon, LogoIcon } from '../components/landing/ui'
import {
  fetchBillingPayments,
  fetchCurrentSubscription,
  formatMoney,
  formatPlanLabel,
  paymentStatusLabel,
  startCheckout,
  subscriptionStatusLabel,
  type BillingPaymentRow,
  type BillingPlanId,
  type BillingSubscriptionRow,
} from '../lib/billing'
import { useAuth } from '../hooks/useAuth'

const PLANS: {
  id: BillingPlanId
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
      'SSO и RBAC',
      'Выделенный менеджер',
      'SLA 99.9%',
      'Кастомные интеграции',
    ],
    popular: false,
  },
]

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function BackIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M5 12l6-6M5 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'paid':
    case 'active':
      return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-800'
    case 'failed':
    case 'past_due':
      return 'border-red-400/40 bg-red-500/10 text-red-700'
    default:
      return 'border-amber-400/40 bg-amber-500/10 text-amber-800'
  }
}

function parsePlanIdFromQuery(value: string | null): BillingPlanId | null {
  if (value === 'light' || value === 'pro' || value === 'enterprise') return value
  return null
}

export function BillingPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { account, loading, signOut } = useAuth()

  const planFromQuery = parsePlanIdFromQuery(searchParams.get('plan'))
  const [selectedPlanId, setSelectedPlanId] = useState<BillingPlanId>(planFromQuery ?? 'pro')
  const [paymentHistory, setPaymentHistory] = useState<BillingPaymentRow[]>([])
  const [subscription, setSubscription] = useState<BillingSubscriptionRow | null>(null)
  const [billingLoading, setBillingLoading] = useState(true)
  const [billingError, setBillingError] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const selectedPlan = PLANS.find((p) => p.id === selectedPlanId) ?? PLANS[1]

  const loadBilling = useCallback(async () => {
    setBillingLoading(true)
    setBillingError(null)
    try {
      const [payments, currentSubscription] = await Promise.all([
        fetchBillingPayments(),
        fetchCurrentSubscription(),
      ])
      setPaymentHistory(payments)
      setSubscription(currentSubscription)
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : 'Не удалось загрузить биллинг.')
    } finally {
      setBillingLoading(false)
    }
  }, [])

  useEffect(() => {
    const fromQuery = parsePlanIdFromQuery(searchParams.get('plan'))
    if (fromQuery) setSelectedPlanId(fromQuery)
  }, [searchParams])

  useEffect(() => {
    if (!account) return
    void loadBilling()
  }, [account, loadBilling])

  useEffect(() => {
    const checkout = searchParams.get('checkout')
    if (checkout === 'success') {
      setSuccess(
        'Оплата принята. Подписка и история обновятся через несколько секунд после обработки webhook.',
      )
      void loadBilling()
      const next = new URLSearchParams(searchParams)
      next.delete('checkout')
      setSearchParams(next, { replace: true })
    } else if (checkout === 'cancel') {
      setPayError('Оплата отменена. Вы можете попробовать снова.')
      const next = new URLSearchParams(searchParams)
      next.delete('checkout')
      setSearchParams(next, { replace: true })
    }
  }, [loadBilling, searchParams, setSearchParams])

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const handlePay = async () => {
    setSuccess(null)
    setPayError(null)
    setPaying(true)
    try {
      await startCheckout(selectedPlanId)
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Не удалось начать оплату.')
      setPaying(false)
    }
  }

  if (loading || !account) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <span className="text-sm text-navy/50">Загрузка…</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-surface to-surface-alt">
      <header className="sticky top-0 z-30 border-b border-navy/10 bg-surface/95 backdrop-blur">
        <div className="section-shell flex h-20 items-center justify-between">
          <Link to="/" aria-label="AiVibeBoard — на главную" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 rotate-3 items-center justify-center rounded-2xl bg-navy text-accent shadow-card">
              <LogoIcon />
            </div>
            <span className="text-xl font-black tracking-[-0.04em] text-navy">
              AI VIBE<span className="text-accent">.</span>
            </span>
          </Link>

          <AccountBadge account={account} onSignOut={handleSignOut} />
        </div>
      </header>

      <main className="section-shell py-8">
        <Link
          to="/boards"
          className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-navy/50 transition hover:text-accent"
        >
          <BackIcon />
          К доскам
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-[-0.04em] text-navy sm:text-4xl">Биллинг</h1>
          <p className="mt-2 max-w-2xl text-sm text-navy/60">
            Выберите тариф и оплатите подписку через Stripe Checkout. История платежей хранится в
            вашем аккаунте.
          </p>
        </div>

        {success ? (
          <div
            className="mb-6 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800"
            role="status"
          >
            {success}
          </div>
        ) : null}

        {payError ? (
          <div
            className="mb-6 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {payError}
          </div>
        ) : null}

        {billingError ? (
          <div
            className="mb-6 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {billingError}
          </div>
        ) : null}

        {subscription ? (
          <section className="panel-shell mb-8 p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Текущая подписка</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="text-lg font-black text-navy">{formatPlanLabel(subscription.plan_id)}</p>
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(subscription.status)}`}
              >
                {subscriptionStatusLabel(subscription.status)}
              </span>
              {subscription.current_period_end ? (
                <p className="text-sm text-navy/55">
                  Действует до {formatDateTime(subscription.current_period_end)}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="mb-10">
          <h2 className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-accent">
            Тарифные планы
          </h2>
          <div className="grid gap-5 md:grid-cols-3">
            {PLANS.map((plan) => {
              const isSelected = plan.id === selectedPlanId
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => {
                    setSelectedPlanId(plan.id)
                    setSuccess(null)
                    setPayError(null)
                  }}
                  className={`relative flex min-h-[380px] flex-col rounded-2xl border p-8 text-left shadow-card transition duration-300 hover:-translate-y-1 ${
                    isSelected
                      ? 'border-accent/60 bg-navy-light ring-2 ring-accent/50'
                      : 'border-navy/10 bg-navy hover:border-navy/20'
                  }`}
                >
                  {plan.popular ? (
                    <span className="absolute right-6 top-6 text-[10px] font-bold uppercase tracking-wider text-accent">
                      Самый популярный
                    </span>
                  ) : null}
                  <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-white/40">
                    {plan.name}
                  </p>
                  <p className="mb-2 text-4xl font-black tracking-tight text-white">
                    {plan.price}
                    <span className="text-base font-medium text-white/40">{plan.period}</span>
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
                  {isSelected ? (
                    <p className="mt-6 text-center text-xs font-bold uppercase tracking-wider text-accent">
                      Выбран
                    </p>
                  ) : null}
                </button>
              )
            })}
          </div>

          <div className="panel-shell mt-6 flex flex-col items-stretch gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-navy">К оплате</p>
              <p className="text-2xl font-black text-navy">
                {selectedPlan.price}
                <span className="text-base font-medium text-navy/45">{selectedPlan.period}</span>
                <span className="ml-2 text-sm font-semibold text-navy/50">· {selectedPlan.name}</span>
              </p>
            </div>
            <ButtonPrimary
              type="button"
              disabled={paying}
              onClick={() => void handlePay()}
              className="justify-center px-8 py-3 sm:min-w-[200px]"
            >
              {paying ? 'Переход в Stripe…' : 'Оплатить'}
            </ButtonPrimary>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-accent">
            История платежей
          </h2>
          <div className="panel-shell overflow-hidden">
            {billingLoading ? (
              <p className="px-5 py-8 text-sm text-navy/50">Загрузка истории…</p>
            ) : paymentHistory.length === 0 ? (
              <p className="px-5 py-8 text-sm text-navy/50">Платежей пока нет.</p>
            ) : (
              <ul className="divide-y divide-navy/10">
                {paymentHistory.map((payment) => {
                  const paidAt = payment.paid_at ?? payment.created_at
                  return (
                    <li
                      key={payment.id}
                      className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-navy">
                          {formatPlanLabel(payment.plan_id)}{' '}
                          <span className="font-semibold text-navy/60">
                            {formatMoney(payment.amount_cents, payment.currency)}
                          </span>
                        </p>
                        <p className="mt-1 text-xs text-navy/45">{formatDateTime(paidAt)}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-navy/35">
                          {payment.stripe_invoice_id}
                        </p>
                      </div>
                      <span
                        className={`inline-flex w-fit shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(payment.status)}`}
                      >
                        {paymentStatusLabel(payment.status)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
