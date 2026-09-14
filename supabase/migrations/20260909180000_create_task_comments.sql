create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  attachment_url text,
  attachment_name text,
  attachment_size bigint,
  attachment_mime text,
  created_at timestamptz not null default now(),
  constraint task_comments_body_or_attachment check (
    length(trim(body)) > 0 or attachment_url is not null
  )
);

create index if not exists task_comments_task_id_idx on public.task_comments (task_id);
create index if not exists task_comments_created_at_idx on public.task_comments (created_at);

alter table public.task_comments enable row level security;

create policy task_comments_select_own on public.task_comments
  for select
  using (
    exists (
      select 1
      from public.tasks t
      join public.boards b on b.id = t.board_id
      where t.id = task_comments.task_id
        and b.owner_id = auth.uid()
    )
  );

create policy task_comments_insert_own on public.task_comments
  for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1
      from public.tasks t
      join public.boards b on b.id = t.board_id
      where t.id = task_comments.task_id
        and b.owner_id = auth.uid()
    )
  );

create policy task_comments_delete_own on public.task_comments
  for delete
  using (
    author_id = auth.uid()
    and exists (
      select 1
      from public.tasks t
      join public.boards b on b.id = t.board_id
      where t.id = task_comments.task_id
        and b.owner_id = auth.uid()
    )
  );
