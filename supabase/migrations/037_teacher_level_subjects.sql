-- ============================================================
-- Matières enseignées par professeur, liées au niveau précis
--
-- PROBLÈME (signalé le 28/09) : teacher_subjects (teacher_id, subject_id) et
-- teacher_levels (teacher_id, level_id) sont deux tables indépendantes, sans
-- aucun lien entre elles. Un professeur qui enseigne l'Économie en 2ème
-- année Bac et la Comptabilité en 1ère année Bac (mais PAS l'Économie en
-- 1ère) se retrouvait donc affiché comme enseignant l'Économie dans les
-- DEUX niveaux — et le formulaire lui proposait même un groupe "Économie —
-- 1ère année Bac" auquel il ne devrait jamais avoir accès.
--
-- CORRECTION : nouvelle table teacher_level_subjects qui lie explicitement
-- chaque matière au niveau où elle est réellement enseignée.
-- teacher_subjects n'est plus utilisée par le code applicatif après cette
-- migration — elle n'est pas supprimée (au cas où), mais ne reçoit plus
-- aucune écriture.
--
-- REPRISE DES DONNÉES (décision du centre le 28/09) : préremplissage avec
-- toutes les combinaisons niveau × matière déjà cochées pour chaque
-- professeur, à charge pour le centre de retirer ensuite les mauvaises
-- associations dans le formulaire (ex. retirer "Économie / 1ère année Bac"
-- pour Salah Eddine, qui ne reste vrai que côté Asmae) plutôt que de tout
-- ressaisir. Restreint aux niveaux de cycles SANS forfait : un cycle au
-- forfait n'a jamais eu de matière cochée, le produit croisé n'y ajoute
-- donc rien.
-- ============================================================

create table if not exists public.teacher_level_subjects (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references public.teachers(id) on delete cascade,
  level_id    uuid not null references public.levels(id) on delete cascade,
  subject_id  uuid not null references public.subjects(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (teacher_id, level_id, subject_id)
);

alter table public.teacher_level_subjects enable row level security;

-- Même politique d'accès ouverte que les autres tables opérationnelles du
-- projet : la sécurité de ce projet est appliquée côté rôle/interface, pas
-- par des policies RLS fines par table.
create policy "Accès authentifié complet"
  on public.teacher_level_subjects
  for all
  to authenticated
  using (true)
  with check (true);

insert into public.teacher_level_subjects (teacher_id, level_id, subject_id)
select distinct tl.teacher_id, tl.level_id, ts.subject_id
from public.teacher_levels tl
join public.levels l on l.id = tl.level_id
join public.cycles c on c.id = l.cycle_id and coalesce(c.has_fixed_price, false) = false
join public.teacher_subjects ts on ts.teacher_id = tl.teacher_id
on conflict (teacher_id, level_id, subject_id) do nothing;
