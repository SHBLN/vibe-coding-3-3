create or replace function public.enforce_board_creation_plan_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sub record;
  board_count integer;
begin
  select plan_id, status
  into sub
  from public.billing_subscriptions
  where user_id = new.owner_id;

  if not found then
    raise exception
      'billing_subscription_required: Для создания проекта нужна активная подписка. Перейдите в раздел «Биллинг».'
      using errcode = 'P0001';
  end if;

  if sub.status not in ('active', 'trialing') then
    raise exception
      'billing_subscription_inactive: Подписка неактивна. Обновите оплату в разделе «Биллинг».'
      using errcode = 'P0001';
  end if;

  if sub.plan_id = 'light' then
    select count(*)::integer
    into board_count
    from public.boards
    where owner_id = new.owner_id;

    if board_count >= 1 then
      raise exception
        'light_board_limit: На тарифе Light доступен только 1 проект. Перейдите на Pro или Enterprise в «Биллинге».'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists boards_enforce_plan_limits_before_insert on public.boards;

create trigger boards_enforce_plan_limits_before_insert
  before insert on public.boards
  for each row
  execute function public.enforce_board_creation_plan_limits();
