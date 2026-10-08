-- Hackathons: tracks, submissions and winners (docs/plan/V2-NEXT.md, V2-9; D-115 to D-117).
--
-- Events (D-103) get a KIND: 'event' (as before), 'hackathon', or 'build' (another building event:
-- a build week, a workshop, a showcase…). Hackathons and building events take SUBMISSIONS:
--   * the event's dates run from kickoff to results. Submissions open on its first day and close at
--     `submissions_close`; results are expected at `results_at`. Both fall inside the event's dates;
--   * up to 6 TRACKS, named by the admin. When an event has tracks, a submission picks one;
--   * a member whose card is in the hall submits one of their own projects on that card, one per
--     event, and can swap it or withdraw it until submissions close. It hangs in the event's room in
--     the Museum while it is on their approved card (ADR-002). No Museum access is needed for that.
-- After submissions close, admins record AWARDS: 1st, 2nd and 3rd place and named awards (e.g.
-- "Best UI"), overall or per track, each with a judges' note (D-116), then ANNOUNCE them, once.
-- Nothing about the results is public before that, and afterwards they are fixed (only a judges'
-- note can be corrected). The announcement is a public hall event (RESULTS_ANNOUNCED); every credited
-- maker who is a member hears it in their bell (AWARD_WON), wears a ribbon on their badge
-- (hall_awards()) and earns the Champion title (D-117).
-- Event, track and award names are data typed by admins, never code (D-029, D-067). Safe to run again.

-- ---------------------------------------------------------------- events: kind, tracks, schedule
alter table public.hall_seasons add column if not exists kind text not null default 'event';
alter table public.hall_seasons add column if not exists tracks text[] not null default '{}';
alter table public.hall_seasons add column if not exists submissions_close timestamptz;
alter table public.hall_seasons add column if not exists results_at timestamptz;
alter table public.hall_seasons add column if not exists announced_at timestamptz;
alter table public.hall_seasons drop constraint if exists hall_seasons_kind_check;
alter table public.hall_seasons add constraint hall_seasons_kind_check check (kind in ('event', 'hackathon', 'build'));
alter table public.hall_seasons drop constraint if exists hall_seasons_schedule_check;
alter table public.hall_seasons add constraint hall_seasons_schedule_check check (
  cardinality(tracks) <= 6 and (
    (kind = 'event' and submissions_close is null and results_at is null and announced_at is null and cardinality(tracks) = 0)
    or (kind <> 'event' and submissions_close is not null and results_at is not null and results_at >= submissions_close)));

-- ---------------------------------------------------------------- submissions
create table if not exists public.event_submissions (
  season_key    text not null references public.hall_seasons (key) on delete cascade,
  project_id    uuid not null references public.projects (id) on delete cascade,
  member_id     uuid not null references public.profiles (id) on delete cascade,
  track         text,
  submitted_at  timestamptz not null default now(),
  primary key (season_key, project_id),
  unique (season_key, member_id)
);
revoke all on public.event_submissions from anon, authenticated;
alter table public.event_submissions enable row level security;

-- ---------------------------------------------------------------- awards
-- A placement (1–3) or a named award, overall (track null) or in one track. Each goes to a project
-- submitted to the event (in that track, for a track award).
create table if not exists public.event_awards (
  id          bigint generated always as identity primary key,
  season_key  text not null,
  project_id  uuid not null,
  place       smallint check (place between 1 and 3),
  name        text check (char_length(name) between 2 and 40),
  track       text,
  note        text not null default '' check (char_length(note) <= 200),
  created_at  timestamptz not null default now(),
  foreign key (season_key, project_id) references public.event_submissions (season_key, project_id) on delete cascade,
  check ((place is null) <> (name is null))
);
-- One 1st (2nd, 3rd) per event and track; one of each named award; one placement per project.
create unique index if not exists event_awards_place_idx on public.event_awards (season_key, coalesce(track, ''), place) where place is not null;
create unique index if not exists event_awards_name_idx on public.event_awards (season_key, coalesce(track, ''), lower(name)) where name is not null;
create unique index if not exists event_awards_placed_idx on public.event_awards (season_key, coalesce(track, ''), project_id) where place is not null;
revoke all on public.event_awards from anon, authenticated;
alter table public.event_awards enable row level security;

