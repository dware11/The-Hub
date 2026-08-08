-- Normalize storage ownership comparisons across Supabase storage schema versions.

begin;

drop policy if exists "owners and admins read intake sources" on storage.objects;
drop policy if exists "owners delete intake sources" on storage.objects;

create policy "owners and admins read intake sources" on storage.objects
  for select using (
    bucket_id = 'intake-sources'
    and (owner_id::text = auth.uid()::text or is_admin())
  );

create policy "owners delete intake sources" on storage.objects
  for delete using (
    bucket_id = 'intake-sources'
    and (owner_id::text = auth.uid()::text or is_admin())
  );

commit;
