-- ============================================================
-- Historique des matières retirées à un élève
--
-- BESOIN : un élève suit Français + Anglais + Maths. En novembre, la
-- secrétaire retire l'Anglais. Les mois passés (septembre, octobre) doivent
-- toujours afficher l'Anglais : il était suivi, payé ou dû à l'époque.
--
-- Jusqu'ici, retirer une matière supprimait sa ligne de
-- student_subscriptions (l'application supprime puis recrée toutes les
-- lignes à chaque modification). La page Frais de scolarité calcule chaque
-- mois avec les matières ACTUELLES de l'élève : l'Anglais disparaissait donc
-- aussi des mois passés.
--
-- APPROCHE (ne rien changer à ce qui existe) : student_subscriptions garde
-- son sens — les matières suivies aujourd'hui — et toutes les pages qui la
-- lisent restent inchangées. Cette nouvelle table garde la trace de chaque
-- matière retirée :
--   - started_at : début de facturation de la matière (NULL = depuis
--                  l'inscription), recopié de student_subscriptions ;
--   - ended_at   : moment du retrait. La matière n'est plus due à partir du
--                  mois de ended_at ; elle reste due sur les mois d'avant ;
--   - pricing_type, monthly_price, group_id, teacher_id : la matière telle
--     qu'elle était suivie (son prix sert aux mois passés).
-- Seule la page Frais de scolarité (et ce qui partage son calcul : retards,
-- rapports) la lit.
-- ============================================================

create table if not exists public.student_subscription_ends (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students(id) on delete cascade,
  subject_id    uuid not null references public.subjects(id) on delete cascade,
  started_at    timestamptz,
  ended_at      timestamptz not null default now(),
  pricing_type  text,
  monthly_price numeric,
  group_id      uuid references public.groups(id) on delete set null,
  teacher_id    uuid references public.teachers(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists student_subscription_ends_student_idx
  on public.student_subscription_ends (student_id);

alter table public.student_subscription_ends enable row level security;

-- Même accès que les autres tables opérationnelles (student_subscriptions,
-- student_payment_subjects...) : la sécurité est appliquée côté rôle/interface.
drop policy if exists student_subscription_ends_authenticated on public.student_subscription_ends;
create policy student_subscription_ends_authenticated on public.student_subscription_ends
  for all to authenticated using (true) with check (true);
