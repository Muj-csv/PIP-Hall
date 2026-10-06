-- Missions and the hall event layer (docs/plan/V2-LIVING-HALL.md, V2-3; D-099).
--
-- hall_events: an append-only record of things that really happened, written only by triggers and
-- security-definer functions. One event can later feed notifications, activity and Mission
-- progress (V2-4). Visibility: 'public' (already public facts) or 'private' (only the people
-- involved: the actor, or metadata.owner).
--
-- Missions: three a day and one a week (Asia/Manila calendar, like the PIP caps). The app picks
-- them from real hall data; the database never trusts the pick, it checks the CONDITION against
-- the member's own verified discoveries and exhibit visits in the current day or week, caps how
-- many pay (3 a day, 1 a week), and pays 10 (daily) or 40 (weekly) PIPs once per Mission.
-- Guests do Missions on their device for stamps only (D-097). Safe to run again.

-- ---------------------------------------------------------------- events
create table if not exists public.hall_events (
  id           bigint generated always as identity primary key,
  actor_id     uuid references public.profiles (id) on delete cascade,
  event_type   text not null,
  target_type  text,
  target_id    text,
  metadata     jsonb not null default '{}'::jsonb,
  visibility   text not null default 'public',
  created_at   timestamptz not null default now()
);
alter table public.hall_events drop constraint if exists hall_events_event_type_check;
alter table public.hall_events add constraint hall_events_event_type_check check (event_type in (
  'CARD_APPROVED', 'PROJECT_PUBLISHED', 'EXHIBIT_ADDED', 'COLLAB_ACCEPTED', 'ACHIEVEMENT_UNLOCKED',
  'MISSION_COMPLETED', 'MEMBER_FEATURED'));
alter table public.hall_events drop constraint if exists hall_events_visibility_check;
alter table public.hall_events add constraint hall_events_visibility_check check (visibility in ('public', 'private'));
create index if not exists hall_events_created_idx on public.hall_events (created_at desc);
create index if not exists hall_events_actor_idx on public.hall_events (actor_id, created_at desc);

revoke all on public.hall_events from anon, authenticated;
grant select on public.hall_events to authenticated;
alter table public.hall_events enable row level security;
drop policy if exists "own hall events" on public.hall_events;
create policy "own hall events" on public.hall_events
  for select to authenticated
  using (actor_id = (select auth.uid()) or metadata->>'owner' = (select auth.uid())::text);

create or replace function public.log_event(p_actor uuid, p_type text, p_target_type text, p_target_id text, p_meta jsonb, p_visibility text)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.hall_events (actor_id, event_type, target_type, target_id, metadata, visibility)
  values (p_actor, p_type, p_target_type, p_target_id, coalesce(p_meta, '{}'::jsonb), p_visibility);
$$;

-- Approvals (published_at moves), new projects on an approved card, and featuring.
create or replace function public.events_published_card()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  pr jsonb;
begin
  if tg_op = 'INSERT' or new.published_at is distinct from old.published_at then
    perform public.log_event(new.profile_id, 'CARD_APPROVED', 'card', new.username, jsonb_build_object('member_no', new.member_no), 'public');
    for pr in select p from jsonb_array_elements(new.card->'projects') p loop
      if pr->>'id' is not null and (tg_op = 'INSERT' or not exists (
            select 1 from jsonb_array_elements(old.card->'projects') o where o->>'id' = pr->>'id')) then
        perform public.log_event(new.profile_id, 'PROJECT_PUBLISHED', 'project', pr->>'id',
          jsonb_build_object('title', pr->>'title', 'makers', 1 + coalesce(jsonb_array_length(pr->'collaborators'), 0)), 'public');
      end if;
    end loop;
  end if;
  if tg_op = 'UPDATE' and new.is_featured and not old.is_featured then
    perform public.log_event(new.profile_id, 'MEMBER_FEATURED', 'card', new.username, '{}'::jsonb, 'public');
  end if;
  return null;
end;
$$;
drop trigger if exists published_cards_events on public.published_cards;
create trigger published_cards_events after insert or update on public.published_cards
  for each row execute function public.events_published_card();

create or replace function public.events_museum_entry()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.log_event(new.member_id, 'EXHIBIT_ADDED', 'exhibit', new.project_id::text, '{}'::jsonb, 'public');
  return null;
end;
$$;
drop trigger if exists museum_entries_events on public.museum_entries;
create trigger museum_entries_events after insert on public.museum_entries
  for each row execute function public.events_museum_entry();

