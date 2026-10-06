-- Identity and proof (docs/plan/V2-LIVING-HALL.md, V2-5; D-101).
--
--   * TITLES are earned from behaviour and worked out live from the records that prove them
--     (published_cards, discoveries, project credits, museum_entries, mission_completions), so
--     every title traces to real actions (rule 4) and disappears if its proof does. A member picks
--     which earned title their badge shows. Only members whose card is in the hall have titles.
--   * TITLE PLATES are a new PIP MART kind (cosmetic, rule 6): the plate the title is shown on.
--   * MISSION REROLLS: once a day, a member can swap today's Missions for 15 PIPs. The database
--     never trusted the pick anyway (D-099), and the daily cap still holds, so a reroll buys a
--     different set, never more PIPs.
-- Safe to run again.

-- ---------------------------------------------------------------- titles
-- [{key, name, rule}] in display order. The rule is what the profile says to explain the title.
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
    {"key": "pathfinder",  "name": "Pathfinder",  "rule": "Completed 10 Missions."}
  ]'::jsonb;
$$;

-- The keys of the titles a member has earned right now, in catalogue order.
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
    case when (select count(*) from public.mission_completions m where m.member_id = p_member) >= 10 then 'pathfinder' end
  ], null), '{}')
  from public.published_cards c
  where c.profile_id = p_member
  union all
  select '{}'::text[] where not exists (select 1 from public.published_cards where profile_id = p_member)
  limit 1;
$$;

-- ---------------------------------------------------------------- title plates (a PIP MART kind)
alter table public.mart_items drop constraint if exists mart_items_kind_check;
alter table public.mart_items add constraint mart_items_kind_check check (kind in ('frame', 'plate'));

-- A plate's style names two card tones: the plate and the ink written on it.
create or replace function public.valid_plate_style(s jsonb)
returns boolean
language sql immutable set search_path = ''
as $$
  select s is not null and jsonb_typeof(s) = 'object'
     and (select count(*) from jsonb_object_keys(s)) = 2
     and s->>'plate' = any (public.reward_tones()) and s->>'ink' = any (public.reward_tones());
$$;
alter table public.mart_items drop constraint if exists mart_items_style_check;
alter table public.mart_items add constraint mart_items_style_check check (
  style is null
  or (kind = 'frame' and public.valid_frame_style(style))
  or (kind = 'plate' and public.valid_plate_style(style)));

insert into public.mart_items (key, kind, name, description, price, for_sale, style, sort) values
  ('plate-brass',  'plate', 'Brass Plate',       'Your title on polished brass.',         150, true, '{"plate": "gold", "ink": "ink"}',     50),
  ('plate-silver', 'plate', 'Silver Plate',      'Your title on bright silver.',          300, true, '{"plate": "metal-hi", "ink": "ink"}', 51),
  ('plate-plum',   'plate', 'Plum Enamel Plate', 'Your title in cream on plum enamel.',   450, true, '{"plate": "plum", "ink": "cream"}',   52)
on conflict (key) do nothing;

alter table public.card_appearance add column if not exists title text;
alter table public.card_appearance add column if not exists plate text;

-- The borders list in Admin → Rewards is frames only; plates are built in.
create or replace function public.admin_mart_items()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('key', key, 'name', name, 'description', description, 'price', price,
           'for_sale', for_sale, 'active', active, 'style', style) order by sort, name)
           from public.mart_items where kind = 'frame'), '[]'::jsonb);
end;
$$;

-- As in D-087, plus: an admin border can't take over a plate's key.
create or replace function public.admin_save_frame(p_key text, p_name text, p_description text, p_price integer, p_for_sale boolean, p_style jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  if p_key is null or p_key !~ '^[a-z0-9][a-z0-9-]{1,23}$' or p_key = 'member' then raise exception 'BAD_KEY' using errcode = 'P0001'; end if;
  if coalesce(length(trim(p_name)), 0) not between 2 and 40 then raise exception 'BAD_NAME' using errcode = 'P0001'; end if;
  if coalesce(length(trim(p_description)), 0) > 120 then raise exception 'BAD_DESCRIPTION' using errcode = 'P0001'; end if;
  if p_price is null or p_price not between 1 and 100000 then raise exception 'BAD_PRICE' using errcode = 'P0001'; end if;
  if not public.valid_frame_style(p_style) then raise exception 'BAD_STYLE' using errcode = 'P0001'; end if;
  if exists (select 1 from public.mart_items where key = p_key and (style is null or kind <> 'frame')) then
    raise exception 'BUILT_IN' using errcode = 'P0001'; -- the original frames and the plates are built in
  end if;
  insert into public.mart_items (key, kind, name, description, price, for_sale, style, sort)
  values (p_key, 'frame', trim(p_name), coalesce(trim(p_description), ''), p_price, coalesce(p_for_sale, true), p_style, 100)
  on conflict (key) do update
    set name = excluded.name, description = excluded.description, price = excluded.price,
        for_sale = excluded.for_sale, style = excluded.style;
end;
$$;

-- As in D-087, plus `kind` already in each item, and the title and plate being worn.
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
               'owned', exists (select 1 from public.inventory i where i.member_id = (select auth.uid()) and i.item_key = m.key))
             order by m.sort, m.name)
        from public.mart_items m
       where (m.active and m.for_sale)
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

-- {eligible, title, plate, titles: [{key, name, rule, earned}]}
create or replace function public.my_titles()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'eligible', exists (select 1 from public.published_cards where profile_id = (select auth.uid())),
    'title', (select a.title from public.card_appearance a where a.member_id = (select auth.uid()) and a.title = any (mine.keys)),
    'plate', (select a.plate from public.card_appearance a where a.member_id = (select auth.uid())),
    'titles', (select jsonb_agg(t || jsonb_build_object('earned', (t->>'key') = any (mine.keys)))
                 from jsonb_array_elements(public.title_catalog()) t))
  from (select public.earned_titles((select auth.uid())) as keys) mine;
