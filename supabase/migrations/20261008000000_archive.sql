-- The archive: past projects and hackathon outputs (docs/plan/V2-NEXT.md, V2-10; D-118, D-122).
--
-- Admins compile past work into ARCHIVE EXHIBITS: a title, a description, the year, the event it
-- came from (a recorded hall event, or a typed name for older ones), the track it was in, the place
-- or award it won (with the judges' note), a team name, what it was built with, links (site, code,
-- video) and a picture (a Storage path in the uploading admin's folder, D-027). An exhibit can be
-- kept as a draft while it's being compiled; only published ones are public.
-- Its MAKERS are slots: a member of the hall (linked to their badge), or a typed name, or neither
-- (someone who isn't named). Typed names are public only when the admin records that the makers
-- agreed to be named (`names_ok`); otherwise the exhibit shows its team name, or "a team of N".
-- Members can CLAIM an archive exhibit ("Is this yours?"); an admin confirms or declines. A member
-- linked to one hears it in their bell and can take their name off it again. Linked credits count
-- toward Connector, Curator and Champion (rule 4: titles follow recorded facts), and an archive
-- award puts a ribbon on the member's badge like an award won in the hall.
-- Nothing here is invented: every row is typed by an admin (rule 7). Safe to run again.

-- ---------------------------------------------------------------- exhibits
create table if not exists public.archive_exhibits (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null check (char_length(title) between 1 and 80),
  description         text not null default '' check (char_length(description) <= 500),
  year                smallint not null check (year between 1990 and 2100),
  season_key          text references public.hall_seasons (key) on delete set null,
  event_name          text check (event_name is null or char_length(event_name) between 2 and 60),
  track               text check (track is null or char_length(track) between 2 and 30),
  award_place         smallint check (award_place between 1 and 3),
  award_name          text check (award_name is null or char_length(award_name) between 2 and 40),
  award_in_track      boolean not null default false,
  award_note          text not null default '' check (char_length(award_note) <= 200),
  team_name           text check (team_name is null or char_length(team_name) between 2 and 40),
  tech                text[] not null default '{}' check (cardinality(tech) <= 8),
  project_url         text check (project_url is null or project_url ~ '^https://\S+$'),
  github_url          text check (github_url is null or github_url ~ '^https://\S+$'),
  video_url           text check (video_url is null or video_url ~ '^https://\S+$'),
  cover_path          text check (cover_path is null or cover_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpe?g|png)$'),
  names_ok            boolean not null default false,
  published           boolean not null default false,
  first_published_at  timestamptz,
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (award_place is null or award_name is null)
);
revoke all on public.archive_exhibits from anon, authenticated;
alter table public.archive_exhibits enable row level security;

-- A maker slot: a member, a typed name, or someone not named. At most 12 per exhibit (checked in
-- admin_save_archive()); a member is on an exhibit at most once.
create table if not exists public.archive_makers (
  id          bigint generated always as identity primary key,
  exhibit_id  uuid not null references public.archive_exhibits (id) on delete cascade,
  member_id   uuid references public.profiles (id) on delete set null,
  name        text check (name is null or char_length(name) between 1 and 60),
  sort        smallint not null default 0
);
create unique index if not exists archive_makers_member_idx on public.archive_makers (exhibit_id, member_id) where member_id is not null;
revoke all on public.archive_makers from anon, authenticated;
alter table public.archive_makers enable row level security;

create table if not exists public.archive_claims (
  id           bigint generated always as identity primary key,
  exhibit_id   uuid not null references public.archive_exhibits (id) on delete cascade,
  member_id    uuid not null references public.profiles (id) on delete cascade,
  note         text not null default '' check (char_length(note) <= 200),
  status       text not null default 'pending' check (status in ('pending', 'confirmed', 'declined')),
  created_at   timestamptz not null default now(),
  answered_at  timestamptz,
  unique (exhibit_id, member_id)
);
revoke all on public.archive_claims from anon, authenticated;
alter table public.archive_claims enable row level security;

-- ---------------------------------------------------------------- new hall events
-- Only widens (see the notifications migration): a later list that already has these is kept.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'hall_events_event_type_check'
                  and pg_get_constraintdef(oid) like '%ARCHIVE_CLAIM_DECLINED%') then
    alter table public.hall_events drop constraint if exists hall_events_event_type_check;
    alter table public.hall_events add constraint hall_events_event_type_check check (event_type in (
      'CARD_APPROVED', 'PROJECT_PUBLISHED', 'EXHIBIT_ADDED', 'COLLAB_ACCEPTED', 'ACHIEVEMENT_UNLOCKED',
      'MISSION_COMPLETED', 'MEMBER_FEATURED', 'COLLAB_REQUESTED', 'CARD_REJECTED', 'COLLAB_PUBLISHED',
      'EVENT_SUBMITTED', 'RESULTS_ANNOUNCED', 'AWARD_WON',
      'ARCHIVE_ADDED', 'ARCHIVE_CREDITED', 'ARCHIVE_CLAIM_DECLINED'));
  end if;
end $$;

-- ---------------------------------------------------------------- how an archive exhibit reads
-- The event's name as people say it, with the year when the name doesn't already have it
-- ("Spring Hackathon 2024", "Build Week 2023"); null when the exhibit came from no event.
create or replace function public.archive_event_label(p_season text, p_event text, p_year integer)
returns text
language sql stable security definer set search_path = ''
as $$
  select case when x.n is null then null
              when position(p_year::text in x.n) > 0 then x.n
              else x.n || ' ' || p_year end
    from (select coalesce((select s.name from public.hall_seasons s where s.key = p_season), p_event) as n) x;
$$;

-- (member, exhibit) for every member of the hall linked on a published archive exhibit.
create or replace function public.archive_credits()
returns table (member_id uuid, exhibit_id uuid)
language sql stable security definer set search_path = ''
as $$
  select m.member_id, a.id
    from public.archive_makers m
    join public.archive_exhibits a on a.id = m.exhibit_id and a.published
    join public.published_cards c on c.profile_id = m.member_id;
$$;

-- One exhibit as visitors see it. Makers: members of the hall by their card, typed names only when
-- the makers agreed to be named; `team_size` counts every slot, so "a team of 4" stays true.
create or replace function public.archive_json(a public.archive_exhibits)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', a.id, 'title', a.title, 'description', a.description, 'year', a.year,
    'event_key', (select s.key from public.hall_seasons s where s.key = a.season_key),
    'event', public.archive_event_label(a.season_key, a.event_name, a.year),
    'track', a.track,
    'award', case when a.award_place is not null or a.award_name is not null then
      jsonb_build_object('place', a.award_place, 'name', a.award_name, 'track', case when a.award_in_track then a.track end, 'note', a.award_note) end,
    'team_name', a.team_name, 'tech', to_jsonb(a.tech),
    'project_url', a.project_url, 'github_url', a.github_url, 'video_url', a.video_url, 'cover_path', a.cover_path,
    'makers', coalesce((
      select jsonb_agg(case when c.profile_id is not null
                            then jsonb_build_object('username', c.username, 'full_name', c.card->>'full_name', 'member_no', c.member_no)
                            else jsonb_build_object('full_name', m.name) end order by m.sort, m.id)
        from public.archive_makers m
        left join public.published_cards c on c.profile_id = m.member_id
       where m.exhibit_id = a.id and (c.profile_id is not null or (a.names_ok and m.name is not null))), '[]'::jsonb),
    'team_size', (select count(*) from public.archive_makers m where m.exhibit_id = a.id));