-- ---------------------------------------------------------------- new hall events
-- Only widens, like the notifications migration: a later list that already has these is kept.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'hall_events_event_type_check'
                  and pg_get_constraintdef(oid) like '%AWARD_WON%') then
    alter table public.hall_events drop constraint if exists hall_events_event_type_check;
    alter table public.hall_events add constraint hall_events_event_type_check check (event_type in (
      'CARD_APPROVED', 'PROJECT_PUBLISHED', 'EXHIBIT_ADDED', 'COLLAB_ACCEPTED', 'ACHIEVEMENT_UNLOCKED',
      'MISSION_COMPLETED', 'MEMBER_FEATURED', 'COLLAB_REQUESTED', 'CARD_REJECTED', 'COLLAB_PUBLISHED',
      'EVENT_SUBMITTED', 'RESULTS_ANNOUNCED', 'AWARD_WON'));
  end if;
end $$;

-- ---------------------------------------------------------------- how an event reads
-- upcoming → (event) live → over;  upcoming → (hackathon, build) open → judging → results.
create or replace function public.event_phase(s public.hall_seasons)
returns text
language sql stable set search_path = ''
as $$
  select case
    when now() < lower(public.season_window(s.starts_on, s.ends_on)) then 'upcoming'
    when s.kind = 'event' then case when now() < upper(public.season_window(s.starts_on, s.ends_on)) then 'live' else 'over' end
    when s.announced_at is not null then 'results'
    when now() < s.submissions_close then 'open'
    else 'judging'
  end;
$$;

-- As in D-103, plus the kind, tracks, schedule and phase, and the submissions in a live event's counts.
create or replace function public.season_json(s public.hall_seasons, p_counts boolean)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'key', s.key, 'name', s.name, 'blurb', s.blurb, 'starts_on', s.starts_on, 'ends_on', s.ends_on,
    'kind', s.kind, 'tracks', to_jsonb(s.tracks), 'submissions_close', s.submissions_close,
    'results_at', s.results_at, 'announced_at', s.announced_at, 'phase', public.event_phase(s),
    'mission', case when s.mission_kind is not null then
      jsonb_build_object('kind', s.mission_kind, 'param', s.mission_param, 'n', s.mission_n, 'reward', s.mission_reward) end,
    'frame', (select jsonb_build_object('key', m.key, 'name', m.name, 'price', m.price)
                from public.mart_items m where m.key = s.frame_key and m.kind = 'frame' and m.active),
    'counts', case when p_counts then (
      select jsonb_build_object(
        'joined', count(*) filter (where e.event_type = 'CARD_APPROVED' and not exists (
                    select 1 from public.hall_events f where f.actor_id = e.actor_id and f.event_type = 'CARD_APPROVED' and f.id < e.id)),
        'projects', count(*) filter (where e.event_type = 'PROJECT_PUBLISHED'),
        'exhibits', count(*) filter (where e.event_type = 'EXHIBIT_ADDED'),
        'teamups', count(*) filter (where e.event_type = 'COLLAB_PUBLISHED'),
        'submissions', (select count(*) from public.event_submissions es where es.season_key = s.key))
        from public.hall_events e
       where e.visibility = 'public' and e.created_at <@ public.season_window(s.starts_on, s.ends_on)) end);
$$;

-- {live, next, results}: as in D-103, plus `results`, the event whose results were announced in
-- the last 7 days (for the banner once the event itself is over).
create or replace function public.current_season()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'live', (select public.season_json(s, true) from public.hall_seasons s
              where public.season_window(s.starts_on, s.ends_on) @> now() limit 1),
    'next', (select public.season_json(s, false) from public.hall_seasons s
              where lower(public.season_window(s.starts_on, s.ends_on)) > now()
                and lower(public.season_window(s.starts_on, s.ends_on)) <= now() + interval '30 days'
              order by s.starts_on limit 1),
    'results', (select public.season_json(s, false) from public.hall_seasons s
                 where s.announced_at > now() - interval '7 days'
                 order by s.announced_at desc limit 1));
$$;

-- ---------------------------------------------------------------- who made a winning project
-- (member, award, project title) for every announced award: the project's owner and the members
-- credited on it, as on the owner's approved card. Only while the project is on that card.
create or replace function public.award_makers()
returns table (member_id uuid, award_id bigint, title text)
language sql stable security definer set search_path = ''
as $$
  select mk.member_id, a.id, pj.p->>'title'
    from public.event_awards a
    join public.hall_seasons s on s.key = a.season_key and s.announced_at is not null
    join public.event_submissions es on es.season_key = a.season_key and es.project_id = a.project_id
    join public.published_cards c on c.profile_id = es.member_id
    cross join lateral (select x as p from jsonb_array_elements(c.card->'projects') x
                         where x->>'id' = a.project_id::text limit 1) pj
    cross join lateral (
      select c.profile_id as member_id
      union
      select m.profile_id from jsonb_array_elements(coalesce(pj.p->'collaborators', '[]'::jsonb)) col
        join public.published_cards m on m.username = col->>'username') mk;
