-- The branches primary key is a UUID but the existing table was created
-- without a default value. Inserts from the application do not provide an ID,
-- so Postgres must generate one automatically.
create extension if not exists pgcrypto;

alter table public.branches
  alter column id set default gen_random_uuid();
