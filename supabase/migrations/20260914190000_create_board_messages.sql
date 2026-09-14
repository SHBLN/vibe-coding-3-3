create table if not exists public.board_messages (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  ai_run_status text not null default 'processing',
  ai_result_summary text,
  created_at timestamptz not null default now(),
  constraint board_messages_body_not_empty check (length(trim(body)) > 0),
  constraint board_messages_ai_status_check check (
    ai_run_status in ('processing', 'success', 'error')
  )
);

create index if not exists board_messages_board_id_idx on public.board_messages (board_id);
create index if not exists board_messages_created_at_idx on public.board_messages (created_at);

alter table public.board_messages enable row level security;

create policy board_messages_select_own on public.board_messages
  for select
  using (
    exists (
      select 1
      from public.boards b
      where b.id = board_messages.board_id
        and b.owner_id = auth.uid()
    )
  );

create policy board_messages_insert_own on public.board_messages
  for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1
      from public.boards b
      where b.id = board_messages.board_id
        and b.owner_id = auth.uid()
    )
  );

create policy board_messages_update_own on public.board_messages
  for update
  using (
    author_id = auth.uid()
    and exists (
      select 1
      from public.boards b
      where b.id = board_messages.board_id
        and b.owner_id = auth.uid()
    )
  )
  with check (
    author_id = auth.uid()
    and exists (
      select 1
      from public.boards b
      where b.id = board_messages.board_id
        and b.owner_id = auth.uid()
    )
  );

alter publication supabase_realtime add table public.board_messages;
