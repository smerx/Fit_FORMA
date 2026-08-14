-- Пробное, заметка, несколько занятий в один день, очередь пушей.
-- SQL Editor → Run. Учеников не удаляет.

do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.tutor_lessons'::regclass
      and contype = 'u'
  loop
    execute format('alter table public.tutor_lessons drop constraint if exists %I', r.conname);
  end loop;
end $$;

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