$$;

-- ---------------------------------------------------------------- titles: Champion (D-117)
create or replace function public.title_catalog()
returns jsonb
language sql immutable set search_path = ''
as $$
  select '[
    {"key": "card_holder", "name": "Card Holder", "rule": "Has a card in the hall."},
    {"key": "pioneer",     "name": "Pioneer",     "rule": "One of the hall''s first 10 members."},
    {"key": "explorer",    "name": "Explorer",    "rule": "Met 10 members of the hall."},
    {"key": "connector",   "name": "Connector",   "rule": "Credited on a team project with another member."},
    {"key": "curator",     "name": "Curator",     "rule": "Has 3 projects on show in the Museum."},
    {"key": "pathfinder",  "name": "Pathfinder",  "rule": "Completed 10 Missions."},
    {"key": "champion",    "name": "Champion",    "rule": "Made a project that won a place or an award at a hall event."}
  ]'::jsonb;
$$;

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
                       where o.profile_id <> p_member and m->>'username' = c.username) then 'connector' end,
    case when (select count(*) from public.museum_entries e where e.member_id = p_member) >= 3 then 'curator' end,
    case when (select count(*) from public.mission_completions m where m.member_id = p_member) >= 10 then 'pathfinder' end,
    case when exists (select 1 from public.award_makers() w where w.member_id = p_member) then 'champion' end
  ], null), '{}')
  from public.published_cards c
  where c.profile_id = p_member
  union all
  select '{}'::text[] where not exists (select 1 from public.published_cards where profile_id = p_member)
  limit 1;
$$;

-- ---------------------------------------------------------------- public reads
-- An event's submissions as exhibits (like museum_exhibits(), plus the track), while each project
-- is on its owner's approved card.
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
           'featured', c.is_featured,
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

create or replace function public.event_award_list(p_key text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'place', a.place, 'name', a.name, 'track', a.track, 'note', a.note, 'project_id', a.project_id)
           order by a.track nulls first, a.place nulls last, a.name), '[]'::jsonb)
    from public.event_awards a
   where a.season_key = p_key;
$$;

-- [event + {entries, awards}] for every hackathon and building event that has begun, newest first.
-- Awards only once announced.
create or replace function public.museum_events()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(public.season_json(s, false) || jsonb_build_object(
           'entries', public.event_entries(s.key),
           'awards', case when s.announced_at is not null then public.event_award_list(s.key) else '[]'::jsonb end)
           order by s.starts_on desc, s.key), '[]'::jsonb)
    from public.hall_seasons s
   where s.kind <> 'event' and lower(public.season_window(s.starts_on, s.ends_on)) <= now();
$$;

-- Ribbons for badges and the Proof panel: [{profile_id, awards: [{event_key, event, place, name,
-- track, project_id, title, at}]}], newest first. Announced awards only, as in award_makers().
create or replace function public.hall_awards()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('profile_id', w.member_id, 'awards', w.awards)), '[]'::jsonb)
    from (
      select am.member_id, jsonb_agg(jsonb_build_object(
               'event_key', s.key, 'event', s.name, 'place', a.place, 'name', a.name, 'track', a.track,
               'project_id', a.project_id, 'title', am.title, 'at', s.announced_at)
               order by s.announced_at desc, a.place nulls last, a.name) as awards
        from public.award_makers() am
        join public.event_awards a on a.id = am.award_id
        join public.hall_seasons s on s.key = a.season_key
       group by am.member_id) w;
$$;

-- ---------------------------------------------------------------- members: submitting
-- {eligible, done, submission: {project_id, track} | null} for the live event (as in D-103, plus
-- what I submitted to it).
create or replace function public.my_season()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'eligible', exists (select 1 from public.published_cards where profile_id = (select auth.uid())),
    'done', exists (select 1 from public.mission_completions m, public.hall_seasons s
                     where m.member_id = (select auth.uid()) and m.key = 'season:' || s.key
                       and public.season_window(s.starts_on, s.ends_on) @> now()),
    'submission', (select jsonb_build_object('project_id', es.project_id, 'track', es.track)
                     from public.event_submissions es
                     join public.hall_seasons s on s.key = es.season_key
                    where es.member_id = (select auth.uid()) and public.season_window(s.starts_on, s.ends_on) @> now()
                    limit 1));
