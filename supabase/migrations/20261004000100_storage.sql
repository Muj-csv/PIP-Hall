-- PIP-Hall — storage buckets for avatars and project covers.
-- Public read (images on public cards), writes only into the member's own folder: <bucket>/<user id>/<uuid>.webp
-- Files get a new uuid name on every upload, so an approved card keeps pointing at the image it was approved with.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',        'avatars',        true, 2097152, array['image/webp', 'image/jpeg', 'image/png']),
  ('project-covers', 'project-covers', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "list own images" on storage.objects
  for select to authenticated
  using (bucket_id in ('avatars', 'project-covers') and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "upload own images" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('avatars', 'project-covers') and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "replace own images" on storage.objects
  for update to authenticated
  using (bucket_id in ('avatars', 'project-covers') and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "delete own images" on storage.objects
  for delete to authenticated
  using (bucket_id in ('avatars', 'project-covers') and (storage.foldername(name))[1] = (select auth.uid())::text);
