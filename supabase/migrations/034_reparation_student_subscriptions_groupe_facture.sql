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
--   4. Garde-fou avant d'écrire : si le nombre de lignes NOUVELLEMENT
--      réparées à ce passage dépasse le nombre de lignes incohérentes
--      détectées ce même passage (impossible si la logique est correcte),
--      la migration s'arrête avec une exception avant de toucher à
--      student_subscriptions. Zéro nouvelle ligne n'est pas une erreur —
--      c'est le résultat normal d'un passage où tout était déjà réparé.
--   5. Idempotente et rejouable à volonté : chaque relance ne repère et ne
--      sauvegarde que ce qui est nouvellement réparable à cet instant
--      (par exemple après une correction manuelle faite entre-temps dans
--      l'application) ; les lignes déjà bonnes ne bougent pas.
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
-- 2) et 3) Repérage des lignes réparables, sauvegarde de leur état "avant"
--    et garde-fou, dans le même bloc pour comparer le nombre de
--    lignes NOUVELLEMENT réparées à ce passage (pas le cumul historique
--    de la table de sauvegarde, qui grandit à chaque relance) au nombre
--    de lignes incohérentes trouvées CE passage-ci. Comparer le cumul
--    historique à l'instantané actuel n'a pas de sens dès le deuxième
--    passage : la table de sauvegarde s'accumule, mais l'incohérence
--    restante diminue à mesure qu'on répare — les deux ne sont plus sur
--    la même échelle après le premier passage.
-- ------------------------------------------------------------
do $$
declare
  nb_incoherentes_avant integer;
  nb_nouvelles integer;
begin
  select count(*) into nb_incoherentes_avant
  from public.student_subscriptions sub
  join public.students s on s.id = sub.student_id
  join public.levels l   on l.id = s.level_id
  left join public.groups g_faux on g_faux.id = sub.group_id
  where g_faux.level_id is distinct from l.id;

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
    select
      c.subscription_id, c.student_id, c.subject_id, c.old_group_id,
      vm.group_id as new_group_id,
      'student_group_subjects' as source
    from cible c
    join via_matiere vm on vm.subscription_id = c.subscription_id
    left join via_groupe vg on vg.subscription_id = c.subscription_id
    where vg.group_id is null or vg.group_id = vm.group_id

    union all

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

  get diagnostics nb_nouvelles = row_count;

  if nb_nouvelles > nb_incoherentes_avant then
    raise exception 'Incohérence interne : % nouvelles lignes réparées pour % lignes incohérentes détectées ce passage — arrêt avant toute modification.', nb_nouvelles, nb_incoherentes_avant;
  end if;

  raise notice '% nouvelles lignes réparables trouvées et sauvegardées à ce passage, sur % lignes incohérentes détectées avant réparation.', nb_nouvelles, nb_incoherentes_avant;
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
