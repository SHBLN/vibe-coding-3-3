create table if not exists public.telegram_task_sessions (
  chat_id bigint primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  selected_board_id uuid references public.boards(id) on delete set null,
  state text not null default 'idle',
  updated_at timestamptz not null default now(),
  constraint telegram_task_sessions_state_check check (
    state in ('idle', 'await_task')
  )
);

create index if not exists telegram_task_sessions_profile_id_idx
  on public.telegram_task_sessions (profile_id);

alter table public.telegram_task_sessions enable row level security;
