import type { BillingPlanId, BillingSubscriptionRow } from './billing'

const PLAN_RANK: Record<BillingPlanId, number> = {
  light: 1,
  pro: 2,
  enterprise: 3,
}

export function planRank(planId: string | null | undefined): number {
  if (planId === 'light' || planId === 'pro' || planId === 'enterprise') {
    return PLAN_RANK[planId]
  }
  return 0
}

export function isSubscriptionEntitled(subscription: BillingSubscriptionRow | null): boolean {
  if (!subscription) return false

  if (subscription.status !== 'active' && subscription.status !== 'trialing') return false

  if (subscription.current_period_end) {
    const end = new Date(subscription.current_period_end)
    if (end.getTime() <= Date.now()) return false
  }

  return true
}

export type PlanCheckoutAction = 'checkout' | 'upgrade' | 'blocked' | 'current'

export function resolvePlanAction(
  subscription: BillingSubscriptionRow | null,
  targetPlanId: BillingPlanId,
): { action: PlanCheckoutAction; message: string | null } {
  if (!isSubscriptionEntitled(subscription)) {
    return { action: 'checkout', message: null }
  }

  const currentPlanId = subscription!.plan_id as BillingPlanId
  const currentRank = planRank(currentPlanId)
  const targetRank = planRank(targetPlanId)

  if (targetRank === currentRank) {
    return { action: 'current', message: 'Это ваш текущий тариф.' }
  }

  if (targetRank > currentRank) {
    return { action: 'upgrade', message: null }
  }

  if (subscription!.cancel_at_period_end) {
    return {
      action: 'blocked',
      message:
        'Подписка отменена и действует до конца периода. Более дешёвый тариф можно оформить после этой даты.',
    }
  }

  return {
    action: 'blocked',
    message:
      'Понижение тарифа недоступно при активной подписке. Отмените подписку и дождитесь окончания периода.',
  }
}

export function canCancelSubscription(subscription: BillingSubscriptionRow | null): boolean {
  if (!subscription?.stripe_subscription_id) return false
  if (!isSubscriptionEntitled(subscription)) return false
  return true
}
