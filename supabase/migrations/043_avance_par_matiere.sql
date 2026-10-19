-- ============================================================
-- Avance par matière : une matière peut se régler en plusieurs fois
--
-- BESOIN : inscrit le 18/10 en Maths, PC et FR (150 DH chacune), l'élève
-- paie 150 DH par matière. Octobre ne compte qu'à moitié (75 DH) ; les 75 DH
-- restants de chaque matière sont une AVANCE sur novembre. Novembre reste
-- « partiel » (orange) jusqu'à ce que l'élève paie le reste, et passe dans
-- Retards & Impayés une fois son échéance dépassée.
--
-- MODÈLE :
--   - student_payment_subjects garde une ligne par SOMME REÇUE (versement),
--     chacune à sa date : l'avance du 18/10 reste dans la caisse du 18/10, le
--     solde payé en novembre dans la caisse de ce jour-là. La contrainte
--     « une ligne par élève + matière + mois » est donc levée ;
--   - due_amount = prix attendu pour cette matière ce mois-là (75 DH pour un
--     demi-mois, 150 DH pour un mois normal). La matière est réglée quand la
--     somme de ses versements du mois atteint ce montant, partielle sinon ;
--   - due_amount NULL = ligne enregistrée avant cette migration : son
--     montant était le prix du mois, la matière reste considérée réglée
--     (aucun mois déjà payé ne redevient partiel).
--
-- SÉCURITÉ : aucune ligne n'est modifiée, seules une colonne et un index
-- sont ajoutés et la contrainte d'unicité retirée.
-- ============================================================

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.student_payment_subjects'::regclass
      and contype = 'u'
  loop
    execute format('alter table public.student_payment_subjects drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.student_payment_subjects
  add column if not exists due_amount numeric;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'student_payment_subjects_due_amount_positive'
      and conrelid = 'public.student_payment_subjects'::regclass
  ) then
    alter table public.student_payment_subjects
      add constraint student_payment_subjects_due_amount_positive check (due_amount is null or due_amount >= 0);
  end if;
end $$;

create index if not exists student_payment_subjects_student_month_idx
  on public.student_payment_subjects (student_id, month, subject_id);
