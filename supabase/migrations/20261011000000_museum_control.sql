-- The Museum, curated end to end (V2-20, D-133). Nothing hangs by itself:
--   * winners hang when an admin hangs them (museum_hung_winners), not when results are announced;
--     ribbons, the Champion title and the results news still come from the results;
--   * members an admin features hang as their badges in a Featured Members room, each with an
--     optional curator's note (museum_portraits);
--   * admins rename, reorder and hide the rooms (museum_rooms), and hand-pick a wing's exhibits as
--     well as filling it from tools (museum_wing_picks; a wing with no tools holds only its picks).
-- Featured projects (D-130) and the archive are as before. On the first run every winner already on
-- show is hung, so nothing leaves the Museum. Safe to run again. If the curated Museum migration never
-- ran on this database, it stops first and says so.

-- ---------------------------------------------------------------- what this needs first
do $$
begin
  if to_regclass('public.museum_features') is null or to_regprocedure('public.museum_made_by(uuid, uuid)') is null then
    raise exception 'Nothing was changed. This database is missing an earlier migration: run 20261009000000_curated_museum.sql first (it names any others it needs), then this one again.'
      using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------- winners an admin hung
do $$
begin
  if to_regclass('public.museum_hung_winners') is null then
    create table public.museum_hung_winners (
      season_key  text not null references public.hall_seasons (key) on delete cascade,
      project_id  uuid not null,
      hung_at     timestamptz not null default now(),
      hung_by     uuid references auth.users (id) on delete set null,
      primary key (season_key, project_id)
    );
    -- Every winner on show before this ran stays on show.
    insert into public.museum_hung_winners (season_key, project_id, hung_at)
    select distinct a.season_key, a.project_id, s.announced_at
      from public.event_awards a
      join public.hall_seasons s on s.key = a.season_key and s.announced_at is not null;
  end if;
end;
$$;
revoke all on public.museum_hung_winners from anon, authenticated;
alter table public.museum_hung_winners enable row level security;

-- ---------------------------------------------------------------- portraits, rooms, picked wings
create table if not exists public.museum_portraits (
  member_id   uuid primary key references public.profiles (id) on delete cascade,
  note        text not null default '' check (char_length(note) <= 140),
  updated_at  timestamptz not null default now()
);
create table if not exists public.museum_rooms (
  room_key  text primary key check (room_key ~ '^(winners|members|all|archive|(event|wing):[a-z0-9][a-z0-9-]{1,23})$'),
  sign      text check (sign is null or char_length(sign) between 2 and 30),
  position  integer not null,
  hidden    boolean not null default false
);
create table if not exists public.museum_wing_picks (
  wing_key    text not null references public.museum_wings (key) on delete cascade,
  project_id  uuid not null,
  position    integer not null default 0,
  primary key (wing_key, project_id)
);
revoke all on public.museum_portraits, public.museum_rooms, public.museum_wing_picks from anon, authenticated;
alter table public.museum_portraits enable row level security;
alter table public.museum_rooms enable row level security;
alter table public.museum_wing_picks enable row level security;
-- No policies: read through museum_curation() and the admin functions below.

-- ---------------------------------------------------------------- what is on show
-- Featured (and still on its maker's approved card), a winner an admin hung (award_makers() asks for
-- the card), or a published archive exhibit.
create or replace function public.museum_on_show(p_project uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.museum_features f
                  where f.project_id = p_project and p_project = any (public.live_project_ids(f.member_id)))
      or exists (select 1 from public.museum_hung_winners h
                   join public.event_awards a on a.season_key = h.season_key and a.project_id = h.project_id
                   join public.award_makers() w on w.award_id = a.id
                  where h.project_id = p_project)
      or exists (select 1 from public.archive_exhibits a where a.id = p_project and a.published);
$$;

-- As in V2-9, plus whether an admin hung the winner in the Museum.
create or replace function public.event_award_list(p_key text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'place', a.place, 'name', a.name, 'track', a.track, 'note', a.note, 'project_id', a.project_id,
           'hung', exists (select 1 from public.museum_hung_winners h where h.season_key = a.season_key and h.project_id = a.project_id))
           order by a.track nulls first, a.place nulls last, a.name), '[]'::jsonb)
    from public.event_awards a
   where a.season_key = p_key;
