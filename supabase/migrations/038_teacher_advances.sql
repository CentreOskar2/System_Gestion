-- ============================================================
-- Avances sur salaire des professeurs
--
-- DEMANDE (01/10) : la page Charges est séparée en trois (Achats, Avances
-- des profs, Salaires). Une avance versée à un professeur doit apparaître
-- dans son journal de salaire et être déduite automatiquement du montant à
-- lui verser pour le mois concerné.
--
-- `month` est le mois de salaire sur lequel l'avance est déduite (toujours
-- le 1er du mois, comme teacher_salaries.month) ; `advance_date` est le jour
-- où l'argent a été remis. Les deux diffèrent quand une avance est prise en
-- fin de mois sur le salaire du mois suivant.
--
-- Une avance n'est PAS une charge de plus : c'est une partie du salaire
-- payée en avance. Le bénéfice net continue de compter le salaire brut une
-- seule fois ; l'avance ne fait que réduire le « net à verser » du journal.
-- C'est pourquoi elle vit dans sa propre table et non dans expenses.
-- ============================================================

create table if not exists public.teacher_advances (
  id            uuid primary key default gen_random_uuid(),
  teacher_id    uuid not null references public.teachers(id) on delete cascade,
  amount        numeric not null check (amount > 0),
  advance_date  date not null default current_date,
  month         date not null check (extract(day from month) = 1),
  note          text,
  created_by    uuid references public.users(id),
  created_at    timestamptz not null default now()
);

create index if not exists teacher_advances_teacher_month_idx
  on public.teacher_advances (teacher_id, month);

alter table public.teacher_advances enable row level security;

-- Même politique d'accès ouverte que les autres tables opérationnelles du
-- projet : la sécurité de ce projet est appliquée côté rôle/interface, pas
-- par des policies RLS fines par table.
create policy "Accès authentifié complet"
  on public.teacher_advances
  for all
  to authenticated
  using (true)
  with check (true);