-- Private: an accepted tag isn't public until the owner's next approval (ADR-002).
create or replace function public.events_collaboration()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    perform public.log_event(new.member_id, 'COLLAB_ACCEPTED', 'project', new.project_id::text,
      jsonb_build_object('owner', (select profile_id from public.projects where id = new.project_id)), 'private');
  end if;
  return null;
end;
$$;
drop trigger if exists project_collaborators_events on public.project_collaborators;
create trigger project_collaborators_events after update on public.project_collaborators
  for each row execute function public.events_collaboration();

create or replace function public.events_achievement()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.log_event(new.member_id, 'ACHIEVEMENT_UNLOCKED', 'achievement', new.key, '{}'::jsonb, 'public');
  return null;
end;
$$;
drop trigger if exists member_achievements_events on public.member_achievements;
create trigger member_achievements_events after insert on public.member_achievements
  for each row execute function public.events_achievement();

-- ---------------------------------------------------------------- PIP rules and ledger reason
create or replace function public.pip_rules()
returns jsonb
language sql immutable set search_path = ''
as $$
  select jsonb_build_object(
    'discover', 5,
    'discover_daily_cap', 100,
    'first_approval', 100,
    'project_live', 25,
    'project_reward_cap', 12,
    'day_zone', 'Asia/Manila',
    'mission_daily', 10,
    'mission_weekly', 40,
    'missions_per_day', 3,
    'missions_per_week', 1
  );
$$;

alter table public.pip_ledger drop constraint if exists pip_ledger_reason_check;
alter table public.pip_ledger add constraint pip_ledger_reason_check
  check (reason in ('first_approval', 'project_live', 'discover', 'achievement', 'purchase', 'mission'));

-- ---------------------------------------------------------------- missions
create table if not exists public.mission_completions (
  member_id     uuid not null references public.profiles (id) on delete cascade,
  key           text not null,
  scope         text not null check (scope in ('daily', 'weekly')),
  period        text not null,
  kind          text not null,
  param         text,
  n             integer not null,
  completed_at  timestamptz not null default now(),
  primary key (member_id, key)
);
revoke all on public.mission_completions from anon, authenticated;
grant select on public.mission_completions to authenticated;
alter table public.mission_completions enable row level security;
drop policy if exists "own mission completions" on public.mission_completions;
create policy "own mission completions" on public.mission_completions
  for select to authenticated using (member_id = (select auth.uid()));

-- Start of the current day / week, and their labels, in the hall's time zone.
create or replace function public.mission_period(p_scope text)
returns table (starts timestamptz, label text)
language sql stable set search_path = ''
as $$
  select (date_trunc(case when p_scope = 'weekly' then 'week' else 'day' end, now() at time zone 'Asia/Manila') at time zone 'Asia/Manila'),
         case when p_scope = 'weekly' then to_char(now() at time zone 'Asia/Manila', 'IYYY-"W"IW')
              else to_char(now() at time zone 'Asia/Manila', 'YYYY-MM-DD') end;
$$;

-- Does the member's own verified activity since `p_since` meet this Mission?
create or replace function public.mission_met(p_member uuid, p_kind text, p_param text, p_n integer, p_since timestamptz)
returns boolean
language sql stable security definer set search_path = ''
as $$
  with met as (
    select c.* from public.discoveries d
      join public.published_cards c on c.profile_id = d.card_id
     where d.member_id = p_member and d.source = 'verified' and d.created_at >= p_since
  )
  select case p_kind
    when 'people' then (select count(*) from met) >= p_n
    when 'exhibits' then (select count(*) from public.passport_visits v
                           where v.member_id = p_member and v.source = 'verified' and v.visited_at >= p_since) >= p_n
    when 'skill' then exists (select 1 from met, jsonb_array_elements_text(met.card->'skills') s
                               where lower(trim(s)) = lower(trim(p_param)))
    when 'department' then exists (select 1 from met where lower(trim(met.card->>'department')) = lower(trim(p_param)))
    when 'tech' then exists (select 1 from met, jsonb_array_elements(met.card->'projects') p
                              where lower(trim(p->>'language')) = lower(trim(p_param))
                                 or exists (select 1 from jsonb_array_elements_text(p->'tech_stack') t where lower(trim(t)) = lower(trim(p_param))))
    when 'team' then exists (select 1 from met where
                               exists (select 1 from jsonb_array_elements(met.card->'projects') p where jsonb_array_length(coalesce(p->'collaborators', '[]'::jsonb)) > 0)
                               or exists (select 1 from public.published_cards o, jsonb_array_elements(o.card->'projects') p, jsonb_array_elements(coalesce(p->'collaborators', '[]'::jsonb)) m
                                          where m->>'username' = met.username))
    when 'departments' then (select count(distinct lower(trim(met.card->>'department'))) from met where coalesce(trim(met.card->>'department'), '') <> '') >= p_n
    else false
  end;