$$;

-- Submits one of my projects on my approved card to an open event (or changes its track).
-- One project per member per event: to submit another, withdraw the first.
create or replace function public.submit_to_event(p_key text, p_project uuid, p_track text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  s public.hall_seasons;
  t text := nullif(trim(coalesce(p_track, '')), '');
  mine uuid;
begin
  if me is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  if not exists (select 1 from public.published_cards where profile_id = me) then
    raise exception 'NOT_ELIGIBLE' using errcode = 'P0001';
  end if;
  select * into s from public.hall_seasons where key = p_key;
  if not found or s.kind = 'event' then raise exception 'NO_SUCH_EVENT' using errcode = 'P0001'; end if;
  if public.event_phase(s) <> 'open' then raise exception 'SUBMISSIONS_CLOSED' using errcode = 'P0001'; end if;
  if not (p_project = any (public.live_project_ids(me)))
     or not exists (select 1 from public.projects where id = p_project and profile_id = me) then
    raise exception 'NOT_LIVE' using errcode = 'P0001';
  end if;
  if (cardinality(s.tracks) > 0 and (t is null or not (t = any (s.tracks)))) or (cardinality(s.tracks) = 0 and t is not null) then
    raise exception 'BAD_TRACK' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('event:' || p_key || ':' || me::text));
  select project_id into mine from public.event_submissions where season_key = p_key and member_id = me;
  if mine is not null and mine <> p_project then raise exception 'ONE_PER_EVENT' using errcode = 'P0001'; end if;
  if mine is not null then
    update public.event_submissions set track = t where season_key = p_key and project_id = p_project;
  else
    insert into public.event_submissions (season_key, project_id, member_id, track) values (p_key, p_project, me, t);
    perform public.log_event(me, 'EVENT_SUBMITTED', 'project', p_project::text,
      jsonb_build_object('season', s.key, 'event', s.name, 'track', t), 'public');
  end if;
  return jsonb_build_object('project_id', p_project, 'track', t);
end;
$$;

-- Takes my submission back, while submissions are open.
create or replace function public.withdraw_from_event(p_key text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  s public.hall_seasons;
begin
  if me is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  select * into s from public.hall_seasons where key = p_key;
  if not found or s.kind = 'event' then raise exception 'NO_SUCH_EVENT' using errcode = 'P0001'; end if;
  if public.event_phase(s) <> 'open' then raise exception 'SUBMISSIONS_CLOSED' using errcode = 'P0001'; end if;
  delete from public.event_submissions where season_key = p_key and member_id = me;
  if not found then raise exception 'NOT_SUBMITTED' using errcode = 'P0001'; end if;
end;
$$;

-- As in D-098, plus: an exhibit in an event room is on show too.
create or replace function public.stamp_exhibit(p_project uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  if not exists (select 1 from public.published_cards where profile_id = me) then return false; end if;
  -- Only exhibits on show, and not your own.
  if not exists (select 1 from public.museum_entries e
                  where e.project_id = p_project and e.member_id <> me and public.has_museum_access(e.member_id))
     and not exists (select 1 from public.event_submissions es
                       join public.published_cards c on c.profile_id = es.member_id
                      where es.project_id = p_project and es.member_id <> me
                        and exists (select 1 from jsonb_array_elements(c.card->'projects') p where p->>'id' = p_project::text)) then
    return false;
  end if;
  insert into public.passport_visits (member_id, project_id) values (me, p_project) on conflict do nothing;
  return found;
end;
$$;

-- ---------------------------------------------------------------- notifications and Recent
-- As in D-100, plus AWARD_WON (with its event and award) in the bell.
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
                 'title', case when e.target_type = 'project' then coalesce(pr.title, e.metadata->>'title')
                               when e.target_type = 'achievement' then a.name end,
                 'note', e.metadata->>'note',
                 'event', e.metadata->>'event',
                 'place', (e.metadata->>'place')::integer,
                 'award', e.metadata->>'award',
                 'track', e.metadata->>'track',
                 'by_username', case when e.actor_id is distinct from e.recipient_id then ap.username end,
                 'by_name', case when e.actor_id is distinct from e.recipient_id then coalesce(ac.card->>'full_name', ap.full_name) end) as n
          from public.hall_events e
          left join public.projects pr on e.target_type = 'project' and pr.id::text = e.target_id
          left join public.achievements a on e.target_type = 'achievement' and a.key = e.target_id
          left join public.profiles ap on ap.id = e.actor_id
          left join public.published_cards ac on ac.profile_id = e.actor_id
         where e.recipient_id = (select auth.uid())
           and e.event_type in ('CARD_APPROVED', 'CARD_REJECTED', 'COLLAB_REQUESTED', 'COLLAB_ACCEPTED',
                                'COLLAB_PUBLISHED', 'ACHIEVEMENT_UNLOCKED', 'MEMBER_FEATURED', 'AWARD_WON')
           and (e.event_type <> 'COLLAB_REQUESTED' or exists (
                 select 1 from public.project_collaborators pc
                  where pc.project_id::text = e.target_id and pc.member_id = e.recipient_id))
         order by e.id desc
         limit greatest(1, least(coalesce(p_limit, 30), 50))
      ) x(n)), '[]'::jsonb));
