# Лимиты тарифов и подписка

Правила применяются на **владельца аккаунта** (оплатившего подписку). Данные в `billing_subscriptions`, лимиты дублируются в UI (`src/lib/planLimits.ts`, `src/lib/subscriptionRules.ts`).

## Тарифы

| Тариф | Проекты | Участники (уникальные по всем доскам) | ИИ-разбиение |
|-------|---------|----------------------------------------|--------------|
| **Light** | 1 | до 3 | нет |
| **Pro** | безлимит | до 15 | да |
| **Enterprise** | безлимит | безлимит | да |

Без активной подписки (`active` / `trialing`) создание досок и добавление участников блокируется.

## Где enforced

- **Проекты (Light = 1):** триггер `boards_enforce_plan_limits_before_insert` — миграция `20260921194500_enforce_light_board_limit.sql`.
- **Участники:** таблица `board_members`, триггер `board_members_enforce_plan_limits_before_insert` — `20260921203000_board_members_plan_limits.sql`.
- **ИИ-разбиение:** Edge Function `anymodel-chat`, Telegram `telegram-ok-reply/flows.ts`; на вебе — чат на доске (`BoardChatPanel`).
- **Подписка / смена тарифа:** см. [STRIPE_BILLING.md](./STRIPE_BILLING.md).

## Смена тарифа (бизнес-правила)

- **Повышение:** только Light → Pro → Enterprise через `stripe-upgrade-subscription` (proration в Stripe).
- **Понижение:** при активной подписке нельзя; после **отмены автопродления** доступ сохраняется до `current_period_end`, затем можно оформить любой тариф через Checkout.
- **Новый Checkout** при активной подписке запрещён (кроме случая, когда подписка уже не действует).

Поле `billing_subscriptions.cancel_at_period_end` синхронизируется webhook `customer.subscription.updated` и функцией отмены.

## Деплой Edge Functions (Stripe)

Импорты shared-модулей в бандле Supabase: `./_shared/...` (не `../_shared`).

```powershell
node scripts/build-edge-deploy-files.mjs stripe-cancel-subscription
node scripts/build-edge-deploy-files.mjs stripe-upgrade-subscription
node scripts/build-edge-deploy-files.mjs stripe-create-checkout
node scripts/build-edge-deploy-files.mjs stripe-webhook
```

Далее — Supabase Dashboard, MCP `deploy_edge_function`, или `npx supabase login` + `supabase functions deploy <name>`.

Обязательны в проекте: `stripe-cancel-subscription`, `stripe-upgrade-subscription`, `stripe-create-checkout`, `stripe-webhook`.
