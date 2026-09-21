import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@17.7.0'
import {
  planIdForPriceId,
  resolvePlanIdFromMetadata,
  type PlanId,
} from './_shared/stripePlans.ts'

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function isDuplicateEvent(admin: SupabaseClient, eventId: string): Promise<boolean> {
  const { data, error } = await admin
    .from('stripe_webhook_events')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle()

  if (error) throw error
  return Boolean(data)
}

async function markEventProcessed(admin: SupabaseClient, eventId: string) {
  const { error } = await admin.from('stripe_webhook_events').insert({ event_id: eventId })
  if (error?.code === '23505') return
  if (error) throw error
}

async function findUserIdByCustomer(
  admin: SupabaseClient,
  customerId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (error) throw error
  return data?.id ?? null
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription): string | null {
  if (!subscription.current_period_end) return null
  return new Date(subscription.current_period_end * 1000).toISOString()
}

function planFromSubscription(subscription: Stripe.Subscription): PlanId | null {
  const fromMeta = resolvePlanIdFromMetadata(subscription.metadata)
  if (fromMeta) return fromMeta

  const priceId = subscription.items.data[0]?.price?.id
  if (priceId) return planIdForPriceId(priceId)
  return null
}

async function upsertSubscription(
  admin: SupabaseClient,
  payload: {
    userId: string
    subscription: Stripe.Subscription
    planId: PlanId
  },
) {
  const { error } = await admin.from('billing_subscriptions').upsert(
    {
      user_id: payload.userId,
      stripe_subscription_id: payload.subscription.id,
      plan_id: payload.planId,
      status: payload.subscription.status,
      current_period_end: subscriptionPeriodEnd(payload.subscription),
      cancel_at_period_end: payload.subscription.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (error) throw error
}

async function upsertPayment(
  admin: SupabaseClient,
  payload: {
    userId: string
    invoice: Stripe.Invoice
    planId: PlanId | null
    status: 'paid' | 'failed'
  },
) {
  const paidAt =
    payload.status === 'paid' && payload.invoice.status_transitions?.paid_at
      ? new Date(payload.invoice.status_transitions.paid_at * 1000).toISOString()
      : payload.status === 'paid'
        ? new Date().toISOString()
        : null

  const paymentIntent =
    typeof payload.invoice.payment_intent === 'string'
      ? payload.invoice.payment_intent
      : payload.invoice.payment_intent?.id ?? null

  const { error } = await admin.from('billing_payments').upsert(
    {
      user_id: payload.userId,
      stripe_invoice_id: payload.invoice.id,
      stripe_payment_intent_id: paymentIntent,
      plan_id: payload.planId,
      amount_cents: payload.invoice.amount_paid ?? payload.invoice.amount_due ?? 0,
      currency: payload.invoice.currency ?? 'usd',
      status: payload.status,
      paid_at: paidAt,
    },
    { onConflict: 'stripe_invoice_id' },
  )

  if (error) throw error
}

async function handleCheckoutCompleted(
  admin: SupabaseClient,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
) {
  const userId = session.metadata?.user_id ?? session.client_reference_id
  if (!userId) return

  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null

  if (customerId) {
    const { error } = await admin
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', userId)

    if (error) throw error
  }

  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id

  if (!subscriptionId) return

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const planId =
    resolvePlanIdFromMetadata(session.metadata) ??
    planFromSubscription(subscription) ??
    resolvePlanIdFromMetadata(subscription.metadata)

  if (!planId) return

  await upsertSubscription(admin, { userId, subscription, planId })
}

async function handleSubscriptionUpdated(admin: SupabaseClient, subscription: Stripe.Subscription) {
  const userId =
    subscription.metadata?.user_id ??
    (subscription.customer
      ? await findUserIdByCustomer(
          admin,
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id,
        )
      : null)

  if (!userId) return

  const planId = planFromSubscription(subscription)
  if (!planId) return

  await upsertSubscription(admin, { userId, subscription, planId })
}

async function handleSubscriptionDeleted(admin: SupabaseClient, subscription: Stripe.Subscription) {
  const { error } = await admin
    .from('billing_subscriptions')
    .update({
      status: 'canceled',
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) throw error
}

async function handleInvoicePaid(admin: SupabaseClient, stripe: Stripe, invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null

  if (!customerId) return

  let userId = await findUserIdByCustomer(admin, customerId)

  if (!userId && invoice.subscription) {
    const subscriptionId =
      typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    userId = subscription.metadata?.user_id ?? null
  }

  if (!userId) return

  let planId: PlanId | null = null
  if (invoice.subscription) {
    const subscriptionId =
      typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    planId = planFromSubscription(subscription)
  }

  if (!planId) {
    const priceId = invoice.lines.data[0]?.price?.id
    if (priceId) planId = planIdForPriceId(priceId)
  }

  await upsertPayment(admin, { userId, invoice, planId, status: 'paid' })
}

async function handleInvoiceFailed(admin: SupabaseClient, invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null

  if (!customerId) return

  const userId = await findUserIdByCustomer(admin, customerId)
  if (!userId) return

  const priceId = invoice.lines.data[0]?.price?.id
  const planId = priceId ? planIdForPriceId(priceId) : null

  await upsertPayment(admin, { userId, invoice, planId, status: 'failed' })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  const missingKeys: string[] = []
  if (!stripeSecretKey) missingKeys.push('STRIPE_SECRET_KEY')
  if (!webhookSecret) missingKeys.push('STRIPE_WEBHOOK_SECRET')
  if (!supabaseUrl) missingKeys.push('SUPABASE_URL')
  if (!serviceRoleKey) missingKeys.push('SUPABASE_SERVICE_ROLE_KEY')

  if (missingKeys.length > 0) {
    return jsonResponse({ error: 'Server is not configured', missingKeys }, 500)
  }

  const signature = req.headers.get('Stripe-Signature')
  if (!signature) {
    return jsonResponse({ error: 'Missing Stripe-Signature' }, 400)
  }

  const rawBody = await req.text()
  const stripe = new Stripe(stripeSecretKey!)

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret!)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    return jsonResponse({ error: message }, 400)
  }

  const admin = createClient(supabaseUrl!, serviceRoleKey!)

  try {
    if (await isDuplicateEvent(admin, event.id)) {
      return jsonResponse({ ok: true, duplicate: true })
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(admin, stripe, event.data.object as Stripe.Checkout.Session)
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(admin, event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(admin, event.data.object as Stripe.Subscription)
        break
      case 'invoice.paid':
        await handleInvoicePaid(admin, stripe, event.data.object as Stripe.Invoice)
        break
      case 'invoice.payment_failed':
        await handleInvoiceFailed(admin, event.data.object as Stripe.Invoice)
        break
      default:
        break
    }

    await markEventProcessed(admin, event.id)

    return jsonResponse({ ok: true, type: event.type })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook handler failed'
    console.error(message)
    return jsonResponse({ error: message }, 500)
  }
})
