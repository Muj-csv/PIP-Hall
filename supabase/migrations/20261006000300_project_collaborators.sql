-- Project collaborators (docs/plan/MUSEUM-CONSOLES.md, phase 1; D-089).
-- An owner tags members of the hall on a project; a tag shows publicly only once the tagged member
-- accepts it AND the owner's card is next approved (the snapshot, ADR-002). Declining is final for
-- that project, so a declined member can't be asked again and again. Safe to run again.

-- ---------------------------------------------------------------- table
create table if not exists public.project_collaborators (
  project_id    uuid not null references public.projects (id) on delete cascade,
  member_id     uuid not null references public.profiles (id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  primary key (project_id, member_id)
);
create index if not exists project_collaborators_member_idx on public.project_collaborators (member_id);

revoke all on public.project_collaborators from anon, authenticated;
grant select on public.project_collaborators to authenticated;
alter table public.project_collaborators enable row level security;

-- The owner of the project and the tagged member can read the tag; nobody else.
drop policy if exists "collaboration rows for owner and member" on public.project_collaborators;
create policy "collaboration rows for owner and member" on public.project_collaborators
  for select to authenticated
  using (member_id = (select auth.uid())
         or exists (select 1 from public.projects p where p.id = project_id and p.profile_id = (select auth.uid())));

-- ---------------------------------------------------------------- the public snapshot
-- Same card as before, plus each project's accepted collaborators who are in the hall.
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
               'project_date', pr.project_date,
               'collaborators', coalesce((
                 select jsonb_agg(jsonb_build_object('username', c.username, 'full_name', c.card->>'full_name', 'member_no', c.member_no)
                                  order by pc.responded_at, c.member_no)
                   from public.project_collaborators pc
                   join public.published_cards c on c.profile_id = pc.member_id
                  where pc.project_id = pr.id and pc.status = 'accepted'), '[]'::jsonb))
             order by pr.sort_order, pr.created_at)
        from public.projects pr where pr.profile_id = p.id), '[]'::jsonb)
  )
  from public.profiles p where p.id = p_id;
$$;
revoke execute on function public.build_card(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- member functions
-- Tags a member of the hall (by username) on one of my projects. Returns the tag.
create or replace function public.tag_collaborator(p_project uuid, p_username text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  who public.published_cards;
  existing text;
begin
  if me is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  if not exists (select 1 from public.projects where id = p_project and profile_id = me) then
    raise exception 'NOT_YOURS' using errcode = 'P0001';
  end if;
  select * into who from public.published_cards where username = lower(trim(coalesce(p_username, '')));
  if not found then raise exception 'NOT_IN_HALL' using errcode = 'P0001'; end if;
  if who.profile_id = me then raise exception 'SELF' using errcode = 'P0001'; end if;
  select status into existing from public.project_collaborators where project_id = p_project and member_id = who.profile_id;
  if existing = 'declined' then raise exception 'DECLINED' using errcode = 'P0001'; end if;
  if existing is null then
    if (select count(*) from public.project_collaborators where project_id = p_project) >= 8 then
      raise exception 'TOO_MANY' using errcode = 'P0001';
    end if;
    insert into public.project_collaborators (project_id, member_id) values (p_project, who.profile_id);
    existing := 'pending';
  end if;
  return jsonb_build_object('member_id', who.profile_id, 'username', who.username, 'full_name', who.card->>'full_name', 'status', existing);
end;
$$;

create or replace function public.untag_collaborator(p_project uuid, p_member uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  if not exists (select 1 from public.projects where id = p_project and profile_id = me) then
    raise exception 'NOT_YOURS' using errcode = 'P0001';
  end if;
  -- A declined tag stays (it keeps the "don't ask again" answer); the owner can't clear it.
  delete from public.project_collaborators where project_id = p_project and member_id = p_member and status <> 'declined';
end;
$$;

-- The tagged member answers a request: accept or decline.
create or replace function public.respond_collaboration(p_project uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  update public.project_collaborators
     set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
   where project_id = p_project and member_id = me and status = 'pending';
  if not found then raise exception 'NO_REQUEST' using errcode = 'P0001'; end if;
end;
$$;

-- An accepted collaborator takes their name off a project (stays declined, so it can't be re-asked).
create or replace function public.leave_collaboration(p_project uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  update public.project_collaborators set status = 'declined', responded_at = now()
   where project_id = p_project and member_id = me and status = 'accepted';
  if not found then raise exception 'NO_REQUEST' using errcode = 'P0001'; end if;
end;
$$;

-- {incoming: [{project_id, title, owner_username, owner_name, status}],
--  outgoing: [{project_id, member_id, username, full_name, status}]}
create or replace function public.my_collaborations()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'incoming', coalesce((
      select jsonb_agg(jsonb_build_object('project_id', pc.project_id, 'title', pr.title,
               'owner_username', o.username, 'owner_name', o.full_name, 'status', pc.status) order by pc.created_at desc)
        from public.project_collaborators pc
        join public.projects pr on pr.id = pc.project_id
        join public.profiles o on o.id = pr.profile_id
       where pc.member_id = (select auth.uid()) and pc.status <> 'declined'), '[]'::jsonb),
    'outgoing', coalesce((
      select jsonb_agg(jsonb_build_object('project_id', pc.project_id, 'member_id', pc.member_id,
               'username', c.username, 'full_name', c.card->>'full_name', 'status', pc.status) order by pc.created_at)
        from public.project_collaborators pc
        join public.projects pr on pr.id = pc.project_id
        left join public.published_cards c on c.profile_id = pc.member_id
       where pr.profile_id = (select auth.uid())), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------- function privileges
revoke execute on function public.tag_collaborator(uuid, text), public.untag_collaborator(uuid, uuid),
  public.respond_collaboration(uuid, boolean), public.leave_collaboration(uuid), public.my_collaborations()
  from public, anon, authenticated;
grant execute on function public.tag_collaborator(uuid, text), public.untag_collaborator(uuid, uuid),
  public.respond_collaboration(uuid, boolean), public.leave_collaboration(uuid), public.my_collaborations()
  to authenticated;
