-- Время отдельно на каждый день недели. Старые ученики не трогает: дни и время остаются.
-- SQL Editor → Run.

alter table public.tutor_students add column if not exists schedule jsonb;
