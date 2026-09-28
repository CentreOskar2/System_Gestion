-- ============================================================
-- Réparation ciblée de student_group_subjects : groupe incohérent avec
-- le niveau de la fiche élève
--
-- CAUSE RACINE : même origine que la migration 034 (les "Groupe 1/2/3/4"
-- identiques créés au départ pour chaque niveau). student_group_subjects
-- a été touchée par le même phénomène, indépendamment de
-- student_subscriptions — c'est cette table qui alimente la fiche
-- d'absence et le journal du professeur, donc un élève peut apparaître
-- correctement sur sa propre fiche (via student_subscriptions, réparée en
-- migration 034) tout en restant invisible dans ces deux écrans-là tant
-- que student_group_subjects n'est pas réparée à son tour.
--
-- PORTÉE MESURÉE le 23/09 (lecture seule, vérifiée avec le centre) :
-- 244 lignes / 69 élèves incohérents. Cette population recoupe
-- exactement les 69 élèves ("53 catégorie A" + "16 catégorie B") déjà
-- identifiés dans une investigation précédente :
--   - 186 lignes ont, dans student_subscriptions (déjà réparée en 034),
--     un groupe pour le même élève et la même matière qui correspond au
--     bon niveau ;
--   - 0 lignes supplémentaires ne sont récupérables via group_students
--     (aucun candidat unique et sans ambiguïté au-delà des 186) ;
--   - 58 lignes (les 16 élèves "catégorie B") n'ont de preuve fiable dans
--     AUCUNE des deux tables et ne sont PAS touchées ici — c'est le même
--     travail manuel déjà listé pour la migration 034.
--
-- SÉCURITÉ (même politique que la migration 034 — priorité absolue : ne
-- perdre aucune donnée, ne rien deviner) :
--   1. État "avant" sauvegardé dans student_group_subjects_repair_20260923
--      avant toute écriture, table verrouillée par RLS (sans policy).
--   2. Seule une UPDATE cible group_id, ligne par ligne, par la
--      combinaison exacte (student_id, subject_id, old_group_id).
--      Aucun DELETE, aucun INSERT.
--   3. Une ligne n'est corrigée QUE si student_subscriptions donne UN
--      SEUL groupe du bon niveau pour ce même élève et cette même
--      matière, ET (si group_students répond aussi) que les deux sont
--      d'accord ; à défaut, uniquement si group_students donne à lui
--      seul un candidat unique. Toute ambiguïté ou désaccord laisse la
--      ligne intacte.
--   4. Garde-fou : arrêt avant toute écriture si le nombre de lignes
--      NOUVELLEMENT réparées à ce passage dépasse le nombre de lignes
--      incohérentes détectées ce même passage. Zéro nouvelle ligne n'est
--      pas une erreur en soi — c'est le résultat normal d'un passage où
--      tout était déjà réparé.
--   5. Idempotente et rejouable à volonté (par exemple après une
--      correction manuelle faite dans l'application entre deux passages).
-- ============================================================

-- ------------------------------------------------------------
-- 1) Table de sauvegarde — verrouillée
-- ------------------------------------------------------------
-- Pas de colonne id exploitée ici : l'application manipule cette table par
-- la combinaison (student_id, group_id, subject_id), jamais par un id
-- unique (voir enrollmentApi.js, syncGroupSubjectRows). On s'appuie donc
-- sur cette même combinaison naturelle comme identifiant de ligne.
create table if not exists public.student_group_subjects_repair_20260923 (
  student_id       uuid not null,
  subject_id       uuid not null,
  old_group_id     uuid not null,
  new_group_id     uuid not null,
  source           text not null check (source in ('student_subscriptions', 'group_students')),
  repaired_at      timestamptz not null default now(),
  primary key (student_id, subject_id, old_group_id)
);

alter table public.student_group_subjects_repair_20260923 enable row level security;

-- ------------------------------------------------------------
-- 2) et 3) Repérage des lignes réparables, sauvegarde de leur état "avant"
--    et garde-fou, dans le même bloc : on compare le nombre de lignes
--    NOUVELLEMENT réparées à ce passage (pas le cumul historique de la
--    table de sauvegarde, qui grandit à chaque relance) au nombre de
--    lignes incohérentes détectées CE passage-ci — les deux ne sont plus
--    sur la même échelle dès le deuxième passage sinon.
-- ------------------------------------------------------------
do $$
declare
  nb_incoherentes_avant integer;
  nb_nouvelles integer;
