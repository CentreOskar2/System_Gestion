-- Un upsert « ON CONFLICT (a, b) » exige un index unique sur exactement ces
-- colonnes, sinon PostgreSQL refuse la requête :
--   « there is no unique or exclusion constraint matching the ON CONFLICT
--     specification »
-- C'est ce qui faisait échouer la validation d'un salaire. Deux tables sont
-- concernées ; la migration 016 avait déjà réglé le cas de student_payments.

-- ============================================================
-- 1) teacher_salaries — validateSalary() / ExpensesPage upsert (teacher_id, month)
-- ============================================================

-- Un index unique ne peut pas se créer sur des doublons existants : on ne garde
-- qu'une ligne par professeur et par mois, en privilégiant celle déjà payée.
with ranked as (
  select
    ctid,
    row_number() over (
      partition by teacher_id, month
      order by (status = 'paid') desc, ctid desc
    ) as rn
  from public.teacher_salaries
)
delete from public.teacher_salaries as target
using ranked
where target.ctid = ranked.ctid
  and ranked.rn > 1;

create unique index if not exists teacher_salaries_teacher_month_key
  on public.teacher_salaries (teacher_id, month);

-- ============================================================
-- 2) student_events — pointage des absences, upsert
--    (student_id, event_date, event_type, group_id)
-- ============================================================

with ranked as (
  select
    ctid,
    row_number() over (
      partition by student_id, event_date, event_type, group_id
      order by ctid desc
    ) as rn
  from public.student_events
)
delete from public.student_events as target
using ranked
where target.ctid = ranked.ctid
  and ranked.rn > 1;

create unique index if not exists student_events_student_date_type_group_key
  on public.student_events (student_id, event_date, event_type, group_id);