$$;

-- ---------------------------------------------------------------- public reads
-- Every published archive exhibit, newest year first.
create or replace function public.museum_archive()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(public.archive_json(a) order by a.year desc, a.title), '[]'::jsonb)
    from public.archive_exhibits a
   where a.published;
$$;

-- As in D-116, plus the places and awards of archive exhibits members are linked on (D-118).
create or replace function public.hall_awards()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('profile_id', w.member_id, 'awards', w.awards)), '[]'::jsonb)
    from (
      select r.member_id, jsonb_agg(r.award order by r.at desc, r.award->>'place' nulls last, r.award->>'name') as awards
        from (
          select am.member_id, s.announced_at as at, jsonb_build_object(
                   'event_key', s.key, 'event', s.name, 'place', a.place, 'name', a.name, 'track', a.track,
                   'project_id', a.project_id, 'title', am.title, 'at', s.announced_at) as award
            from public.award_makers() am
            join public.event_awards a on a.id = am.award_id
            join public.hall_seasons s on s.key = a.season_key
          union all
          select x.member_id, make_date(a.year, 12, 31)::timestamptz, jsonb_build_object(
                   'event_key', a.season_key, 'event', public.archive_event_label(a.season_key, a.event_name, a.year),
                   'place', a.award_place, 'name', a.award_name, 'track', case when a.award_in_track then a.track end,
                   'project_id', a.id, 'title', a.title, 'at', make_date(a.year, 12, 31), 'archive', true)
            from public.archive_credits() x
            join public.archive_exhibits a on a.id = x.exhibit_id
           where a.award_place is not null or a.award_name is not null
        ) r
       group by r.member_id) w;
