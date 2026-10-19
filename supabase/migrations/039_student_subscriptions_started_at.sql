-- ============================================================
-- Date de début de facturation d'une matière
--
-- BESOIN : un élève inscrit en Français + Maths ajoute la Physique en cours
-- d'année. La Physique doit apparaître comme due à partir du mois où elle a
-- été ajoutée — ni avant (les mois passés étaient réglés sans elle), ni
-- « déjà payée » parce que le mois avait été réglé avant l'ajout.
--
-- Jusqu'ici, rien ne disait depuis quand une matière est suivie :
-- l'application supprime puis recrée toutes les lignes de
-- student_subscriptions à chaque modification, donc created_at ne reflète
-- que le dernier enregistrement.
--
-- started_at :
--   - NULL  = matière suivie depuis l'inscription (matières choisies à
--             l'inscription, et lignes existantes sans preuve contraire) ;
--   - date  = matière ajoutée après coup, due à partir de ce moment.
-- L'application recopie la valeur existante à chaque ré-enregistrement
-- (voir enrollmentApi.js, withStartDates).
-- ============================================================

alter table public.student_subscriptions
  add column if not exists started_at timestamptz;

-- ------------------------------------------------------------
-- Rattrapage des matières DÉJÀ ajoutées en cours d'année
--
-- Preuve utilisée : un mois qui a une ligne student_payments (mois complet)
-- ET un détail par matière (student_payment_subjects) a été réglé matière
-- par matière, toutes les matières de l'époque cochées — l'application
-- n'écrit student_payments qu'à cette condition. Si une matière actuelle de
-- l'élève n'a PAS de ligne dans un tel mois, c'est qu'elle n'était pas
-- encore suivie : elle a été ajoutée après.
--
-- Début retenu, à partir du DERNIER mois réglé sans elle (M) :
--   - si la matière a déjà été payée sur un mois postérieur à M, elle a été
--     ajoutée entre les deux : début au 1er du mois qui suit M ;
--   - sinon, elle a été ajoutée après le paiement de M : début à la date de
--     ce paiement (au plus tôt le 1er de M). M redevient partiel, la matière
--     y est due — c'est le cas signalé par le centre : mois réglé en
--     Français + Maths, Physique ajoutée ensuite dans le même mois.
-- Les mois antérieurs restent réglés.
--
-- SÉCURITÉ : seules les lignes dont started_at est encore NULL sont
-- touchées, et seule cette colonne est écrite. Aucun paiement n'est
-- modifié. Annulable sans perte : remettre started_at à NULL.
-- ------------------------------------------------------------
with mois_sans_matiere as (
  select sub.id as subscription_id, sub.student_id, sub.subject_id, pay.month, pay.paid_at
  from public.student_subscriptions sub
  join public.student_payments pay
    on pay.student_id = sub.student_id
   and coalesce(pay.status, 'paid') in ('paid', 'validé')
  where exists (
      select 1 from public.student_payment_subjects detail
      where detail.student_id = pay.student_id and detail.month = pay.month
    )
    and not exists (
      select 1 from public.student_payment_subjects detail
      where detail.student_id = pay.student_id
        and detail.month = pay.month
        and detail.subject_id = sub.subject_id
    )
),
dernier as (
  select distinct on (subscription_id) *
  from mois_sans_matiere
  order by subscription_id, month desc
),
debut as (
  select
    d.subscription_id,
    case
      when exists (
        select 1 from public.student_payment_subjects later
        where later.student_id = d.student_id
          and later.subject_id = d.subject_id
          and later.month > d.month
      )
      then (d.month + interval '1 month')::timestamp at time zone 'Africa/Casablanca'
      else greatest(
        coalesce(d.paid_at, '-infinity'::timestamptz),
        d.month::timestamp at time zone 'Africa/Casablanca'
      )
    end as started_at
  from dernier d
)
update public.student_subscriptions sub
set started_at = debut.started_at
from debut
where debut.subscription_id = sub.id
  and sub.started_at is null;
