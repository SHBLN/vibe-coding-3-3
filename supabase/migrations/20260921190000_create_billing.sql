alter table public.profiles
  add column if not exists stripe_customer_id text;

create unique index if not exists profiles_stripe_customer_id_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create table if not exists public.billing_subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  stripe_subscription_id text not null,
  plan_id text not null,
  status text not null,
  current_period_end timestamptz,
  updated_at timestamptz not null default now(),
  constraint billing_subscriptions_plan_id_check check (
    plan_id in ('light', 'pro', 'enterprise')
  )
);

create unique index if not exists billing_subscriptions_stripe_subscription_id_idx
  on public.billing_subscriptions (stripe_subscription_id);

create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  stripe_invoice_id text not null,
  stripe_payment_intent_id text,
  plan_id text,
  amount_cents integer not null,
  currency text not null default 'usd',
  status text not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  constraint billing_payments_plan_id_check check (
    plan_id is null or plan_id in ('light', 'pro', 'enterprise')
  )
);

create unique index if not exists billing_payments_stripe_invoice_id_idx
  on public.billing_payments (stripe_invoice_id);

create index if not exists billing_payments_user_id_paid_at_idx
  on public.billing_payments (user_id, paid_at desc nulls last);

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

alter table public.billing_subscriptions enable row level security;
alter table public.billing_payments enable row level security;
alter table public.stripe_webhook_events enable row level security;

create policy billing_subscriptions_select_own on public.billing_subscriptions
  for select
  using (user_id = auth.uid());

create policy billing_payments_select_own on public.billing_payments
  for select
  using (user_id = auth.uid());
