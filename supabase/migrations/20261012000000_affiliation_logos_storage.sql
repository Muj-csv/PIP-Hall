-- V2-22 (D-135): a public bucket for the logos admins upload for affiliations.
-- Public read (the logo is printed on frames and pins everyone sees); only admins upload, into their
-- own folder: affiliation-logos/<admin id>/<uuid>.png. Any admin may delete one, so a logo can go
-- whoever put it there. Names never live in the code: the image and the affiliation's name are data.
-- Run it with the other migrations; safe to run again.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('affiliation-logos', 'affiliation-logos', true, 524288, array['image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "admins list logos" on storage.objects;
create policy "admins list logos" on storage.objects
  for select to authenticated
  using (bucket_id = 'affiliation-logos' and (select public.is_admin()));

drop policy if exists "admins upload logos" on storage.objects;
create policy "admins upload logos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'affiliation-logos' and (select public.is_admin()) and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "admins delete logos" on storage.objects;
create policy "admins delete logos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'affiliation-logos' and (select public.is_admin()));
