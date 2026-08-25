-- One tariff must exist at most once for a given subject and level. This
-- permits the application to create a tariff and later update its price.
alter table public.tariffs
  add constraint tariffs_level_id_subject_id_key unique (level_id, subject_id);
