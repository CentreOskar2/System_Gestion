-- ============================================================
-- Frais d'inscription : montant modifiable et paiement en plusieurs fois
--
-- BESOIN :
--   1) le montant des frais d'inscription se négocie élève par élève
--      (ex. 50 DH au lieu des 100 DH habituels) ;
--   2) l'élève peut en payer une partie (avance) et ramener le reste plus tard.
--
-- MODÈLE :
--   - registration_fees.amount  = montant DÛ par l'élève pour l'année
--     (modifiable, par défaut le réglage registration_fee_amount) ;
--   - registration_fee_payments = chaque somme réellement encaissée, avec sa
--     date et son encaisseur. Deux versements de 50 DH sont deux lignes : chacun
--     compte dans la caisse du jour où il a été reçu ;
--   - registration_fees.status    = 'unpaid' | 'partial' | 'paid', tenu à jour
--     par l'application (registrationFeesApi.js) d'après les versements ;
--   - registration_fees.paid_at   = date du versement qui a soldé les frais.
--
-- RATTRAPAGE : chaque frais déjà payé reçoit un versement unique de son
-- montant, à sa date de paiement. Les recettes passées ne bougent pas.
-- ============================================================

create table if not exists public.registration_fee_payments (
  id                   uuid primary key default gen_random_uuid(),
  registration_fee_id  uuid not null references public.registration_fees (id) on delete cascade,
  student_id           uuid not null references public.students (id) on delete cascade,
  amount               numeric not null check (amount > 0),
  paid_at              timestamptz not null default now(),
  paid_by              uuid references public.users (id) on delete set null,
  created_at           timestamptz not null default now()
);

create index if not exists registration_fee_payments_fee_idx
  on public.registration_fee_payments (registration_fee_id);

create index if not exists registration_fee_payments_paid_at_idx
  on public.registration_fee_payments (paid_at);

alter table public.registration_fee_payments enable row level security;

drop policy if exists registration_fee_payments_authenticated on public.registration_fee_payments;
create policy registration_fee_payments_authenticated on public.registration_fee_payments
  for all to authenticated using (true) with check (true);

-- Statut « partial » (une avance a été versée, il reste à payer).
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.registration_fees'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.registration_fees drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.registration_fees
  add constraint registration_fees_status_check check (status in ('paid', 'partial', 'unpaid'));

-- Rattrapage : un versement pour chaque frais déjà payé (une seule fois).
insert into public.registration_fee_payments (registration_fee_id, student_id, amount, paid_at, paid_by)
select rf.id, rf.student_id, rf.amount, coalesce(rf.paid_at, rf.created_at, now()), rf.validated_by
from public.registration_fees rf
where rf.status = 'paid'
  and coalesce(rf.amount, 0) > 0
  and not exists (
    select 1 from public.registration_fee_payments p where p.registration_fee_id = rf.id
  );
