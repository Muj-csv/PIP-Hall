-- PIP MART v1 (E2, docs/plan/PIP-PROGRESSION-E2.md, D-074…D-076).
-- Members in the hall spend PIPs on badge frames. Affiliations can give a free perk frame that
-- prints the affiliation's name (e.g. an org's MEMBER frame, D-070), so names stay admin data.
-- The equipped frame lives outside the reviewed snapshot (cosmetic, no review: D-060).

-- ---------------------------------------------------------------- ledger: purchases are spending
alter table public.pip_ledger drop constraint if exists pip_ledger_reason_check;
alter table public.pip_ledger add constraint pip_ledger_reason_check
  check (reason in ('first_approval', 'project_live', 'discover', 'achievement', 'purchase'));

-- ---------------------------------------------------------------- tables
-- The catalogue is data, so prices can be tuned in one update (BR-E2-05).
create table public.mart_items (
  key          text primary key check (key ~ '^[a-z0-9][a-z0-9-]{1,23}$'),
  kind         text not null check (kind in ('frame')),
  name         text not null,
  description  text not null,
  price        integer not null check (price > 0),
  active       boolean not null default true,
  sort         integer not null default 0
);

insert into public.mart_items (key, kind, name, description, price, sort) values
  ('meadow', 'frame', 'Meadow Frame', 'Hill green with little flowers in bloom.',     200, 1),
  ('dusk',   'frame', 'Dusk Frame',   'Deep plum with stars in the corners.',         400, 2),
  ('pearl',  'frame', 'Pearl Frame',  'Soft cream with polished pearls.',             700, 3),
  ('gold',   'frame', 'Gold Frame',   'Block gold with coins. For the hall''s finest.', 1000, 4);

create table public.inventory (
  member_id    uuid not null references public.profiles (id) on delete cascade,
  item_key     text not null references public.mart_items (key),
  acquired_at  timestamptz not null default now(),
  primary key (member_id, item_key)
);

-- What a member wears on their badge: a bought frame, or 'member' (the affiliation perk frame).
create table public.card_appearance (
  member_id         uuid primary key references public.profiles (id) on delete cascade,
  frame             text,
  frame_affiliation text references public.affiliations (key) on delete set null,
  updated_at        timestamptz not null default now()
);

revoke all on public.mart_items, public.inventory, public.card_appearance from anon, authenticated;
grant select on public.mart_items to anon, authenticated;
grant select on public.inventory, public.card_appearance to authenticated;

alter table public.mart_items      enable row level security;
alter table public.inventory       enable row level security;
alter table public.card_appearance enable row level security;

create policy "the catalogue is public" on public.mart_items for select to anon, authenticated using (true);
create policy "own inventory" on public.inventory for select to authenticated using (member_id = (select auth.uid()));
create policy "own appearance" on public.card_appearance for select to authenticated using (member_id = (select auth.uid()));

-- ---------------------------------------------------------------- helpers
-- "ACM" and "ACM Member" both print ACM MEMBER on the perk frame.
create or replace function public.perk_label(p_name text)
returns text
language sql immutable set search_path = ''
as $$
  select case when upper(trim(p_name)) ~ '(^| )MEMBER$' then upper(trim(p_name)) else upper(trim(p_name)) || ' MEMBER' end;
$$;

