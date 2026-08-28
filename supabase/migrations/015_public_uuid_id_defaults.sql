-- Some original project tables have UUID primary keys but no default value.
-- The application creates them without explicitly supplying an ID. Normalize
-- every public UUID `id` column, except `users` whose ID is provided by Auth.
create extension if not exists pgcrypto;

do $$
declare
  target_table text;
begin
  for target_table in
    select table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'id'
      and data_type = 'uuid'
      and table_name <> 'users'
  loop
    execute format(
      'alter table public.%I alter column id set default gen_random_uuid()',
      target_table
    );
  end loop;
end $$;
