import type { BillingPlanId, BillingSubscriptionRow } from './billing'

export function isActiveSubscription(subscription: BillingSubscriptionRow | null): boolean {
  return (
    subscription !== null &&
    (subscription.status === 'active' || subscription.status === 'trialing')
  )
}

export function maxTeamMembersForPlan(planId: string | null | undefined): number | null {
  switch (planId as BillingPlanId | undefined) {
    case 'light':
      return 3
    case 'pro':
      return 15
    case 'enterprise':
      return null
    default:
      return 0
  }
}

export function maxBoardsForPlan(planId: string | null | undefined): number | null {
  switch (planId as BillingPlanId | undefined) {
    case 'light':
      return 1
    case 'pro':
    case 'enterprise':
      return null
    default:
      return 0
  }
}

export function planIncludesAiSplit(planId: string | null | undefined): boolean {
  return planId === 'pro' || planId === 'enterprise'
}

export function canUseAiSplit(subscription: BillingSubscriptionRow | null): boolean {
  if (!subscription || !isActiveSubscription(subscription)) return false
  return planIncludesAiSplit(subscription.plan_id)
}

export function aiSplitUnavailableMessage(subscription: BillingSubscriptionRow | null): string {
  if (!subscription) {
    return 'Для ИИ-разбиения нужна активная подписка Pro или Enterprise.'
  }

  if (!isActiveSubscription(subscription)) {
    return 'Подписка неактивна. Обновите оплату в разделе «Биллинг».'
  }

  if (!planIncludesAiSplit(subscription.plan_id)) {
    return 'ИИ-разбиение задач доступно на тарифах Pro и Enterprise.'
  }

  return 'ИИ-разбиение временно недоступно.'
}

export function teamMemberLimitLabel(planId: string | null | undefined): string | null {
  const max = maxTeamMembersForPlan(planId)
  if (max === null) return null
  if (max === 0) return '0'
  return String(max)
}

export function boardsLimitLabel(planId: string | null | undefined): string {
  const max = maxBoardsForPlan(planId)
  if (max === null) return 'безлимит'
  return String(max)
}
