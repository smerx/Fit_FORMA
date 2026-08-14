-- Календарь: время у дел. Журнал выполненного — отдельная таблица.
-- SQL Editor → Run. Дневник еды не трогает.

alter table public.tool_tasks add column if not exists due_time text;

create table if not exists public.tool_notes (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists tool_notes_user on public.tool_notes (user_id, created_at desc);

alter table public.tool_notes enable row level security;

drop policy if exists "own notes" on public.tool_notes;
create policy "own notes" on public.tool_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
