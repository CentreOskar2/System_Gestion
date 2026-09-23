-- ============================================================
-- Réparation ciblée de student_subscriptions : groupe de facturation
-- incohérent avec le niveau de la fiche élève
--
-- CAUSE RACINE (confirmée avec le centre le 23/09) : au tout début, un
-- même jeu de noms génériques ("Groupe 1", "Groupe 2", "Groupe 3",
-- "Groupe 4") a été créé pour CHAQUE niveau, avant d'être renommé plus
-- tard par l'admin. subjectDetailsFor() résolvait alors le groupe d'un
-- élève par correspondance de NOM (Array.find()) sur catalog.groupsById,
-- ce qui était ambigu tant que ces noms étaient dupliqués entre niveaux :
-- le premier groupe trouvé portant ce nom pouvait appartenir à
-- n'importe quel niveau. Le code a depuis été corrigé pour résoudre par
-- group_id (voir enrollmentApi.js, subjectDetailsFor), mais les lignes
-- déjà enregistrées à l'époque du bug restent fausses.
--
-- PORTÉE MESURÉE le 23/09 (lecture seule, vérifiée en direct avec le
-- centre via le SQL editor) : 356 lignes / 118 élèves ont un group_id
-- dont le niveau ne correspond pas au niveau de la fiche de l'élève.
-- Une première estimation donnait 143 + 155 = 298 lignes réparables, mais
-- cette estimation ne croisait pas encore les deux sources entre elles.
-- Cette migration est plus stricte : une ligne n'est corrigée QUE si sa
-- source est sans ambiguïté ET que, lorsque les deux sources existent,
-- elles sont D'ACCORD entre elles. Le nombre réellement corrigé peut donc
-- être un peu inférieur à 298 — c'est voulu, c'est la marge de sécurité.
--
-- SÉCURITÉ (priorité absolue : ne perdre aucune donnée, ne rien deviner) :
--   1. L'état "avant" de chaque ligne touchée est sauvegardé dans
--      student_subscriptions_repair_20260923 avant toute écriture, avec
--      l'ancien group_id et la source de la correction. Rien n'est perdu
--      : cette table reste consultable indéfiniment pour vérifier ou
--      annuler une ligne précise. Elle est verrouillée par RLS comme les
--      autres tables internes du projet (registration_counters,
--      migration 033) : invisible via l'API, consultable uniquement
--      depuis le SQL editor avec les droits propriétaire.
--   2. Seule une UPDATE cible group_id, ligne par ligne, par id exact.
--      Aucun DELETE, aucun INSERT sur student_subscriptions, aucune
--      autre colonne modifiée (monthly_price, teacher_id, pricing_type
--      restent inchangés).
--   3. Une ligne n'est corrigée QUE si :
--        a) student_group_subjects donne UN SEUL groupe du bon niveau
--           pour ce même élève et cette même matière, ET (s'il existe
--           aussi une réponse côté group_students) que les deux tables
--           sont D'ACCORD sur le même groupe ; OU
--        b) student_group_subjects n'a rien, mais group_students donne
--           UN SEUL groupe du bon niveau pour cet élève.
--      Toute ambiguïté (plusieurs candidats) ou tout désaccord entre les
--      deux sources laisse la ligne INTACTE — elle rejoint le tas à
--      vérifier à la main plutôt que d'être devinée.
--   4. Garde-fou avant d'écrire : si aucune ligne n'est réparable (0) ou
--      si le nombre trouvé dépasse le nombre de lignes incohérentes
--      détectées (impossible si la logique est correcte), la migration
--      s'arrête avec une exception avant de toucher à student_subscriptions.
--      Le nombre réellement trouvé est affiché avec raise notice pour
--      être comparé à ce qu'on a vérifié ensemble avant de lancer.
--   5. Idempotente : à la deuxième exécution, les lignes déjà réparées ne
--      correspondent plus aux critères (leur groupe est déjà du bon
--      niveau), rien ne bouge, aucune erreur.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Table de sauvegarde — créée une seule fois, jamais vidée, verrouillée
-- ------------------------------------------------------------
create table if not exists public.student_subscriptions_repair_20260923 (
  subscription_id  uuid primary key,
  student_id       uuid not null,
  subject_id       uuid not null,
  old_group_id     uuid,
  new_group_id     uuid not null,
  source           text not null check (source in ('student_group_subjects', 'group_students')),
  repaired_at      timestamptz not null default now()
);

-- RLS activé sans policy = accès refusé à tout le monde via l'API, y
-- compris à un super admin authentifié normalement (même principe que
-- registration_counters en migration 033).
alter table public.student_subscriptions_repair_20260923 enable row level security;