$$;

-- {eligible, day, week, done: [{key, scope, kind, param, n}]} for the current day and week.
create or replace function public.my_missions()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'eligible', exists (select 1 from public.published_cards where profile_id = (select auth.uid())),
    'day', (select label from public.mission_period('daily')),
    'week', (select label from public.mission_period('weekly')),
    'done', coalesce((
      select jsonb_agg(jsonb_build_object('key', m.key, 'scope', m.scope, 'kind', m.kind, 'param', m.param, 'n', m.n) order by m.completed_at)
        from public.mission_completions m
       where m.member_id = (select auth.uid())
         and m.period in ((select label from public.mission_period('daily')), (select label from public.mission_period('weekly')))), '[]'::jsonb)
  );
$$;

-- Claims a Mission. Checks the condition, the per-day/week cap and the minimum size, then pays.
create or replace function public.complete_mission(p_scope text, p_kind text, p_param text, p_n integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  r jsonb := public.pip_rules();
  v_since timestamptz;
  v_label text;
  n integer := coalesce(p_n, 1);
  param text := nullif(trim(coalesce(p_param, '')), '');
  k text;
  reward integer;
begin
  if me is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  if not exists (select 1 from public.published_cards where profile_id = me) then
    raise exception 'NOT_ELIGIBLE' using errcode = 'P0001';
  end if;
  -- What a Mission may ask for (the app's catalogue, src/lib/missions.ts).
  if not (
       (p_scope = 'daily' and p_kind in ('skill', 'department', 'tech', 'team') and n = 1)
    or (p_scope = 'daily' and p_kind = 'people' and n >= 3)
    or (p_scope = 'daily' and p_kind = 'exhibits' and n >= 2)
    or (p_scope = 'weekly' and p_kind = 'people' and n >= 8)
    or (p_scope = 'weekly' and p_kind = 'exhibits' and n >= 5)
    or (p_scope = 'weekly' and p_kind = 'departments' and n >= 3)
  ) or (p_kind in ('skill', 'department', 'tech') and (param is null or length(param) > 40)) then
    raise exception 'BAD_MISSION' using errcode = 'P0001';
  end if;
  if p_kind not in ('skill', 'department', 'tech') then param := null; end if;

  select mp.starts, mp.label into v_since, v_label from public.mission_period(p_scope) mp;
  k := p_scope || ':' || v_label || ':' || p_kind || ':' || coalesce(lower(param), '') || ':' || n;
  -- One claim at a time per member, so the caps can't be raced.
  perform 1 from public.profiles where id = me for update;
  if exists (select 1 from public.mission_completions where member_id = me and key = k) then
    raise exception 'ALREADY_DONE' using errcode = 'P0001';
  end if;
  if (select count(*) from public.mission_completions where member_id = me and scope = p_scope and period = v_label)
     >= (r->>(case when p_scope = 'weekly' then 'missions_per_week' else 'missions_per_day' end))::int then
    raise exception 'MISSION_LIMIT' using errcode = 'P0001';
  end if;
  if not public.mission_met(me, p_kind, param, n, v_since) then
    raise exception 'NOT_DONE' using errcode = 'P0001';
  end if;

  insert into public.mission_completions (member_id, key, scope, period, kind, param, n) values (me, k, p_scope, v_label, p_kind, param, n);
  reward := (r->>(case when p_scope = 'weekly' then 'mission_weekly' else 'mission_daily' end))::int;
  perform public.grant_pips(me, reward, 'mission', 'mission:' || k);
  perform public.log_event(me, 'MISSION_COMPLETED', 'mission', k, jsonb_build_object('scope', p_scope, 'kind', p_kind, 'param', param, 'n', n, 'pips', reward), 'private');
  return jsonb_build_object('key', k, 'amount', reward, 'balance', (public.my_pips()->>'balance')::int);
end;
$$;

-- ---------------------------------------------------------------- function privileges
revoke execute on function public.log_event(uuid, text, text, text, jsonb, text), public.events_published_card(),
  public.events_museum_entry(), public.events_collaboration(), public.events_achievement(),
  public.mission_period(text), public.mission_met(uuid, text, text, integer, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.my_missions(), public.complete_mission(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.my_missions(), public.complete_mission(text, text, text, integer) to authenticated;