$$;

-- ---------------------------------------------------------------- the public read
-- {rooms: [{key, sign, hidden}] in the admins' order, portraits: [{member_id, note}] for every featured
-- member, picks: [{wing, project_id}] still on show}. Rooms nobody arranged follow, in their usual order.
create or replace function public.museum_curation()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'rooms', coalesce((select jsonb_agg(jsonb_build_object('key', r.room_key, 'sign', r.sign, 'hidden', r.hidden) order by r.position, r.room_key)
                         from public.museum_rooms r), '[]'::jsonb),
    'portraits', coalesce((select jsonb_agg(jsonb_build_object('member_id', c.profile_id, 'note', coalesce(p.note, '')) order by c.member_no)
                             from public.published_cards c
                             left join public.museum_portraits p on p.member_id = c.profile_id
                            where c.is_featured), '[]'::jsonb),
    'picks', coalesce((select jsonb_agg(jsonb_build_object('wing', k.wing_key, 'project_id', k.project_id) order by k.wing_key, k.position)
                         from public.museum_wing_picks k
                        where public.museum_on_show(k.project_id)), '[]'::jsonb));
$$;

-- ---------------------------------------------------------------- the hall's record
-- The project's title, for the news and the bell.
create or replace function public.museum_title_meta(p_member uuid, p_project uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object('title', (
    select x->>'title' from public.published_cards c, jsonb_array_elements(c.card->'projects') x
     where c.profile_id = p_member and x->>'id' = p_project::text limit 1)));
$$;

-- A featured project is news once, credited to its maker (as in D-130), now with its title.
create or replace function public.events_museum_feature()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.hall_events e
                  where e.event_type = 'EXHIBIT_ADDED' and e.actor_id = new.member_id and e.target_id = new.project_id::text) then
    perform public.log_event(new.member_id, 'EXHIBIT_ADDED', 'exhibit', new.project_id::text, public.museum_title_meta(new.member_id, new.project_id), 'public');
  end if;
  return null;
end;
$$;

-- A winner hung in the Museum is news once too, credited to the member who submitted it.
create or replace function public.events_museum_hang()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  maker uuid;
begin
  select es.member_id into maker from public.event_submissions es
   where es.season_key = new.season_key and es.project_id = new.project_id;
  if maker is not null and not exists (
       select 1 from public.hall_events e
        where e.event_type = 'EXHIBIT_ADDED' and e.actor_id = maker and e.target_id = new.project_id::text) then
    perform public.log_event(maker, 'EXHIBIT_ADDED', 'exhibit', new.project_id::text, public.museum_title_meta(maker, new.project_id), 'public');
  end if;
  return null;
end;
$$;
drop trigger if exists museum_hung_winners_events on public.museum_hung_winners;
create trigger museum_hung_winners_events after insert on public.museum_hung_winners
  for each row execute function public.events_museum_hang();

-- Recent in the hall: a new exhibit shows while its project is featured or a hung winner.
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
             when 'EXHIBIT_ADDED' then pj.p is not null and (exists (select 1 from public.museum_features mf where mf.project_id::text = e.target_id)
                                                    or exists (select 1 from public.museum_hung_winners h where h.project_id::text = e.target_id))
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