$$;

-- As in D-100, plus submissions (while they stand) and results announcements, with the event.
create or replace function public.recent_hall_events(p_limit integer default 8)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(r order by (r->>'id')::bigint desc), '[]'::jsonb) from (
    select jsonb_build_object(
             'id', e.id, 'type', e.event_type, 'at', e.created_at,
             'username', c.username, 'full_name', c.card->>'full_name',
             'title', case when e.event_type = 'ACHIEVEMENT_UNLOCKED' then a.name else pj.p->>'title' end,
             'project_id', case when e.target_type in ('project', 'exhibit') then e.target_id end,
             'with_username', w.username, 'with_name', w.card->>'full_name',
             'event_key', ev.key, 'event', ev.name) as r
      from (select * from public.hall_events
             where visibility = 'public'
               and event_type in ('CARD_APPROVED', 'PROJECT_PUBLISHED', 'EXHIBIT_ADDED', 'COLLAB_PUBLISHED',
                                  'ACHIEVEMENT_UNLOCKED', 'MEMBER_FEATURED', 'EVENT_SUBMITTED', 'RESULTS_ANNOUNCED')
             order by id desc limit 400) e
      left join public.published_cards c on c.profile_id = e.actor_id
      left join lateral (select x as p from jsonb_array_elements(c.card->'projects') x
                          where e.target_type in ('project', 'exhibit') and x->>'id' = e.target_id limit 1) pj on true
      left join public.published_cards w on e.event_type = 'COLLAB_PUBLISHED' and w.username = e.metadata->>'with'
      left join public.achievements a on e.event_type = 'ACHIEVEMENT_UNLOCKED' and a.key = e.target_id
      left join public.hall_seasons ev on ev.key = case when e.event_type = 'RESULTS_ANNOUNCED' then e.target_id
                                                        when e.event_type = 'EVENT_SUBMITTED' then e.metadata->>'season' end
     where case e.event_type
             when 'CARD_APPROVED' then c.profile_id is not null and not exists (select 1 from public.hall_events f
                                                    where f.actor_id = e.actor_id and f.event_type = 'CARD_APPROVED' and f.id < e.id)
             when 'PROJECT_PUBLISHED' then pj.p is not null and not exists (
                                                    select 1 from public.hall_events f
                                                     where f.actor_id = e.actor_id and f.event_type = 'CARD_APPROVED' and f.created_at = e.created_at
                                                       and not exists (select 1 from public.hall_events g
                                                                        where g.actor_id = e.actor_id and g.event_type = 'CARD_APPROVED' and g.id < f.id))
             when 'EXHIBIT_ADDED' then pj.p is not null and exists (select 1 from public.museum_entries me where me.project_id::text = e.target_id)
             when 'COLLAB_PUBLISHED' then w.profile_id is not null and exists (
                                                    select 1 from jsonb_array_elements(coalesce(pj.p->'collaborators', '[]'::jsonb)) m
                                                     where m->>'username' = w.username)
             when 'ACHIEVEMENT_UNLOCKED' then c.profile_id is not null and a.key is not null
             when 'MEMBER_FEATURED' then c.is_featured
             when 'EVENT_SUBMITTED' then pj.p is not null and ev.key is not null and exists (
                                                    select 1 from public.event_submissions es
                                                     where es.season_key = ev.key and es.project_id::text = e.target_id)
             when 'RESULTS_ANNOUNCED' then ev.announced_at is not null
           end
     order by e.id desc
     limit greatest(1, least(coalesce(p_limit, 8), 20))
  ) x(r);
