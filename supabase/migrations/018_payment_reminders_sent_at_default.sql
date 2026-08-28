-- Reminders are timestamped when they are sent. Keep a database default as a
-- safeguard for inserts made outside the application.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payment_reminders'
      and column_name = 'sent_at'
      and data_type in ('timestamp with time zone', 'timestamp without time zone')
  ) then
    alter table public.payment_reminders
      alter column sent_at set default now();
  end if;
end $$;
