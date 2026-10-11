-- V2-22 (D-134, D-135): the affiliation looks, and the badge's band.
--
-- An admin uploads an affiliation's logo (a PNG or WebP in the affiliation-logos bucket, kept as a
-- Storage path like every image, D-027) and gives the affiliation a frame: Member, Diamond or
-- Cat-eye. Members tagged with the affiliation may wear that frame (it carries the logo and prints
-- the affiliation's name as the admin typed it) and show its pin (the logo itself) on their band;
-- nobody else can. The code holds only the frame designs, never a logo or a name (D-135).
--
-- The band: from everything a member has earned (affiliation pins, admin badges, ribbons won at
-- events, an officer seat) they pick up to 3, in their order. Until they choose, the band shows what
-- it shows today. Each pick is checked as earned when chosen and again whenever a badge is drawn,
-- so a pin goes the moment its affiliation (or its logo) does. Safe to run again. If the curated
-- Museum update (V2-20) never ran on this database, it stops first and says so. Run the logos bucket
-- (20261012000000_affiliation_logos_storage.sql) with it.

-- ---------------------------------------------------------------- what this needs first
do $$
begin
  if to_regclass('public.museum_hung_winners') is null or to_regprocedure('public.award_makers()') is null
     or to_regprocedure('public.archive_credits()') is null or to_regprocedure('public.officer_term_current(date)') is null
     or to_regprocedure('public.frame_in_season(text)') is null then
    raise exception 'Nothing was changed. This database is missing an earlier migration: run 20261011000000_museum_control.sql first (it names any others it needs), then this one again.'
      using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------- affiliations: a logo and a frame design
alter table public.affiliations add column if not exists logo_path text;
alter table public.affiliations drop constraint if exists affiliations_logo_path_check;
alter table public.affiliations add constraint affiliations_logo_path_check
  check (logo_path is null or logo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|webp)$');
alter table public.affiliations drop constraint if exists affiliations_frame_key_check;
alter table public.affiliations add constraint affiliations_frame_key_check
  check (frame_key is null or frame_key in ('member', 'diamond', 'cateye'));

-- ---------------------------------------------------------------- the band: up to 3 picks, in order
-- null: not chosen yet (the band shows what it always has); '{}': chose to show nothing.
alter table public.card_appearance add column if not exists band text[];
alter table public.card_appearance drop constraint if exists card_appearance_band_check;
alter table public.card_appearance add constraint card_appearance_band_check check (band is null or cardinality(band) <= 3);

-- Every place and award a member's projects won: at hall events (as makers, D-116) and in the
-- archive (D-118). Ids: 'e<award id>' and 'a<exhibit id>'.
create or replace function public.member_awards(p_member uuid)
returns table (id text, at timestamptz, award jsonb)
language sql stable security definer set search_path = ''
as $$
  select 'e' || a.id, s.announced_at, jsonb_build_object(
           'event_key', s.key, 'event', s.name, 'place', a.place, 'name', a.name, 'track', a.track,
           'project_id', a.project_id, 'title', am.title, 'at', s.announced_at)
    from public.award_makers() am
    join public.event_awards a on a.id = am.award_id
    join public.hall_seasons s on s.key = a.season_key
   where am.member_id = p_member
  union all
  select 'a' || a.id, make_date(a.year, 12, 31)::timestamptz, jsonb_build_object(
           'event_key', a.season_key, 'event', public.archive_event_label(a.season_key, a.event_name, a.year),
           'place', a.award_place, 'name', a.award_name, 'track', case when a.award_in_track then a.track end,
           'project_id', a.id, 'title', a.title, 'at', make_date(a.year, 12, 31), 'archive', true)
    from public.archive_credits() x
    join public.archive_exhibits a on a.id = x.exhibit_id
   where x.member_id = p_member and (a.award_place is not null or a.award_name is not null);
$$;

-- Everything a member could put on their band right now, each with a ref ('officer:<team>',
-- 'award:<id>', 'pin:<affiliation>', 'badge:<key>') and what's needed to draw it: a current officer
-- seat, ribbons (newest first), affiliation pins (only with a logo), admin-made badges (newest first).
create or replace function public.band_items(p_member uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(i.item order by i.grp, i.n), '[]'::jsonb)
    from (
      select 1 as grp, row_number() over (order by a.sort, a.key) as n,
             jsonb_build_object('ref', 'officer:' || a.key, 'kind', 'officer', 'key', a.key, 'team', a.name, 'position', ma.position) as item
        from public.member_affiliations ma
        join public.affiliations a on a.key = ma.key and a.officers and public.officer_term_current(a.term_ends)
       where ma.member_id = p_member
      union all
      select 2, row_number() over (order by w.at desc, w.id), jsonb_build_object('ref', 'award:' || w.id, 'kind', 'award') || w.award
        from public.member_awards(p_member) w
      union all
      select 3, row_number() over (order by a.sort, a.key),
             jsonb_build_object('ref', 'pin:' || a.key, 'kind', 'pin', 'key', a.key, 'name', a.name, 'logo', a.logo_path)
        from public.member_affiliations ma
        join public.affiliations a on a.key = ma.key and a.logo_path is not null
       where ma.member_id = p_member
      union all
      select 4, row_number() over (order by ma.unlocked_at desc, a.key),
             jsonb_build_object('ref', 'badge:' || a.key, 'kind', 'badge', 'key', a.key, 'name', a.name, 'gem', a.gem, 'tone', a.tone)
        from public.member_achievements ma
        join public.achievements a on a.key = ma.key and a.custom
       where ma.member_id = p_member
    ) i;
$$;

-- The band a member chose, in their order, keeping only what they still have: {band: [...]}, or
-- null when they haven't chosen.
create or replace function public.card_band(p_member uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('band', coalesce((
           select jsonb_agg(i.item order by r.n)
             from unnest(a.band) with ordinality as r(ref, n)
             join jsonb_array_elements(public.band_items(p_member)) as i(item) on i.item->>'ref' = r.ref), '[]'::jsonb))
    from public.card_appearance a
   where a.member_id = p_member and a.band is not null;
$$;

-- Chooses the band: up to 3 different things the member has, in order; null goes back to the band
-- the hall picks.
create or replace function public.set_band(p_band text[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  items jsonb;
  r text;
begin
  if me is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  if not exists (select 1 from public.published_cards where profile_id = me) then
    raise exception 'NOT_ELIGIBLE' using errcode = 'P0001';
  end if;
  if p_band is not null then
    if cardinality(p_band) > 3 then raise exception 'TOO_MANY' using errcode = 'P0001'; end if;
    if array_position(p_band, null) is not null then raise exception 'NOT_EARNED' using errcode = 'P0001'; end if;
    if (select count(distinct x) from unnest(p_band) x) <> cardinality(p_band) then
      raise exception 'TWICE' using errcode = 'P0001';
    end if;
    items := public.band_items(me);
    foreach r in array p_band loop
      if not exists (select 1 from jsonb_array_elements(items) i where i->>'ref' = r) then
        raise exception 'NOT_EARNED' using errcode = 'P0001';
      end if;
    end loop;
  end if;
  insert into public.card_appearance (member_id, band, updated_at) values (me, p_band, now())
  on conflict (member_id) do update set band = excluded.band, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------- frames: the affiliation's design and logo
-- As in D-087, plus: an affiliation's frame is its design (member, diamond or cateye) with its logo;
-- the Member frame prints NAME MEMBER, the others the name as the admin typed it.
create or replace function public.valid_frame(p_member uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case
    when a.frame = 'member' then (
      select jsonb_build_object('frame', af.frame_key,
                                'label', case when af.frame_key = 'member' then public.perk_label(af.name) else trim(af.name) end,
                                'logo', af.logo_path, 'affiliation', af.key)
        from public.member_affiliations ma
        join public.affiliations af on af.key = ma.key
       where ma.member_id = p_member and ma.key = a.frame_affiliation and af.frame_key is not null)
    when a.frame is not null then (
      select jsonb_build_object('frame', a.frame, 'label', null, 'style', m.style)
        from public.inventory i join public.mart_items m on m.key = i.item_key
       where i.member_id = p_member and i.item_key = a.frame)
  end
  from public.card_appearance a where a.member_id = p_member;
$$;

-- Wears a frame: null takes it off, 'member' wears an affiliation's frame (whatever its design),
-- anything else must be a frame the member owns.
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
       where ma.member_id = me and ma.key = p_affiliation and af.frame_key is not null) then
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

-- [{profile_id, frame?, label?, style?, logo?, band?}] for members in the hall wearing a frame or
-- showing a band they chose.
create or replace function public.card_appearances()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('profile_id', c.profile_id) || coalesce(f.v, '{}'::jsonb) || coalesce(b.v, '{}'::jsonb)), '[]'::jsonb)
    from public.published_cards c
    cross join lateral (select public.valid_frame(c.profile_id) as v) f
    cross join lateral (select public.card_band(c.profile_id) as v) b
   where f.v is not null or b.v is not null;
$$;

-- As in D-103, plus: an affiliation's frame comes with its design and logo, and My Card's
-- Customize gets the band chosen ('band', null when not chosen) and everything that could go on it
-- ('band_items').
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
      select jsonb_agg(jsonb_build_object('key', af.key, 'name', af.name, 'design', af.frame_key, 'logo', af.logo_path,
                                          'label', case when af.frame_key = 'member' then public.perk_label(af.name) else trim(af.name) end)
             order by af.sort)
        from public.member_affiliations ma
        join public.affiliations af on af.key = ma.key
       where ma.member_id = (select auth.uid()) and af.frame_key is not null), '[]'::jsonb),
    'equipped', coalesce((
      select jsonb_build_object('frame', a.frame, 'affiliation', a.frame_affiliation, 'title', a.title, 'plate', a.plate)
        from public.card_appearance a where a.member_id = (select auth.uid())),
      jsonb_build_object('frame', null, 'affiliation', null, 'title', null, 'plate', null)),
    'band', (select to_jsonb(a.band) from public.card_appearance a where a.member_id = (select auth.uid())),
    'band_items', public.band_items((select auth.uid()))
  );
