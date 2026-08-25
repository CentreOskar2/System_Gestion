-- Some project installations do not include every administration table. Set
-- UUID defaults only on tables that exist and whose `id` column is a UUID.
-- `users` is deliberately excluded because its ID is supplied by Supabase Auth.
create extension if not exists pgcrypto;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'branches',
    'user_branches',
    'user_permissions',
    'center_settings',
    'cycles',
    'levels',
    'study_branches',
    'subjects',
    'whatsapp_templates',
    'tariffs'
  ]
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = target_table
        and column_name = 'id'
        and data_type = 'uuid'
    ) then
      execute format(
        'alter table public.%I alter column id set default gen_random_uuid()',
        target_table
      );
    end if;
  end loop;
end $$;
