-- Отдельные таблицы для расшифровок и планирования.
-- Не трогают дневник еды. SQL Editor → Run.

create table if not exists public.tool_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  groq_key text,
  transcript_on boolean not null default true,
  voice_plan_on boolean not null default true,
  planner_on boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.tool_transcripts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null,
  duration_sec integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tool_tasks (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  notes text,
  due_on date,
  done boolean not null default false,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create index if not exists tool_transcripts_user on public.tool_transcripts (user_id, created_at desc);
create index if not exists tool_tasks_user on public.tool_tasks (user_id, created_at desc);

alter table public.tool_settings enable row level security;
alter table public.tool_transcripts enable row level security;
alter table public.tool_tasks enable row level security;

drop policy if exists "own tool settings" on public.tool_settings;
create policy "own tool settings" on public.tool_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own transcripts" on public.tool_transcripts;
create policy "own transcripts" on public.tool_transcripts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own tasks" on public.tool_tasks;
create policy "own tasks" on public.tool_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
