-- Статус оплаты текущего абонемента. Только добавляет колонку, данные не удаляет.
begin;

alter table public.tutor_students
  add column if not exists paid boolean not null default false;

commit;
