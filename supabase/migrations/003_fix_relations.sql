-- ============================================================
-- Correction des relations entre tables
-- À exécuter dans l'éditeur SQL de Supabase (après 001 et 002).
--
-- Corrige 2 anomalies détectées sur la base en ligne :
--   1. group_students possède DEUX clés étrangères vers students -> PostgREST
--      ne sait plus laquelle utiliser et refuse toute jointure imbriquée.
--      Conséquence : fetchCatalog() lève une erreur, ce qui casse l'inscription,
--      les frais de scolarité, les impayés et le tableau de bord.
--   2. student_events.group_id n'existe pas alors que le pointage l'enregistre.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Supprimer la clé étrangère group_students -> students en double
-- ------------------------------------------------------------
-- On conserve la contrainte canonique « group_students_student_id_fkey » et on
-- supprime toute autre FK partant de group_students.student_id vers students.
do $$
declare
  dup record;
begin
  for dup in
    select con.conname
    from pg_constraint con
    join pg_class src on src.oid = con.conrelid
    join pg_class tgt on tgt.oid = con.confrelid
    join pg_namespace ns on ns.oid = src.relnamespace
    where con.contype = 'f'
      and ns.nspname = 'public'
      and src.relname = 'group_students'
      and tgt.relname = 'students'
      and con.conname <> 'group_students_student_id_fkey'
  loop
    execute format('alter table public.group_students drop constraint %I', dup.conname);
    raise notice 'Contrainte en double supprimée : %', dup.conname;
  end loop;
end $$;

-- Filet de sécurité : si la contrainte canonique avait été celle supprimée par
-- une manipulation précédente, on la recrée.
do $$
begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class src on src.oid = con.conrelid
    join pg_namespace ns on ns.oid = src.relnamespace
    where con.contype = 'f' and ns.nspname = 'public'
      and src.relname = 'group_students'
      and con.conname = 'group_students_student_id_fkey'
  ) then
    alter table public.group_students
      add constraint group_students_student_id_fkey
      foreign key (student_id) references public.students (id) on delete cascade;
  end if;
end $$;

-- ------------------------------------------------------------
-- 2) Ajouter student_events.group_id (utilisé par le pointage)
-- ------------------------------------------------------------
alter table public.student_events
  add column if not exists group_id uuid references public.groups (id) on delete set null;

-- Le pointage fait un upsert avec
--   onConflict: 'student_id,event_date,event_type,group_id'
-- ce qui exige une contrainte UNIQUE sur exactement ces 4 colonnes.
do $$
begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class src on src.oid = con.conrelid
    join pg_namespace ns on ns.oid = src.relnamespace
    where ns.nspname = 'public'
      and src.relname = 'student_events'
      and con.conname = 'student_events_unique_event'
  ) then
    alter table public.student_events
      add constraint student_events_unique_event
      unique (student_id, event_date, event_type, group_id);
  end if;
end $$;

-- Index de confort pour les lectures par groupe.
create index if not exists student_events_group_id_idx on public.student_events (group_id);