$$;

-- ---------------------------------------------------------------- admin: events
-- As in D-103, plus each event's phase and how many submissions and awards it has.
create or replace function public.admin_seasons()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(public.season_json(s, false) || jsonb_build_object(
           'state', case when public.season_window(s.starts_on, s.ends_on) @> now() then 'live'
                         when lower(public.season_window(s.starts_on, s.ends_on)) > now() then 'upcoming' else 'over' end,
           'entries', (select count(*) from public.event_submissions es where es.season_key = s.key),
           'award_count', (select count(*) from public.event_awards a where a.season_key = s.key))
           order by s.starts_on desc) from public.hall_seasons s), '[]'::jsonb);
end;
$$;

-- Schedules an event or changes one: as in D-103, plus the event's kind, its tracks, when
-- submissions close and when results are expected (hackathons and building events only).
drop function if exists public.admin_save_season(text, text, text, date, date, text, text, integer, integer, text);
create or replace function public.admin_save_season(p_key text, p_name text, p_blurb text, p_starts date, p_ends date,
  p_kind text, p_param text, p_n integer, p_reward integer, p_frame text,
  p_event text, p_tracks text[], p_close timestamptz, p_results timestamptz)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  param text := nullif(trim(coalesce(p_param, '')), '');
  ev text := coalesce(p_event, 'event');
  w tstzrange;
  tr text[];
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  if p_key is null or p_key !~ '^[a-z0-9][a-z0-9-]{1,23}$' then raise exception 'BAD_KEY' using errcode = 'P0001'; end if;
  if coalesce(char_length(trim(p_name)), 0) not between 2 and 40 then raise exception 'BAD_NAME' using errcode = 'P0001'; end if;
  if coalesce(char_length(trim(p_blurb)), 0) > 200 then raise exception 'BAD_BLURB' using errcode = 'P0001'; end if;
  if p_starts is null or p_ends is null or p_ends < p_starts or p_ends - p_starts > 30 then
    raise exception 'BAD_DATES' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.hall_seasons s where s.key <> p_key
              and public.season_window(s.starts_on, s.ends_on) && public.season_window(p_starts, p_ends)) then
    raise exception 'OVERLAP' using errcode = 'P0001';
  end if;
  if p_kind is not null and not (
       (p_kind in ('skill', 'department', 'tech') and coalesce(p_n, 1) = 1 and param is not null and char_length(param) <= 40)
    or (p_kind = 'team' and coalesce(p_n, 1) = 1)
    or (p_kind = 'people' and p_n between 2 and 20)
    or (p_kind = 'exhibits' and p_n between 1 and 20)
    or (p_kind = 'departments' and p_n between 2 and 10)
  ) then
    raise exception 'BAD_MISSION' using errcode = 'P0001';
  end if;
  if p_kind is not null and (p_reward is null or p_reward not between 5 and 200) then
    raise exception 'BAD_REWARD' using errcode = 'P0001';
  end if;
  if p_frame is not null and not exists (select 1 from public.mart_items where key = p_frame and kind = 'frame') then
    raise exception 'NO_SUCH_FRAME' using errcode = 'P0001';
  end if;
  if ev not in ('event', 'hackathon', 'build') then raise exception 'BAD_EVENT_KIND' using errcode = 'P0001'; end if;
  -- Tracks: trimmed, 2–30 characters each, no two alike, at most 6. Plain events have none.
  select coalesce(array_agg(x order by n), '{}') into tr
    from (select trim(x) as x, n from unnest(coalesce(p_tracks, '{}')) with ordinality u(x, n) where trim(x) <> '') t;
  if ev = 'event' then tr := '{}'; end if;
  if cardinality(tr) > 6 or exists (select 1 from unnest(tr) x where char_length(x) not between 2 and 30)
     or (select count(distinct lower(x)) from unnest(tr) x) <> cardinality(tr) then
    raise exception 'BAD_TRACKS' using errcode = 'P0001';
  end if;
  w := public.season_window(p_starts, p_ends);
  if ev <> 'event' and (p_close is null or p_results is null or p_close <= lower(w) or p_close > upper(w)
                        or p_results < p_close or p_results > upper(w)) then
    raise exception 'BAD_SCHEDULE' using errcode = 'P0001';
  end if;
  -- Submissions keep their event and their track; once judging has begun, submissions stay closed.
  if exists (select 1 from public.event_submissions es where es.season_key = p_key
              and (ev = 'event' or (es.track is not null and not (es.track = any (tr)))))
     or (exists (select 1 from public.event_awards a where a.season_key = p_key) and (ev = 'event' or p_close > now())) then
    raise exception 'IN_USE' using errcode = 'P0001';
  end if;
  insert into public.hall_seasons (key, name, blurb, starts_on, ends_on, mission_kind, mission_param, mission_n, mission_reward, frame_key,
                                   kind, tracks, submissions_close, results_at, updated_at)
  values (p_key, trim(p_name), coalesce(trim(p_blurb), ''), p_starts, p_ends, p_kind,
          case when p_kind in ('skill', 'department', 'tech') then param end,
          case when p_kind is null then null else coalesce(p_n, 1) end,
          case when p_kind is null then null else p_reward end, p_frame,
          ev, tr, case when ev <> 'event' then p_close end, case when ev <> 'event' then p_results end, now())
  on conflict (key) do update
    set name = excluded.name, blurb = excluded.blurb, starts_on = excluded.starts_on, ends_on = excluded.ends_on,
        mission_kind = excluded.mission_kind, mission_param = excluded.mission_param, mission_n = excluded.mission_n,
        mission_reward = excluded.mission_reward, frame_key = excluded.frame_key,
        kind = excluded.kind, tracks = excluded.tracks, submissions_close = excluded.submissions_close,
        results_at = excluded.results_at, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------- admin: results
