import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@17.7.0'
import { isPlanId, priceIdForPlan, type PlanId } from './_shared/stripePlans.ts'
import { upgradeBlockReason } from './_shared/subscriptionRules.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  const missingKeys: string[] = []
  if (!stripeSecretKey) missingKeys.push('STRIPE_SECRET_KEY')
  if (!supabaseUrl) missingKeys.push('SUPABASE_URL')
  if (!supabaseAnonKey) missingKeys.push('SUPABASE_ANON_KEY')
  if (!serviceRoleKey) missingKeys.push('SUPABASE_SERVICE_ROLE_KEY')

  if (missingKeys.length > 0) {
    return jsonResponse({ error: 'Server is not configured', missingKeys }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  let body: { planId?: string }
  try {
    body = (await req.json()) as { planId?: string }
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const planId = body.planId
  if (!planId || !isPlanId(planId)) {
    return jsonResponse({ error: 'planId must be light, pro, or enterprise' }, 400)
  }

  const priceId = priceIdForPlan(planId as PlanId)
  if (!priceId) {
    return jsonResponse(
      {
        error: 'Stripe price is not configured for this plan',
        missingKeys: [`STRIPE_PRICE_${planId.toUpperCase()}`],
      },
      500,
    )
  }

  const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const admin = createClient(supabaseUrl!, serviceRoleKey!)

  const { data: subscription, error: subError } = await admin
    .from('billing_subscriptions')
    .select('stripe_subscription_id, plan_id, status, current_period_end, cancel_at_period_end')
    .eq('user_id', user.id)
    .maybeSingle()

  if (subError) {
    return jsonResponse({ error: subError.message }, 500)
  }

  const blockReason = upgradeBlockReason(subscription, planId as PlanId)
  if (blockReason) {
    return jsonResponse({ error: blockReason, code: 'upgrade_not_allowed' }, 400)
  }

  const stripe = new Stripe(stripeSecretKey!)

  const stripeSubscription = await stripe.subscriptions.retrieve(subscription!.stripe_subscription_id)
  const itemId = stripeSubscription.items.data[0]?.id

  if (!itemId) {
    return jsonResponse({ error: 'Subscription has no billable items' }, 500)
  }

  const updated = await stripe.subscriptions.update(subscription!.stripe_subscription_id, {
    items: [{ id: itemId, price: priceId }],
    proration_behavior: 'create_prorations',
    cancel_at_period_end: false,
    metadata: {
      ...stripeSubscription.metadata,
      user_id: user.id,
      plan_id: planId,
    },
  })

  const periodEnd = updated.current_period_end
    ? new Date(updated.current_period_end * 1000).toISOString()
    : subscription!.current_period_end

  const { error: updateError } = await admin
    .from('billing_subscriptions')
    .update({
      plan_id: planId,
      status: updated.status,
      current_period_end: periodEnd,
      cancel_at_period_end: updated.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  if (updateError) {
    return jsonResponse({ error: updateError.message }, 500)
  }

  return jsonResponse({
    ok: true,
    planId,
    currentPeriodEnd: periodEnd,
  })
})
