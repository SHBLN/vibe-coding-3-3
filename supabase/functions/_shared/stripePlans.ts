export type PlanId = 'light' | 'pro' | 'enterprise'

const PLAN_IDS: PlanId[] = ['light', 'pro', 'enterprise']

export function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as string[]).includes(value)
}

export function priceIdForPlan(planId: PlanId): string | null {
  const envKey =
    planId === 'light'
      ? 'STRIPE_PRICE_LIGHT'
      : planId === 'pro'
        ? 'STRIPE_PRICE_PRO'
        : 'STRIPE_PRICE_ENTERPRISE'
  return Deno.env.get(envKey) ?? null
}

export function planIdForPriceId(priceId: string): PlanId | null {
  for (const planId of PLAN_IDS) {
    const mapped = priceIdForPlan(planId)
    if (mapped && mapped === priceId) return planId
  }
  return null
}

export function resolvePlanIdFromMetadata(metadata: Record<string, string> | null | undefined): PlanId | null {
  const raw = metadata?.plan_id
  if (raw && isPlanId(raw)) return raw
  return null
}
