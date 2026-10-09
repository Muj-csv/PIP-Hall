-- The curated Museum (D-130). The Museum now shows three things only:
--   * projects an admin features (museum_features: any project on an approved card in the hall),
--   * projects that won a place or an award at an announced event, and
--   * the published archive.
-- Members with Museum access still offer projects (museum_entries, and the console they hang in);
-- an offer is now a suggestion the admin sees, not an exhibit. Event rooms show their winners only.
-- On the first run, exhibits by members an admin had Featured become featured projects, so the
-- Museum's Featured row stays as it was. Safe to run again.

-- ---------------------------------------------------------------- featured projects
do $$
begin
  if to_regclass('public.museum_features') is null then
    create table public.museum_features (
      project_id   uuid primary key,
      member_id    uuid not null references public.profiles (id) on delete cascade,
      featured_at  timestamptz not null default now(),
      featured_by  uuid references auth.users (id) on delete set null
    );
    -- What the Featured row showed before: featured makers' exhibits.
    insert into public.museum_features (project_id, member_id, featured_at)
    select e.project_id, e.member_id, e.added_at
      from public.museum_entries e
      join public.published_cards c on c.profile_id = e.member_id
     where c.is_featured and public.has_museum_access(e.member_id)
       and e.project_id = any (public.live_project_ids(e.member_id));
  end if;
end;
$$;
revoke all on public.museum_features from anon, authenticated;
alter table public.museum_features enable row level security;
-- No policies: read through museum_exhibits() and the admin functions below.

-- A project leaves the Museum when it leaves its maker's approved card (as offers do, D-071).
create or replace function public.museum_follow_card()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.museum_entries e
   where e.member_id = new.profile_id
     and not (e.project_id = any (public.live_project_ids(new.profile_id)));
  delete from public.museum_features f
   where f.member_id = new.profile_id
     and not (f.project_id = any (public.live_project_ids(new.profile_id)));
  return null;
end;
$$;

-- ---------------------------------------------------------------- what is on show
-- Featured (and still on its maker's approved card), a winner at an announced event (award_makers()
-- already asks for the card), or a published archive exhibit.
create or replace function public.museum_on_show(p_project uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.museum_features f
                  where f.project_id = p_project and p_project = any (public.live_project_ids(f.member_id)))
      or exists (select 1 from public.award_makers() w join public.event_awards a on a.id = w.award_id
                  where a.project_id = p_project)
      or exists (select 1 from public.archive_exhibits a where a.id = p_project and a.published);
$$;

-- Whether a member made it: its owner (featured or entered), or a maker linked on the archive exhibit.
create or replace function public.museum_made_by(p_project uuid, p_member uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.museum_features f where f.project_id = p_project and f.member_id = p_member)
      or exists (select 1 from public.event_submissions es where es.project_id = p_project and es.member_id = p_member)
      or exists (select 1 from public.archive_makers m where m.exhibit_id = p_project and m.member_id = p_member);
$$;

-- Featured projects, as approved, with the console their maker picked when they offered it.
create or replace function public.museum_exhibits()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'project_id', f.project_id,
           'username', c.username,
           'full_name', c.card->>'full_name',
           'avatar_path', c.card->'avatar_path',
           'member_no', c.member_no,
           'featured', true,
           'console', e.console,
           'project', x.elem) order by f.featured_at, f.project_id), '[]'::jsonb)
    from public.museum_features f
    join public.published_cards c on c.profile_id = f.member_id
    cross join lateral (
      select p as elem from jsonb_array_elements(c.card->'projects') p
       where p->>'id' = f.project_id::text limit 1) x
    left join public.museum_entries e on e.project_id = f.project_id and e.member_id = f.member_id;
$$;

