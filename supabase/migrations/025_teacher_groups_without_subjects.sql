-- Les cycles à prix fixe (préscolaire, primaire) n'ont pas de matières à la
-- carte : un professeur y enseigne l'ensemble du niveau pour un groupe donné.
-- teacher_group_subjects ne peut pas décrire cette affectation puisqu'elle
-- exige une matière. Cette table porte le lien professeur ↔ groupe sans matière.
create table if not exists public.teacher_groups (
  teacher_id  uuid not null references public.teachers (id) on delete cascade,
  group_id    uuid not null references public.groups (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (teacher_id, group_id)
);

create index if not exists teacher_groups_group_id_idx
  on public.teacher_groups (group_id);

-- Row Level Security : mêmes règles que le reste de l'app
-- (tout utilisateur authentifié peut lire / écrire).
alter table public.teacher_groups enable row level security;

drop policy if exists teacher_groups_authenticated on public.teacher_groups;
create policy teacher_groups_authenticated on public.teacher_groups
  for all to authenticated using (true) with check (true);

-- Reprise de l'existant : les groupes de cycle à prix fixe déjà rattachés à un
-- professeur via groups.teacher_id deviennent des affectations explicites.
insert into public.teacher_groups (teacher_id, group_id)
select grp.teacher_id, grp.id
from public.groups as grp
join public.levels as level on level.id = grp.level_id
join public.cycles as cycle on cycle.id = level.cycle_id
where grp.teacher_id is not null
  and coalesce(cycle.has_fixed_price, false)
on conflict do nothing;
