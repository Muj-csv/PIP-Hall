-- PIP Progression E1 — PIPs core (docs/plan/PIP-PROGRESSION-E1.md, D-058…D-065).
-- Members with a published card earn PIPs for discovering other members and for getting their
-- card and projects approved, and unlock achievements. Only the functions below grant PIPs; the
-- browser can read its own ledger and nothing else.

-- ---------------------------------------------------------------- tables
create table public.pip_ledger (
  id          bigint generated always as identity primary key,
  member_id   uuid not null references public.profiles (id) on delete cascade,
  amount      integer not null check (amount <> 0),
  reason      text not null check (reason in ('first_approval', 'project_live', 'discover', 'achievement')),
  ref         text not null,               -- one grant per member per ref (BR-E1-04)
  created_at  timestamptz not null default now(),
  unique (member_id, ref)
);
create index pip_ledger_member_idx on public.pip_ledger (member_id, created_at desc);

create table public.discoveries (
  member_id   uuid not null references public.profiles (id) on delete cascade,
  card_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (member_id, card_id),
  check (member_id <> card_id)
);

create table public.achievements (
  key          text primary key,
  name         text not null,
  description  text not null,
  reward       integer not null check (reward > 0),
  sort         integer not null
);

create table public.member_achievements (
  member_id    uuid not null references public.profiles (id) on delete cascade,
  key          text not null references public.achievements (key),
  unlocked_at  timestamptz not null default now(),
  primary key (member_id, key)
);

insert into public.achievements (key, name, description, reward, sort) values
  ('first_card',    'Card Holder',  'Your card was approved for the first time.', 50,  1),
  ('first_project', 'First Quest',  'Your first project went live.',              50,  2),
  ('builder',       'Builder',      '5 of your projects went live.',              150, 3),
  ('explorer',      'Explorer',     'You discovered 10 members.',                 100, 4),
  ('hall_walker',   'Hall Walker',  'You discovered 50 members.',                 200, 5);

-- ---------------------------------------------------------------- privileges and RLS
-- Supabase grants new tables to the API roles by default; start from nothing.
revoke all on public.pip_ledger, public.discoveries, public.achievements, public.member_achievements
  from anon, authenticated;

grant select on public.pip_ledger, public.discoveries to authenticated;
grant select on public.achievements, public.member_achievements to anon, authenticated;

alter table public.pip_ledger          enable row level security;
alter table public.discoveries         enable row level security;
alter table public.achievements        enable row level security;
alter table public.member_achievements enable row level security;

-- The balance and whom you discovered are yours alone (D-063).
create policy "own ledger" on public.pip_ledger
  for select to authenticated using (member_id = (select auth.uid()));
create policy "own discoveries" on public.discoveries
  for select to authenticated using (member_id = (select auth.uid()));
create policy "achievement list is public" on public.achievements
  for select to anon, authenticated using (true);
-- Achievements are public for members in the hall (D-063).
create policy "achievements of members in the hall" on public.member_achievements
  for select to anon, authenticated
  using (exists (select 1 from public.published_cards c where c.profile_id = member_id));

-- ---------------------------------------------------------------- rules (BR-E1-03, BR-E1-05, BR-E1-07)
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
    'day_zone', 'Asia/Manila'
  );
$$;

