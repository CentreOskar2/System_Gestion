-- The application creates relationship rows without supplying created_at.
-- Give every relevant timestamp column a database default so those inserts do
-- not fail on installations where the original schema omitted it.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'teacher_levels',
    'teacher_subjects',
    'teacher_group_subjects',
    'teacher_branches',
    'group_students',
    'student_group_subjects',
    'student_subscriptions',
    'student_payments'
  ]
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = target_table
        and column_name = 'created_at'
        and data_type in ('timestamp with time zone', 'timestamp without time zone')
    ) then
      execute format(
        'alter table public.%I alter column created_at set default now()',
        target_table
      );
    end if;
  end loop;
end $$;
