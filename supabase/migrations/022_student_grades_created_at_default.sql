-- Notes are created from the interface without an explicit creation timestamp.
-- Ensure the database always supplies it.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'student_grades'
      and column_name = 'created_at'
  ) then
    alter table public.student_grades
      alter column created_at set default now();
  end if;
end
$$;
