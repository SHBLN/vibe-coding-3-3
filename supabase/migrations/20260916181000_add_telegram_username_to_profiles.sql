alter table public.profiles
  add column if not exists telegram_username text;

create unique index if not exists profiles_telegram_username_unique_idx
  on public.profiles (lower(telegram_username))
  where telegram_username is not null;

comment on column public.profiles.telegram_username is
  'Telegram @username without @ prefix, used for bot mapping';
