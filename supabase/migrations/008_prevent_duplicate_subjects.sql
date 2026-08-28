-- Keep the subject that is already used by a tariff (if any), then remove
-- duplicate subject rows that are not referenced by a tariff.
with ranked_subjects as (
  select
    id,
    row_number() over (
      partition by lower(btrim(name))
      order by exists (select 1 from public.tariffs t where t.subject_id = subjects.id) desc, id
    ) as row_number
  from public.subjects
)
delete from public.subjects s
using ranked_subjects ranked
where s.id = ranked.id
  and ranked.row_number > 1
  and not exists (select 1 from public.tariffs t where t.subject_id = s.id);

-- Prevent the same subject from being created twice with only case or spaces
-- changed (for example, "Mathématique" and "mathématique ").
create unique index if not exists subjects_name_normalized_key
  on public.subjects (lower(btrim(name)));
