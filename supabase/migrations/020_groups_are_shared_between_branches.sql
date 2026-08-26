-- Groups are a shared academic resource for the entire centre. Students,
-- teachers and accounting may still be filtered by branch, but a group itself
-- must not be restricted to the branch that originally created it.
alter table public.groups
  alter column branch_id drop not null;

update public.groups
set branch_id = null
where branch_id is not null;
