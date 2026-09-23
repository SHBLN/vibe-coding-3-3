alter table public.profiles
  add column if not exists avatar_preset text,
  add column if not exists avatar_url text;

comment on column public.profiles.avatar_preset is
  'Built-in avatar id: preset-1 .. preset-5';

comment on column public.profiles.avatar_url is
  'Public URL of user-uploaded avatar image';
