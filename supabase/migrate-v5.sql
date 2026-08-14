-- Ученики / репетиторство. Отдельные таблицы, дневник еды не трогают.
-- SQL Editor → Run.

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
  active boolean not null default true,
  pack_started_on date,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.tutor_lessons (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  student_id uuid not null references public.tutor_students (id) on delete cascade,
  held_on date not null,
  status text not null check (status in ('held', 'skipped', 'cancelled', 'extra')),
  created_at timestamptz not null default now(),
  unique (student_id, held_on)
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
