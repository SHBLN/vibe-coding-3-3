# Stripe billing

## Edge Function secrets (Supabase Dashboard → Edge Functions → Secrets)

| Secret | Description |
|--------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_...` or `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret from Stripe webhook endpoint (`whsec_...`) |
| `STRIPE_PRICE_LIGHT` | Monthly Price ID for Light ($9.99) |
| `STRIPE_PRICE_PRO` | Monthly Price ID for Pro ($19.99) |
| `STRIPE_PRICE_ENTERPRISE` | Monthly Price ID for Enterprise ($29.99) |
| `SITE_URL` | Public app URL for Checkout return URLs (e.g. `https://your-app.example` or `http://localhost:5173`) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided by Supabase automatically for Edge Functions.

## Deploy functions

```bash
supabase functions deploy stripe-create-checkout
supabase functions deploy stripe-webhook
```

Or deploy from the Supabase Dashboard / MCP.

## Stripe webhook

1. Stripe Dashboard → Developers → Webhooks → Add endpoint.
2. URL: `https://yxxwpsodzksvxpvizybt.supabase.co/functions/v1/stripe-webhook`
3. Events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

### Local testing

```bash
stripe listen --forward-to https://yxxwpsodzksvxpvizybt.supabase.co/functions/v1/stripe-webhook
```

Use the CLI `whsec_...` as `STRIPE_WEBHOOK_SECRET` while listening.

## User flow

1. User opens `/billing`, selects a plan, clicks **Оплатить**.
2. `stripe-create-checkout` creates a Stripe Checkout Session (subscription).
3. After payment, Stripe sends webhooks; data is stored in `billing_subscriptions` and `billing_payments`.
4. User returns to `/billing?checkout=success` and sees updated history after webhook processing.