$$;

-- ---------------------------------------------------------------- titles count the archive too
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
    {"key": "champion",    "name": "Champion",    "rule": "Made a project that won a place or an award at an event."}
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
                       where o.profile_id <> p_member and m->>'username' = c.username)
           or exists (select 1 from public.archive_credits() x join public.archive_credits() y
                         on y.exhibit_id = x.exhibit_id and y.member_id <> x.member_id
                       where x.member_id = p_member) then 'connector' end,
    case when (select count(*) from public.museum_entries e where e.member_id = p_member)
              + (select count(*) from public.archive_credits() x where x.member_id = p_member) >= 3 then 'curator' end,
    case when (select count(*) from public.mission_completions m where m.member_id = p_member) >= 10 then 'pathfinder' end,
    case when exists (select 1 from public.award_makers() w where w.member_id = p_member)
           or exists (select 1 from public.archive_credits() x join public.archive_exhibits a on a.id = x.exhibit_id
                       where x.member_id = p_member and (a.award_place is not null or a.award_name is not null)) then 'champion' end
  ], null), '{}')
  from public.published_cards c
  where c.profile_id = p_member
  union all
  select '{}'::text[] where not exists (select 1 from public.published_cards where profile_id = p_member)
  limit 1;
$$;

-- ---------------------------------------------------------------- members: claims
-- {eligible, claims: [{exhibit_id, status}], credited: [exhibit ids]} for the signed-in member.
create or replace function public.my_archive()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'eligible', exists (select 1 from public.published_cards where profile_id = (select auth.uid())),
    'claims', coalesce((select jsonb_agg(jsonb_build_object('exhibit_id', c.exhibit_id, 'status', c.status))
                          from public.archive_claims c where c.member_id = (select auth.uid())), '[]'::jsonb),
    'credited', coalesce((select jsonb_agg(m.exhibit_id) from public.archive_makers m
                           where m.member_id = (select auth.uid())), '[]'::jsonb));
$$;

-- "Is this yours?": asks the admins to link me on a published archive exhibit. One claim per
-- exhibit (a declined one can be made again), at most 10 waiting at a time.
create or replace function public.claim_archive(p_id uuid, p_note text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  st text;
begin
  if me is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  if not exists (select 1 from public.published_cards where profile_id = me) then
    raise exception 'NOT_ELIGIBLE' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.archive_exhibits where id = p_id and published) then
    raise exception 'NO_SUCH_EXHIBIT' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.archive_makers where exhibit_id = p_id and member_id = me) then
    raise exception 'ALREADY_CREDITED' using errcode = 'P0001';
  end if;
  if coalesce(char_length(trim(p_note)), 0) > 200 then raise exception 'BAD_NOTE' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext('claims:' || me::text));
  select status into st from public.archive_claims where exhibit_id = p_id and member_id = me;
  if st = 'pending' then raise exception 'ALREADY_CLAIMED' using errcode = 'P0001'; end if;
  if (select count(*) from public.archive_claims where member_id = me and status = 'pending') >= 10 then
    raise exception 'TOO_MANY_CLAIMS' using errcode = 'P0001';
  end if;
  insert into public.archive_claims (exhibit_id, member_id, note) values (p_id, me, coalesce(trim(p_note), ''))
  on conflict (exhibit_id, member_id) do update
    set status = 'pending', note = excluded.note, created_at = now(), answered_at = null;
end;
$$;