-- The frame a member may wear right now: a bought one they still own, or the perk frame of an
-- affiliation that still gives one. Anything else shows the plain badge.
create or replace function public.valid_frame(p_member uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case
    when a.frame = 'member' then (
      select jsonb_build_object('frame', 'member', 'label', public.perk_label(af.name))
        from public.member_affiliations ma
        join public.affiliations af on af.key = ma.key
       where ma.member_id = p_member and ma.key = a.frame_affiliation and af.frame_key = 'member')
    when a.frame is not null and exists (
      select 1 from public.inventory i where i.member_id = p_member and i.item_key = a.frame)
      then jsonb_build_object('frame', a.frame, 'label', null)
  end
  from public.card_appearance a where a.member_id = p_member;
$$;

-- ---------------------------------------------------------------- member functions
-- {eligible, balance, items: [{key, kind, name, description, price, owned}], perks: [{key, name, label}],
--  equipped: {frame, affiliation}}
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
               'owned', exists (select 1 from public.inventory i where i.member_id = (select auth.uid()) and i.item_key = m.key))
             order by m.sort)
        from public.mart_items m
       where m.active or exists (select 1 from public.inventory i where i.member_id = (select auth.uid()) and i.item_key = m.key)), '[]'::jsonb),
    'perks', coalesce((
      select jsonb_agg(jsonb_build_object('key', af.key, 'name', af.name, 'label', public.perk_label(af.name)) order by af.sort)
        from public.member_affiliations ma
        join public.affiliations af on af.key = ma.key
       where ma.member_id = (select auth.uid()) and af.frame_key = 'member'), '[]'::jsonb),
    'equipped', coalesce((
      select jsonb_build_object('frame', a.frame, 'affiliation', a.frame_affiliation)
        from public.card_appearance a where a.member_id = (select auth.uid())),
      jsonb_build_object('frame', null, 'affiliation', null))
  );
$$;

-- Buys one item. Locked per member so two clicks can't spend twice (BR-E2-02).
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
  select * into item from public.mart_items where key = p_key and active;
  if not found then raise exception 'NO_SUCH_ITEM' using errcode = 'P0001'; end if;
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

-- Wears a frame: null takes it off, 'member' wears an affiliation's perk frame, anything else
-- must be a frame the member owns.
create or replace function public.equip_frame(p_frame text, p_affiliation text default null)
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
  if p_frame = 'member' then
    if not exists (
      select 1 from public.member_affiliations ma join public.affiliations af on af.key = ma.key
       where ma.member_id = me and ma.key = p_affiliation and af.frame_key = 'member') then
      raise exception 'NO_SUCH_PERK' using errcode = 'P0001';
    end if;
  elsif p_frame is not null then
    if not exists (
      select 1 from public.inventory i join public.mart_items m on m.key = i.item_key
       where i.member_id = me and i.item_key = p_frame and m.kind = 'frame') then
      raise exception 'NOT_OWNED' using errcode = 'P0001';
    end if;
  end if;
  insert into public.card_appearance (member_id, frame, frame_affiliation, updated_at)
  values (me, p_frame, case when p_frame = 'member' then p_affiliation end, now())
  on conflict (member_id) do update
    set frame = excluded.frame, frame_affiliation = excluded.frame_affiliation, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------- public: what badges wear
-- [{profile_id, frame, label}] for members in the hall wearing a valid frame.
create or replace function public.card_appearances()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('profile_id', c.profile_id) || f.v), '[]'::jsonb)
    from public.published_cards c
    cross join lateral (select public.valid_frame(c.profile_id) as v) f
   where f.v is not null;
$$;

-- ---------------------------------------------------------------- admin: which affiliations give a frame
create or replace function public.admin_set_affiliation_frame(p_key text, p_frame text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  if p_frame is not null and p_frame <> 'member' then raise exception 'NO_SUCH_FRAME' using errcode = 'P0001'; end if;
  update public.affiliations set frame_key = p_frame where key = p_key;
end;
$$;

-- ---------------------------------------------------------------- function privileges
revoke execute on function public.perk_label(text), public.valid_frame(uuid), public.my_mart(), public.buy_item(text),
  public.equip_frame(text, text), public.card_appearances(), public.admin_set_affiliation_frame(text, text)
  from public, anon, authenticated;
grant execute on function public.my_mart(), public.buy_item(text), public.equip_frame(text, text),
  public.admin_set_affiliation_frame(text, text) to authenticated;
grant execute on function public.card_appearances() to anon, authenticated;