-- As in V2-9, but 'featured' now says whether an admin featured the project itself.
create or replace function public.event_entries(p_key text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'project_id', es.project_id,
           'username', c.username,
           'full_name', c.card->>'full_name',
           'avatar_path', c.card->'avatar_path',
           'member_no', c.member_no,
           'featured', exists (select 1 from public.museum_features f where f.project_id = es.project_id),
           'console', me.console,
           'track', es.track,
           'project', x.elem) order by es.submitted_at), '[]'::jsonb)
    from public.event_submissions es
    join public.published_cards c on c.profile_id = es.member_id
    cross join lateral (
      select p as elem from jsonb_array_elements(c.card->'projects') p
       where p->>'id' = es.project_id::text limit 1) x
    left join public.museum_entries me on me.project_id = es.project_id
   where es.season_key = p_key;
$$;

-- {access, live, projects, entries, consoles, featured}: as before, plus which of my projects an
-- admin featured.
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
    'entries', coalesce((select jsonb_agg(project_id) from public.museum_entries where member_id = (select auth.uid())), '[]'::jsonb),
    'consoles', coalesce((
      select jsonb_object_agg(project_id, console) from public.museum_entries
       where member_id = (select auth.uid()) and console is not null), '{}'::jsonb),
    'featured', coalesce((
      select jsonb_agg(f.project_id order by f.featured_at) from public.museum_features f
       where f.member_id = (select auth.uid()) and f.project_id = any (public.live_project_ids(f.member_id))), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------- admins
-- Every project on an approved card in the hall: who made it, whether its maker offered it,
-- whether it is featured, and whether it won (then it is on show anyway).
create or replace function public.admin_museum_projects()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'project_id', x->>'id',
             'title', x->>'title',
             'username', c.username,
             'full_name', c.card->>'full_name',
             'member_no', c.member_no,
             'offered', exists (select 1 from public.museum_entries e where e.project_id::text = x->>'id'),
             'featured', exists (select 1 from public.museum_features f where f.project_id::text = x->>'id'),
             'won', exists (select 1 from public.award_makers() w join public.event_awards a on a.id = w.award_id
                             where a.project_id::text = x->>'id'))
           order by c.member_no, n)
      from public.published_cards c, jsonb_array_elements(c.card->'projects') with ordinality t(x, n)
     where x->>'id' is not null), '[]'::jsonb);
end;
$$;

-- Features one project on an approved card (or takes it down). Returns whether it is featured now.
create or replace function public.admin_feature_project(p_project uuid, p_on boolean)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  maker uuid;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  if not coalesce(p_on, false) then
    delete from public.museum_features where project_id = p_project;
    return false;
  end if;
  select c.profile_id into maker
    from public.published_cards c, jsonb_array_elements(c.card->'projects') p
   where p->>'id' = p_project::text
   limit 1;
  if maker is null then raise exception 'NOT_LIVE' using errcode = 'P0001'; end if;
  insert into public.museum_features (project_id, member_id, featured_by)
  values (p_project, maker, (select auth.uid()))
  on conflict (project_id) do nothing;
  return true;
end;
$$;

-- ---------------------------------------------------------------- the hall's record
-- A new exhibit is now a project an admin features (an offer is not news). Credited to its maker.
create or replace function public.events_museum_feature()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.hall_events e
                  where e.event_type = 'EXHIBIT_ADDED' and e.actor_id = new.member_id and e.target_id = new.project_id::text) then
    perform public.log_event(new.member_id, 'EXHIBIT_ADDED', 'exhibit', new.project_id::text, '{}'::jsonb, 'public');
  end if;
  return null;
end;
$$;
drop trigger if exists museum_entries_events on public.museum_entries;
drop trigger if exists museum_features_events on public.museum_features;
create trigger museum_features_events after insert on public.museum_features
  for each row execute function public.events_museum_feature();

