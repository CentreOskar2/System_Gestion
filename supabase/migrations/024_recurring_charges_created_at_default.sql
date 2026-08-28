-- Repair legacy recurring_charges tables created without a created_at default.
-- Safe to run more than once.
alter table public.recurring_charges
  alter column created_at set default now();
