alter table public.telegram_task_sessions
  drop constraint if exists telegram_task_sessions_state_check;

alter table public.telegram_task_sessions
  add constraint telegram_task_sessions_state_check check (
    state in ('idle', 'await_task', 'processing')
  );

create table if not exists public.telegram_processed_updates (
  update_id bigint primary key,
  chat_id bigint not null,
  processed_at timestamptz not null default now()
);

create index if not exists telegram_processed_updates_chat_id_idx
  on public.telegram_processed_updates (chat_id);

alter table public.telegram_processed_updates enable row level security;