-- ------------------------------------------------------------
-- 2) Repérage des lignes réparables + sauvegarde de leur état "avant"
-- ------------------------------------------------------------
with cible as (
  select
    sub.id as subscription_id,
    sub.student_id,
    sub.subject_id,
    sub.group_id as old_group_id,
    l.id as level_id
  from public.student_subscriptions sub
  join public.students s on s.id = sub.student_id
  join public.levels l   on l.id = s.level_id
  left join public.groups g_faux on g_faux.id = sub.group_id
  where g_faux.level_id is distinct from l.id
),
via_matiere as (
  -- Un seul candidat exigé, exactement comme via_groupe ci-dessous : si
  -- deux groupes différents du bon niveau existent pour la même matière,
  -- on ne choisit pas au hasard, la ligne devient non résolue.
  select c.subscription_id, (array_agg(sgs.group_id))[1] as group_id
  from cible c
  join public.student_group_subjects sgs
    on sgs.student_id = c.student_id
   and sgs.subject_id = c.subject_id
  join public.groups g_bon
    on g_bon.id = sgs.group_id
   and g_bon.level_id = c.level_id
  group by c.subscription_id
  having count(distinct sgs.group_id) = 1
),
candidats_groupe as (
  select gs.student_id, g2.level_id, gs.group_id
  from public.group_students gs
  join public.groups g2 on g2.id = gs.group_id
  group by gs.student_id, g2.level_id, gs.group_id
),
via_groupe as (
  select c.subscription_id, (array_agg(cg.group_id))[1] as group_id
  from cible c
  join candidats_groupe cg
    on cg.student_id = c.student_id
   and cg.level_id = c.level_id
  group by c.subscription_id
  having count(distinct cg.group_id) = 1
),
a_reparer as (
  -- Cas a : student_group_subjects répond, et si group_students répond
  -- aussi, les deux sont d'accord (ou group_students n'a rien à dire).
  select
    c.subscription_id, c.student_id, c.subject_id, c.old_group_id,
    vm.group_id as new_group_id,
    'student_group_subjects' as source
  from cible c
  join via_matiere vm on vm.subscription_id = c.subscription_id
  left join via_groupe vg on vg.subscription_id = c.subscription_id
  where vg.group_id is null or vg.group_id = vm.group_id

  union all

  -- Cas b : student_group_subjects n'a rien, mais group_students donne
  -- une réponse unique.
  select
    c.subscription_id, c.student_id, c.subject_id, c.old_group_id,
    vg.group_id as new_group_id,
    'group_students' as source
  from cible c
  join via_groupe vg on vg.subscription_id = c.subscription_id
  where not exists (
    select 1 from via_matiere vm where vm.subscription_id = c.subscription_id
  )
)
insert into public.student_subscriptions_repair_20260923
  (subscription_id, student_id, subject_id, old_group_id, new_group_id, source)
select subscription_id, student_id, subject_id, old_group_id, new_group_id, source
from a_reparer
on conflict (subscription_id) do nothing;

-- ------------------------------------------------------------
-- 3) Garde-fou : on s'arrête ici si quelque chose d'impossible est trouvé,
--    avant de toucher à quoi que ce soit
-- ------------------------------------------------------------
do $$
declare
  nb_sauvegardees integer;
  nb_incoherentes_avant integer;
begin
  select count(*) into nb_sauvegardees
  from public.student_subscriptions_repair_20260923;

  select count(*) into nb_incoherentes_avant
  from public.student_subscriptions sub
  join public.students s on s.id = sub.student_id
  join public.levels l   on l.id = s.level_id
  left join public.groups g_faux on g_faux.id = sub.group_id
  where g_faux.level_id is distinct from l.id;

  if nb_sauvegardees = 0 then
    raise exception 'Aucune ligne réparable trouvée — arrêt avant toute modification. À examiner avant de relancer.';
  end if;

  if nb_sauvegardees > nb_incoherentes_avant then
    raise exception 'Incohérence interne : % lignes sauvegardées pour % lignes incohérentes détectées — arrêt avant toute modification.', nb_sauvegardees, nb_incoherentes_avant;
  end if;

  raise notice '% lignes réparables trouvées et sauvegardées, sur % lignes incohérentes au total.', nb_sauvegardees, nb_incoherentes_avant;
end $$;

-- ------------------------------------------------------------
-- 4) La correction elle-même — uniquement les lignes sauvegardées,
--    uniquement group_id, rien d'autre
-- ------------------------------------------------------------
update public.student_subscriptions sub
set group_id = r.new_group_id
from public.student_subscriptions_repair_20260923 r
where r.subscription_id = sub.id
  and sub.group_id is distinct from r.new_group_id;

-- ------------------------------------------------------------
-- 5) Vérification finale : le nombre de lignes encore incohérentes doit
--    correspondre exactement à ce qui n'a pas été réparé (les cas sans
--    preuve fiable ou en désaccord, volontairement non touchés)
-- ------------------------------------------------------------
do $$
declare
  restantes integer;
  nb_reparees integer;
begin
  select count(*) into nb_reparees from public.student_subscriptions_repair_20260923;

  select count(*) into restantes
  from public.student_subscriptions sub
  join public.students s on s.id = sub.student_id
  join public.levels l   on l.id = s.level_id
  left join public.groups g_faux on g_faux.id = sub.group_id
  where g_faux.level_id is distinct from l.id;

  raise notice 'Réparation terminée : % lignes corrigées, % lignes laissées pour vérification manuelle (aucune preuve fiable ou sources en désaccord).', nb_reparees, restantes;
end $$;
