-- ============================================================
-- Permission « Avances des profs »
--
-- DEMANDE (30/10) : l'onglet Avances des profs de la page Charges était
-- réservé à la direction (super_admin, admin, director). L'administrateur doit
-- pouvoir le donner à qui il veut depuis Utilisateurs > Permissions d'accès,
-- comme les autres pages.
--
-- Une colonne de plus dans user_permissions, à false : aucun compte existant
-- ne gagne l'accès sans qu'on le lui donne. La direction y a accès d'office
-- (AuthContext), comme à toutes les pages.
--
-- Idempotente : peut être relancée sans effet.
-- ============================================================

alter table public.user_permissions
  add column if not exists teacher_advances boolean not null default false;
