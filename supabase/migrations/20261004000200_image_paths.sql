-- PIP-Hall — store image paths inside our own Storage, never free URLs (D-027).
-- An approved card used to accept any https avatar/cover URL, so a member could get approved and then
-- swap the file on a server they control, bypassing review (D-002). Now a card can only point at
-- <bucket>/<owner id>/<uuid>.<ext>; every upload gets a new uuid, so the approved image can't change.
-- The client builds the public URL: <SUPABASE_URL>/storage/v1/object/public/<bucket>/<path>.

alter table public.profiles rename column avatar_url to avatar_path;
alter table public.profiles drop constraint profiles_avatar_url_check;
alter table public.profiles add constraint profiles_avatar_path_check
  check (avatar_path ~ ('^' || id::text || '/[0-9a-f-]{36}\.(webp|jpe?g|png)$'));

alter table public.projects rename column cover_url to cover_path;
alter table public.projects drop constraint projects_cover_url_check;
alter table public.projects add constraint projects_cover_path_check
  check (cover_path ~ ('^' || profile_id::text || '/[0-9a-f-]{36}\.(webp|jpe?g|png)$'));

-- Column grants follow the rename; these two functions name the columns in their bodies, so recreate them.
create or replace function public.profiles_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if current_setting('piphall.internal', true) = 'on' then
    return new;  -- admin/system functions
  end if;
  if new.username is distinct from old.username and old.username_locked then
    raise exception 'USERNAME_LOCKED' using errcode = 'P0001';
  end if;
  if old.status <> 'draft' and (
       new.full_name, new.tagline, new.bio, new.role, new.org_position, new.department, new.avatar_path,
       new.linkedin_url, new.portfolio_url, new.public_email, new.show_email, new.skills, new.username)
     is distinct from
      (old.full_name, old.tagline, old.bio, old.role, old.org_position, old.department, old.avatar_path,
       old.linkedin_url, old.portfolio_url, old.public_email, old.show_email, old.skills, old.username)
  then
    new.status := 'draft';
  end if;
  return new;
end;
$$;

create or replace function public.build_card(p_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'username', p.username,
    'full_name', p.full_name,
    'tagline', p.tagline,
    'bio', p.bio,
    'role', p.role,
    'org_position', p.org_position,
    'department', p.department,
    'avatar_path', p.avatar_path,
    'github_username', p.github_username,
    'linkedin_url', p.linkedin_url,
    'portfolio_url', p.portfolio_url,
    'public_email', case when p.show_email then p.public_email end,
    'skills', to_jsonb(p.skills),
    'theme', p.theme,
    'is_featured', p.is_featured,
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
               'title', pr.title, 'description', pr.description, 'cover_path', pr.cover_path,
               'project_url', pr.project_url, 'github_url', pr.github_url, 'language', pr.language,
               'stars', pr.stars, 'tech_stack', to_jsonb(pr.tech_stack), 'source', pr.source,
               'project_date', pr.project_date)
             order by pr.sort_order, pr.created_at)
        from public.projects pr where pr.profile_id = p.id), '[]'::jsonb)
  )
  from public.profiles p where p.id = p_id;
$$;

revoke execute on function public.build_card(uuid) from public, anon, authenticated;