-- Takes my name off an archive exhibit (the slot stays, unnamed, so the team size stays true).
create or replace function public.leave_archive(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  update public.archive_makers set member_id = null where exhibit_id = p_id and member_id = me;
  if not found then raise exception 'NOT_CREDITED' using errcode = 'P0001'; end if;
end;
$$;

-- As in D-116, plus: a published archive exhibit is on show too (not one you made).
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
                        and exists (select 1 from jsonb_array_elements(c.card->'projects') p where p->>'id' = p_project::text))
     and not exists (select 1 from public.archive_exhibits a
                      where a.id = p_project and a.published
                        and not exists (select 1 from public.archive_makers m where m.exhibit_id = a.id and m.member_id = me)) then
    return false;
  end if;
  insert into public.passport_visits (member_id, project_id) values (me, p_project) on conflict do nothing;
  return found;
end;
$$;

-- ---------------------------------------------------------------- notifications and Recent
-- Credits a linked member once per exhibit (public: the exhibit now shows them), and settles any
-- claim they had waiting on it.
create or replace function public.archive_credit(p_exhibit uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  a public.archive_exhibits;
  m uuid;
begin
  select * into a from public.archive_exhibits where id = p_exhibit;
  if not found or not a.published then return; end if;
  for m in select x.member_id from public.archive_credits() x where x.exhibit_id = p_exhibit loop
    update public.archive_claims set status = 'confirmed', answered_at = now()
     where exhibit_id = p_exhibit and member_id = m and status = 'pending';
    if not exists (select 1 from public.hall_events e
                    where e.event_type = 'ARCHIVE_CREDITED' and e.actor_id = m and e.target_id = p_exhibit::text) then
      perform public.log_event(m, 'ARCHIVE_CREDITED', 'archive', p_exhibit::text, jsonb_build_object('title', a.title), 'public');
    end if;
  end loop;
end;
$$;

-- As in D-116, plus archive credits and declined claims in the bell.
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
          left join public.projects pr on e.target_type = 'project' and pr.id::text = e.target_id
          left join public.archive_exhibits ar on e.target_type = 'archive' and ar.id::text = e.target_id
          left join public.achievements a on e.target_type = 'achievement' and a.key = e.target_id
          left join public.profiles ap on ap.id = e.actor_id
          left join public.published_cards ac on ac.profile_id = e.actor_id
         where e.recipient_id = (select auth.uid())
           and e.event_type in ('CARD_APPROVED', 'CARD_REJECTED', 'COLLAB_REQUESTED', 'COLLAB_ACCEPTED',
                                'COLLAB_PUBLISHED', 'ACHIEVEMENT_UNLOCKED', 'MEMBER_FEATURED', 'AWARD_WON',
                                'ARCHIVE_CREDITED', 'ARCHIVE_CLAIM_DECLINED')
           and (e.event_type <> 'COLLAB_REQUESTED' or exists (
                 select 1 from public.project_collaborators pc
                  where pc.project_id::text = e.target_id and pc.member_id = e.recipient_id))
         order by e.id desc
         limit greatest(1, least(coalesce(p_limit, 30), 50))
      ) x(n)), '[]'::jsonb));
$$;

-- As in D-116, plus new archive exhibits and archive credits, while they stand.
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
             when 'ARCHIVE_ADDED' then coalesce(ar.published, false)
             when 'ARCHIVE_CREDITED' then coalesce(ar.published, false) and c.profile_id is not null and exists (
                                                    select 1 from public.archive_makers m where m.exhibit_id = ar.id and m.member_id = e.actor_id)
           end
     order by e.id desc
     limit greatest(1, least(coalesce(p_limit, 8), 20))
  ) x(r);
$$;

