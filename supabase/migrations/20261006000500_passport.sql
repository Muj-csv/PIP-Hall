-- Passport (docs/plan/V2-LIVING-HALL.md, V2-2; D-097, D-098).
-- An approved member's Passport = the members they discovered (discoveries) + the Museum exhibits
-- they visited (passport_visits). A guest's Passport lives on their device; once their card is
-- approved they may import it as HISTORY: imported stamps never pay PIPs, never count toward
-- achievements, and a person already stamped doesn't pay a discovery later. Safe to run again.

-- ---------------------------------------------------------------- where a stamp came from
alter table public.discoveries add column if not exists source text not null default 'verified';
alter table public.discoveries drop constraint if exists discoveries_source_check;
alter table public.discoveries add constraint discoveries_source_check check (source in ('verified', 'imported'));

-- ---------------------------------------------------------------- exhibits visited
create table if not exists public.passport_visits (
  member_id   uuid not null references public.profiles (id) on delete cascade,
  project_id  uuid not null,
  visited_at  timestamptz not null default now(),
  source      text not null default 'verified' check (source in ('verified', 'imported')),
  primary key (member_id, project_id)
);
revoke all on public.passport_visits from anon, authenticated;
grant select on public.passport_visits to authenticated;
alter table public.passport_visits enable row level security;
drop policy if exists "own passport visits" on public.passport_visits;
create policy "own passport visits" on public.passport_visits
  for select to authenticated using (member_id = (select auth.uid()));

-- ---------------------------------------------------------------- achievements count only verified discoveries
create or replace function public.check_achievements(p_member uuid)
returns text[]
language plpgsql security definer set search_path = ''
as $$
declare
  projects_live integer;
  discovered integer;
  a record;
  ok boolean;
  unlocked text[] := '{}';
begin
  select count(*) into projects_live from public.pip_ledger where member_id = p_member and reason = 'project_live';
  select count(*) into discovered from public.discoveries where member_id = p_member and source = 'verified';
  for a in select * from public.achievements order by sort loop
    ok := case a.key
      when 'first_card'    then exists (select 1 from public.pip_ledger where member_id = p_member and ref = 'first_approval')
      when 'first_project' then projects_live >= 1
      when 'builder'       then projects_live >= 5
      when 'explorer'      then discovered >= 10
      when 'hall_walker'   then discovered >= 50
      else false
    end;
    if ok then
      insert into public.member_achievements (member_id, key) values (p_member, a.key) on conflict do nothing;
      if found then
        perform public.grant_pips(p_member, a.reward, 'achievement', 'achievement:' || a.key);
        unlocked := unlocked || a.key;
      end if;
    end if;
  end loop;
  return unlocked;
end;
$$;

-- ---------------------------------------------------------------- client functions
-- {eligible, people: [{id, at, imported}], exhibits: [{id, at, imported}]} for the signed-in member.
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
        from public.passport_visits v where v.member_id = (select auth.uid())), '[]'::jsonb)
  );
$$;

-- The signed-in member opened an exhibit's page. Stamps it once; no PIPs. True if new.
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
                  where e.project_id = p_project and e.member_id <> me and public.has_museum_access(e.member_id)) then
    return false;
  end if;
  insert into public.passport_visits (member_id, project_id) values (me, p_project) on conflict do nothing;
  return found;
end;
$$;

-- Graduation: a device Passport becomes history. p_people / p_exhibits = [{id, at}], at most 1000
-- each. Unknown ids, yourself, and exhibits not on show are skipped; dates are clamped to
-- [1 Oct 2026, now]. No PIPs, no achievements. Returns how many stamps were added.
create or replace function public.import_passport(p_people jsonb, p_exhibits jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  n_people integer := 0;
  n_exhibits integer := 0;
begin
  if me is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  if not exists (select 1 from public.published_cards where profile_id = me) then
    raise exception 'NOT_ELIGIBLE' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(p_people, 'null')) <> 'array' or jsonb_typeof(coalesce(p_exhibits, 'null')) <> 'array'
     or jsonb_array_length(p_people) > 1000 or jsonb_array_length(p_exhibits) > 1000 then
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

  return jsonb_build_object('people', n_people, 'exhibits', n_exhibits);
end;
$$;

-- ---------------------------------------------------------------- function privileges
revoke execute on function public.check_achievements(uuid) from public, anon, authenticated;
revoke execute on function public.my_passport(), public.stamp_exhibit(uuid), public.import_passport(jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.my_passport(), public.stamp_exhibit(uuid), public.import_passport(jsonb, jsonb)
  to authenticated;
