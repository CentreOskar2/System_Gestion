-- recordFirstMonthPayment() uses an upsert on (student_id, month). Give
-- PostgreSQL the matching unique index required by ON CONFLICT.
create unique index if not exists student_payments_student_month_key
  on public.student_payments (student_id, month);

-- Older installations can also lack this default on the same table.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'student_payments'
      and column_name = 'created_at'
      and data_type in ('timestamp with time zone', 'timestamp without time zone')
  ) then
    alter table public.student_payments
      alter column created_at set default now();
  end if;
end $$;
