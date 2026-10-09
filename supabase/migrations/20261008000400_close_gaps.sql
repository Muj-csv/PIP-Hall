-- Close the gaps (docs/plan/V2-NEXT.md, V2-13; D-111, D-112, D-128).
--
-- MENTOR (D-111): a title for members credited on team projects with 2 different members who
-- joined the hall after them (a higher member number): bringing newcomers into real work.
-- MISSIONS: three more, offered by the app only when the hall can really complete them:
--   daily  'crew'   n>=3  find a project made by 3 or more people (meet one of its makers, or open its exhibit)
--   daily  'winner' n=1   visit an exhibit that won a place or an award
--   weekly 'skill'  n>=3  meet 3 people who know <skill> (a daily 'skill' is still n=1)
-- PROGRESS (D-112): my_progress() gives a member their own Missions completed; nobody else's.
-- Safe to run again.

-- ---------------------------------------------------------------- titles: Mentor (D-111)
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
    {"key": "champion",    "name": "Champion",    "rule": "Made a project that won a place or an award at an event."},
    {"key": "mentor",      "name": "Mentor",      "rule": "Built team projects with 2 members who joined the hall after you."}
  ]'::jsonb;
$$;

-- As in V2-10, plus Mentor: the makers of my team projects (owner and credited collaborators still
-- in the hall) who joined after me, counted once each.
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

-- ---------------------------------------------------------------- Missions
-- As in V2-3, plus 'crew' and 'winner', and 'skill' counts people (n of them know the skill).
create or replace function public.mission_met(p_member uuid, p_kind text, p_param text, p_n integer, p_since timestamptz)
returns boolean
language sql stable security definer set search_path = ''
as $$
  with met as (
    select c.* from public.discoveries d
      join public.published_cards c on c.profile_id = d.card_id
     where d.member_id = p_member and d.source = 'verified' and d.created_at >= p_since
  ), visited as (
    select v.project_id from public.passport_visits v
     where v.member_id = p_member and v.source = 'verified' and v.visited_at >= p_since
  ), crews as (
    -- Every project in the hall with its makers still in the hall (owner first, then credited collaborators).
    select o.profile_id as owner, p->>'id' as project_id,
           array(select o.username union select m.username
                   from jsonb_array_elements(coalesce(p->'collaborators', '[]'::jsonb)) col
                   join public.published_cards m on m.username = col->>'username') as makers
      from public.published_cards o, jsonb_array_elements(o.card->'projects') p
  )
  select case p_kind
    when 'people' then (select count(*) from met) >= p_n
    when 'exhibits' then (select count(*) from visited) >= p_n
    when 'skill' then (select count(distinct met.profile_id) from met, jsonb_array_elements_text(met.card->'skills') s
                        where lower(trim(s)) = lower(trim(p_param))) >= coalesce(p_n, 1)
    when 'department' then exists (select 1 from met where lower(trim(met.card->>'department')) = lower(trim(p_param)))
    when 'tech' then exists (select 1 from met, jsonb_array_elements(met.card->'projects') p
                              where lower(trim(p->>'language')) = lower(trim(p_param))
                                 or exists (select 1 from jsonb_array_elements_text(p->'tech_stack') t where lower(trim(t)) = lower(trim(p_param))))
    when 'team' then exists (select 1 from met where
                               exists (select 1 from jsonb_array_elements(met.card->'projects') p where jsonb_array_length(coalesce(p->'collaborators', '[]'::jsonb)) > 0)
                               or exists (select 1 from public.published_cards o, jsonb_array_elements(o.card->'projects') p, jsonb_array_elements(coalesce(p->'collaborators', '[]'::jsonb)) m
                                          where m->>'username' = met.username))
    when 'departments' then (select count(distinct lower(trim(met.card->>'department'))) from met where coalesce(trim(met.card->>'department'), '') <> '') >= p_n
    when 'crew' then exists (select 1 from crews k
                              where cardinality(k.makers) >= coalesce(p_n, 3)
                                and (exists (select 1 from met where met.username = any (k.makers))
                                     or exists (select 1 from visited v where v.project_id::text = k.project_id)))
    when 'winner' then exists (select 1 from visited v
                                where exists (select 1 from public.event_awards a join public.hall_seasons s on s.key = a.season_key
                                               where a.project_id = v.project_id and s.announced_at is not null)
                                   or exists (select 1 from public.archive_exhibits x
                                               where x.id = v.project_id and x.published and (x.award_place is not null or x.award_name is not null)))
    else false
  end;
$$;

-- As in V2-3, with the three new Missions in the catalogue (src/lib/missions.ts).
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
       (p_scope = 'daily' and p_kind in ('skill', 'department', 'tech', 'team', 'winner') and n = 1)
    or (p_scope = 'daily' and p_kind = 'people' and n >= 3)
    or (p_scope = 'daily' and p_kind = 'exhibits' and n >= 2)
    or (p_scope = 'daily' and p_kind = 'crew' and n between 3 and 12)
    or (p_scope = 'weekly' and p_kind = 'people' and n >= 8)
    or (p_scope = 'weekly' and p_kind = 'exhibits' and n >= 5)
    or (p_scope = 'weekly' and p_kind = 'departments' and n >= 3)
    or (p_scope = 'weekly' and p_kind = 'skill' and n between 3 and 10)
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

-- ---------------------------------------------------------------- your progress (D-112)
-- The signed-in member's Missions completed, by kind of Mission, and in all. Only their own:
-- the public profile keeps proof, never activity counts (rule 5).
create or replace function public.my_progress()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'eligible', exists (select 1 from public.published_cards where profile_id = (select auth.uid())),
    'missions', jsonb_build_object(
      'daily', count(*) filter (where m.scope = 'daily'),
      'weekly', count(*) filter (where m.scope = 'weekly'),
      'season', count(*) filter (where m.scope = 'season'),
      'total', count(m.key)))
    from (select 1) one
    left join public.mission_completions m on m.member_id = (select auth.uid());
$$;

-- ---------------------------------------------------------------- function privileges
revoke execute on function public.mission_met(uuid, text, text, integer, timestamptz) from public, anon, authenticated;
revoke execute on function public.complete_mission(text, text, text, integer), public.my_progress() from public, anon, authenticated;
grant execute on function public.complete_mission(text, text, text, integer), public.my_progress() to authenticated;
