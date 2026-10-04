-- MUSEUM and affiliations (docs/plan/MUSEUM.md, D-067…D-070).
-- Affiliations are admin-entered labels (e.g. an org or "CS Student"); one can grant Museum access.
-- Members with access opt their live projects into the public Museum, which always shows the
-- approved snapshot.

-- ---------------------------------------------------------------- project ids in the snapshot (BR-M-04)
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
               'id', pr.id,
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

-- Cards already in the hall: match each approved project to its row by title (first match).
update public.published_cards c
   set card = jsonb_set(c.card, '{projects}', coalesce((
     select jsonb_agg(
              x.elem || jsonb_build_object('id', (
                select pr.id from public.projects pr
                 where pr.profile_id = c.profile_id and pr.title = x.elem->>'title'
                 order by pr.sort_order, pr.created_at limit 1))
              order by x.n)
       from jsonb_array_elements(c.card->'projects') with ordinality as x(elem, n)), '[]'::jsonb));

-- ---------------------------------------------------------------- tables
create table public.affiliations (
  key            text primary key check (key ~ '^[a-z0-9][a-z0-9-]{1,23}$'),
  name           text not null check (char_length(trim(name)) between 1 and 40),
  grants_museum  boolean not null default false,
  frame_key      text,                      -- the perk frame, from E2 (D-070)
  sort           integer not null default 0,
  created_at     timestamptz not null default now()
);

create table public.member_affiliations (
  member_id   uuid not null references public.profiles (id) on delete cascade,
  key         text not null references public.affiliations (key) on delete cascade,
  granted_at  timestamptz not null default now(),
  primary key (member_id, key)
);

create table public.museum_entries (
  project_id  uuid primary key references public.projects (id) on delete cascade,
  member_id   uuid not null references public.profiles (id) on delete cascade,
  added_at    timestamptz not null default now()
);

revoke all on public.affiliations, public.member_affiliations, public.museum_entries from anon, authenticated;
grant select on public.affiliations, public.member_affiliations to anon, authenticated;
grant select on public.museum_entries to authenticated;

alter table public.affiliations        enable row level security;
alter table public.member_affiliations enable row level security;
alter table public.museum_entries      enable row level security;

create policy "affiliations are public" on public.affiliations
  for select to anon, authenticated using (true);
-- Chips are public for members in the hall; admins also see everyone else's (to manage them).
-- Visitors get their own policy: is_admin() isn't executable by anon.
create policy "affiliations of members in the hall (visitors)" on public.member_affiliations
  for select to anon
  using (exists (select 1 from public.published_cards c where c.profile_id = member_id));
create policy "affiliations of members in the hall, or any for admins" on public.member_affiliations
  for select to authenticated
  using (exists (select 1 from public.published_cards c where c.profile_id = member_id) or (select public.is_admin()));
create policy "own museum entries" on public.museum_entries
  for select to authenticated using (member_id = (select auth.uid()));

-- ---------------------------------------------------------------- helpers
create or replace function public.has_museum_access(p_member uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.member_affiliations ma
      join public.affiliations a on a.key = ma.key
     where ma.member_id = p_member and a.grants_museum
  );
$$;

-- Project ids in a member's approved card.
create or replace function public.live_project_ids(p_member uuid)
returns uuid[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg((x->>'id')::uuid), '{}')
    from public.published_cards c, jsonb_array_elements(c.card->'projects') x
   where c.profile_id = p_member and x->>'id' is not null;
$$;

-- ---------------------------------------------------------------- admin functions (BR-M-01)
create or replace function public.admin_save_affiliation(p_key text, p_name text, p_grants_museum boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  insert into public.affiliations (key, name, grants_museum, sort)
  values (lower(trim(p_key)), trim(p_name), p_grants_museum, (select coalesce(max(sort), 0) + 1 from public.affiliations))
  on conflict (key) do update set name = excluded.name, grants_museum = excluded.grants_museum;
end;
$$;

create or replace function public.admin_delete_affiliation(p_key text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  delete from public.affiliations where key = p_key;
end;
$$;

create or replace function public.set_member_affiliation(p_member uuid, p_key text, p_on boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  if p_on then
    insert into public.member_affiliations (member_id, key) values (p_member, p_key) on conflict do nothing;
  else
    delete from public.member_affiliations where member_id = p_member and key = p_key;
  end if;
end;
$$;

-- ---------------------------------------------------------------- member functions (BR-M-02)
-- {access, live: [project ids in my approved card], entries: [my opted-in project ids]}
create or replace function public.my_museum()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'access', public.has_museum_access((select auth.uid())),
    'live', to_jsonb(public.live_project_ids((select auth.uid()))),
    'entries', coalesce((select jsonb_agg(project_id) from public.museum_entries where member_id = (select auth.uid())), '[]'::jsonb)
  );
$$;

create or replace function public.set_museum(p_project uuid, p_on boolean)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  if not exists (select 1 from public.projects where id = p_project and profile_id = me) then
    raise exception 'NOT_YOURS' using errcode = 'P0001';
  end if;
  if not p_on then
    delete from public.museum_entries where project_id = p_project and member_id = me;
    return false;
  end if;
  if not public.has_museum_access(me) then raise exception 'NO_MUSEUM_ACCESS' using errcode = 'P0001'; end if;
  if not (p_project = any (public.live_project_ids(me))) then raise exception 'NOT_LIVE' using errcode = 'P0001'; end if;
  insert into public.museum_entries (project_id, member_id) values (p_project, me) on conflict do nothing;
  return true;
end;
$$;

-- ---------------------------------------------------------------- the Museum (public, FR-M-05/06)
create or replace function public.museum_exhibits()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'project_id', e.project_id,
           'username', c.username,
           'full_name', c.card->>'full_name',
           'avatar_path', c.card->'avatar_path',
           'member_no', c.member_no,
           'project', x.elem)), '[]'::jsonb)
    from public.museum_entries e
    join public.published_cards c on c.profile_id = e.member_id
    cross join lateral (
      select p as elem from jsonb_array_elements(c.card->'projects') p
       where p->>'id' = e.project_id::text limit 1) x
   where public.has_museum_access(e.member_id);
$$;

-- ---------------------------------------------------------------- function privileges
revoke execute on function public.has_museum_access(uuid), public.live_project_ids(uuid),
  public.admin_save_affiliation(text, text, boolean), public.admin_delete_affiliation(text),
  public.set_member_affiliation(uuid, text, boolean), public.my_museum(), public.set_museum(uuid, boolean),
  public.museum_exhibits()
  from public, anon, authenticated;
grant execute on function public.admin_save_affiliation(text, text, boolean), public.admin_delete_affiliation(text),
  public.set_member_affiliation(uuid, text, boolean), public.my_museum(), public.set_museum(uuid, boolean)
  to authenticated;
grant execute on function public.museum_exhibits() to anon, authenticated;
