-- Les charges fixes (loyer, wifi, assurance…) ne réapparaissaient jamais les
-- mois suivants : la génération de la migration 002 ne s'exécutait que par
-- pg_cron, extension qui n'a jamais été activée. Et même activée, elle ne
-- traitait que le mois courant : un mois sans exécution restait un trou
-- définitif dans la comptabilité.
--
-- Cette version rattrape tous les mois manquants, du mois de création du modèle
-- jusqu'au mois en cours. L'application l'appelle à l'ouverture de la page
-- Charges, ce qui la rend autonome — pg_cron reste possible, sans être requis.

-- Jusqu'où le modèle a déjà été généré. Sans cette mémoire, une charge
-- supprimée à la main réapparaîtrait au rechargement suivant, et réactiver une
-- charge suspendue rattraperait les mois de suspension.
-- NULL signifie « jamais généré » : le rattrapage part alors de la création.
alter table public.recurring_charges
  add column if not exists generated_through date;

-- Garde-fou : deux exécutions simultanées (deux onglets ouverts en même temps)
-- ne peuvent plus créer la charge en double. Les lignes ordinaires ont
-- recurring_charge_id à NULL et ne sont pas concernées : l'index est partiel.

-- L'index ne peut pas se créer si des doublons existent déjà.
with ranked as (
  select
    ctid,
    row_number() over (partition by recurring_charge_id, month order by ctid) as rn
  from public.expenses
  where recurring_charge_id is not null
)
delete from public.expenses as target
using ranked
where target.ctid = ranked.ctid
  and ranked.rn > 1;

create unique index if not exists expenses_recurring_charge_month_key
  on public.expenses (recurring_charge_id, month)
  where recurring_charge_id is not null;

-- La version de la migration 002 renvoyait void. « create or replace » ne peut
-- pas changer le type de retour d'une fonction existante : il faut la supprimer.
drop function if exists public.generate_recurring_charges();

create function public.generate_recurring_charges()
returns integer
language plpgsql
as $$
declare
  v_created integer := 0;
  v_current date := date_trunc('month', current_date)::date;
begin
  with candidates as (
    select
      rc.id,
      rc.label,
      rc.amount,
      rc.branch_id,
      rc.day_of_month,
      case
        when rc.generated_through is null then date_trunc('month', rc.created_at)::date
        else greatest(
          date_trunc('month', rc.created_at)::date,
          (rc.generated_through + interval '1 month')::date
        )
      end as first_month
    from public.recurring_charges as rc
    where rc.status = 'active'
  ),
  expanded as (
    select
      candidates.*,
      generate_series(candidates.first_month, v_current, interval '1 month')::date as month_start
    from candidates
    where candidates.first_month <= v_current
  ),
  inserted as (
    insert into public.expenses (title, amount, month, charge_date, branch_id, type, recurring_charge_id)
    select
      expanded.label,
      expanded.amount,
      expanded.month_start,
      -- Le jour d'échéance du modèle, ramené au mois concerné.
      expanded.month_start + (expanded.day_of_month - 1),
      expanded.branch_id,
      'recurring_fixed',
      expanded.id
    from expanded
    on conflict (recurring_charge_id, month) where recurring_charge_id is not null
    do nothing
    returning 1
  )
  select count(*) into v_created from inserted;

  update public.recurring_charges
  set generated_through = v_current
  where status = 'active'
    and (generated_through is null or generated_through < v_current);

  return v_created;
end;
$$;

-- Rattrapage immédiat des mois déjà écoulés.
select public.generate_recurring_charges();

-- Note backend : la planification pg_cron reste facultative — l'application
-- appelle la fonction à l'ouverture de la page Charges. Pour l'ajouter quand
-- même, activer l'extension (Database > Extensions > pg_cron) puis :
--   select cron.schedule('generate-recurring-charges', '0 3 1 * *', $$select public.generate_recurring_charges();$$);
