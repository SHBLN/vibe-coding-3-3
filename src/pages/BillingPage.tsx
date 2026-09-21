import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AccountBadge } from '../components/landing/AccountBadge'
import { ButtonPrimary, CheckIcon, LogoIcon } from '../components/landing/ui'
import {
  cancelSubscriptionAtPeriodEnd,
  fetchBillingPayments,
  fetchCurrentSubscription,
  formatMoney,
  formatPlanLabel,
  paymentStatusLabel,
  startCheckout,
  subscriptionStatusLabel,
  upgradeSubscription,
  type BillingPaymentRow,
  type BillingPlanId,
  type BillingSubscriptionRow,
} from '../lib/billing'
import { useAuth } from '../hooks/useAuth'
import { fetchOwnerDistinctTeamMemberIds } from '../lib/boardMembers'
import { listBoards } from '../lib/boards'
import {
  boardsLimitLabel,
  canUseAiSplit,
  planIncludesAiSplit,
  teamMemberLimitLabel,
} from '../lib/planLimits'
import {
  canCancelSubscription,
  isSubscriptionEntitled,
  resolvePlanAction,
} from '../lib/subscriptionRules'

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

type NoticeTone = 'success' | 'warning' | 'error'

function BillingNotice({
  tone,
  children,
  onDismiss,
}: {
  tone: NoticeTone
  children: string
  onDismiss?: () => void
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-900'
      : tone === 'warning'
        ? 'border-amber-400/35 bg-amber-500/10 text-amber-950'
        : 'border-red-400/35 bg-red-500/10 text-red-800'

  return (
    <div
      className={`mb-6 flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${toneClass}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <p className="leading-relaxed">{children}</p>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold opacity-70 transition hover:bg-white/40 hover:opacity-100"
        >
          Закрыть
        </button>
      ) : null}
    </div>
  )
}

function planCardBadge(
  planAction: ReturnType<typeof resolvePlanAction>,
  popular: boolean,
): { label: string; className: string } | null {
  if (planAction.action === 'current') {
    return {
      label: 'Ваш тариф',
      className: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
    }
  }
  if (planAction.action === 'upgrade') {
    return {
      label: 'Повышение',
      className: 'border-accent/50 bg-accent/15 text-accent',
    }
  }
  if (planAction.action === 'blocked') {
    return {
      label: 'Позже',
      className: 'border-white/15 bg-white/5 text-white/45',
    }
  }
  if (popular) {
    return {
      label: 'Популярный',
      className: 'border-accent/50 bg-accent/10 text-accent',
    }
  }
  return null
}

function CancelSubscriptionModal({
  open,
  busy,
  periodEndLabel,
  onClose,
  onConfirm,
}: {
  open: boolean
  busy: boolean
  periodEndLabel: string | null
  onClose: () => void
  onConfirm: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (!busy && event.target === event.currentTarget) onClose()
      }}
    >
      <div className="absolute inset-0 bg-navy/50 backdrop-blur-sm" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-subscription-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-navy/10 bg-white p-6 shadow-hero"
      >
        <h2 id="cancel-subscription-title" className="text-lg font-black text-navy">
          Отменить автопродление?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-navy/65">
          Доступ к функциям тарифа сохранится до конца оплаченного периода. После этой даты можно
          оформить любой план, в том числе более дешёвый.
        </p>
        {periodEndLabel ? (
          <p className="mt-3 rounded-xl bg-surface-alt/80 px-3 py-2 text-xs text-navy/55">
            Оплаченный период до:{' '}
            <span className="font-semibold text-navy">{periodEndLabel}</span>
          </p>
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="press-down rounded-xl border border-navy/15 bg-white px-4 py-2.5 text-sm font-bold text-navy/70 transition hover:border-navy/25 disabled:opacity-50"
          >
            Оставить подписку
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="press-down rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
          >
            {busy ? 'Отмена…' : 'Отменить автопродление'}
          </button>
        </div>
      </div>
    </div>
  )
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
  const [boardCount, setBoardCount] = useState(0)
  const [teamMemberCount, setTeamMemberCount] = useState(0)
  const [canceling, setCanceling] = useState(false)
  const [cancelMessage, setCancelMessage] = useState<string | null>(null)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)

  const selectedPlan = PLANS.find((p) => p.id === selectedPlanId) ?? PLANS[1]
  const selectedPlanAction = resolvePlanAction(subscription, selectedPlanId)

  const loadBilling = useCallback(async () => {
    setBillingLoading(true)
    setBillingError(null)
    try {
      const [payments, currentSubscription, boards, teamIds] = await Promise.all([
        fetchBillingPayments(),
        fetchCurrentSubscription(),
        listBoards(),
        fetchOwnerDistinctTeamMemberIds(),
      ])
      setPaymentHistory(payments)
      setSubscription(currentSubscription)
      setBoardCount(boards.length)
      setTeamMemberCount(teamIds.length)
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

  const handlePrimaryPlanAction = async () => {
    setSuccess(null)
    setPayError(null)
    setCancelMessage(null)

    if (selectedPlanAction.action === 'current' || selectedPlanAction.action === 'blocked') {
      return
    }

    setPaying(true)
    try {
      if (selectedPlanAction.action === 'upgrade') {
        const result = await upgradeSubscription(selectedPlanId)
        setSuccess(
          `Тариф повышен до ${formatPlanLabel(result.planId)}. Изменения применены, доплата списана по правилам Stripe.`,
        )
        await loadBilling()
      } else {
        await startCheckout(selectedPlanId)
      }
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Не удалось выполнить действие.')
    } finally {
      setPaying(false)
    }
  }

  const handleConfirmCancelSubscription = async () => {
    setPayError(null)
    setSuccess(null)
    setCancelMessage(null)

    if (!canCancelSubscription(subscription) || subscription?.cancel_at_period_end) return

    setCanceling(true)
    try {
      const result = await cancelSubscriptionAtPeriodEnd()
      setCancelMessage(
        result.alreadyScheduled
          ? 'Отмена уже была запланирована ранее.'
          : result.currentPeriodEnd
            ? `Автопродление отключено. Доступ сохранится до ${formatDateTime(result.currentPeriodEnd)}.`
            : 'Автопродление будет отключено в конце оплаченного периода.',
      )
      setCancelModalOpen(false)
      await loadBilling()
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Не удалось отменить подписку.')
    } finally {
      setCanceling(false)
    }
  }

  const primaryButtonLabel = (() => {
    if (paying) {
      return selectedPlanAction.action === 'upgrade' ? 'Повышение…' : 'Переход в Stripe…'
    }
    switch (selectedPlanAction.action) {
      case 'upgrade':
        return `Повысить до ${selectedPlan.name}`
      case 'current':
        return 'Текущий тариф'
      case 'blocked':
        return 'Недоступно'
      default:
        return 'Оплатить'
    }
  })()

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

        {cancelMessage ? (
          <BillingNotice tone="warning" onDismiss={() => setCancelMessage(null)}>
            {cancelMessage}
          </BillingNotice>
        ) : null}

        {success ? (
          <BillingNotice tone="success" onDismiss={() => setSuccess(null)}>
            {success}
          </BillingNotice>
        ) : null}

        {payError ? (
          <BillingNotice tone="error" onDismiss={() => setPayError(null)}>
            {payError}
          </BillingNotice>
        ) : null}

        {billingError ? (
          <BillingNotice tone="error" onDismiss={() => setBillingError(null)}>
            {billingError}
          </BillingNotice>
        ) : null}

        {subscription ? (
          <section className="panel-shell mb-8 overflow-hidden">
            <div className="border-b border-navy/10 bg-gradient-to-r from-navy to-navy-light px-6 py-5 text-white">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">
                Текущая подписка
              </p>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-2xl font-black tracking-tight">
                    {formatPlanLabel(subscription.plan_id)}
                  </p>
                  {subscription.current_period_end ? (
                    <p className="mt-1 text-sm text-white/55">
                      Период до {formatDateTime(subscription.current_period_end)}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(subscription.status)}`}
                  >
                    {subscriptionStatusLabel(subscription.status)}
                  </span>
                  {subscription.cancel_at_period_end && isSubscriptionEntitled(subscription) ? (
                    <span className="inline-flex rounded-full border border-amber-300/40 bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-100">
                      Без автопродления
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid gap-3 p-6 sm:grid-cols-3">
              <div className="rounded-xl border border-navy/10 bg-surface-alt/40 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Проекты</p>
                <p className="mt-1 text-lg font-black text-navy">
                  {boardCount}
                  <span className="text-sm font-semibold text-navy/45">
                    {' '}
                    / {boardsLimitLabel(subscription.plan_id)}
                  </span>
                </p>
              </div>
              <div className="rounded-xl border border-navy/10 bg-surface-alt/40 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Команда</p>
                <p className="mt-1 text-lg font-black text-navy">
                  {teamMemberCount}
                  <span className="text-sm font-semibold text-navy/45">
                    {teamMemberLimitLabel(subscription.plan_id)
                      ? ` / ${teamMemberLimitLabel(subscription.plan_id)}`
                      : ' · ∞'}
                  </span>
                </p>
              </div>
              <div className="rounded-xl border border-navy/10 bg-surface-alt/40 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-navy/40">ИИ</p>
                <p className="mt-1 text-sm font-bold leading-snug text-navy">
                  {canUseAiSplit(subscription)
                    ? 'Доступно'
                    : planIncludesAiSplit(subscription.plan_id)
                      ? 'Нужна активная оплата'
                      : 'Только Pro+'}
                </p>
              </div>
            </div>

            {canCancelSubscription(subscription) ? (
              <div className="flex flex-col gap-2 border-t border-navy/10 bg-surface/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-navy/50">
                  {subscription.cancel_at_period_end
                    ? 'Автопродление уже отключено — тариф действует до конца периода.'
                    : 'Понижение тарифа — после окончания текущего периода.'}
                </p>
                {!subscription.cancel_at_period_end ? (
                  <button
                    type="button"
                    disabled={canceling}
                    onClick={() => setCancelModalOpen(true)}
                    className="press-down shrink-0 text-sm font-semibold text-navy/55 underline-offset-2 transition hover:text-red-600 hover:underline disabled:opacity-50"
                  >
                    Отменить автопродление
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="mb-10">
          <h2 className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-accent">
            Тарифные планы
          </h2>
          <div className="grid gap-5 md:grid-cols-3">
            {PLANS.map((plan) => {
              const isSelected = plan.id === selectedPlanId
              const planAction = resolvePlanAction(subscription, plan.id)
              const isCurrent = planAction.action === 'current'
              const isBlocked = planAction.action === 'blocked'
              const badge = planCardBadge(planAction, plan.popular)
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => {
                    setSelectedPlanId(plan.id)
                    setSuccess(null)
                    setPayError(null)
                  }}
                  className={`relative flex min-h-[380px] flex-col rounded-2xl border p-8 text-left shadow-card transition duration-300 ${
                    isBlocked
                      ? 'cursor-default border-navy/10 bg-navy/90 opacity-90'
                      : 'hover:-translate-y-1'
                  } ${
                    isSelected
                      ? isCurrent
                        ? 'border-emerald-400/50 bg-navy-light ring-2 ring-emerald-400/40'
                        : 'border-accent/60 bg-navy-light ring-2 ring-accent/50'
                      : isBlocked
                        ? ''
                        : 'border-navy/10 bg-navy hover:border-navy/20'
                  }`}
                >
                  {badge ? (
                    <span
                      className={`absolute right-6 top-6 inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  ) : null}
                  <p className="mb-4 pr-24 text-xs font-semibold uppercase tracking-[0.15em] text-white/40">
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
                  {isSelected && !isCurrent ? (
                    <p className="mt-6 text-center text-xs font-bold uppercase tracking-wider text-accent">
                      Выбран
                    </p>
                  ) : null}
                </button>
              )
            })}
          </div>

          <div className="panel-shell mt-6 p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.15em] text-navy/40">
                  {selectedPlanAction.action === 'upgrade'
                    ? 'Повышение'
                    : selectedPlanAction.action === 'current'
                      ? 'Ваш план'
                      : selectedPlanAction.action === 'blocked'
                        ? 'Недоступно'
                        : 'Оплата'}
                </p>
                <p className="mt-1 text-2xl font-black text-navy">
                  {selectedPlan.price}
                  <span className="text-base font-medium text-navy/45">{selectedPlan.period}</span>
                  <span className="ml-2 text-sm font-semibold text-navy/50">· {selectedPlan.name}</span>
                </p>
              </div>
              <ButtonPrimary
                type="button"
                disabled={
                  paying ||
                  selectedPlanAction.action === 'current' ||
                  selectedPlanAction.action === 'blocked'
                }
                onClick={() => void handlePrimaryPlanAction()}
                className="w-full justify-center px-8 py-3 sm:w-auto sm:min-w-[220px]"
              >
                {primaryButtonLabel}
              </ButtonPrimary>
            </div>

            {selectedPlanAction.action === 'upgrade' ? (
              <p className="mt-4 rounded-xl border border-accent/15 bg-accent/5 px-3 py-2 text-xs leading-relaxed text-navy/60">
                Доплата за оставшийся период рассчитывается Stripe автоматически (proration).
              </p>
            ) : null}

            {selectedPlanAction.action === 'blocked' && selectedPlanAction.message ? (
              <p className="mt-4 rounded-xl border border-navy/10 bg-surface-alt/60 px-3 py-2 text-xs leading-relaxed text-navy/55">
                {selectedPlanAction.message}
              </p>
            ) : null}

            {selectedPlanAction.action === 'current' ? (
              <p className="mt-4 text-xs text-navy/45">
                Чтобы перейти на более дешёвый тариф, сначала отключите автопродление и дождитесь
                окончания периода.
              </p>
            ) : null}
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

      <CancelSubscriptionModal
        open={cancelModalOpen}
        busy={canceling}
        periodEndLabel={
          subscription?.current_period_end
            ? formatDateTime(subscription.current_period_end)
            : null
        }
        onClose={() => {
          if (!canceling) setCancelModalOpen(false)
        }}
        onConfirm={() => void handleConfirmCancelSubscription()}
      />
    </div>
  )
}