begin
  select count(*) into nb_incoherentes_avant
  from public.student_group_subjects sub
  join public.students s on s.id = sub.student_id
  join public.levels l   on l.id = s.level_id
  left join public.groups g_faux on g_faux.id = sub.group_id
  where g_faux.level_id is distinct from l.id;

  with cible as (
    select
      sub.student_id,
      sub.subject_id,
      sub.group_id as old_group_id,
      l.id as level_id
    from public.student_group_subjects sub
    join public.students s on s.id = sub.student_id
    join public.levels l   on l.id = s.level_id
    left join public.groups g_faux on g_faux.id = sub.group_id
    where g_faux.level_id is distinct from l.id
  ),
  via_subscriptions as (
    select c.student_id, c.subject_id, c.old_group_id, (array_agg(ss.group_id))[1] as group_id
    from cible c
    join public.student_subscriptions ss
      on ss.student_id = c.student_id
     and ss.subject_id = c.subject_id
    join public.groups g_bon
      on g_bon.id = ss.group_id
     and g_bon.level_id = c.level_id
    group by c.student_id, c.subject_id, c.old_group_id
    having count(distinct ss.group_id) = 1
  ),
  candidats_groupe as (
    select gs.student_id, g2.level_id, gs.group_id
    from public.group_students gs
    join public.groups g2 on g2.id = gs.group_id
    group by gs.student_id, g2.level_id, gs.group_id
  ),
  via_groupe as (
    select c.student_id, c.subject_id, c.old_group_id, (array_agg(cg.group_id))[1] as group_id
    from cible c
    join candidats_groupe cg
      on cg.student_id = c.student_id
     and cg.level_id = c.level_id
    group by c.student_id, c.subject_id, c.old_group_id
    having count(distinct cg.group_id) = 1
  ),
  a_reparer as (
    -- Cas a : student_subscriptions répond, et si group_students répond
    -- aussi, les deux sont d'accord (ou group_students n'a rien à dire).
    select
      c.student_id, c.subject_id, c.old_group_id,
      vs.group_id as new_group_id,
      'student_subscriptions' as source
    from cible c
    join via_subscriptions vs
      on vs.student_id = c.student_id and vs.subject_id = c.subject_id and vs.old_group_id = c.old_group_id
    left join via_groupe vg
      on vg.student_id = c.student_id and vg.subject_id = c.subject_id and vg.old_group_id = c.old_group_id
    where vg.group_id is null or vg.group_id = vs.group_id

    union all

    -- Cas b : student_subscriptions n'a rien, mais group_students donne
    -- une réponse unique.
    select
      c.student_id, c.subject_id, c.old_group_id,
      vg.group_id as new_group_id,
      'group_students' as source
    from cible c
    join via_groupe vg
      on vg.student_id = c.student_id and vg.subject_id = c.subject_id and vg.old_group_id = c.old_group_id
    where not exists (
      select 1 from via_subscriptions vs
      where vs.student_id = c.student_id and vs.subject_id = c.subject_id and vs.old_group_id = c.old_group_id
    )
  )
  insert into public.student_group_subjects_repair_20260923
    (student_id, subject_id, old_group_id, new_group_id, source)
  select student_id, subject_id, old_group_id, new_group_id, source
  from a_reparer
  on conflict (student_id, subject_id, old_group_id) do nothing;

  get diagnostics nb_nouvelles = row_count;

  if nb_nouvelles > nb_incoherentes_avant then
    raise exception 'Incohérence interne : % nouvelles lignes réparées pour % lignes incohérentes détectées ce passage — arrêt avant toute modification.', nb_nouvelles, nb_incoherentes_avant;
  end if;

  raise notice '% nouvelles lignes réparables trouvées et sauvegardées à ce passage, sur % lignes incohérentes détectées avant réparation.', nb_nouvelles, nb_incoherentes_avant;
end $$;

-- ------------------------------------------------------------
-- 4) La correction elle-même — uniquement group_id, rien d'autre
-- ------------------------------------------------------------
update public.student_group_subjects sub
set group_id = r.new_group_id
from public.student_group_subjects_repair_20260923 r
where r.student_id = sub.student_id
  and r.subject_id = sub.subject_id
  and r.old_group_id = sub.group_id;

-- ------------------------------------------------------------
-- 5) Vérification finale
-- ------------------------------------------------------------
do $$
declare
  restantes integer;
  nb_reparees integer;
begin
  select count(*) into nb_reparees from public.student_group_subjects_repair_20260923;

  select count(*) into restantes
  from public.student_group_subjects sub
  join public.students s on s.id = sub.student_id
  join public.levels l   on l.id = s.level_id
  left join public.groups g_faux on g_faux.id = sub.group_id
  where g_faux.level_id is distinct from l.id;

  raise notice 'Réparation terminée : % lignes corrigées, % lignes laissées pour vérification manuelle.', nb_reparees, restantes;
end $$;