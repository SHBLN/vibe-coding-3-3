import type { Tables } from './database.types'
import { supabase } from './supabase'

export type BillingPlanId = 'light' | 'pro' | 'enterprise'

export type BillingPaymentRow = Tables<'billing_payments'>
export type BillingSubscriptionRow = Tables<'billing_subscriptions'>

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: Response }).context
    if (context instanceof Response) {
      try {
        const body = (await context.clone().json()) as {
          error?: string
          missingKeys?: string[]
        }

        if (body.missingKeys?.length) {
          return `Stripe не настроен. Добавьте secrets в Supabase: ${body.missingKeys.join(', ')}`
        }

        if (body.error) return body.error
      } catch {
        // ignore JSON parse errors
      }
    }
  }

  if (error instanceof Error && error.message) {
    if (error.message.includes('Failed to send a request to the Edge Function')) {
      return 'Edge Function недоступна. Разверните stripe-cancel-subscription и stripe-upgrade-subscription в Supabase (см. docs/STRIPE_BILLING.md).'
    }
    if (error.message.includes('non-2xx')) {
      return 'Edge Function вернула ошибку. Проверьте Stripe secrets в Supabase.'
    }
    return error.message
  }

  return 'Не удалось начать оплату.'
}

export async function startCheckout(planId: BillingPlanId): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(
    'stripe-create-checkout',
    { body: { planId } },
  )

  if (error) {
    throw new Error(await getFunctionErrorMessage(error))
  }

  if (!data?.url) {
    throw new Error(data?.error ?? 'Сервер не вернул ссылку на оплату.')
  }

  window.location.assign(data.url)
}

export async function fetchBillingPayments(): Promise<BillingPaymentRow[]> {
  const { data, error } = await supabase
    .from('billing_payments')
    .select(
      'id, user_id, stripe_invoice_id, stripe_payment_intent_id, plan_id, amount_cents, currency, status, paid_at, created_at',
    )
    .order('paid_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function fetchCurrentSubscription(): Promise<BillingSubscriptionRow | null> {
  const { data, error } = await supabase
    .from('billing_subscriptions')
    .select(
      'user_id, stripe_subscription_id, plan_id, status, current_period_end, cancel_at_period_end, updated_at',
    )
    .maybeSingle()

  if (error) throw error
  return data
}

export async function cancelSubscriptionAtPeriodEnd(): Promise<{
  currentPeriodEnd: string | null
  alreadyScheduled: boolean
}> {
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean
    currentPeriodEnd?: string | null
    alreadyScheduled?: boolean
    error?: string
  }>('stripe-cancel-subscription', { body: {} })

  if (error) {
    throw new Error(await getFunctionErrorMessage(error))
  }

  if (!data?.ok) {
    throw new Error(data?.error ?? 'Не удалось отменить подписку.')
  }

  return {
    currentPeriodEnd: data.currentPeriodEnd ?? null,
    alreadyScheduled: Boolean(data.alreadyScheduled),
  }
}

export async function upgradeSubscription(planId: BillingPlanId): Promise<{
  planId: BillingPlanId
  currentPeriodEnd: string | null
}> {
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean
    planId?: BillingPlanId
    currentPeriodEnd?: string | null
    error?: string
  }>('stripe-upgrade-subscription', { body: { planId } })

  if (error) {
    throw new Error(await getFunctionErrorMessage(error))
  }

  if (!data?.ok || !data.planId) {
    throw new Error(data?.error ?? 'Не удалось повысить тариф.')
  }

  return {
    planId: data.planId,
    currentPeriodEnd: data.currentPeriodEnd ?? null,
  }
}

export function formatPlanLabel(planId: string | null | undefined): string {
  switch (planId) {
    case 'light':
      return 'LIGHT'
    case 'pro':
      return 'PRO'
    case 'enterprise':
      return 'ENTERPRISE'
    default:
      return planId?.toUpperCase() ?? '—'
  }
}

export function formatMoney(amountCents: number, currency: string): string {
  const amount = amountCents / 100
  if (currency.toLowerCase() === 'usd') {
    return `$${amount.toFixed(2)}`
  }
  return `${amount.toFixed(2)} ${currency.toUpperCase()}`
}

export function paymentStatusLabel(status: string): string {
  switch (status) {
    case 'paid':
      return 'Оплачено'
    case 'failed':
      return 'Ошибка'
    case 'pending':
      return 'В обработке'
    default:
      return status
  }
}

export function subscriptionStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'Активна'
    case 'canceled':
      return 'Отменена'
    case 'past_due':
      return 'Просрочена'
    case 'trialing':
      return 'Пробный период'
    default:
      return status
  }
}
