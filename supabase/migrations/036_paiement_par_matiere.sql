-- ============================================================
-- Paiement mensuel par matière (au lieu d'un seul bloc tout-ou-rien)
--
-- BESOIN : un élève inscrit à plusieurs matières peut régler une partie
-- seulement dans le mois (ex. 3 matières sur 4, faute de moyens ce mois-ci).
-- Jusqu'ici, student_payments n'enregistre qu'une seule ligne par élève et
-- par mois — impossible de dire QUELLES matières sont payées.
--
-- APPROCHE (la plus sûre : ne rien changer à ce qui existe déjà) :
--   - Nouvelle table student_payment_subjects : le détail, une ligne par
--     élève + matière + mois payée. C'est elle qui alimente l'affichage
--     "segmenté" (un segment par matière) et les cases à cocher de la
--     modale de validation.
--   - student_payments (table existante) continue de fonctionner EXACTEMENT
--     comme avant : une ligne = un mois intégralement réglé. Elle n'est
--     écrite que lorsque TOUTES les matières du mois sont payées (le code
--     applicatif s'en charge), et supprimée si on décoche une matière qui
--     faisait passer le mois de "complet" à "partiel".
--   - Résultat : aucune autre page (Dashboard, Rapports, Retards & Impayés,
--     Salaires) n'a besoin d'être modifiée. Elles continuent de lire
--     student_payments exactement comme avant ; un mois partiellement payé
--     y reste simplement absent, donc toujours compté "impayé" — ce qui est
--     le comportement correct pour le suivi des retards.
--   - Les élèves au forfait (préscolaire/primaire, sans matières séparées)
--     ne sont pas concernés : ils continuent d'utiliser uniquement
--     student_payments, comme aujourd'hui.
-- ============================================================

create table if not exists public.student_payment_subjects (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  subject_id  uuid not null references public.subjects(id) on delete cascade,
  month       date not null,
  amount      numeric not null default 0,
  paid_at     timestamptz not null default now(),
  paid_by     uuid references public.users(id),
  created_at  timestamptz not null default now(),
  unique (student_id, subject_id, month)
);

alter table public.student_payment_subjects enable row level security;

-- Même politique d'accès ouverte que les autres tables opérationnelles du
-- projet (student_payments, student_subscriptions...) : la sécurité de ce
-- projet est appliquée côté rôle/interface, pas par des policies RLS fines
-- par table.
create policy "Accès authentifié complet"
  on public.student_payment_subjects
  for all
  to authenticated
  using (true)
  with check (true);
