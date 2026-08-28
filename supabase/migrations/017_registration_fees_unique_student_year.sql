-- recordRegistrationFee() uses an upsert on (student_id, school_year).
create unique index if not exists registration_fees_student_year_key
  on public.registration_fees (student_id, school_year);

-- Match the registration_fees schema used by the application on older tables.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'registration_fees'
      and column_name = 'created_at'
      and data_type in ('timestamp with time zone', 'timestamp without time zone')
  ) then
    alter table public.registration_fees
      alter column created_at set default now();
  end if;
end $$;