-- The bell: as before, plus "your project now hangs in the Museum" (EXHIBIT_ADDED).
create or replace function public.my_notifications(p_limit integer default 30)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'seen_at', (select seen_at from public.notification_reads where member_id = (select auth.uid())),
    'items', coalesce((
      select jsonb_agg(n order by (n->>'id')::bigint desc) from (
        select jsonb_build_object(
                 'id', e.id, 'type', e.event_type, 'at', e.created_at,
                 'target_type', e.target_type, 'target_id', e.target_id,
                 'title', case when e.target_type in ('project', 'exhibit') then coalesce(pr.title, e.metadata->>'title')
                               when e.target_type = 'archive' then coalesce(ar.title, e.metadata->>'title')
                               when e.target_type = 'achievement' then a.name end,
                 'note', e.metadata->>'note',
                 'event', e.metadata->>'event',
                 'place', (e.metadata->>'place')::integer,
                 'award', e.metadata->>'award',
                 'track', e.metadata->>'track',
                 'by_username', case when e.actor_id is distinct from e.recipient_id then ap.username end,
                 'by_name', case when e.actor_id is distinct from e.recipient_id then coalesce(ac.card->>'full_name', ap.full_name) end) as n
          from public.hall_events e
          left join public.projects pr on e.target_type in ('project', 'exhibit') and pr.id::text = e.target_id
          left join public.archive_exhibits ar on e.target_type = 'archive' and ar.id::text = e.target_id
          left join public.achievements a on e.target_type = 'achievement' and a.key = e.target_id
          left join public.profiles ap on ap.id = e.actor_id
          left join public.published_cards ac on ac.profile_id = e.actor_id
         where e.recipient_id = (select auth.uid())
           and e.event_type in ('CARD_APPROVED', 'CARD_REJECTED', 'COLLAB_REQUESTED', 'COLLAB_ACCEPTED',
                                'COLLAB_PUBLISHED', 'ACHIEVEMENT_UNLOCKED', 'MEMBER_FEATURED', 'AWARD_WON',
                                'ARCHIVE_CREDITED', 'ARCHIVE_CLAIM_DECLINED', 'EXHIBIT_ADDED')
           and (e.event_type <> 'COLLAB_REQUESTED' or exists (
                 select 1 from public.project_collaborators pc
                  where pc.project_id::text = e.target_id and pc.member_id = e.recipient_id))
         order by e.id desc
         limit greatest(1, least(coalesce(p_limit, 30), 50))
      ) x(n)), '[]'::jsonb));
$$;

-- ---------------------------------------------------------------- titles
-- As before; Curator counts projects of mine on show: featured, hung winners, the archive.
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
                   join public.museum_hung_winners h on h.season_key = a.season_key and h.project_id = a.project_id
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

-- ---------------------------------------------------------------- admins: projects
-- As in D-130, plus whether the project hangs as a winner.
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
                             where a.project_id::text = x->>'id'),
             'hung', exists (select 1 from public.museum_hung_winners h where h.project_id::text = x->>'id'))
           order by c.member_no, n)
      from public.published_cards c, jsonb_array_elements(c.card->'projects') with ordinality t(x, n)
     where x->>'id' is not null), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------- admins: winners
-- Every announced event with awards, newest first, and its winning projects: their awards, who
-- submitted them, whether they hang, and whether they are still on their maker's approved card.
create or replace function public.admin_museum_winners()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(ev order by at desc, k) from (
      select s.key as k, s.announced_at as at, jsonb_build_object(
               'season_key', s.key, 'event', s.name, 'announced_at', s.announced_at,
               'winners', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'project_id', w.project_id,
                          'title', coalesce(t.title, pr.title, 'A project'),
                          'username', c.username,
                          'full_name', c.card->>'full_name',
                          'awards', w.awards,
                          'live', t.title is not null,
                          'hung', exists (select 1 from public.museum_hung_winners h where h.season_key = s.key and h.project_id = w.project_id))
                          order by w.best, coalesce(t.title, pr.title))
                   from (select a.project_id, min(coalesce(a.place, 9)) as best,
                                jsonb_agg(jsonb_build_object('place', a.place, 'name', a.name, 'track', a.track) order by a.place nulls last, a.name) as awards
                           from public.event_awards a where a.season_key = s.key group by a.project_id) w
                   left join public.event_submissions es on es.season_key = s.key and es.project_id = w.project_id
                   left join public.published_cards c on c.profile_id = es.member_id
                   left join lateral (select x->>'title' as title from jsonb_array_elements(c.card->'projects') x
                                       where x->>'id' = w.project_id::text limit 1) t on true
                   left join public.projects pr on pr.id = w.project_id), '[]'::jsonb)) as ev
        from public.hall_seasons s
       where s.announced_at is not null and exists (select 1 from public.event_awards a where a.season_key = s.key)) x), '[]'::jsonb);
end;
$$;

