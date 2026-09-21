import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@17.7.0'
import { isPlanId, priceIdForPlan, type PlanId } from './_shared/stripePlans.ts'
import { checkoutBlockReason } from './_shared/subscriptionRules.ts'

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

function resolveSiteUrl(req: Request): string {
  const fromEnv = Deno.env.get('SITE_URL')?.replace(/\/+$/, '')
  if (fromEnv) return fromEnv
  const origin = req.headers.get('Origin')?.replace(/\/+$/, '')
  if (origin) return origin
  return 'http://localhost:5173'
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

  const missingKeys: string[] = []
  if (!stripeSecretKey) missingKeys.push('STRIPE_SECRET_KEY')
  if (!supabaseUrl) missingKeys.push('SUPABASE_URL')
  if (!supabaseAnonKey) missingKeys.push('SUPABASE_ANON_KEY')

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

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceRoleKey) {
    return jsonResponse({ error: 'Server is not configured', missingKeys: ['SUPABASE_SERVICE_ROLE_KEY'] }, 500)
  }

  const admin = createClient(supabaseUrl!, serviceRoleKey)

  const { data: existingSubscription, error: existingSubError } = await admin
    .from('billing_subscriptions')
    .select('plan_id, status, current_period_end, cancel_at_period_end')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingSubError) {
    return jsonResponse({ error: existingSubError.message }, 500)
  }

  const checkoutDenied = checkoutBlockReason(existingSubscription, planId as PlanId)
  if (checkoutDenied) {
    return jsonResponse({ error: checkoutDenied, code: 'checkout_not_allowed' }, 400)
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('stripe_customer_id, display_name')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    return jsonResponse({ error: profileError.message }, 500)
  }

  const stripe = new Stripe(stripeSecretKey!)

  let customerId = profile?.stripe_customer_id ?? null

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: profile?.display_name ?? undefined,
      metadata: { user_id: user.id },
    })
    customerId = customer.id

    const { error: updateProfileError } = await admin
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)

    if (updateProfileError) {
      return jsonResponse({ error: updateProfileError.message }, 500)
    }
  }

  const siteUrl = resolveSiteUrl(req)

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      user_id: user.id,
      plan_id: planId,
    },
    subscription_data: {
      metadata: {
        user_id: user.id,
        plan_id: planId,
      },
    },
    success_url: `${siteUrl}/billing?checkout=success&plan=${planId}`,
    cancel_url: `${siteUrl}/billing?checkout=cancel&plan=${planId}`,
  })

  if (!session.url) {
    return jsonResponse({ error: 'Stripe did not return checkout URL' }, 502)
  }

  return jsonResponse({ url: session.url })
})