-- ---------------------------------------------------------------- admin
-- Every archive exhibit, drafts too, with its maker slots and the claims waiting on it.
create or replace function public.admin_archive()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
           'id', a.id, 'title', a.title, 'description', a.description, 'year', a.year,
           'season_key', a.season_key, 'event_name', a.event_name,
           'event', public.archive_event_label(a.season_key, a.event_name, a.year), 'track', a.track,
           'award_place', a.award_place, 'award_name', a.award_name, 'award_in_track', a.award_in_track, 'award_note', a.award_note,
           'team_name', a.team_name, 'tech', to_jsonb(a.tech), 'project_url', a.project_url, 'github_url', a.github_url,
           'video_url', a.video_url, 'cover_path', a.cover_path, 'names_ok', a.names_ok, 'published', a.published,
           'makers', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'member_id', m.member_id, 'name', m.name,
                                 'username', c.username, 'full_name', c.card->>'full_name') order by m.sort, m.id)
                                 from public.archive_makers m left join public.published_cards c on c.profile_id = m.member_id
                                where m.exhibit_id = a.id), '[]'::jsonb),
           'claims', coalesce((select jsonb_agg(jsonb_build_object('id', cl.id, 'member_id', cl.member_id, 'username', p.username,
                                 'full_name', coalesce(c.card->>'full_name', p.full_name), 'note', cl.note, 'at', cl.created_at) order by cl.created_at)
                                 from public.archive_claims cl join public.profiles p on p.id = cl.member_id
                                 left join public.published_cards c on c.profile_id = cl.member_id
                                where cl.exhibit_id = a.id and cl.status = 'pending'), '[]'::jsonb))
           order by a.year desc, a.title) from public.archive_exhibits a), '[]'::jsonb);
end;
$$;

