-- ============================================================
-- Formations (hors structure académique)
--
-- Le cursus scolaire est strictement hiérarchique : cycles → levels →
-- study_branches, et un élève ne porte qu'un seul level_id. Une formation
-- (« Français communication », « English communication ») ne rentre pas dans
-- cette hiérarchie : elle se suit EN PLUS d'un cycle, ou toute seule.
--
-- D'où quatre ajouts, sans rien casser de l'existant :
--   1. formations           — le catalogue
--   2. formation_levels     — les niveaux d'une formation, chacun son tarif
--   3. student_formations   — l'inscription d'un élève à un niveau
--   4. formation_payments   — le calendrier de paiement, séparé de la scolarité
--
-- Les groupes ne sont PAS dupliqués : la table groups gagne une colonne
-- formation_level_id. Un groupe de formation réutilise donc tel quel le
-- pointage des présences (student_events.group_id), les inscriptions
-- (group_students) et l'affectation d'un professeur (groups.teacher_id).
--
-- Idempotente : create table if not exists / add column if not exists partout,
-- le fichier peut être relancé sans effet.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Catalogue des formations
-- ------------------------------------------------------------
create table if not exists public.formations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  status      text not null default 'active' check (status in ('active', 'inactive')),
  created_at  timestamptz not null default now()
);

create unique index if not exists formations_name_unique on public.formations (lower(name));

-- ------------------------------------------------------------
-- 2) Niveaux d'une formation — c'est le niveau qui porte le prix, pas la
--    formation : « English communication · Débutant » n'a pas le même tarif
--    que « · Avancé ».
-- ------------------------------------------------------------
create table if not exists public.formation_levels (
  id            uuid primary key default gen_random_uuid(),
  formation_id  uuid not null references public.formations (id) on delete cascade,
  name          text not null,
  price         numeric not null default 0,
  -- Ordre d'affichage : Débutant avant Avancé, que l'alphabet ne respecte pas.
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  constraint formation_levels_name_unique unique (formation_id, name)
);

create index if not exists formation_levels_formation_idx
  on public.formation_levels (formation_id);

-- ------------------------------------------------------------
-- 3) Un groupe peut désormais appartenir à un niveau de formation plutôt
--    qu'à un couple (niveau scolaire, matière). Les deux rattachements sont
--    exclusifs en pratique ; toutes ces colonnes étaient déjà nullables.
-- ------------------------------------------------------------
alter table public.groups
  add column if not exists formation_level_id uuid
  references public.formation_levels (id) on delete set null;

create index if not exists groups_formation_level_idx
  on public.groups (formation_level_id);

-- ------------------------------------------------------------
-- 4) Inscription d'un élève à un niveau de formation.
--
--    enrolled_at joue pour la formation le rôle que registration_date joue
--    pour la scolarité : c'est lui qui ancre la date d'échéance mensuelle.
-- ------------------------------------------------------------
create table if not exists public.student_formations (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references public.students (id) on delete cascade,
  formation_level_id uuid not null references public.formation_levels (id) on delete cascade,
  group_id           uuid references public.groups (id) on delete set null,
  teacher_id         uuid references public.teachers (id) on delete set null,
  pricing_type       text not null default 'standard' check (pricing_type in ('standard', 'manual')),
  monthly_price      numeric not null default 0,
  enrolled_at        date not null default current_date,
  status             text not null default 'active' check (status in ('active', 'inactive')),
  created_at         timestamptz not null default now(),
  -- Un élève ne s'inscrit qu'une fois au même niveau ; il peut en revanche
  -- suivre plusieurs formations, ou plusieurs niveaux de formations différentes.
  constraint student_formations_unique unique (student_id, formation_level_id)
);

create index if not exists student_formations_student_idx
  on public.student_formations (student_id);
create index if not exists student_formations_level_idx
  on public.student_formations (formation_level_id);

-- ------------------------------------------------------------
-- 5) Paiements de formation — table distincte de student_payments, pour que
--    le calendrier des formations se règle et se relance indépendamment de
--    celui de la scolarité.
-- ------------------------------------------------------------
create table if not exists public.formation_payments (
  id                   uuid primary key default gen_random_uuid(),
  student_formation_id uuid not null references public.student_formations (id) on delete cascade,
  month                date not null,
  amount               numeric not null default 0,
  status               text not null default 'paid' check (status in ('paid', 'unpaid')),
  paid_at              timestamptz,
  paid_by              uuid references public.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  -- Contrainte exigée par l'upsert onConflict de l'encaissement.
  constraint formation_payments_unique_month unique (student_formation_id, month)
);

create index if not exists formation_payments_month_idx
  on public.formation_payments (month);
create index if not exists formation_payments_paid_at_idx
  on public.formation_payments (paid_at);

-- ------------------------------------------------------------
-- 6) Une inscription en formation seule n'a ni cycle ni niveau scolaire :
--    ces deux colonnes deviennent optionnelles sur students.
--
--    Sans danger pour l'existant : rendre une colonne nullable ne touche
--    aucune ligne déjà remplie.
-- ------------------------------------------------------------
do $$
declare
  target text;
begin
  foreach target in array array['cycle_id', 'level_id'] loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'students'
        and column_name = target and is_nullable = 'NO'
    ) then
      execute format('alter table public.students alter column %I drop not null', target);
      raise notice 'students.% est désormais optionnelle', target;
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 7) Row Level Security : mêmes règles que le reste de l'application
--    (tout utilisateur authentifié peut lire / écrire).
-- ------------------------------------------------------------
do $$
declare
  target text;
begin
  foreach target in array array['formations', 'formation_levels', 'student_formations', 'formation_payments'] loop
    execute format('alter table public.%I enable row level security', target);
    execute format('drop policy if exists %I on public.%I', target || '_authenticated', target);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      target || '_authenticated', target
    );
  end loop;
end $$;
