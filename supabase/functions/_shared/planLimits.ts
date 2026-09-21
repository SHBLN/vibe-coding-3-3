export function isActiveSubscriptionStatus(status: string): boolean {
  return status === 'active' || status === 'trialing'
}

export function planIncludesAiSplit(planId: string | null | undefined): boolean {
  return planId === 'pro' || planId === 'enterprise'
}

export function aiSplitDenialMessage(
  planId: string | null | undefined,
  inactive: boolean,
): string {
  if (inactive) {
    return 'Подписка неактивна. Обновите оплату в разделе «Биллинг» в веб-приложении.'
  }

  if (!planId) {
    return 'Для ИИ-разбиения нужна активная подписка Pro или Enterprise.'
  }

  return 'ИИ-разбиение задач доступно на тарифах Pro и Enterprise. Обновите план в веб-приложении (раздел «Биллинг»).'
}

type SubscriptionLookupClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        maybeSingle: () => Promise<{
          data: { plan_id: string; status: string } | null
          error: { message: string } | null
        }>
      }
    }
  }
}

export async function getAiSplitDenialReason(
  supabase: SubscriptionLookupClient,
  ownerUserId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('billing_subscriptions')
    .select('plan_id, status')
    .eq('user_id', ownerUserId)
    .maybeSingle()

  if (error) throw new Error(error.message)

  if (!data) {
    return aiSplitDenialMessage(null, false)
  }

  if (!isActiveSubscriptionStatus(data.status)) {
    return aiSplitDenialMessage(data.plan_id, true)
  }

  if (!planIncludesAiSplit(data.plan_id)) {
    return aiSplitDenialMessage(data.plan_id, false)
  }

  return null
}
