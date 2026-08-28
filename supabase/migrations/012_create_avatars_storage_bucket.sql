-- Photos for teachers and students are uploaded by src/utils/storage.js to
-- the `avatars` bucket. Create it if this Supabase project does not have it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Public bucket: images can be displayed through their public URL. Uploads
-- and changes remain limited to authenticated application users.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'avatars_authenticated_upload'
  ) then
    create policy avatars_authenticated_upload
      on storage.objects for insert to authenticated
      with check (bucket_id = 'avatars');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'avatars_authenticated_update'
  ) then
    create policy avatars_authenticated_update
      on storage.objects for update to authenticated
      using (bucket_id = 'avatars')
      with check (bucket_id = 'avatars');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'avatars_authenticated_delete'
  ) then
    create policy avatars_authenticated_delete
      on storage.objects for delete to authenticated
      using (bucket_id = 'avatars');
  end if;
end $$;
