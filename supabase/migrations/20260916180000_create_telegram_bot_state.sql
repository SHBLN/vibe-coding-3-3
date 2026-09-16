create table if not exists public.telegram_bot_state (
  id text primary key,
  last_update_id bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.telegram_bot_state enable row level security;

insert into public.telegram_bot_state (id, last_update_id)
values ('telegram-ok-reply', 0)
on conflict (id) do nothing;
