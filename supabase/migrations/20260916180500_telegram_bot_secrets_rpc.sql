create or replace function public.get_telegram_bot_secrets()
returns table (bot_token text, poll_secret text)
language sql
security definer
set search_path = public, vault
as $$
  select
    (select decrypted_secret from vault.decrypted_secrets where name = 'telegram_bot_token' limit 1),
    (select decrypted_secret from vault.decrypted_secrets where name = 'telegram_poll_secret' limit 1);
$$;

revoke all on function public.get_telegram_bot_secrets() from public;
revoke all on function public.get_telegram_bot_secrets() from anon, authenticated;
