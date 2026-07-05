-- ===========================================================================
-- PawPin migration 0005 — Storage: cat-photos bucket + policies
-- ===========================================================================
-- Creates a PUBLIC-READ bucket for cat photos. Uploads are restricted to
-- authenticated users, scoped to a folder named after their user id
-- (e.g. "<uid>/<filename>"). Public read is acceptable because photos are
-- non-sensitive AND location/EXIF metadata is stripped server-side before
-- upload (see docs/security-report.md). No private user data is stored here.
--
-- NOTE: On Supabase, storage.objects already has RLS enabled and is owned by
-- the storage schema. These statements are idempotent and safe to re-run.
-- ===========================================================================

-- Create the bucket (public read). id + name = 'cat-photos'.
insert into storage.buckets (id, name, public)
values ('cat-photos', 'cat-photos', true)
on conflict (id) do update set public = excluded.public;

-- Public read of objects in the cat-photos bucket.
drop policy if exists "cat_photos_public_read" on storage.objects;
create policy "cat_photos_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'cat-photos');

-- Authenticated users may upload only into their own "<uid>/..." folder.
drop policy if exists "cat_photos_authenticated_insert" on storage.objects;
create policy "cat_photos_authenticated_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cat-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users may update/delete only their own objects; admins can manage all.
drop policy if exists "cat_photos_owner_update" on storage.objects;
create policy "cat_photos_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'cat-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists "cat_photos_owner_delete" on storage.objects;
create policy "cat_photos_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'cat-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
