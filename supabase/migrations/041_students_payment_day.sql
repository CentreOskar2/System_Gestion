-- ============================================================
-- Jour de paiement mensuel de l'élève
--
-- BESOIN : la date d'inscription et le jour où l'élève paie chaque mois sont
-- deux choses différentes. Jusqu'ici, l'échéance mensuelle était déduite du
-- jour de la date d'inscription (inscrit le 26/07 → dû le 26 de chaque mois).
-- Le centre veut pouvoir fixer ce jour librement à l'inscription.
--
-- payment_day (1 à 31) :
--   - échéance de chaque mois = ce jour-là dans le mois (un 31 tombe sur le
--     dernier jour des mois plus courts) ;
--   - vaut aussi pour les mensualités des formations de l'élève ;
--   - le mois d'inscription n'est jamais exigible avant l'inscription
--     elle-même (calcul fait par l'application, monthUtils.js).
--
-- Rattrapage : les élèves existants reçoivent le jour de leur date
-- d'inscription, c.-à-d. exactement l'échéance qu'ils avaient jusqu'ici.
-- Aucun paiement n'est modifié.
-- ============================================================

alter table public.students
  add column if not exists payment_day smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'students_payment_day_range'
      and conrelid = 'public.students'::regclass
  ) then
    alter table public.students
      add constraint students_payment_day_range check (payment_day between 1 and 31);
  end if;
end $$;

update public.students
set payment_day = extract(day from coalesce(registration_date::date, (created_at at time zone 'Africa/Casablanca')::date))::smallint
where payment_day is null
  and coalesce(registration_date::date, (created_at at time zone 'Africa/Casablanca')::date) is not null;