-- ---------------------------------------------------------------- the Passport
-- As in D-118, with what is on show now: featured, winners, the archive. Never one you made.
create or replace function public.stamp_exhibit(p_project uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  if not exists (select 1 from public.published_cards where profile_id = me) then return false; end if;
  if not public.museum_on_show(p_project) or public.museum_made_by(p_project, me) then return false; end if;
  insert into public.passport_visits (member_id, project_id) values (me, p_project) on conflict do nothing;
  return found;
end;
$$;

-- Graduation, as in V2-12; a device's exhibit stamps count only for exhibits on show now.
create or replace function public.import_passport(p_people jsonb, p_exhibits jsonb, p_checkins jsonb default '[]'::jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  n_people integer := 0;
  n_exhibits integer := 0;
  n_checkins integer := 0;
begin
  if me is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  if not exists (select 1 from public.published_cards where profile_id = me) then
    raise exception 'NOT_ELIGIBLE' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(p_people, 'null')) <> 'array' or jsonb_typeof(coalesce(p_exhibits, 'null')) <> 'array'
     or jsonb_typeof(coalesce(p_checkins, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(p_people) > 1000 or jsonb_array_length(p_exhibits) > 1000 or jsonb_array_length(coalesce(p_checkins, '[]'::jsonb)) > 50 then
    raise exception 'BAD_IMPORT' using errcode = 'P0001';
  end if;

  with items as (
    select x->>'id' as id, x->>'at' as at from jsonb_array_elements(p_people) x where jsonb_typeof(x) = 'object'
  ), ok as (
    select distinct on (c.profile_id) c.profile_id,
           least(now(), greatest(timestamptz '2026-10-01', case when i.at ~ '^\d{4}-\d{2}-\d{2}T[0-9:.]+(Z|[+-]\d{2}:?\d{2})?$' then i.at::timestamptz else now() end)) as at
      from items i
      join public.published_cards c on c.profile_id::text = lower(i.id)
     where i.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and c.profile_id <> me
  )
  insert into public.discoveries (member_id, card_id, created_at, source)
  select me, profile_id, at, 'imported' from ok
  on conflict do nothing;
  get diagnostics n_people = row_count;

  with items as (
    select x->>'id' as id, x->>'at' as at from jsonb_array_elements(p_exhibits) x where jsonb_typeof(x) = 'object'
  ), ok as (
    select distinct on (lower(i.id)) lower(i.id)::uuid as project_id,
           least(now(), greatest(timestamptz '2026-10-01', case when i.at ~ '^\d{4}-\d{2}-\d{2}T[0-9:.]+(Z|[+-]\d{2}:?\d{2})?$' then i.at::timestamptz else now() end)) as at
      from items i
     where i.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       and public.museum_on_show(lower(i.id)::uuid) and not public.museum_made_by(lower(i.id)::uuid, me)
  )
  insert into public.passport_visits (member_id, project_id, visited_at, source)
  select me, project_id, at, 'imported' from ok
  on conflict do nothing;
  get diagnostics n_exhibits = row_count;

  -- A check-in is kept only for an event that had a check-in QR and was on when the stamp says it was made.
  with items as (
    select x->>'id' as id, x->>'at' as at from jsonb_array_elements(coalesce(p_checkins, '[]'::jsonb)) x where jsonb_typeof(x) = 'object'
  ), dated as (
    select i.id, case when i.at ~ '^\d{4}-\d{2}-\d{2}T[0-9:.]+(Z|[+-]\d{2}:?\d{2})?$' then i.at::timestamptz end as at from items i
  ), ok as (
    select distinct on (s.key) s.key, d.at
      from dated d
      join public.hall_seasons s on s.key = d.id
     where d.at is not null and d.at <= now() and s.checkin_code is not null and public.season_window(s.starts_on, s.ends_on) @> d.at
  )
  insert into public.event_checkins (member_id, season_key, checked_at, source)
  select me, key, at, 'imported' from ok
  on conflict do nothing;
  get diagnostics n_checkins = row_count;

  return jsonb_build_object('people', n_people, 'exhibits', n_exhibits, 'checkins', n_checkins);
end;
$$;

-- ---------------------------------------------------------------- titles
-- As in V2-13; Curator counts projects on show that I made: featured, winners, the archive.
create or replace function public.earned_titles(p_member uuid)
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_remove(array[
    'card_holder',
    case when c.member_no <= 10 then 'pioneer' end,
    case when (select count(*) from public.discoveries d
                where d.member_id = p_member and d.source = 'verified' and d.card_id <> p_member) >= 10 then 'explorer' end,
    case when exists (select 1 from jsonb_array_elements(c.card->'projects') p
                       where jsonb_array_length(coalesce(p->'collaborators', '[]'::jsonb)) > 0)
           or exists (select 1 from public.published_cards o, jsonb_array_elements(o.card->'projects') p,
                             jsonb_array_elements(coalesce(p->'collaborators', '[]'::jsonb)) m
                       where o.profile_id <> p_member and m->>'username' = c.username)
           or exists (select 1 from public.archive_credits() x join public.archive_credits() y
                         on y.exhibit_id = x.exhibit_id and y.member_id <> x.member_id
                       where x.member_id = p_member) then 'connector' end,
    case when (select count(*) from (
                 select f.project_id from public.museum_features f
                  where f.member_id = p_member and f.project_id = any (public.live_project_ids(p_member))
                 union
                 select a.project_id from public.award_makers() w join public.event_awards a on a.id = w.award_id
                  where w.member_id = p_member
                 union
                 select x.exhibit_id from public.archive_credits() x where x.member_id = p_member) shown) >= 3 then 'curator' end,
    case when (select count(*) from public.mission_completions m where m.member_id = p_member) >= 10 then 'pathfinder' end,
    case when exists (select 1 from public.award_makers() w where w.member_id = p_member)
           or exists (select 1 from public.archive_credits() x join public.archive_exhibits a on a.id = x.exhibit_id
                       where x.member_id = p_member and (a.award_place is not null or a.award_name is not null)) then 'champion' end,
    case when (select count(distinct mk.profile_id)
                 from public.published_cards o
                 cross join lateral jsonb_array_elements(o.card->'projects') p
                 cross join lateral (
                   select o.profile_id, o.member_no
                   union
                   select m.profile_id, m.member_no
                     from jsonb_array_elements(coalesce(p->'collaborators', '[]'::jsonb)) col
                     join public.published_cards m on m.username = col->>'username') mk
                where mk.member_no > c.member_no
                  and (o.profile_id = p_member
                       or exists (select 1 from jsonb_array_elements(coalesce(p->'collaborators', '[]'::jsonb)) col
                                   where col->>'username' = c.username))) >= 2 then 'mentor' end
  ], null), '{}')
  from public.published_cards c
  where c.profile_id = p_member
  union all
  select '{}'::text[] where not exists (select 1 from public.published_cards where profile_id = p_member)
  limit 1;
$$;

-- ---------------------------------------------------------------- Recent in the hall
-- As in V2-10; a new exhibit shows while its project is featured.
create or replace function public.recent_hall_events(p_limit integer default 8)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(r order by (r->>'id')::bigint desc), '[]'::jsonb) from (
    select jsonb_build_object(
             'id', e.id, 'type', e.event_type, 'at', e.created_at,
             'username', c.username, 'full_name', c.card->>'full_name',
             'title', case when e.event_type = 'ACHIEVEMENT_UNLOCKED' then a.name
                           when e.target_type = 'archive' then ar.title else pj.p->>'title' end,
             'project_id', case when e.target_type in ('project', 'exhibit', 'archive') then e.target_id end,
             'with_username', w.username, 'with_name', w.card->>'full_name',
             'event_key', case when e.target_type = 'archive' then ar.season_key else ev.key end,
             'event', case when e.target_type = 'archive' then public.archive_event_label(ar.season_key, ar.event_name, ar.year) else ev.name end) as r
      from (select * from public.hall_events
             where visibility = 'public'
               and event_type in ('CARD_APPROVED', 'PROJECT_PUBLISHED', 'EXHIBIT_ADDED', 'COLLAB_PUBLISHED',
                                  'ACHIEVEMENT_UNLOCKED', 'MEMBER_FEATURED', 'EVENT_SUBMITTED', 'RESULTS_ANNOUNCED',
                                  'ARCHIVE_ADDED', 'ARCHIVE_CREDITED')
             order by id desc limit 400) e
      left join public.published_cards c on c.profile_id = e.actor_id
      left join lateral (select x as p from jsonb_array_elements(c.card->'projects') x
                          where e.target_type in ('project', 'exhibit') and x->>'id' = e.target_id limit 1) pj on true
      left join public.published_cards w on e.event_type = 'COLLAB_PUBLISHED' and w.username = e.metadata->>'with'
      left join public.achievements a on e.event_type = 'ACHIEVEMENT_UNLOCKED' and a.key = e.target_id
      left join public.hall_seasons ev on ev.key = case when e.event_type = 'RESULTS_ANNOUNCED' then e.target_id
                                                        when e.event_type = 'EVENT_SUBMITTED' then e.metadata->>'season' end
      left join public.archive_exhibits ar on e.target_type = 'archive' and ar.id::text = e.target_id
     where case e.event_type
             when 'CARD_APPROVED' then c.profile_id is not null and not exists (select 1 from public.hall_events f
                                                    where f.actor_id = e.actor_id and f.event_type = 'CARD_APPROVED' and f.id < e.id)
             when 'PROJECT_PUBLISHED' then pj.p is not null and not exists (
                                                    select 1 from public.hall_events f
                                                     where f.actor_id = e.actor_id and f.event_type = 'CARD_APPROVED' and f.created_at = e.created_at
                                                       and not exists (select 1 from public.hall_events g
                                                                        where g.actor_id = e.actor_id and g.event_type = 'CARD_APPROVED' and g.id < f.id))
             when 'EXHIBIT_ADDED' then pj.p is not null and exists (select 1 from public.museum_features mf where mf.project_id::text = e.target_id)
             when 'COLLAB_PUBLISHED' then w.profile_id is not null and exists (
                                                    select 1 from jsonb_array_elements(coalesce(pj.p->'collaborators', '[]'::jsonb)) m
                                                     where m->>'username' = w.username)
             when 'ACHIEVEMENT_UNLOCKED' then c.profile_id is not null and a.key is not null
             when 'MEMBER_FEATURED' then c.is_featured
             when 'EVENT_SUBMITTED' then pj.p is not null and ev.key is not null and exists (
                                                    select 1 from public.event_submissions es
                                                     where es.season_key = ev.key and es.project_id::text = e.target_id)
             when 'RESULTS_ANNOUNCED' then ev.announced_at is not null
             when 'ARCHIVE_ADDED' then coalesce(ar.published, false)
             when 'ARCHIVE_CREDITED' then coalesce(ar.published, false) and c.profile_id is not null and exists (
                                                    select 1 from public.archive_makers m where m.exhibit_id = ar.id and m.member_id = e.actor_id)
           end
     order by e.id desc
     limit greatest(1, least(coalesce(p_limit, 8), 20))
  ) x(r);
$$;

-- ---------------------------------------------------------------- function privileges
revoke execute on function public.museum_follow_card(), public.events_museum_feature(),
  public.museum_on_show(uuid), public.museum_made_by(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.museum_exhibits(), public.event_entries(text) from public;
grant execute on function public.museum_exhibits() to anon, authenticated;
revoke execute on function public.event_entries(text) from anon, authenticated;
revoke execute on function public.my_museum(), public.admin_museum_projects(), public.admin_feature_project(uuid, boolean),
  public.stamp_exhibit(uuid), public.import_passport(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.my_museum(), public.admin_museum_projects(), public.admin_feature_project(uuid, boolean),
  public.stamp_exhibit(uuid), public.import_passport(jsonb, jsonb, jsonb) to authenticated;
revoke execute on function public.earned_titles(uuid) from public, anon, authenticated;
revoke execute on function public.recent_hall_events(integer) from public;
grant execute on function public.recent_hall_events(integer) to anon, authenticated;
