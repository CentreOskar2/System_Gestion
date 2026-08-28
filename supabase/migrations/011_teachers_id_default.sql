-- Teachers are created by the application without an explicit ID. Ensure the
-- database generates their UUID automatically.
create extension if not exists pgcrypto;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'teachers'
      and column_name = 'id'
      and data_type = 'uuid'
  ) then
    alter table public.teachers
      alter column id set default gen_random_uuid();
  end if;
end $$;
