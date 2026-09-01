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
  note text,
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

-- Инструменты (голос / план). Отдельные таблицы: дневник еды не трогают.
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
  due_time text,
  done boolean not null default false,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create table if not exists public.tool_notes (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists tool_transcripts_user on public.tool_transcripts (user_id, created_at desc);
create index if not exists tool_tasks_user on public.tool_tasks (user_id, created_at desc);
create index if not exists tool_notes_user on public.tool_notes (user_id, created_at desc);

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

alter table public.tool_notes enable row level security;

drop policy if exists "own notes" on public.tool_notes;
create policy "own notes" on public.tool_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Ученики / репетиторство. Отдельный контур.
create table if not exists public.tutor_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default true,
  reminders_on boolean not null default true,
  pay_details text not null default '89041237534 Сбербанк, Дмитрий Андреевич.',
  updated_at timestamptz not null default now()
);

create table if not exists public.tutor_students (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  pay_kind text not null check (pay_kind in ('pack4', 'pack8', 'hourly')),
  price_rub integer not null,
  duration_min integer not null default 60,
  weekdays integer[] not null default '{}',
  time_hm text not null default '16:00',
  schedule jsonb,
  active boolean not null default true,
  paid boolean not null default false,
  pack_started_on date,
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tutor_lessons (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  student_id uuid not null references public.tutor_students (id) on delete cascade,
  held_on date not null,
  time_hm text not null default '',
  status text not null check (status in ('held', 'skipped', 'cancelled', 'extra')),
  created_at timestamptz not null default now()
);

create index if not exists tutor_students_user on public.tutor_students (user_id, created_at);
create index if not exists tutor_lessons_user_day on public.tutor_lessons (user_id, held_on desc);

alter table public.tutor_settings enable row level security;
alter table public.tutor_students enable row level security;
alter table public.tutor_lessons enable row level security;

drop policy if exists "own tutor settings" on public.tutor_settings;
create policy "own tutor settings" on public.tutor_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own tutor students" on public.tutor_students;
create policy "own tutor students" on public.tutor_students
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own tutor lessons" on public.tutor_lessons;
create policy "own tutor lessons" on public.tutor_lessons
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.tutor_settings add column if not exists reminders_on boolean not null default true;
alter table public.tutor_settings add column if not exists pay_details text not null default '89041237534 Сбербанк, Дмитрий Андреевич.';
alter table public.tutor_students add column if not exists schedule jsonb;
alter table public.tutor_students add column if not exists sort_order integer not null default 0;
alter table public.tutor_students add column if not exists paid boolean not null default false;

create table if not exists public.tutor_events (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  student_id uuid references public.tutor_students (id) on delete cascade,
  happened_on date not null,
  kind text not null check (kind in ('payment', 'trial', 'note')),
  amount_rub integer not null default 0,
  title text not null default '',
  time_hm text,
  created_at timestamptz not null default now()
);

create index if not exists tutor_events_user_day on public.tutor_events (user_id, happened_on desc);

alter table public.tutor_events enable row level security;

drop policy if exists "own tutor events" on public.tutor_events;
create policy "own tutor events" on public.tutor_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.tutor_lessons drop constraint if exists tutor_lessons_student_id_held_on_key;
alter table public.tutor_lessons add column if not exists time_hm text not null default '';
alter table public.tutor_events alter column student_id drop not null;
alter table public.tutor_events add column if not exists title text not null default '';
alter table public.tutor_events add column if not exists time_hm text;
alter table public.tutor_events drop constraint if exists tutor_events_kind_check;
alter table public.tutor_events add constraint tutor_events_kind_check
  check (kind in ('payment', 'trial', 'note'));

create table if not exists public.tutor_push_subs (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tutor_reminder_queue (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  fire_at timestamptz not null,
  title text not null,
  body text not null default '',
  tag text not null,
  sent_at timestamptz,
  unique (user_id, tag)
);

create index if not exists tutor_reminder_queue_due on public.tutor_reminder_queue (fire_at) where sent_at is null;

alter table public.tutor_push_subs enable row level security;
alter table public.tutor_reminder_queue enable row level security;

drop policy if exists "own tutor push subs" on public.tutor_push_subs;
create policy "own tutor push subs" on public.tutor_push_subs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own tutor reminders" on public.tutor_reminder_queue;
create policy "own tutor reminders" on public.tutor_reminder_queue
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.activity_entries add column if not exists note text;
