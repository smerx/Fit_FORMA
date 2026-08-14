-- Форма: схема для одного пользователя (Дмитрий)
-- Вставь в Supabase → SQL Editor → Run

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'Дмитрий',
  sex text not null check (sex in ('male', 'female')),
  age integer not null,
  height_cm numeric not null,
  weight_kg numeric not null,
  goal_weight_kg numeric not null,
  calorie_goal integer,
  deficit integer not null default 500,
  onboarding_complete boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.food_entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_on date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_id text,
  name text not null,
  form text,
  grams numeric not null,
  kcal numeric not null,
  protein numeric not null,
  fat numeric not null,
  carbs numeric not null,
  image text,
  emoji text,
  source text not null default 'local',
  created_at timestamptz not null default now()
);

create table if not exists public.activity_entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_on date not null,
  activity_id text not null,
  name text not null,
  minutes integer not null,
  met numeric not null,
  kcal numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists public.weight_logs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_on date not null,
  weight numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists public.favorite_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  food_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, food_key)
);

create table if not exists public.keepalive (
  id int primary key default 1,
  poked_at timestamptz default now()
);

insert into public.keepalive (id) values (1) on conflict (id) do nothing;

create index if not exists food_entries_user_date on public.food_entries (user_id, logged_on);
create index if not exists activity_entries_user_date on public.activity_entries (user_id, logged_on);
create index if not exists weight_logs_user_date on public.weight_logs (user_id, logged_on);

alter table public.profiles enable row level security;
alter table public.food_entries enable row level security;
alter table public.activity_entries enable row level security;
alter table public.weight_logs enable row level security;
alter table public.favorite_foods enable row level security;
alter table public.keepalive enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own food" on public.food_entries;
create policy "own food" on public.food_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own activity" on public.activity_entries;
create policy "own activity" on public.activity_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own weight" on public.weight_logs;
create policy "own weight" on public.weight_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own favorites" on public.favorite_foods;
create policy "own favorites" on public.favorite_foods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "anon ping" on public.keepalive;
create policy "anon ping" on public.keepalive
  for select using (true);

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
