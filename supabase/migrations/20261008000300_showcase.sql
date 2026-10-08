-- The showcase (docs/plan/V2-NEXT.md, V2-12; D-109, D-120, D-127).
--
-- CHECK-INS: at an event, the kiosk shows a QR that gives scanners a Passport stamp, "Visited the
-- showcase at <event>". Guests keep it on their device; members with a card in the hall keep it in
-- their account: one per member per event, no PIPs, and counted in the live event's numbers. The QR
-- carries the event's check-in code, which admins make (and can renew, so a forwarded old link
-- stops working); a check-in only counts while the event is on. A device stamp brought into an
-- account later is history: kept, never counted, until the member checks in with their account
-- while the event is still on. Safe to run again.

-- ---------------------------------------------------------------- the code on the kiosk's QR
alter table public.hall_seasons add column if not exists checkin_code text;
alter table public.hall_seasons drop constraint if exists hall_seasons_checkin_code_check;
alter table public.hall_seasons add constraint hall_seasons_checkin_code_check check (checkin_code is null or checkin_code ~ '^[a-z0-9]{8,24}$');

-- ---------------------------------------------------------------- check-ins
create table if not exists public.event_checkins (
  member_id   uuid not null references public.profiles (id) on delete cascade,
  season_key  text not null references public.hall_seasons (key) on delete cascade,
  checked_at  timestamptz not null default now(),
  source      text not null default 'verified' check (source in ('verified', 'imported')),
  primary key (member_id, season_key)
);
revoke all on public.event_checkins from anon, authenticated;
grant select on public.event_checkins to authenticated;
alter table public.event_checkins enable row level security;
drop policy if exists "own check-ins" on public.event_checkins;
create policy "own check-ins" on public.event_checkins
  for select to authenticated using (member_id = (select auth.uid()));

-- ---------------------------------------------------------------- public
-- {key, name, live, ok} for a scanned check-in link: `ok` when the event is on and the code is its
-- current one. Null when there is no such event. The code itself is never returned.
create or replace function public.checkin_event(p_key text, p_code text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'key', s.key,
    'name', s.name,
    'live', public.season_window(s.starts_on, s.ends_on) @> now(),
    'ok', public.season_window(s.starts_on, s.ends_on) @> now() and s.checkin_code is not null and s.checkin_code = lower(trim(coalesce(p_code, ''))))
    from public.hall_seasons s
   where s.key = p_key;
$$;

-- A member checks in at the showcase. True if new (or if it turns an imported stamp into a counted
-- one); false when they're not in the hall yet (their device keeps the stamp instead) or already
-- checked in. No PIPs.
create or replace function public.check_in(p_key text, p_code text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  s public.hall_seasons;
begin
  if me is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  select * into s from public.hall_seasons where key = p_key;
  if not found then raise exception 'NO_SUCH_EVENT' using errcode = 'P0001'; end if;
  if not public.season_window(s.starts_on, s.ends_on) @> now() then raise exception 'NOT_LIVE' using errcode = 'P0001'; end if;
  if s.checkin_code is null or s.checkin_code <> lower(trim(coalesce(p_code, ''))) then raise exception 'BAD_CODE' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.published_cards where profile_id = me) then return false; end if;
  insert into public.event_checkins (member_id, season_key) values (me, s.key)
  on conflict (member_id, season_key) do update set source = 'verified', checked_at = now()
    where public.event_checkins.source = 'imported';
  return found;
end;
$$;

-- As in V2-2, plus the showcases checked into: {eligible, people, exhibits, checkins: [{id, name, at, imported}]}.
create or replace function public.my_passport()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'eligible', exists (select 1 from public.published_cards where profile_id = (select auth.uid())),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.card_id, 'at', d.created_at, 'imported', d.source = 'imported') order by d.created_at)
        from public.discoveries d where d.member_id = (select auth.uid())), '[]'::jsonb),
    'exhibits', coalesce((
      select jsonb_agg(jsonb_build_object('id', v.project_id, 'at', v.visited_at, 'imported', v.source = 'imported') order by v.visited_at)
        from public.passport_visits v where v.member_id = (select auth.uid())), '[]'::jsonb),
    'checkins', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.season_key, 'name', s.name, 'at', c.checked_at, 'imported', c.source = 'imported') order by c.checked_at)
        from public.event_checkins c join public.hall_seasons s on s.key = c.season_key
       where c.member_id = (select auth.uid())), '[]'::jsonb)
  );
$$;

-- Graduation, as in V2-2, plus the device's showcase stamps: each one an event with a check-in QR
-- that was on at the stamp's date, at most 50. Imported check-ins are history: kept, never counted.
drop function if exists public.import_passport(jsonb, jsonb);
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
    select distinct on (e.project_id) e.project_id,
           least(now(), greatest(timestamptz '2026-10-01', case when i.at ~ '^\d{4}-\d{2}-\d{2}T[0-9:.]+(Z|[+-]\d{2}:?\d{2})?$' then i.at::timestamptz else now() end)) as at
      from items i
      join public.museum_entries e on e.project_id::text = lower(i.id)
     where i.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and e.member_id <> me
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

-- As in V2-9, plus the members who checked in at a live event's showcase (verified only).
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
        'submissions', (select count(*) from public.event_submissions es where es.season_key = s.key),
        'checkins', (select count(*) from public.event_checkins c where c.season_key = s.key and c.source = 'verified'))
        from public.hall_events e
       where e.visibility = 'public' and e.created_at <@ public.season_window(s.starts_on, s.ends_on)) end);
$$;

-- ---------------------------------------------------------------- admin
-- The event's check-in code for the kiosk's link: made the first time it's asked for, or made anew
-- (`p_renew`) so links handed out before stop working.
create or replace function public.admin_checkin_code(p_key text, p_renew boolean default false)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  code text;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  select checkin_code into code from public.hall_seasons where key = p_key;
  if not found then raise exception 'NO_SUCH_EVENT' using errcode = 'P0001'; end if;
  if code is null or coalesce(p_renew, false) then
    code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
    update public.hall_seasons set checkin_code = code where key = p_key;
  end if;
  return code;
end;
$$;

-- ---------------------------------------------------------------- function privileges
revoke execute on function public.checkin_event(text, text), public.check_in(text, text), public.my_passport(),
  public.import_passport(jsonb, jsonb, jsonb), public.admin_checkin_code(text, boolean)
  from public, anon, authenticated;
grant execute on function public.checkin_event(text, text) to anon, authenticated;
grant execute on function public.check_in(text, text), public.my_passport(), public.import_passport(jsonb, jsonb, jsonb),
  public.admin_checkin_code(text, boolean) to authenticated;
