-- The Museum follows the approved card, not the draft (D-071, docs/plan/MUSEUM.md).
-- A museum entry now names a project in the member's published snapshot. Editing or deleting draft
-- projects no longer changes the public Museum; only an approval does, like everything public
-- (ADR-002). Approving a card keeps the entries whose project is still on it and drops the rest.
-- Safe to run again (e.g. after a partial run in the SQL editor).

-- ---------------------------------------------------------------- every approved project has an id
-- Projects that couldn't be linked to a draft row (deleted since approval) get a fresh id, so they
-- can still be exhibited. The next approval replaces it with the draft row's id, if there is one.
update public.published_cards c
   set card = jsonb_set(c.card, '{projects}', (
     select coalesce(jsonb_agg(
              case when x.elem->>'id' is null then x.elem || jsonb_build_object('id', gen_random_uuid())
                   else x.elem end
              order by x.n), '[]'::jsonb)
       from jsonb_array_elements(c.card->'projects') with ordinality as x(elem, n)))
 where exists (select 1 from jsonb_array_elements(c.card->'projects') p where p->>'id' is null);

-- ---------------------------------------------------------------- entries point at the snapshot
alter table public.museum_entries drop constraint if exists museum_entries_project_id_fkey;

-- Drops entries whose project left the approved card (runs on every approval and admin edit).
create or replace function public.museum_follow_card()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.museum_entries e
   where e.member_id = new.profile_id
     and not (e.project_id = any (public.live_project_ids(new.profile_id)));
  return null;
end;
$$;

drop trigger if exists published_cards_museum on public.published_cards;
create trigger published_cards_museum
  after insert or update of card on public.published_cards
  for each row execute function public.museum_follow_card();

-- ---------------------------------------------------------------- member functions
-- {access, live: [ids], projects: [{id, title}] as approved, entries: [ids]}
create or replace function public.my_museum()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'access', public.has_museum_access((select auth.uid())),
    'live', to_jsonb(public.live_project_ids((select auth.uid()))),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object('id', x->>'id', 'title', x->>'title') order by n)
        from public.published_cards c, jsonb_array_elements(c.card->'projects') with ordinality t(x, n)
       where c.profile_id = (select auth.uid()) and x->>'id' is not null), '[]'::jsonb),
    'entries', coalesce((select jsonb_agg(project_id) from public.museum_entries where member_id = (select auth.uid())), '[]'::jsonb)
  );
$$;

create or replace function public.set_museum(p_project uuid, p_on boolean)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  live boolean;
begin
  if me is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  if not p_on then
    delete from public.museum_entries where project_id = p_project and member_id = me;
    return false;
  end if;
  live := p_project = any (public.live_project_ids(me));
  if not live and not exists (select 1 from public.projects where id = p_project and profile_id = me) then
    raise exception 'NOT_YOURS' using errcode = 'P0001';
  end if;
  if not public.has_museum_access(me) then raise exception 'NO_MUSEUM_ACCESS' using errcode = 'P0001'; end if;
  if not live then raise exception 'NOT_LIVE' using errcode = 'P0001'; end if;
  insert into public.museum_entries (project_id, member_id) values (p_project, me) on conflict do nothing;
  return true;
end;
$$;

-- ---------------------------------------------------------------- admin summary
-- One row per member in the hall with Museum access: approved projects and how many are exhibited.
create or replace function public.admin_museum_summary()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'profile_id', c.profile_id,
             'username', c.username,
             'full_name', c.card->>'full_name',
             'projects', jsonb_array_length(c.card->'projects'),
             'exhibits', (select count(*) from public.museum_entries e where e.member_id = c.profile_id))
           order by c.member_no)
      from public.published_cards c
     where public.has_museum_access(c.profile_id)), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------- function privileges
revoke execute on function public.museum_follow_card(), public.admin_museum_summary() from public, anon, authenticated;
revoke execute on function public.my_museum(), public.set_museum(uuid, boolean) from public, anon;
grant execute on function public.admin_museum_summary(), public.my_museum(), public.set_museum(uuid, boolean) to authenticated;
