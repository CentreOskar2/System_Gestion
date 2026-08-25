-- user_branches is inserted with user_id and branch_id only. Generate its
-- UUID primary key automatically instead of requiring the client or function
-- to send one.
create extension if not exists pgcrypto;

alter table public.user_branches
  alter column id set default gen_random_uuid();
