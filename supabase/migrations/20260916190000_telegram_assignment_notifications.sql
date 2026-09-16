create table if not exists public.telegram_profile_links (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  chat_id bigint not null unique,
  telegram_username text,
  linked_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists telegram_profile_links_chat_id_idx
  on public.telegram_profile_links (chat_id);

alter table public.telegram_profile_links enable row level security;

create table if not exists public.telegram_assignment_notifications (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  chat_id bigint not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint telegram_assignment_notifications_status_check check (
    status in ('pending', 'sent', 'failed')
  ),
  constraint telegram_assignment_notifications_task_profile_key unique (task_id, profile_id)
);

create index if not exists telegram_assignment_notifications_status_created_idx
  on public.telegram_assignment_notifications (status, created_at);

alter table public.telegram_assignment_notifications enable row level security;

create or replace function public.enqueue_telegram_assignment_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.telegram_assignment_notifications (
    task_id,
    profile_id,
    chat_id,
    status
  )
  select
    new.task_id,
    new.profile_id,
    tpl.chat_id,
    'pending'
  from public.telegram_profile_links tpl
  where tpl.profile_id = new.profile_id
  on conflict (task_id, profile_id) do nothing;

  return new;
end;
$$;

drop trigger if exists task_assignees_enqueue_telegram_notification on public.task_assignees;

create trigger task_assignees_enqueue_telegram_notification
  after insert on public.task_assignees
  for each row
  execute function public.enqueue_telegram_assignment_notification();
