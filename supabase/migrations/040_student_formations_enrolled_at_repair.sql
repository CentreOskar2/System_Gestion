-- ============================================================
-- Date de début des formations ajoutées après l'inscription de l'élève
--
-- PROBLÈME : jusqu'ici, une formation ajoutée en MODIFIANT un élève recevait
-- comme enrolled_at la date d'inscription scolaire de l'élève. Inscrit en
-- septembre, formation ajoutée en décembre : septembre à novembre
-- ressortaient impayés sur le calendrier des formations. L'application
-- utilise désormais le jour de l'ajout (enrollmentApi.js, updateEnrollment).
--
-- RÉPARATION des lignes existantes. Preuve utilisée : student_formations n'est
-- jamais supprimée puis recréée (syncStudentFormations met à jour en place),
-- donc son created_at est bien le jour où la formation a été ajoutée. Une
-- ligne créée plus d'un jour après l'élève a été ajoutée après coup.
--
-- Début retenu : le jour de l'ajout (heure du Maroc), mais jamais après le
-- premier mois déjà payé — un mois réglé doit rester visible et compté.
-- Seul enrolled_at est écrit, et seulement pour le reculer vers une date
-- plus tardive. Aucun paiement n'est modifié.
-- ============================================================
with cible as (
  select
    sf.id,
    greatest(
      sf.enrolled_at,
      least(
        (sf.created_at at time zone 'Africa/Casablanca')::date,
        coalesce(
          (select min(fp.month) from public.formation_payments fp where fp.student_formation_id = sf.id),
          'infinity'::date
        )
      )
    ) as debut
  from public.student_formations sf
  join public.students s on s.id = sf.student_id
  where sf.created_at > s.created_at + interval '1 day'
)
update public.student_formations sf
set enrolled_at = cible.debut
from cible
where cible.id = sf.id
  and cible.debut > sf.enrolled_at;