-- {entries: [{project_id, title, username, full_name, track, submitted_at, on_card}],
--  awards: [{id, place, name, track, note, project_id}], announced_at}: everything, before and after
-- the announcement.
create or replace function public.admin_event_results(p_key text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  if not exists (select 1 from public.hall_seasons where key = p_key and kind <> 'event') then
    raise exception 'NO_SUCH_EVENT' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'announced_at', (select announced_at from public.hall_seasons where key = p_key),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
               'project_id', es.project_id, 'title', coalesce(x.elem->>'title', pr.title),
               'username', pf.username, 'full_name', coalesce(c.card->>'full_name', pf.full_name),
               'track', es.track, 'submitted_at', es.submitted_at, 'on_card', x.elem is not null)
               order by es.track nulls first, es.submitted_at)
        from public.event_submissions es
        join public.profiles pf on pf.id = es.member_id
        left join public.projects pr on pr.id = es.project_id
        left join public.published_cards c on c.profile_id = es.member_id
        left join lateral (select p as elem from jsonb_array_elements(c.card->'projects') p
                            where p->>'id' = es.project_id::text limit 1) x on true
       where es.season_key = p_key), '[]'::jsonb),
    'awards', public.event_award_list(p_key));
end;
$$;

-- Records a place (1–3) or a named award, overall (track null) or in a track, with the judges' note.
-- Only after submissions close, only for a submitted project (in that track), only before the
-- results are announced. Returns the award's id.
create or replace function public.admin_save_award(p_key text, p_project uuid, p_place integer, p_name text, p_track text, p_note text)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  s public.hall_seasons;
  nm text := nullif(trim(coalesce(p_name, '')), '');
  t text := nullif(trim(coalesce(p_track, '')), '');
  sub public.event_submissions;
  new_id bigint;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  select * into s from public.hall_seasons where key = p_key for update;
  if not found or s.kind = 'event' then raise exception 'NO_SUCH_EVENT' using errcode = 'P0001'; end if;
  if s.announced_at is not null then raise exception 'ALREADY_ANNOUNCED' using errcode = 'P0001'; end if;
  if public.event_phase(s) <> 'judging' then raise exception 'STILL_OPEN' using errcode = 'P0001'; end if;
  if (p_place is null) = (nm is null) or (p_place is not null and p_place not between 1 and 3)
     or (nm is not null and char_length(nm) not between 2 and 40) then
    raise exception 'BAD_AWARD' using errcode = 'P0001';
  end if;
  if coalesce(char_length(trim(p_note)), 0) > 200 then raise exception 'BAD_NOTE' using errcode = 'P0001'; end if;
  if t is not null and not (t = any (s.tracks)) then raise exception 'BAD_TRACK' using errcode = 'P0001'; end if;
  select * into sub from public.event_submissions where season_key = p_key and project_id = p_project;
  if not found then raise exception 'NOT_SUBMITTED' using errcode = 'P0001'; end if;
  if t is not null and sub.track is distinct from t then raise exception 'BAD_TRACK' using errcode = 'P0001'; end if;
  begin
    insert into public.event_awards (season_key, project_id, place, name, track, note)
    values (p_key, p_project, p_place, nm, t, coalesce(trim(p_note), ''))
    returning id into new_id;
  exception when unique_violation then
    raise exception 'AWARD_TAKEN' using errcode = 'P0001';
  end;
  return new_id;
