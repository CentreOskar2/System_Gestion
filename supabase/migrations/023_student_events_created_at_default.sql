-- Attendance events are created from the interface without an explicit timestamp.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'student_events'
      and column_name = 'created_at'
  ) then
    alter table public.student_events
      alter column created_at set default now();
  end if;
end
$$;
