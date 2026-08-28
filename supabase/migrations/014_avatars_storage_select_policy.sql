-- uploadImage() uses `upsert: true`. Supabase Storage requires SELECT in
-- addition to INSERT/UPDATE when an upload can replace an object.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'avatars_authenticated_read'
  ) then
    create policy avatars_authenticated_read
      on storage.objects for select to authenticated
      using (bucket_id = 'avatars');
  end if;
end $$;
