import { isPlanId, type PlanId } from './stripePlans.ts'

const PLAN_RANK: Record<PlanId, number> = {
  light: 1,
  pro: 2,
  enterprise: 3,
}

export function planRank(planId: string | null | undefined): number {
  if (!planId || !isPlanId(planId)) return 0
  return PLAN_RANK[planId]
}

export type SubscriptionRow = {
  plan_id: string
  status: string
  current_period_end: string | null
  cancel_at_period_end?: boolean
}

export function isSubscriptionEntitled(subscription: SubscriptionRow | null): boolean {
  if (!subscription) return false

  const status = subscription.status
  if (status !== 'active' && status !== 'trialing') return false

  if (subscription.current_period_end) {
    const end = new Date(subscription.current_period_end)
    if (end.getTime() <= Date.now()) return false
  }

  return true
}

export function checkoutBlockReason(
  subscription: SubscriptionRow | null,
  _targetPlanId: PlanId,
): string | null {
  if (!isSubscriptionEntitled(subscription)) return null

  if (subscription!.cancel_at_period_end) {
    return 'Подписка уже отменена и действует до конца оплаченного периода. Более дешёвый тариф можно оформить после этой даты.'
  }

  return 'У вас уже есть активная подписка. Новую оплату можно оформить только после отмены и окончания текущего периода, либо повысьте тариф.'
}

export function upgradeBlockReason(
  subscription: SubscriptionRow | null,
  targetPlanId: PlanId,
): string | null {
  if (!subscription?.plan_id) {
    return 'Сначала оформите подписку.'
  }

  if (!isSubscriptionEntitled(subscription)) {
    return 'Активная подписка не найдена. Оформите тариф через оплату.'
  }

  const currentRank = planRank(subscription.plan_id)
  const targetRank = planRank(targetPlanId)

  if (targetRank <= currentRank) {
    return 'Понижение тарифа недоступно при активной подписке. Отмените её и дождитесь окончания периода.'
  }

  return null
}

export function cancelBlockReason(
  subscription: (SubscriptionRow & { stripe_subscription_id?: string }) | null,
): string | null {
  if (!subscription?.stripe_subscription_id) {
    return 'Нет подписки для отмены.'
  }

  if (!isSubscriptionEntitled(subscription)) {
    return 'Подписка уже неактивна.'
  }

  if (subscription.cancel_at_period_end) {
    return null
  }

  return null
}
