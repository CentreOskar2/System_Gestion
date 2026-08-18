-- ============================================================
-- Frais d'inscription (montant unique par élève et par année scolaire)
-- À exécuter dans l'éditeur SQL de Supabase.
-- ============================================================

-- 1) Réglages globaux de l'application (clé / valeur)
create table if not exists public.app_settings (
  key         text primary key,
  value       text,
  updated_at  timestamptz not null default now()
);

-- Valeurs par défaut : 100 DH de frais d'inscription, année scolaire active 2026-2027.
insert into public.app_settings (key, value) values
  ('registration_fee_amount', '100'),
  ('active_school_year', '2026-2027')
on conflict (key) do nothing;

-- 2) Frais d'inscription par élève et par année scolaire
create table if not exists public.registration_fees (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students (id) on delete cascade,
  school_year   text not null,
  amount        numeric not null default 0,
  status        text not null default 'unpaid' check (status in ('paid', 'unpaid')),
  paid_at       timestamptz,
  validated_by  uuid references public.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint registration_fees_student_year_unique unique (student_id, school_year)
);

create index if not exists registration_fees_school_year_idx
  on public.registration_fees (school_year);

create index if not exists registration_fees_paid_at_idx
  on public.registration_fees (paid_at);

-- 3) Row Level Security : mêmes règles que le reste de l'app
--    (tout utilisateur authentifié peut lire / écrire).
alter table public.app_settings enable row level security;
alter table public.registration_fees enable row level security;

drop policy if exists app_settings_authenticated on public.app_settings;
create policy app_settings_authenticated on public.app_settings
  for all to authenticated using (true) with check (true);

drop policy if exists registration_fees_authenticated on public.registration_fees;
create policy registration_fees_authenticated on public.registration_fees
  for all to authenticated using (true) with check (true);
