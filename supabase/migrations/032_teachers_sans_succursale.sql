-- ============================================================
-- Les professeurs n'appartiennent à aucune succursale
--
-- Un professeur enseigne dans plusieurs cycles et dans plusieurs succursales.
-- L'application a été corrigée en ce sens : plus aucun écran ne filtre les
-- professeurs par succursale. Mais deux politiques de sécurité continuaient de
-- le faire au niveau de la base, avant même que les lignes n'atteignent
-- l'application :
--
--   teachers        : is_super_admin() OR branch_id IN (SELECT ... user_branches)
--   teacher_levels  : is_super_admin() OR EXISTS (SELECT 1 FROM teachers t ...)
--
-- Une secrétaire n'étant jamais super admin, elle ne recevait que les
-- professeurs de sa propre succursale. Conséquence observée : un professeur
-- rattaché à « the new centre » n'apparaissait ni à l'inscription d'un élève,
-- ni sur la fiche d'absence, pour la secrétaire de « the old centre » — alors
-- qu'il enseigne bel et bien le niveau concerné.
--
-- À noter : les quatre tables de liaison (teacher_subjects, teacher_groups,
-- teacher_group_subjects, teacher_branches) sont déjà en accès libre pour tout
-- utilisateur authentifié. L'isolation ne masquait donc que l'identité du
-- professeur, pas ses affectations — elle n'apportait aucune confidentialité
-- réelle, seulement des écrans incohérents.
--
-- RLS reste ACTIF sur les deux tables : seul un utilisateur authentifié y
-- accède. Ce qui change, c'est qu'un utilisateur authentifié les voit toutes.
--
-- Idempotente : relançable sans effet.
-- ============================================================

-- ------------------------------------------------------------
-- 1) teachers
-- ------------------------------------------------------------
drop policy if exists "Branch isolation teachers" on public.teachers;
drop policy if exists teachers_authenticated on public.teachers;

create policy teachers_authenticated on public.teachers
  for all to authenticated
  using (true)
  with check (true);

-- ------------------------------------------------------------
-- 2) teacher_levels
--
-- Sa règle s'appuyait sur celle de teachers : sans cette seconde correction,
-- le professeur redeviendrait visible mais ses niveaux resteraient masqués,
-- et il disparaîtrait des écrans qui filtrent par niveau.
-- ------------------------------------------------------------
drop policy if exists "Branch isolation teacher_levels" on public.teacher_levels;
drop policy if exists teacher_levels_authenticated on public.teacher_levels;

create policy teacher_levels_authenticated on public.teacher_levels
  for all to authenticated
  using (true)
  with check (true);

-- ------------------------------------------------------------
-- 3) Vérification — à lire dans les messages après exécution
-- ------------------------------------------------------------
do $$
declare
  restantes integer;
begin
  select count(*) into restantes
  from pg_policies
  where schemaname = 'public'
    and tablename in ('teachers', 'teacher_levels')
    and qual is distinct from 'true';

  if restantes = 0 then
    raise notice 'OK — les professeurs et leurs niveaux sont lisibles par tout utilisateur authentifié.';
  else
    raise notice 'ATTENTION — % politique(s) restrictive(s) subsistent sur teachers/teacher_levels.', restantes;
  end if;
end $$;
