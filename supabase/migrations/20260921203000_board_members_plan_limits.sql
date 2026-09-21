create table if not exists public.board_members (
  board_id uuid not null references public.boards (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (board_id, profile_id)
);

create index if not exists board_members_profile_id_idx on public.board_members (profile_id);

alter table public.board_members enable row level security;

create policy board_members_select_own_boards on public.board_members
  for select
  using (
    exists (
      select 1
      from public.boards b
      where b.id = board_members.board_id
        and b.owner_id = auth.uid()
    )
  );

create policy board_members_insert_own_boards on public.board_members
  for insert
  with check (
    exists (
      select 1
      from public.boards b
      where b.id = board_members.board_id
        and b.owner_id = auth.uid()
    )
  );

create policy board_members_delete_own_boards on public.board_members
  for delete
  using (
    exists (
      select 1
      from public.boards b
      where b.id = board_members.board_id
        and b.owner_id = auth.uid()
    )
  );

create or replace function public.plan_team_member_limit(plan_id text)
returns integer
language sql
immutable
as $$
  select case plan_id
    when 'light' then 3
    when 'pro' then 15
    else null
  end;
$$;

create or replace function public.enforce_team_member_plan_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  board_owner_id uuid;
  sub record;
  member_limit integer;
  current_count integer;
  already_on_team boolean;
begin
  select b.owner_id
  into board_owner_id
  from public.boards b
  where b.id = new.board_id;

  if board_owner_id is null then
    raise exception 'board_not_found: Доска не найдена.'
      using errcode = 'P0001';
  end if;

  select plan_id, status
  into sub
  from public.billing_subscriptions
  where user_id = board_owner_id;

  if not found then
    raise exception
      'billing_subscription_required: Для добавления участников нужна активная подписка.'
      using errcode = 'P0001';
  end if;

  if sub.status not in ('active', 'trialing') then
    raise exception
      'billing_subscription_inactive: Подписка неактивна. Обновите оплату в разделе «Биллинг».'
      using errcode = 'P0001';
  end if;

  member_limit := public.plan_team_member_limit(sub.plan_id);

  if member_limit is null then
    return new;
  end if;

  select exists (
    select 1
    from public.board_members bm
    inner join public.boards b on b.id = bm.board_id
    where b.owner_id = board_owner_id
      and bm.profile_id = new.profile_id
  )
  into already_on_team;

  if already_on_team then
    return new;
  end if;

  select count(distinct bm.profile_id)::integer
  into current_count
  from public.board_members bm
  inner join public.boards b on b.id = bm.board_id
  where b.owner_id = board_owner_id;

  if current_count >= member_limit then
    raise exception
      'team_member_limit: Достигнут лимит участников для вашего тарифа. Перейдите на более высокий план в «Биллинге».'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists board_members_enforce_plan_limits_before_insert on public.board_members;

create trigger board_members_enforce_plan_limits_before_insert
  before insert on public.board_members
  for each row
  execute function public.enforce_team_member_plan_limits();
