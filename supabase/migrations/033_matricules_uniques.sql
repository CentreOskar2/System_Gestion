-- ============================================================
-- Matricules uniques — fin des collisions entre succursales
--
-- CAUSE RACINE (confirmée par requêtes en base le 22/09) : la politique de
-- sécurité "Branch isolation students" limite ce qu'un compte non-admin peut
-- LIRE dans students à sa propre succursale. C'est un comportement voulu — un
-- élève appartient réellement à une succursale, contrairement à un professeur
-- (migration 032). Le problème est ailleurs : nextRegistrationNumber() calcule
-- "le matricule suivant" à partir de cette même lecture restreinte. Chaque
-- succursale compte donc dans son coin, sans jamais voir les numéros déjà pris
-- par l'autre, et retombe sans arrêt sur les mêmes valeurs.
--
-- Conséquence mesurée : 127 matricules partagés par 256 élèves (plus de 85 %
-- du centre), sur la plage REG-2026-1000 à REG-2026-1126, et le phénomène
-- s'est reproduit à nouveau le 21/09 — ce n'est pas un accident isolé du
-- premier import, c'est une fuite active.
--
-- CE QUE CETTE MIGRATION FAIT, DANS L'ORDRE :
--   1. Un compteur dédié (registration_counters) + une fonction qui l'incrémente
--      de façon atomique, exécutée avec les droits du propriétaire de la
--      fonction (SECURITY DEFINER) — donc indépendante de la succursale de qui
--      l'appelle, et sans race condition possible : l'UPDATE ... RETURNING sur
--      une ligne unique est intrinsèquement séquentiel en PostgreSQL, même sous
--      forte concurrence. C'est plus robuste qu'un simple contournement de la
--      politique de sécurité, qui n'aurait pas réglé la course entre deux
--      inscriptions simultanées (observée le 09/09 : deux élèves de "New
--      centre" créés à 99 secondes d'écart avaient déjà reçu le même numéro).
--   2. Le compteur est amorcé sur le vrai maximum actuel, tous élèves confondus
--      — cette lecture-ci tourne dans la migration, exécutée par le rôle
--      propriétaire de la base, donc pas soumise à la politique de sécurité.
--   3. Réparation des données existantes : pour chaque matricule partagé,
--      "the old centre" garde son numéro (décision du centre), tout le reste
--      reçoit un numéro neuf tiré du compteur. Ordonné par date de création
--      pour un résultat reproductible.
--   4. Une contrainte d'unicité, posée une fois qu'il ne reste plus aucun
--      doublon — elle rend toute collision future IMPOSSIBLE au niveau de la
--      base, même si un bug venait à réapparaître ailleurs dans le code.
--
-- Aucune ligne n'est supprimée : cette migration ne fait que réécrire la
-- colonne registration_number des élèves concernés. Tout le reste de leur
-- dossier (paiements, groupes, notes...) est intact.
--
-- Idempotente : relancer ce fichier après une première exécution réussie ne
-- trouve plus aucun doublon à corriger et ne fait rien d'autre que confirmer
-- l'état déjà bon.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Compteur atomique et fonction de génération
-- ------------------------------------------------------------
create table if not exists public.registration_counters (
  year        integer primary key,
  last_number integer not null default 999
);

-- Jamais exposée en lecture/écriture directe : seule la fonction ci-dessous
-- (SECURITY DEFINER) y touche. RLS activé sans policy = accès refusé à tout
-- le monde via l'API, y compris à un super admin authentifié normalement.
alter table public.registration_counters enable row level security;

create or replace function public.next_registration_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  y int := extract(year from now())::int;
  n int;
begin
  insert into public.registration_counters (year, last_number)
  values (y, 999)
  on conflict (year) do nothing;

  -- UPDATE ... RETURNING sur une ligne unique verrouille cette ligne le temps
  -- de la transaction : deux appels simultanés sont sérialisés par PostgreSQL
  -- lui-même, pas par la logique applicative. C'est ce qui élimine la course
  -- observée le 09/09 entre deux inscriptions à 99 secondes d'écart.
  update public.registration_counters
     set last_number = last_number + 1
   where year = y
  returning last_number into n;

  return 'REG-' || y || '-' || n;
end;
$$;

-- Le SECURITY DEFINER ne suffit pas à autoriser l'appel : il faut aussi le
-- droit d'exécuter la fonction elle-même.
grant execute on function public.next_registration_number() to authenticated;

-- ------------------------------------------------------------
-- 2) Amorçage du compteur sur le vrai maximum actuel (tous élèves confondus)
-- ------------------------------------------------------------
do $$
declare
  y int := extract(year from now())::int;
  prefix text := 'REG-' || y || '-';
  current_max int;
begin
  select coalesce(max(substring(registration_number from length(prefix) + 1)::int), 999)
    into current_max
  from public.students
  where registration_number like prefix || '%'
    and substring(registration_number from length(prefix) + 1) ~ '^[0-9]+$';

  insert into public.registration_counters (year, last_number)
  values (y, current_max)
  on conflict (year) do update
    set last_number = greatest(registration_counters.last_number, excluded.last_number);

  raise notice 'Compteur % amorcé à %.', y, current_max;
end $$;

-- ------------------------------------------------------------
-- 3) Réparation : "the old centre" garde son numéro, tout le reste change
-- ------------------------------------------------------------
do $$
declare
  target record;
  new_number text;
  repaired integer := 0;
begin
  for target in
    select s.id, s.first_name, s.last_name, s.registration_number as ancien_numero
    from public.students s
    left join public.branches b on b.id = s.branch_id
    where s.registration_number in (
      select registration_number from public.students
      where registration_number is not null
      group by registration_number
      having count(*) > 1
    )
    -- coalesce(..., '') : un élève sans succursale renseignée n'est pas "the
    -- old centre" non plus, il est donc renuméroté — comportement le plus sûr
    -- par défaut.
    and coalesce(b.name, '') <> 'the old centre'
    order by s.created_at
  loop
    new_number := public.next_registration_number();
    update public.students set registration_number = new_number where id = target.id;
    repaired := repaired + 1;
    raise notice '% % (%) : % -> %', target.first_name, target.last_name, target.id, target.ancien_numero, new_number;
  end loop;

  raise notice '% élève(s) renuméroté(s).', repaired;
end $$;

-- ------------------------------------------------------------
-- 4) Vérification puis contrainte d'unicité
-- ------------------------------------------------------------
do $$
declare
  restants integer;
begin
  select count(*) into restants
  from (
    select registration_number from public.students
    where registration_number is not null
    group by registration_number
    having count(*) > 1
  ) x;

  if restants > 0 then
    raise exception 'Il reste % matricule(s) en double après réparation — contrainte NON posée, à examiner avant de relancer.', restants;
  end if;

  raise notice 'Aucun doublon restant.';

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.students'::regclass
      and conname = 'students_registration_number_unique'
  ) then
    raise notice 'Contrainte d''unicité déjà en place.';
  else
    alter table public.students
      add constraint students_registration_number_unique unique (registration_number);
    raise notice 'Contrainte d''unicité posée.';
  end if;
end $$;
