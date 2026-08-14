-- Добавки к уже созданной базе Формы.
-- SQL Editor → Run. Можно запускать повторно.

alter table public.profiles add column if not exists tips_enabled boolean not null default true;
alter table public.profiles add column if not exists water_goal_ml integer;
alter table public.profiles add column if not exists tracks_vitamins boolean not null default true;
alter table public.profiles add column if not exists vitamin_name text not null default 'Комплекс витаминов';

create table if not exists public.water_entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_on date not null,
  ml integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.vitamin_entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_on date not null,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists water_entries_user_date on public.water_entries (user_id, logged_on);
create index if not exists vitamin_entries_user_date on public.vitamin_entries (user_id, logged_on);

alter table public.water_entries enable row level security;
alter table public.vitamin_entries enable row level security;

drop policy if exists "own water" on public.water_entries;
create policy "own water" on public.water_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own vitamins" on public.vitamin_entries;
create policy "own vitamins" on public.vitamin_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
