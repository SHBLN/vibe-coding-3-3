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
supabase functions deploy stripe-cancel-subscription
supabase functions deploy stripe-upgrade-subscription
supabase functions deploy stripe-webhook
```

Or deploy from the Supabase Dashboard / MCP.

### Deploy bundles from repo (Windows / CI)

Shared code lives under `supabase/functions/_shared/`. Function entrypoints import `./_shared/...`.

```powershell
node scripts/build-edge-deploy-files.mjs stripe-cancel-subscription
# Upload `.edge-deploy-stripe-cancel-subscription.json` via Supabase MCP `deploy_edge_function`, or:
node scripts/deploy-stripe-billing-functions.mjs   # requires authenticated Supabase MCP in `deploy-via-mcp.mjs`
```

Repeat for `stripe-upgrade-subscription`, `stripe-create-checkout`, `stripe-webhook`.

Plan limits and upgrade/cancel rules: [BILLING_PLAN_LIMITS.md](./BILLING_PLAN_LIMITS.md).

## Stripe webhook

The `stripe-webhook` function verifies signatures with `constructEventAsync` (required in Supabase Edge / Deno).

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

1. User opens `/billing`, selects a plan, clicks **Оплатить** (only if there is no active subscription).
2. `stripe-create-checkout` creates a Stripe Checkout Session (subscription). Blocked while an active subscription exists (use upgrade or cancel first).
3. **Повышение тарифа** (Light → Pro → Enterprise only): `stripe-upgrade-subscription` updates the Stripe subscription price with proration.
4. **Отмена**: `stripe-cancel-subscription` sets `cancel_at_period_end`; cheaper plans can be purchased only after the period ends (webhook `customer.subscription.deleted`).
5. After payment, Stripe sends webhooks; data is stored in `billing_subscriptions` and `billing_payments`.
6. User returns to `/billing?checkout=success` and sees updated history after webhook processing.