$$;

-- Shows an earned title on the badge (null shows none).
create or replace function public.equip_title(p_title text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  if not exists (select 1 from public.published_cards where profile_id = me) then
    raise exception 'NOT_ELIGIBLE' using errcode = 'P0001';
  end if;
  if p_title is not null and not (p_title = any (public.earned_titles(me))) then
    raise exception 'NOT_EARNED' using errcode = 'P0001';
  end if;
  insert into public.card_appearance (member_id, title, updated_at) values (me, p_title, now())
  on conflict (member_id) do update set title = excluded.title, updated_at = now();
end;
$$;

-- Puts the title on a plate the member owns (null: the plain plate).
create or replace function public.equip_plate(p_plate text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  if not exists (select 1 from public.published_cards where profile_id = me) then
    raise exception 'NOT_ELIGIBLE' using errcode = 'P0001';
  end if;
  if p_plate is not null and not exists (
      select 1 from public.inventory i join public.mart_items m on m.key = i.item_key
       where i.member_id = me and i.item_key = p_plate and m.kind = 'plate') then
    raise exception 'NOT_OWNED' using errcode = 'P0001';
  end if;
  insert into public.card_appearance (member_id, plate, updated_at) values (me, p_plate, now())
  on conflict (member_id) do update set plate = excluded.plate, updated_at = now();
end;
$$;

-- Public, for badges and the profile's Proof panel:
-- [{profile_id, earned: [keys], title, plate_style}] for every member in the hall. `title` is the
-- chosen one only while it is still earned; `plate_style` only while the plate is still owned.
create or replace function public.hall_titles()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'profile_id', c.profile_id,
           'earned', to_jsonb(t.keys),
           'title', case when a.title = any (t.keys) then a.title end,
           'plate_style', (select m.style from public.inventory i join public.mart_items m on m.key = i.item_key
                            where i.member_id = c.profile_id and i.item_key = a.plate and m.kind = 'plate'))), '[]'::jsonb)
    from public.published_cards c
    cross join lateral (select public.earned_titles(c.profile_id) as keys) t
    left join public.card_appearance a on a.member_id = c.profile_id;
$$;

-- ---------------------------------------------------------------- Mission rerolls
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
    'missions_per_week', 1,
    'mission_reroll', 15,
    'rerolls_per_day', 1
  );
$$;

create table if not exists public.mission_rerolls (
  member_id   uuid not null references public.profiles (id) on delete cascade,
  period      text not null,
  n           integer not null default 1,
  primary key (member_id, period)
);
revoke all on public.mission_rerolls from anon, authenticated;
alter table public.mission_rerolls enable row level security;

-- As in D-099, plus `rerolls` (today's count): the app picks today's Missions with it in the seed.
create or replace function public.my_missions()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'eligible', exists (select 1 from public.published_cards where profile_id = (select auth.uid())),
    'day', (select label from public.mission_period('daily')),
    'week', (select label from public.mission_period('weekly')),
    'rerolls', coalesce((select r.n from public.mission_rerolls r
                          where r.member_id = (select auth.uid()) and r.period = (select label from public.mission_period('daily'))), 0),
    'done', coalesce((
      select jsonb_agg(jsonb_build_object('key', m.key, 'scope', m.scope, 'kind', m.kind, 'param', m.param, 'n', m.n) order by m.completed_at)
        from public.mission_completions m
       where m.member_id = (select auth.uid())
         and m.period in ((select label from public.mission_period('daily')), (select label from public.mission_period('weekly')))), '[]'::jsonb)
  );
$$;

-- Swaps today's Missions for a new set. {rerolls, balance}
create or replace function public.reroll_missions()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  r jsonb := public.pip_rules();
  price integer := (r->>'mission_reroll')::integer;
  v_day text := (select label from public.mission_period('daily'));
  used integer;
  bal integer;
begin
  if me is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  if not exists (select 1 from public.published_cards where profile_id = me) then
    raise exception 'NOT_ELIGIBLE' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('pips:' || me::text));
  select coalesce((select n from public.mission_rerolls where member_id = me and period = v_day), 0) into used;
  if used >= (r->>'rerolls_per_day')::integer then raise exception 'REROLL_LIMIT' using errcode = 'P0001'; end if;
  select coalesce(sum(amount), 0) into bal from public.pip_ledger where member_id = me;
  if bal < price then raise exception 'NOT_ENOUGH_PIPS' using errcode = 'P0001'; end if;
  insert into public.pip_ledger (member_id, amount, reason, ref) values (me, -price, 'purchase', 'reroll:' || v_day || ':' || (used + 1));
  insert into public.mission_rerolls (member_id, period, n) values (me, v_day, 1)
    on conflict (member_id, period) do update set n = public.mission_rerolls.n + 1;
  return jsonb_build_object('rerolls', used + 1, 'balance', bal - price);
end;
$$;

-- ---------------------------------------------------------------- function privileges
revoke execute on function public.title_catalog(), public.earned_titles(uuid), public.valid_plate_style(jsonb), public.my_titles(), public.equip_title(text),
  public.equip_plate(text), public.hall_titles(), public.reroll_missions()
  from public, anon, authenticated;
grant execute on function public.my_titles(), public.equip_title(text), public.equip_plate(text), public.reroll_missions() to authenticated;
grant execute on function public.hall_titles() to anon, authenticated;
