-- Sur un cycle à prix fixe, le prix du niveau est un forfait pour l'élève :
-- il couvre toutes les matières. L'inscription l'appliquait par matière, si
-- bien qu'un élève de Grande section suivant 6 matières était facturé
-- 6 x 200 DH au lieu de 200 DH. On remet ces élèves sur le forfait du niveau.
update public.students as student
set du_mois = level.fixed_price
from public.levels as level, public.cycles as cycle
where student.level_id = level.id
  and level.cycle_id = cycle.id
  and coalesce(cycle.has_fixed_price, false)
  and level.fixed_price is not null
  and student.du_mois is distinct from level.fixed_price;

-- Ces élèves ne choisissent pas de matières : ils suivent tout le niveau.
-- Seule leur appartenance au groupe (group_students) est conservée, les
-- lignes par matière n'ont plus de sens et fausseraient le calcul du dû.
delete from public.student_subscriptions as subscription
using public.students as student, public.levels as level, public.cycles as cycle
where subscription.student_id = student.id
  and student.level_id = level.id
  and level.cycle_id = cycle.id
  and coalesce(cycle.has_fixed_price, false);

delete from public.student_group_subjects as student_subject
using public.students as student, public.levels as level, public.cycles as cycle
where student_subject.student_id = student.id
  and student.level_id = level.id
  and level.cycle_id = cycle.id
  and coalesce(cycle.has_fixed_price, false);

-- Même logique côté professeurs : sur ces cycles ils enseignent tout le
-- niveau. Leurs affectations par matière sont remplacées par le lien direct
-- professeur / groupe créé par la migration 025.
insert into public.teacher_groups (teacher_id, group_id)
select distinct assignment.teacher_id, assignment.group_id
from public.teacher_group_subjects as assignment
join public.groups as grp on grp.id = assignment.group_id
join public.levels as level on level.id = grp.level_id
join public.cycles as cycle on cycle.id = level.cycle_id
where coalesce(cycle.has_fixed_price, false)
on conflict do nothing;

delete from public.teacher_group_subjects as assignment
using public.groups as grp, public.levels as level, public.cycles as cycle
where assignment.group_id = grp.id
  and grp.level_id = level.id
  and level.cycle_id = cycle.id
  and coalesce(cycle.has_fixed_price, false);
