create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function public.invoke_telegram_assignment_notify()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  project_url text := current_setting('app.settings.supabase_url', true);
  internal_secret text;
  request_url text;
begin
  if project_url is null or project_url = '' then
    project_url := 'https://yxxwpsodzksvxpvizybt.supabase.co';
  end if;

  select decrypted_secret
  into internal_secret
  from vault.decrypted_secrets
  where name = 'telegram_internal_secret'
  limit 1;

  if internal_secret is null then
    return;
  end if;

  request_url := project_url || '/functions/v1/telegram-assignment-notify';

  perform net.http_post(
    url := request_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-telegram-internal-secret', internal_secret
    ),
    body := '{}'::jsonb
  );
end;
$$;

revoke all on function public.invoke_telegram_assignment_notify() from public;
revoke all on function public.invoke_telegram_assignment_notify() from anon, authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname = 'telegram-assignment-notify';

select cron.schedule(
  'telegram-assignment-notify',
  '*/2 * * * *',
  $$select public.invoke_telegram_assignment_notify();$$
);
