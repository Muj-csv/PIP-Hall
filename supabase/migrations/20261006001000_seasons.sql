-- Seasons and events (docs/plan/V2-LIVING-HALL.md, V2-7; D-103).
--
-- An admin schedules an EVENT (e.g. Build Week): a name, a short blurb for the banner, a date range
-- on the hall's calendar (Asia/Manila), and optionally
--   * an EVENT MISSION: one Mission for the whole event, checked by the database against the
--     member's own verified activity since the event began, paid once (5–200 PIPs);
--   * a LIMITED FRAME: an existing PIP MART frame that can only be bought while the event is on.
-- Events never overlap, so the hall has at most one live event. Event counters are real numbers
-- read from public hall_events inside the event's dates; nothing is invented (rule 7). Nothing is
-- seeded: the first event is the curators' to schedule. Safe to run again.

create table if not exists public.hall_seasons (
  key             text primary key check (key ~ '^[a-z0-9][a-z0-9-]{1,23}$'),
  name            text not null check (char_length(name) between 2 and 40),
  blurb           text not null default '' check (char_length(blurb) <= 200),
  starts_on       date not null,
  ends_on         date not null,
  mission_kind    text,
  mission_param   text,
  mission_n       integer,
  mission_reward  integer,
  frame_key       text references public.mart_items (key) on delete set null,
  updated_at      timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 30)
);
revoke all on public.hall_seasons from anon, authenticated;
alter table public.hall_seasons enable row level security;

-- An event's dates as a time range: from midnight Manila on the first day to midnight after the last.
create or replace function public.season_window(p_starts date, p_ends date)
returns tstzrange
language sql immutable set search_path = ''
as $$
  select tstzrange(p_starts::timestamp at time zone 'Asia/Manila', (p_ends + 1)::timestamp at time zone 'Asia/Manila', '[)');
$$;

-- Event Missions complete into mission_completions with scope 'season'.
alter table public.mission_completions drop constraint if exists mission_completions_scope_check;
alter table public.mission_completions add constraint mission_completions_scope_check check (scope in ('daily', 'weekly', 'season'));

-- One event as the app sees it. Counts only for a live event.
create or replace function public.season_json(s public.hall_seasons, p_counts boolean)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'key', s.key, 'name', s.name, 'blurb', s.blurb, 'starts_on', s.starts_on, 'ends_on', s.ends_on,
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
        'teamups', count(*) filter (where e.event_type = 'COLLAB_PUBLISHED'))
        from public.hall_events e
       where e.visibility = 'public' and e.created_at <@ public.season_window(s.starts_on, s.ends_on)) end);
$$;

-- ---------------------------------------------------------------- public
-- {live: event | null, next: event | null}. `next` is the nearest event starting within 30 days.
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
              order by s.starts_on limit 1));
$$;

-- ---------------------------------------------------------------- members: the event Mission
-- {eligible, done} for the live event.
create or replace function public.my_season()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'eligible', exists (select 1 from public.published_cards where profile_id = (select auth.uid())),
    'done', exists (select 1 from public.mission_completions m, public.hall_seasons s
                     where m.member_id = (select auth.uid()) and m.key = 'season:' || s.key
                       and public.season_window(s.starts_on, s.ends_on) @> now()));
$$;

-- Claims the live event's Mission. The database reads the Mission from the event itself, checks
-- it against the member's own verified activity since the event began, and pays once.
create or replace function public.complete_season_mission()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  s public.hall_seasons;
  k text;
begin
  if me is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  if not exists (select 1 from public.published_cards where profile_id = me) then
    raise exception 'NOT_ELIGIBLE' using errcode = 'P0001';
  end if;
  select * into s from public.hall_seasons where public.season_window(starts_on, ends_on) @> now() limit 1;
  if not found or s.mission_kind is null then raise exception 'NO_EVENT_MISSION' using errcode = 'P0001'; end if;
  k := 'season:' || s.key;
  perform 1 from public.profiles where id = me for update;
  if exists (select 1 from public.mission_completions where member_id = me and key = k) then
    raise exception 'ALREADY_DONE' using errcode = 'P0001';
  end if;
  if not public.mission_met(me, s.mission_kind, s.mission_param, s.mission_n, lower(public.season_window(s.starts_on, s.ends_on))) then
    raise exception 'NOT_DONE' using errcode = 'P0001';
  end if;
  insert into public.mission_completions (member_id, key, scope, period, kind, param, n)
  values (me, k, 'season', s.key, s.mission_kind, s.mission_param, s.mission_n);
  perform public.grant_pips(me, s.mission_reward, 'mission', 'mission:' || k);
  perform public.log_event(me, 'MISSION_COMPLETED', 'mission', k,
    jsonb_build_object('scope', 'season', 'kind', s.mission_kind, 'param', s.mission_param, 'n', s.mission_n, 'pips', s.mission_reward), 'private');
  return jsonb_build_object('key', k, 'amount', s.mission_reward, 'balance', (public.my_pips()->>'balance')::int);
end;
$$;

