-- Admin-made rewards (D-087): admins design badge borders (frames) and badges (achievements) from
-- presets, and grant badges to members; a badge can carry a PIP reward and/or a border.
-- Everything is checked here: styles only name theme tones and known motions, so an admin can't
-- inject arbitrary CSS, and only admins can create, change or grant. Safe to run again.

-- ---------------------------------------------------------------- allowed presets
create or replace function public.reward_tones()
returns text[]
language sql immutable set search_path = ''
as $$
  select array['band','plum','ink','cream','face','metal','metal-hi','sky','hill','hill-dark','ground','grass',
               'grass-light','block','block-hi','block-shade','coin','coin-shade','coin-hi','gold','lanyard','lanyard-dark'];
$$;

-- A border style: {frame, hi, shade, trim: tone, gap: 2..6, motion, doodle}.
create or replace function public.valid_frame_style(s jsonb)
returns boolean
language sql immutable set search_path = ''
as $$
  select s is not null
     and jsonb_typeof(s) = 'object'
     and (select count(*) from jsonb_object_keys(s)) = 7
     and s->>'frame' = any (public.reward_tones())
     and s->>'hi'    = any (public.reward_tones())
     and s->>'shade' = any (public.reward_tones())
     and s->>'trim'  = any (public.reward_tones())
     and jsonb_typeof(s->'gap') = 'number' and (s->>'gap')::int between 2 and 6
     and s->>'motion' in ('none', 'flow', 'twinkle', 'pulse', 'gleam')
     and s->>'doodle' in ('none', 'meadow', 'dusk', 'pearl', 'gold', 'member');
$$;

-- ---------------------------------------------------------------- borders: custom frames in the Mart
alter table public.mart_items add column if not exists style jsonb;
alter table public.mart_items add column if not exists for_sale boolean not null default true;
alter table public.mart_items drop constraint if exists mart_items_style_check;
alter table public.mart_items add constraint mart_items_style_check check (style is null or public.valid_frame_style(style));

-- ---------------------------------------------------------------- badges: custom achievements
alter table public.achievements add column if not exists custom boolean not null default false;
alter table public.achievements add column if not exists gem text not null default 'star';
alter table public.achievements add column if not exists tone text not null default 'gold';
alter table public.achievements add column if not exists reward_frame text references public.mart_items (key);
alter table public.achievements drop constraint if exists achievements_reward_check;
alter table public.achievements add constraint achievements_reward_check check (reward >= 0 and reward <= 5000);
alter table public.achievements drop constraint if exists achievements_gem_check;
alter table public.achievements add constraint achievements_gem_check
  check (gem in ('star', 'circle', 'diamond', 'heart', 'shield', 'bolt', 'crown', 'leaf'));
alter table public.achievements drop constraint if exists achievements_tone_check;
alter table public.achievements add constraint achievements_tone_check
  check (tone in ('gold', 'green', 'sky', 'plum', 'red', 'silver'));

-- ---------------------------------------------------------------- what badges wear (now with style)
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
    when a.frame is not null then (
      select jsonb_build_object('frame', a.frame, 'label', null, 'style', m.style)
        from public.inventory i join public.mart_items m on m.key = i.item_key
       where i.member_id = p_member and i.item_key = a.frame)
  end
  from public.card_appearance a where a.member_id = p_member;
$$;

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
      select jsonb_build_object('frame', a.frame, 'affiliation', a.frame_affiliation)
        from public.card_appearance a where a.member_id = (select auth.uid())),
      jsonb_build_object('frame', null, 'affiliation', null))
  );
$$;

-- Reward-only borders can't be bought.
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

-- ---------------------------------------------------------------- public: badges on cards
-- [{profile_id, pins: [{key, name, gem, tone}]}]: up to three admin-made badges per member in the
-- hall, newest first, for the badge band and the profile.
create or replace function public.card_pins()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('profile_id', c.profile_id, 'pins', p.pins)), '[]'::jsonb)
    from public.published_cards c
    cross join lateral (
      select jsonb_agg(jsonb_build_object('key', x.key, 'name', x.name, 'gem', x.gem, 'tone', x.tone) order by x.unlocked_at desc) as pins
        from (select a.key, a.name, a.gem, a.tone, ma.unlocked_at
                from public.member_achievements ma join public.achievements a on a.key = ma.key
               where ma.member_id = c.profile_id and a.custom
               order by ma.unlocked_at desc limit 3) x) p
   where p.pins is not null;
$$;