end;
$$;

-- Corrects a judges' note, also after the announcement (the winners themselves stay as announced).
create or replace function public.admin_award_note(p_id bigint, p_note text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  if coalesce(char_length(trim(p_note)), 0) > 200 then raise exception 'BAD_NOTE' using errcode = 'P0001'; end if;
  update public.event_awards set note = coalesce(trim(p_note), '') where id = p_id;
  if not found then raise exception 'NO_SUCH_AWARD' using errcode = 'P0001'; end if;
end;
$$;

-- Removes an award before the announcement.
create or replace function public.admin_delete_award(p_id bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  k text;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  select season_key into k from public.event_awards where id = p_id;
  if k is null then raise exception 'NO_SUCH_AWARD' using errcode = 'P0001'; end if;
  perform 1 from public.hall_seasons where key = k for update;
  if exists (select 1 from public.hall_seasons where key = k and announced_at is not null) then
    raise exception 'ALREADY_ANNOUNCED' using errcode = 'P0001';
  end if;
  delete from public.event_awards where id = p_id;
end;
$$;

-- Announces the results, once: the hall hears it, every credited maker who is a member hears what
-- they won. {announced_at, makers}
create or replace function public.admin_announce_results(p_key text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  s public.hall_seasons;
  w record;
  n integer := 0;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  select * into s from public.hall_seasons where key = p_key for update;
  if not found or s.kind = 'event' then raise exception 'NO_SUCH_EVENT' using errcode = 'P0001'; end if;
  if s.announced_at is not null then raise exception 'ALREADY_ANNOUNCED' using errcode = 'P0001'; end if;
  if public.event_phase(s) <> 'judging' then raise exception 'STILL_OPEN' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.event_awards where season_key = p_key) then raise exception 'NO_AWARDS' using errcode = 'P0001'; end if;
  update public.hall_seasons set announced_at = now(), updated_at = now() where key = p_key;
  perform public.log_event(null, 'RESULTS_ANNOUNCED', 'event', s.key, jsonb_build_object('event', s.name), 'public');
  for w in select am.member_id, am.title, a.project_id, a.place, a.name, a.track
             from public.award_makers() am join public.event_awards a on a.id = am.award_id
            where a.season_key = p_key
            order by a.place nulls last, a.name loop
    perform public.log_event(w.member_id, 'AWARD_WON', 'project', w.project_id::text,
      jsonb_build_object('season', s.key, 'event', s.name, 'place', w.place, 'award', w.name, 'track', w.track, 'title', w.title), 'public');
    n := n + 1;
  end loop;
  return jsonb_build_object('announced_at', now(), 'makers', n);
end;
$$;

-- ---------------------------------------------------------------- function privileges
revoke execute on function public.event_phase(public.hall_seasons), public.award_makers(), public.event_entries(text),
  public.event_award_list(text), public.museum_events(), public.hall_awards(), public.submit_to_event(text, uuid, text),
  public.withdraw_from_event(text), public.admin_event_results(text),
  public.admin_save_season(text, text, text, date, date, text, text, integer, integer, text, text, text[], timestamptz, timestamptz),
  public.admin_save_award(text, uuid, integer, text, text, text), public.admin_award_note(bigint, text),
  public.admin_delete_award(bigint), public.admin_announce_results(text)
  from public, anon, authenticated;
grant execute on function public.museum_events(), public.hall_awards() to anon, authenticated;
grant execute on function public.submit_to_event(text, uuid, text), public.withdraw_from_event(text), public.admin_event_results(text),
  public.admin_save_season(text, text, text, date, date, text, text, integer, integer, text, text, text[], timestamptz, timestamptz),
  public.admin_save_award(text, uuid, integer, text, text, text), public.admin_award_note(bigint, text),
  public.admin_delete_award(bigint), public.admin_announce_results(text)
  to authenticated;
