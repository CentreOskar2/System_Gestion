-- Salary validation creates an automatic expense. Ensure legacy schemas that
-- require expenses.created_at receive a timestamp when the app omits it.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'expenses'
      and column_name = 'created_at'
      and data_type in ('timestamp with time zone', 'timestamp without time zone')
  ) then
    alter table public.expenses
      alter column created_at set default now();
  end if;
end $$;