-- ---------------------------------------------------------------- admin functions
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
  if exists (select 1 from public.mart_items where key = p_key and style is null) then
    raise exception 'BUILT_IN' using errcode = 'P0001'; -- the original frames are drawn in code
  end if;
  insert into public.mart_items (key, kind, name, description, price, for_sale, style, sort)
  values (p_key, 'frame', trim(p_name), coalesce(trim(p_description), ''), p_price, coalesce(p_for_sale, true), p_style, 100)
  on conflict (key) do update
    set name = excluded.name, description = excluded.description, price = excluded.price,
        for_sale = excluded.for_sale, style = excluded.style;
end;
$$;

create or replace function public.admin_set_item_active(p_key text, p_active boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  update public.mart_items set active = coalesce(p_active, false) where key = p_key;
  if not found then raise exception 'NO_SUCH_ITEM' using errcode = 'P0001'; end if;
end;
$$;

create or replace function public.admin_save_badge(p_key text, p_name text, p_description text, p_reward integer, p_gem text, p_tone text, p_frame text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  if p_key is null or p_key !~ '^[a-z0-9][a-z0-9-]{1,23}$' then raise exception 'BAD_KEY' using errcode = 'P0001'; end if;
  if coalesce(length(trim(p_name)), 0) not between 2 and 40 then raise exception 'BAD_NAME' using errcode = 'P0001'; end if;
  if coalesce(length(trim(p_description)), 0) not between 2 and 120 then raise exception 'BAD_DESCRIPTION' using errcode = 'P0001'; end if;
  if p_reward is null or p_reward not between 0 and 5000 then raise exception 'BAD_REWARD' using errcode = 'P0001'; end if;
  if p_frame is not null and not exists (select 1 from public.mart_items where key = p_frame and kind = 'frame') then
    raise exception 'NO_SUCH_ITEM' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.achievements where key = p_key and not custom) then
    raise exception 'BUILT_IN' using errcode = 'P0001'; -- the automatic achievements stay as they are
  end if;
  insert into public.achievements (key, name, description, reward, sort, custom, gem, tone, reward_frame)
  values (p_key, trim(p_name), trim(p_description), p_reward, 100, true, p_gem, p_tone, p_frame)
  on conflict (key) do update
    set name = excluded.name, description = excluded.description, reward = excluded.reward,
        gem = excluded.gem, tone = excluded.tone, reward_frame = excluded.reward_frame;
end;
$$;

-- Grants a badge to a member in the hall: once, with its PIPs and its border. Returns true if new.
create or replace function public.admin_grant_badge(p_member uuid, p_key text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  a public.achievements;
  n integer;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  select * into a from public.achievements where key = p_key and custom;
  if not found then raise exception 'NO_SUCH_BADGE' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.published_cards where profile_id = p_member) then
    raise exception 'NOT_PUBLISHED' using errcode = 'P0001';
  end if;
  insert into public.member_achievements (member_id, key) values (p_member, p_key) on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return false; end if;
  if a.reward > 0 then perform public.grant_pips(p_member, a.reward, 'achievement', 'achievement:' || p_key); end if;
  if a.reward_frame is not null then
    insert into public.inventory (member_id, item_key) values (p_member, a.reward_frame) on conflict do nothing;
  end if;
  return true;
end;
$$;

-- Takes a badge back off a member's profile. PIPs and borders already given stay theirs.
create or replace function public.admin_revoke_badge(p_member uuid, p_key text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  n integer;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  delete from public.member_achievements m
   using public.achievements a
   where m.member_id = p_member and m.key = p_key and a.key = m.key and a.custom;
  get diagnostics n = row_count;
  return n = 1;
end;
$$;

-- Admins: every border, active or not, with its style, for the builder.
create or replace function public.admin_mart_items()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('key', key, 'name', name, 'description', description, 'price', price,
           'for_sale', for_sale, 'active', active, 'style', style) order by sort, name) from public.mart_items), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------- function privileges
revoke execute on function public.reward_tones(), public.valid_frame_style(jsonb), public.card_pins(),
  public.admin_save_frame(text, text, text, integer, boolean, jsonb), public.admin_set_item_active(text, boolean),
  public.admin_save_badge(text, text, text, integer, text, text, text), public.admin_grant_badge(uuid, text),
  public.admin_revoke_badge(uuid, text), public.admin_mart_items()
  from public, anon, authenticated;
grant execute on function public.card_pins() to anon, authenticated;
grant execute on function public.admin_save_frame(text, text, text, integer, boolean, jsonb), public.admin_set_item_active(text, boolean),
  public.admin_save_badge(text, text, text, integer, text, text, text), public.admin_grant_badge(uuid, text),
  public.admin_revoke_badge(uuid, text), public.admin_mart_items() to authenticated;
-- valid_frame_style runs inside the mart_items check: the table owner needs it, nobody else.
-- The replaced functions keep their earlier grants (create or replace keeps privileges).