$$;

-- ---------------------------------------------------------------- admin
-- Gives an affiliation's members a frame: member, diamond or cateye (null: none).
create or replace function public.admin_set_affiliation_frame(p_key text, p_frame text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  if p_frame is not null and p_frame not in ('member', 'diamond', 'cateye') then raise exception 'NO_SUCH_FRAME' using errcode = 'P0001'; end if;
  update public.affiliations set frame_key = p_frame where key = p_key;
  if not found then raise exception 'NO_SUCH_AFFILIATION' using errcode = 'P0001'; end if;
end;
$$;

-- Sets an affiliation's logo: a file the calling admin uploaded (<their id>/<uuid>.png or .webp in
-- affiliation-logos), or null to take it away (the frame then shows no logo, and its pin goes).
create or replace function public.admin_set_affiliation_logo(p_key text, p_path text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  if p_path is not null and p_path !~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}\.(png|webp)$') then
    raise exception 'BAD_PATH' using errcode = 'P0001';
  end if;
  update public.affiliations set logo_path = p_path where key = p_key;
  if not found then raise exception 'NO_SUCH_AFFILIATION' using errcode = 'P0001'; end if;
end;
$$;

-- ---------------------------------------------------------------- function privileges
revoke execute on function public.member_awards(uuid), public.band_items(uuid), public.card_band(uuid), public.set_band(text[]),
  public.valid_frame(uuid), public.equip_frame(text, text), public.card_appearances(), public.my_mart(),
  public.admin_set_affiliation_frame(text, text), public.admin_set_affiliation_logo(text, text)
  from public, anon, authenticated;
grant execute on function public.set_band(text[]), public.equip_frame(text, text), public.my_mart(),
  public.admin_set_affiliation_frame(text, text), public.admin_set_affiliation_logo(text, text) to authenticated;
grant execute on function public.card_appearances() to anon, authenticated;