-- Hangs one winning project of an announced event (or takes it down). Returns whether it hangs now.
create or replace function public.admin_hang_winner(p_season text, p_project uuid, p_on boolean)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  if not exists (select 1 from public.event_awards a join public.hall_seasons s on s.key = a.season_key and s.announced_at is not null
                  where a.season_key = p_season and a.project_id = p_project) then
    raise exception 'NOT_A_WINNER' using errcode = 'P0001';
  end if;
  if not coalesce(p_on, false) then
    delete from public.museum_hung_winners where season_key = p_season and project_id = p_project;
    return false;
  end if;
  insert into public.museum_hung_winners (season_key, project_id, hung_by)
  values (p_season, p_project, (select auth.uid()))
  on conflict do nothing;
  return true;
end;
$$;

-- Hangs every winner of an announced event (or takes them all down). Returns how many hang now.
create or replace function public.admin_hang_event(p_season text, p_on boolean)
returns integer
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  if not exists (select 1 from public.hall_seasons s where s.key = p_season and s.announced_at is not null)
     or not exists (select 1 from public.event_awards a where a.season_key = p_season) then
    raise exception 'NOT_ANNOUNCED' using errcode = 'P0001';
  end if;
  if coalesce(p_on, false) then
    insert into public.museum_hung_winners (season_key, project_id, hung_by)
    select distinct p_season, a.project_id, (select auth.uid()) from public.event_awards a where a.season_key = p_season
    on conflict do nothing;
  else
    delete from public.museum_hung_winners where season_key = p_season;
  end if;
  return (select count(*)::integer from public.museum_hung_winners where season_key = p_season);
end;
$$;

-- ---------------------------------------------------------------- admins: featured members
-- The curator's note under a featured member's badge (up to 140 characters; empty takes it away).
-- Featuring itself is set_featured(), as before.
create or replace function public.admin_set_portrait(p_member uuid, p_note text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  n text := coalesce(trim(p_note), '');
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  if char_length(n) > 140 then raise exception 'BAD_NOTE' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.profiles where id = p_member) then raise exception 'NO_SUCH_MEMBER' using errcode = 'P0001'; end if;
  if n = '' then
    delete from public.museum_portraits where member_id = p_member;
  else
    insert into public.museum_portraits (member_id, note) values (p_member, n)
    on conflict (member_id) do update set note = excluded.note, updated_at = now();
  end if;
end;
$$;

