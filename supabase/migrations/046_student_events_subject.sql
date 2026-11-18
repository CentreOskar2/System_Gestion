-- ============================================================
-- Pointage par matière
--
-- BESOIN : la secrétaire pointe une absence en Maths. En vérifiant ensuite,
-- elle ne la retrouve pas.
--
-- CAUSE : le pointage (student_events) n'enregistrait que le GROUPE, jamais
-- la matière. Un même groupe porte souvent plusieurs matières pour un élève
-- (ex. 3AC G1 : Maths, PC, SVT). Donc :
--   - rien ne disait dans quelle matière l'absence avait eu lieu ;
--   - l'unicité (élève, jour, type, groupe) faisait qu'une absence en PC le
--     même jour, dans le même groupe, ÉCRASAIT celle de Maths.
--
-- CORRECTION :
--   1. student_events.subject_id : la matière pointée (NULL pour un groupe
--      au forfait, qui couvre toutes les matières) ;
--   2. rattrapage des pointages existants quand il n'y a aucun doute : si
--      l'élève ne suit qu'UNE matière dans ce groupe, c'est elle. Les autres
--      restent sans matière (affichés « matière non précisée ») ;
--   3. l'unicité inclut la matière : Maths et PC peuvent être pointées le
--      même jour dans le même groupe.
-- ============================================================

alter table public.student_events
  add column if not exists subject_id uuid references public.subjects (id) on delete set null;

update public.student_events ev
set subject_id = seule.subject_id
from (
  select student_id, group_id, (array_agg(distinct subject_id))[1] as subject_id
  from public.student_group_subjects
  where subject_id is not null
  group by student_id, group_id
  having count(distinct subject_id) = 1
) seule
where ev.subject_id is null
  and ev.student_id = seule.student_id
  and ev.group_id = seule.group_id;

-- Ancienne unicité sans la matière (migrations 003 et 027).
alter table public.student_events drop constraint if exists student_events_unique_event;
drop index if exists public.student_events_student_date_type_group_key;

create unique index if not exists student_events_student_date_type_group_subject_key
  on public.student_events (student_id, event_date, event_type, group_id, subject_id);

create index if not exists student_events_subject_id_idx on public.student_events (subject_id);