-- ---------------------------------------------------------------- internal functions
-- Grants once per (member, ref). Returns true if this call granted.
create or replace function public.grant_pips(p_member uuid, p_amount integer, p_reason text, p_ref text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  n integer;
begin
  insert into public.pip_ledger (member_id, amount, reason, ref)
  values (p_member, p_amount, p_reason, p_ref)
  on conflict (member_id, ref) do nothing;
  get diagnostics n = row_count;
  return n = 1;
end;
$$;

-- Unlocks (and rewards) every achievement whose condition now holds. Returns the new keys.
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
  select count(*) into discovered from public.discoveries where member_id = p_member;
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

-- Rewards an approval: the welcome grant once, each project once (up to the lifetime cap).
create or replace function public.reward_approval(p_member uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r jsonb := public.pip_rules();
  proj record;
begin
  perform public.grant_pips(p_member, (r->>'first_approval')::int, 'first_approval', 'first_approval');
  for proj in select id from public.projects where profile_id = p_member order by sort_order, created_at loop
    exit when (select count(*) from public.pip_ledger where member_id = p_member and reason = 'project_live')
              >= (r->>'project_reward_cap')::int;
    perform public.grant_pips(p_member, (r->>'project_live')::int, 'project_live', 'project:' || proj.id);
  end loop;
  perform public.check_achievements(p_member);
end;
$$;

-- ---------------------------------------------------------------- client functions
-- {eligible, balance} for the signed-in member. Eligible = has a card in the hall (D-059).
create or replace function public.my_pips()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'eligible', exists (select 1 from public.published_cards where profile_id = (select auth.uid())),
    'balance', coalesce((select sum(amount) from public.pip_ledger where member_id = (select auth.uid())), 0)
  );
$$;

-- The signed-in member opened another member's profile (FR-E1-02).
create or replace function public.discover_card(p_card uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  r jsonb := public.pip_rules();
  today_start timestamptz;
  earned_today integer;
  v_amount integer := 0;
  new_discovery boolean := false;
  unlocked text[] := '{}';
begin
  if me is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  -- Only members in the hall, discovering other members in the hall (BR-E1-01, BR-E1-02).
  if me = p_card
     or not exists (select 1 from public.published_cards where profile_id = me)
     or not exists (select 1 from public.published_cards where profile_id = p_card) then
    return jsonb_build_object('granted', false, 'amount', 0, 'unlocked', '[]'::jsonb,
                              'balance', (public.my_pips()->>'balance')::int);
  end if;
  -- One discovery at a time per member, so the daily cap can't be raced.
  perform 1 from public.profiles where id = me for update;

  insert into public.discoveries (member_id, card_id) values (me, p_card) on conflict do nothing;
  new_discovery := found;
  if new_discovery then
    today_start := (date_trunc('day', now() at time zone (r->>'day_zone')) at time zone (r->>'day_zone'));
    select coalesce(sum(l.amount), 0) into earned_today
      from public.pip_ledger l
     where l.member_id = me and l.reason = 'discover' and l.created_at >= today_start;
    if earned_today + (r->>'discover')::int <= (r->>'discover_daily_cap')::int then
      if public.grant_pips(me, (r->>'discover')::int, 'discover', 'discover:' || p_card) then
        v_amount := (r->>'discover')::int;
      end if;
    end if;
    unlocked := public.check_achievements(me);
  end if;

  return jsonb_build_object(
    'granted', v_amount > 0,
    'new', new_discovery,
    'amount', v_amount,
    'unlocked', to_jsonb(unlocked),
    'balance', (public.my_pips()->>'balance')::int
  );
end;
$$;

-- ---------------------------------------------------------------- approval now rewards (FR-E1-03, FR-E1-04)
create or replace function public.approve_profile(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  p public.profiles;
  n integer;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  select * into p from public.profiles where id = p_id for update;
  if not found or p.status <> 'pending_review' then
    raise exception 'NOT_PENDING' using errcode = 'P0001';
  end if;
  n := coalesce(p.member_no, nextval('public.member_no_seq'));
  perform set_config('piphall.internal', 'on', true);
  update public.profiles
     set status = 'approved', review_note = null, username_locked = true, member_no = n
   where id = p_id;
  insert into public.published_cards (profile_id, username, card, is_featured, published_at, member_no)
  values (p_id, p.username, public.build_card(p_id), p.is_featured, now(), n)
  on conflict (profile_id) do update
    set username = excluded.username, card = excluded.card,
        is_featured = excluded.is_featured, published_at = excluded.published_at,
        member_no = excluded.member_no;
  perform set_config('piphall.internal', 'off', true);
  perform public.reward_approval(p_id);
end;
$$;

-- ---------------------------------------------------------------- function privileges
-- Supabase grants new functions to everyone by default. Internal ones are callable by nobody
-- outside the database; members get exactly the two client functions.
revoke execute on function public.pip_rules(), public.grant_pips(uuid, integer, text, text),
  public.check_achievements(uuid), public.reward_approval(uuid),
  public.my_pips(), public.discover_card(uuid)
  from public, anon, authenticated;
grant execute on function public.my_pips(), public.discover_card(uuid) to authenticated;
revoke execute on function public.approve_profile(uuid) from public, anon;
grant execute on function public.approve_profile(uuid) to authenticated;

-- ---------------------------------------------------------------- one-time backfill (D-062)
-- Members already in the hall get what they would have earned at approval.
select public.reward_approval(profile_id) from public.published_cards;