-- ---------------------------------------------------------------- admins: rooms
-- The rooms in the admins' order: [{key, sign, hidden}] (sign: the name on the door, or null for the
-- room's own). Replaces the whole arrangement; rooms left out follow, in their usual order.
create or replace function public.admin_save_rooms(p_rooms jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  if jsonb_typeof(coalesce(p_rooms, 'null')) <> 'array' or jsonb_array_length(p_rooms) > 200
     or exists (select 1 from jsonb_array_elements(p_rooms) r
                 where jsonb_typeof(r) <> 'object'
                    or coalesce(r->>'key', '') !~ '^(winners|members|all|archive|(event|wing):[a-z0-9][a-z0-9-]{1,23})$'
                    or (nullif(trim(coalesce(r->>'sign', '')), '') is not null and char_length(trim(r->>'sign')) not between 2 and 30)
                    or (r ? 'hidden' and jsonb_typeof(r->'hidden') <> 'boolean'))
     or (select count(*) from jsonb_array_elements(p_rooms)) <> (select count(distinct r->>'key') from jsonb_array_elements(p_rooms) r) then
    raise exception 'BAD_ROOMS' using errcode = 'P0001';
  end if;
  delete from public.museum_rooms where true;
  insert into public.museum_rooms (room_key, sign, position, hidden)
  select r->>'key', nullif(trim(coalesce(r->>'sign', '')), ''), n::integer, coalesce((r->>'hidden')::boolean, false)
    from jsonb_array_elements(p_rooms) with ordinality t(r, n);
end;
$$;

-- ---------------------------------------------------------------- admins: wings
-- As before, but a wing may have no tools: it then holds only the exhibits an admin picks.
create or replace function public.admin_save_wing(p_key text, p_name text, p_note text, p_tags text[], p_sort integer, p_active boolean, p_style text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_kind text;
  v_tags text[];
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  if p_key is null or p_key !~ '^[a-z0-9][a-z0-9-]{1,23}$' then raise exception 'BAD_KEY' using errcode = 'P0001'; end if;
  if coalesce(char_length(trim(p_name)), 0) not between 2 and 30 then raise exception 'BAD_NAME' using errcode = 'P0001'; end if;
  if coalesce(char_length(trim(p_note)), 0) > 280 then raise exception 'BAD_NOTE' using errcode = 'P0001'; end if;
  if p_style is not null and p_style not in ('arcade', 'lab', 'library', 'garden', 'trophy') then raise exception 'BAD_STYLE' using errcode = 'P0001'; end if;
  select kind into v_kind from public.museum_wings where key = p_key;
  if coalesce(v_kind, 'tags') = 'tags' then
    -- Tags: trimmed, each 1–30 characters, no repeats (ignoring case), up to 12. None at all is a
    -- hand-picked wing: it holds only the exhibits an admin picks (D-133).
    select coalesce(array_agg(t order by first), '{}') into v_tags from (
      select min(trim(x)) as t, min(o) as first
        from unnest(coalesce(p_tags, '{}')) with ordinality as u(x, o)
       where trim(x) <> ''
       group by lower(trim(x))) d;
    if cardinality(v_tags) > 12 or exists (select 1 from unnest(v_tags) t where char_length(t) > 30) then
      raise exception 'BAD_TAGS' using errcode = 'P0001';
    end if;
  else
    v_tags := '{}';
  end if;
  insert into public.museum_wings as w (key, kind, name, note, tags, sort, active, style, updated_at)
  values (p_key, coalesce(v_kind, 'tags'), trim(p_name), coalesce(trim(p_note), ''), v_tags, coalesce(p_sort, 100), coalesce(p_active, true), coalesce(p_style, 'arcade'), now())
  on conflict (key) do update
    set name = excluded.name, note = excluded.note, tags = excluded.tags, sort = excluded.sort,
        active = excluded.active, style = coalesce(p_style, w.style), updated_at = now();
end;
$$;

-- The exhibits an admin hangs in a wing by hand, in order (up to 60). Each must be on show.
create or replace function public.admin_set_wing_picks(p_wing text, p_projects uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  if not exists (select 1 from public.museum_wings where key = p_wing) then raise exception 'NO_SUCH_WING' using errcode = 'P0001'; end if;
  if cardinality(coalesce(p_projects, '{}')) > 60 then raise exception 'TOO_MANY' using errcode = 'P0001'; end if;
  if exists (select 1 from unnest(coalesce(p_projects, '{}')) p where not public.museum_on_show(p)) then
    raise exception 'NOT_ON_SHOW' using errcode = 'P0001';
  end if;
  delete from public.museum_wing_picks where wing_key = p_wing;
  insert into public.museum_wing_picks (wing_key, project_id, position)
  select p_wing, p, min(n)::integer from unnest(coalesce(p_projects, '{}')) with ordinality t(p, n) group by p;
end;
$$;

-- ---------------------------------------------------------------- function privileges
revoke execute on function public.museum_title_meta(uuid, uuid), public.events_museum_hang(), public.events_museum_feature(),
  public.museum_on_show(uuid), public.event_award_list(text), public.earned_titles(uuid) from public, anon, authenticated;
revoke execute on function public.museum_curation(), public.recent_hall_events(integer) from public;
grant execute on function public.museum_curation(), public.recent_hall_events(integer) to anon, authenticated;
revoke execute on function public.my_notifications(integer), public.admin_museum_projects(), public.admin_museum_winners(),
  public.admin_hang_winner(text, uuid, boolean), public.admin_hang_event(text, boolean), public.admin_set_portrait(uuid, text),
  public.admin_save_rooms(jsonb), public.admin_save_wing(text, text, text, text[], integer, boolean, text),
  public.admin_set_wing_picks(text, uuid[]) from public, anon;
grant execute on function public.my_notifications(integer), public.admin_museum_projects(), public.admin_museum_winners(),
  public.admin_hang_winner(text, uuid, boolean), public.admin_hang_event(text, boolean), public.admin_set_portrait(uuid, text),
  public.admin_save_rooms(jsonb), public.admin_save_wing(text, text, text, text[], integer, boolean, text),
  public.admin_set_wing_picks(text, uuid[]) to authenticated;