-- Adds (p_id null) or changes an archive exhibit. p_data: {title, description, year, season_key,
-- event_name, track, award_place, award_name, award_in_track, award_note, team_name, tech: [],
-- project_url, github_url, video_url, cover_path, names_ok, published, makers: [{member_id, name}]}.
-- Makers are replaced in the order given. Returns the exhibit's id.
create or replace function public.admin_save_archive(p_id uuid, p_data jsonb)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  d jsonb := coalesce(p_data, '{}'::jsonb);
  t text := trim(coalesce(d->>'title', ''));
  descr text := trim(coalesce(d->>'description', ''));
  yr integer;
  sk text := nullif(trim(coalesce(d->>'season_key', '')), '');
  ev text := nullif(trim(coalesce(d->>'event_name', '')), '');
  tr text := nullif(trim(coalesce(d->>'track', '')), '');
  place integer;
  award text := nullif(trim(coalesce(d->>'award_name', '')), '');
  note text := trim(coalesce(d->>'award_note', ''));
  team text := nullif(trim(coalesce(d->>'team_name', '')), '');
  v_tech text[];
  site text := nullif(trim(coalesce(d->>'project_url', '')), '');
  code text := nullif(trim(coalesce(d->>'github_url', '')), '');
  video text := nullif(trim(coalesce(d->>'video_url', '')), '');
  pic text := nullif(trim(coalesce(d->>'cover_path', '')), '');
  makers jsonb := coalesce(d->'makers', '[]'::jsonb);
  prev public.archive_exhibits;
  xid uuid := p_id;
  mk jsonb;
  n integer := 0;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  if p_id is not null then
    select * into prev from public.archive_exhibits where archive_exhibits.id = p_id for update;
    if not found then raise exception 'NO_SUCH_EXHIBIT' using errcode = 'P0001'; end if;
  end if;
  if char_length(t) not between 1 and 80 then raise exception 'BAD_TITLE' using errcode = 'P0001'; end if;
  if char_length(descr) > 500 then raise exception 'BAD_DESCRIPTION' using errcode = 'P0001'; end if;
  if coalesce(d->>'year', '') !~ '^\d{4}$' then raise exception 'BAD_YEAR' using errcode = 'P0001'; end if;
  yr := (d->>'year')::integer;
  if yr < 1990 or yr > extract(year from now())::integer + 1 then raise exception 'BAD_YEAR' using errcode = 'P0001'; end if;
  -- A recorded event must be over (or have announced its results), so nothing about it leaks early.
  if sk is not null then
    if not exists (select 1 from public.hall_seasons s where s.key = sk) then raise exception 'NO_SUCH_EVENT' using errcode = 'P0001'; end if;
    if not exists (select 1 from public.hall_seasons s where s.key = sk
                    and (upper(public.season_window(s.starts_on, s.ends_on)) <= now() or s.announced_at is not null)) then
      raise exception 'EVENT_NOT_OVER' using errcode = 'P0001';
    end if;
    ev := null;
  elsif ev is not null and char_length(ev) not between 2 and 60 then
    raise exception 'BAD_EVENT' using errcode = 'P0001';
  end if;
  if tr is not null and char_length(tr) not between 2 and 30 then raise exception 'BAD_TRACK' using errcode = 'P0001'; end if;
  if coalesce(d->>'award_place', '') !~ '^[123]?$' then raise exception 'BAD_AWARD' using errcode = 'P0001'; end if;
  place := nullif(d->>'award_place', '')::integer;
  if (place is not null and award is not null) or (award is not null and char_length(award) not between 2 and 40)
     or ((place is not null or award is not null) and sk is null and ev is null)
     or (coalesce((d->>'award_in_track')::boolean, false) and tr is null) then
    raise exception 'BAD_AWARD' using errcode = 'P0001';
  end if;
  if char_length(note) > 200 then raise exception 'BAD_NOTE' using errcode = 'P0001'; end if;
  if team is not null and char_length(team) not between 2 and 40 then raise exception 'BAD_TEAM' using errcode = 'P0001'; end if;
  if jsonb_typeof(coalesce(d->'tech', '[]'::jsonb)) <> 'array' then raise exception 'BAD_TECH' using errcode = 'P0001'; end if;
  select coalesce(array_agg(x order by o), '{}') into v_tech
    from (select trim(x) as x, min(o) as o from jsonb_array_elements_text(coalesce(d->'tech', '[]'::jsonb)) with ordinality u(x, o)
           where trim(x) <> '' group by trim(x)) z;
  if cardinality(v_tech) > 8 or exists (select 1 from unnest(v_tech) x where char_length(x) > 30) then
    raise exception 'BAD_TECH' using errcode = 'P0001';
  end if;
  if (site is not null and site !~ '^https://\S+$') or (code is not null and code !~ '^https://\S+$')
     or (video is not null and video !~ '^https://\S+$') then
    raise exception 'BAD_LINK' using errcode = 'P0001';
  end if;
  -- A new picture is one this admin just uploaded into their own folder; an old one may stay.
  if pic is not null and pic is distinct from prev.cover_path
     and pic !~ ('^' || me::text || '/[0-9a-f-]{36}\.(webp|jpe?g|png)$') then
    raise exception 'BAD_PICTURE' using errcode = 'P0001';
  end if;
  if jsonb_typeof(makers) <> 'array' or jsonb_array_length(makers) > 12 then raise exception 'BAD_MAKERS' using errcode = 'P0001'; end if;
  for mk in select x from jsonb_array_elements(makers) x loop
    if jsonb_typeof(mk) <> 'object'
       or (nullif(trim(coalesce(mk->>'name', '')), '') is not null and char_length(trim(mk->>'name')) > 60)
       or (nullif(mk->>'member_id', '') is not null and (mk->>'member_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
      raise exception 'BAD_MAKERS' using errcode = 'P0001';
    end if;
    if nullif(mk->>'member_id', '') is not null
       and not exists (select 1 from public.published_cards where profile_id = (mk->>'member_id')::uuid) then
      raise exception 'NOT_IN_HALL' using errcode = 'P0001';
    end if;
  end loop;
  if (select count(*) from jsonb_array_elements(makers) x where nullif(x->>'member_id', '') is not null)
     <> (select count(distinct lower(x->>'member_id')) from jsonb_array_elements(makers) x where nullif(x->>'member_id', '') is not null) then
    raise exception 'BAD_MAKERS' using errcode = 'P0001';
  end if;

  if xid is null then
    insert into public.archive_exhibits (title, created_by, year)
    values (t, (select p.id from public.profiles p where p.id = me), yr) returning archive_exhibits.id into xid;
  end if;
  update public.archive_exhibits set
    title = t, description = descr, year = yr, season_key = sk, event_name = ev, track = tr,
    award_place = place, award_name = award, award_in_track = coalesce((d->>'award_in_track')::boolean, false) and (place is not null or award is not null),
    award_note = case when place is null and award is null then '' else note end,
    team_name = team, tech = v_tech, project_url = site, github_url = code, video_url = video, cover_path = pic,
    names_ok = coalesce((d->>'names_ok')::boolean, false), published = coalesce((d->>'published')::boolean, false),
    updated_at = now()
   where archive_exhibits.id = xid;
  delete from public.archive_makers where archive_makers.exhibit_id = xid;
  for mk in select x from jsonb_array_elements(makers) x loop
    insert into public.archive_makers (exhibit_id, member_id, name, sort)
    values (xid, nullif(mk->>'member_id', '')::uuid, nullif(trim(coalesce(mk->>'name', '')), ''), n);
    n := n + 1;
  end loop;
  -- The first time it goes on show, the hall hears it; every linked member is credited once.
  if coalesce((d->>'published')::boolean, false) then
    if (select first_published_at from public.archive_exhibits where archive_exhibits.id = xid) is null then
      update public.archive_exhibits set first_published_at = now() where archive_exhibits.id = xid;
      perform public.log_event(null, 'ARCHIVE_ADDED', 'archive', xid::text, jsonb_build_object('title', t), 'public');
    end if;
    perform public.archive_credit(xid);
  end if;
  return xid;
end;
$$;

create or replace function public.admin_delete_archive(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  delete from public.archive_exhibits where id = p_id;
  if not found then raise exception 'NO_SUCH_EXHIBIT' using errcode = 'P0001'; end if;
end;
$$;

-- Confirms a claim (linking the member to an unlinked maker slot, or adding them as a new maker)
-- or declines it with a note the member sees.
create or replace function public.admin_answer_claim(p_id bigint, p_accept boolean, p_maker bigint, p_note text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  cl public.archive_claims;
  a public.archive_exhibits;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  select * into cl from public.archive_claims where id = p_id and status = 'pending' for update;
  if not found then raise exception 'NO_SUCH_CLAIM' using errcode = 'P0001'; end if;
  select * into a from public.archive_exhibits where id = cl.exhibit_id for update;
  if coalesce(char_length(trim(p_note)), 0) > 200 then raise exception 'BAD_NOTE' using errcode = 'P0001'; end if;
  if not coalesce(p_accept, false) then
    update public.archive_claims set status = 'declined', answered_at = now() where id = p_id;
    perform public.log_event(cl.member_id, 'ARCHIVE_CLAIM_DECLINED', 'archive', a.id::text,
      jsonb_build_object('title', a.title, 'note', nullif(trim(coalesce(p_note, '')), '')), 'private');
    return;
  end if;
  if not exists (select 1 from public.published_cards where profile_id = cl.member_id) then
    raise exception 'NOT_IN_HALL' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.archive_makers where exhibit_id = a.id and member_id = cl.member_id) then
    if p_maker is not null then
      update public.archive_makers set member_id = cl.member_id where id = p_maker and exhibit_id = a.id and member_id is null;
      if not found then raise exception 'BAD_MAKER' using errcode = 'P0001'; end if;
    else
      if (select count(*) from public.archive_makers where exhibit_id = a.id) >= 12 then
        raise exception 'BAD_MAKERS' using errcode = 'P0001';
      end if;
      insert into public.archive_makers (exhibit_id, member_id, sort)
      values (a.id, cl.member_id, coalesce((select max(sort) + 1 from public.archive_makers where exhibit_id = a.id), 0));
    end if;
  end if;
  update public.archive_claims set status = 'confirmed', answered_at = now() where id = p_id;
  perform public.archive_credit(a.id);
end;
$$;

-- ---------------------------------------------------------------- function privileges
revoke execute on function public.archive_event_label(text, text, integer), public.archive_credits(),
  public.archive_json(public.archive_exhibits), public.museum_archive(), public.my_archive(), public.claim_archive(uuid, text),
  public.leave_archive(uuid), public.archive_credit(uuid), public.admin_archive(), public.admin_save_archive(uuid, jsonb),
  public.admin_delete_archive(uuid), public.admin_answer_claim(bigint, boolean, bigint, text)
  from public, anon, authenticated;
grant execute on function public.museum_archive() to anon, authenticated;
grant execute on function public.my_archive(), public.claim_archive(uuid, text), public.leave_archive(uuid), public.admin_archive(),
  public.admin_save_archive(uuid, jsonb), public.admin_delete_archive(uuid), public.admin_answer_claim(bigint, boolean, bigint, text)
  to authenticated;
