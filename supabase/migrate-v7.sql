-- События дня (оплата) и порядок учеников в списке.
-- SQL Editor → Run. Учеников не удаляет.

alter table public.tutor_students add column if not exists sort_order integer not null default 0;

create table if not exists public.tutor_events (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  student_id uuid not null references public.tutor_students (id) on delete cascade,
  happened_on date not null,
  kind text not null check (kind in ('payment')),
  amount_rub integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists tutor_events_user_day on public.tutor_events (user_id, happened_on desc);

alter table public.tutor_events enable row level security;

drop policy if exists "own tutor events" on public.tutor_events;
create policy "own tutor events" on public.tutor_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
