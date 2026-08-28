-- ============================================================
-- Charges : date complète + charges fixes récurrentes
-- À exécuter dans l'éditeur SQL de Supabase, après 001_registration_fees.sql.
-- ============================================================

-- 1) Date complète (jour/mois/année) sur chaque charge, au lieu du seul mois.
alter table public.expenses add column if not exists charge_date date;

-- Backfill : les charges existantes n'ont qu'un mois (1er du mois) — on le reprend tel quel.
update public.expenses set charge_date = month::date where charge_date is null and month is not null;

-- 2) Modèles de charges fixes récurrentes (Loyer, Wifi, Assurance...).
create table if not exists public.recurring_charges (
  id            uuid primary key default gen_random_uuid(),
  label         text not null,
  amount        numeric not null default 0,
  branch_id     uuid references public.branches (id) on delete set null,
  day_of_month  int not null default 1 check (day_of_month between 1 and 28),
  status        text not null default 'active' check (status in ('active', 'inactive')),
  created_at    timestamptz not null default now()
);

-- The table may already exist in older projects, where created_at had no
-- default. `create table if not exists` does not update that existing column.
alter table public.recurring_charges
  alter column created_at set default now();

-- Trace de quel modèle récurrent chaque ligne "charges" générée automatiquement est issue.
alter table public.expenses add column if not exists recurring_charge_id uuid references public.recurring_charges (id) on delete set null;

alter table public.recurring_charges enable row level security;
drop policy if exists recurring_charges_authenticated on public.recurring_charges;
create policy recurring_charges_authenticated on public.recurring_charges
  for all to authenticated using (true) with check (true);

-- 3) Génération automatique mensuelle.
-- Pour chaque charge récurrente active, insère une ligne "expenses" du mois courant si elle
-- n'existe pas déjà (évite les doublons si la tâche est relancée deux fois le même mois).
create or replace function public.generate_recurring_charges()
returns void
language plpgsql
as $$
begin
  insert into public.expenses (title, amount, month, charge_date, branch_id, type, recurring_charge_id)
  select
    rc.label,
    rc.amount,
    date_trunc('month', current_date)::date,
    date_trunc('month', current_date)::date + (rc.day_of_month - 1),
    rc.branch_id,
    'recurring_fixed',
    rc.id
  from public.recurring_charges rc
  where rc.status = 'active'
    and not exists (
      select 1 from public.expenses e
      where e.recurring_charge_id = rc.id
        and date_trunc('month', e.charge_date) = date_trunc('month', current_date)
    );
end;
$$;

-- Note backend : nécessite l'extension pg_cron (Database > Extensions > pg_cron dans le
-- dashboard Supabase, à activer une seule fois). Une fois activée, planifier via :
--   select cron.schedule('generate-recurring-charges', '0 3 1 * *', $$select public.generate_recurring_charges();$$);
-- ('0 3 1 * *' = le 1er de chaque mois à 3h du matin, cohérent avec le rollover de journée
-- comptable déjà utilisé ailleurs dans l'app).