-- ---------------------------------------------------------------- the limited frame
-- A frame that belongs to an event is for sale only while that event is on (owners keep it).
create or replace function public.frame_in_season(p_key text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select not exists (select 1 from public.hall_seasons s where s.frame_key = p_key)
      or exists (select 1 from public.hall_seasons s where s.frame_key = p_key and public.season_window(s.starts_on, s.ends_on) @> now());
$$;

-- As in D-101, plus: event frames show only while their event is on, with `limited_until`.
create or replace function public.my_mart()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'eligible', exists (select 1 from public.published_cards where profile_id = (select auth.uid())),
    'balance', coalesce((select sum(amount) from public.pip_ledger where member_id = (select auth.uid())), 0),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', m.key, 'kind', m.kind, 'name', m.name, 'description', m.description, 'price', m.price,
               'for_sale', m.for_sale, 'style', m.style,
               'limited_until', (select s.ends_on from public.hall_seasons s
                                  where s.frame_key = m.key and public.season_window(s.starts_on, s.ends_on) @> now() limit 1),
               'owned', exists (select 1 from public.inventory i where i.member_id = (select auth.uid()) and i.item_key = m.key))
             order by m.sort, m.name)
        from public.mart_items m
       where (m.active and m.for_sale and public.frame_in_season(m.key))
          or exists (select 1 from public.inventory i where i.member_id = (select auth.uid()) and i.item_key = m.key)), '[]'::jsonb),
    'perks', coalesce((
      select jsonb_agg(jsonb_build_object('key', af.key, 'name', af.name, 'label', public.perk_label(af.name)) order by af.sort)
        from public.member_affiliations ma
        join public.affiliations af on af.key = ma.key
       where ma.member_id = (select auth.uid()) and af.frame_key = 'member'), '[]'::jsonb),
    'equipped', coalesce((
      select jsonb_build_object('frame', a.frame, 'affiliation', a.frame_affiliation, 'title', a.title, 'plate', a.plate)
        from public.card_appearance a where a.member_id = (select auth.uid())),
      jsonb_build_object('frame', null, 'affiliation', null, 'title', null, 'plate', null))
  );
$$;

-- As in D-087, plus: an event frame can't be bought outside its event.
create or replace function public.buy_item(p_key text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  item public.mart_items;
  bal integer;
begin
  if me is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  if not exists (select 1 from public.published_cards where profile_id = me) then
    raise exception 'NOT_ELIGIBLE' using errcode = 'P0001';
  end if;
  select * into item from public.mart_items where key = p_key and active and for_sale;
  if not found then raise exception 'NO_SUCH_ITEM' using errcode = 'P0001'; end if;
  if not public.frame_in_season(p_key) then raise exception 'NOT_IN_SEASON' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext('pips:' || me::text));
  if exists (select 1 from public.inventory where member_id = me and item_key = p_key) then
    raise exception 'ALREADY_OWNED' using errcode = 'P0001';
  end if;
  select coalesce(sum(amount), 0) into bal from public.pip_ledger where member_id = me;
  if bal < item.price then raise exception 'NOT_ENOUGH_PIPS' using errcode = 'P0001'; end if;
  insert into public.pip_ledger (member_id, amount, reason, ref) values (me, -item.price, 'purchase', 'buy:' || p_key);
  insert into public.inventory (member_id, item_key) values (me, p_key);
  return jsonb_build_object('balance', bal - item.price);
end;
$$;

-- ---------------------------------------------------------------- admin
create or replace function public.admin_seasons()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(public.season_json(s, false) || jsonb_build_object(
           'state', case when public.season_window(s.starts_on, s.ends_on) @> now() then 'live'
                         when lower(public.season_window(s.starts_on, s.ends_on)) > now() then 'upcoming' else 'over' end)
           order by s.starts_on desc) from public.hall_seasons s), '[]'::jsonb);
end;
$$;

-- Schedules an event or changes one. p_kind null means no event Mission.
create or replace function public.admin_save_season(p_key text, p_name text, p_blurb text, p_starts date, p_ends date,
  p_kind text, p_param text, p_n integer, p_reward integer, p_frame text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  param text := nullif(trim(coalesce(p_param, '')), '');
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
  insert into public.hall_seasons (key, name, blurb, starts_on, ends_on, mission_kind, mission_param, mission_n, mission_reward, frame_key, updated_at)
  values (p_key, trim(p_name), coalesce(trim(p_blurb), ''), p_starts, p_ends, p_kind,
          case when p_kind in ('skill', 'department', 'tech') then param end,
          case when p_kind is null then null else coalesce(p_n, 1) end,
          case when p_kind is null then null else p_reward end, p_frame, now())
  on conflict (key) do update
    set name = excluded.name, blurb = excluded.blurb, starts_on = excluded.starts_on, ends_on = excluded.ends_on,
        mission_kind = excluded.mission_kind, mission_param = excluded.mission_param, mission_n = excluded.mission_n,
        mission_reward = excluded.mission_reward, frame_key = excluded.frame_key, updated_at = now();
end;
$$;

-- Removes an event that hasn't started. One that has happened stays, as part of the hall's record.
create or replace function public.admin_delete_season(p_key text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  if exists (select 1 from public.hall_seasons s where s.key = p_key and lower(public.season_window(s.starts_on, s.ends_on)) <= now()) then
    raise exception 'ALREADY_STARTED' using errcode = 'P0001';
  end if;
  delete from public.hall_seasons where key = p_key;
  if not found then raise exception 'NO_SUCH_EVENT' using errcode = 'P0001'; end if;
end;
$$;

-- ---------------------------------------------------------------- function privileges
revoke execute on function public.season_window(date, date), public.season_json(public.hall_seasons, boolean),
  public.current_season(), public.my_season(), public.complete_season_mission(), public.frame_in_season(text),
  public.admin_seasons(), public.admin_save_season(text, text, text, date, date, text, text, integer, integer, text),
  public.admin_delete_season(text)
  from public, anon, authenticated;
grant execute on function public.current_season() to anon, authenticated;
grant execute on function public.my_season(), public.complete_season_mission(), public.admin_seasons(),
  public.admin_save_season(text, text, text, date, date, text, text, integer, integer, text), public.admin_delete_season(text)
  to authenticated;
