-- The officers' space (docs/plan/V2-NEXT.md, V2-10b; D-123).
--
-- An admin marks an affiliation as an OFFICERS' TEAM for one term (e.g. "Officers 2026–27", with
-- the day the term ends) and gives each officer a POSITION (President, Vice President…) and a seat,
-- the order the team is shown in. Only admins name officers (D-068); positions are public, like
-- affiliation chips. The hall gets an Officers door, the Museum a built-in Officers' Wing (exhibits
-- by the current officers), and current officers wear an officer pin on their badge. When a term
-- ends, its officers stay on record as past officers. The organization's name is data typed by an
-- admin, never code (D-029, D-067). Safe to run again.

-- ---------------------------------------------------------------- teams, positions, seats
alter table public.affiliations add column if not exists officers boolean not null default false;
alter table public.affiliations add column if not exists term_ends date;
alter table public.member_affiliations add column if not exists position text;
alter table public.member_affiliations add column if not exists seat smallint not null default 100;
alter table public.member_affiliations drop constraint if exists member_affiliations_position_check;
alter table public.member_affiliations add constraint member_affiliations_position_check
  check (position is null or char_length(position) between 2 and 40);
alter table public.member_affiliations drop constraint if exists member_affiliations_seat_check;
alter table public.member_affiliations add constraint member_affiliations_seat_check check (seat between 1 and 100);

-- ---------------------------------------------------------------- the Officers' Wing
-- A built-in wing like Featured and Collab: its rule is "exhibits by the current officers", worked
-- out from the exhibits themselves. Admins can rename it, write its note, or close it.
alter table public.museum_wings drop constraint if exists museum_wings_kind_check;
alter table public.museum_wings add constraint museum_wings_kind_check check (kind in ('featured', 'collab', 'tags', 'officers'));
insert into public.museum_wings (key, kind, name, tags, sort) values ('officers', 'officers', 'Officers'' Wing', '{}', 2)
on conflict (key) do nothing;

-- ---------------------------------------------------------------- public
-- A term is current until the end of its last day on the hall's calendar (or while it has none).
create or replace function public.officer_term_current(p_term_ends date)
returns boolean
language sql stable set search_path = ''
as $$
  select p_term_ends is null or p_term_ends >= (now() at time zone 'Asia/Manila')::date;
$$;

-- [{profile_id, username, full_name, position, seat, team, team_key, term_ends, current}] for every
-- member of the hall on an officers' team: current terms first, then past ones, newest first; within
-- a team, by seat.
create or replace function public.hall_officers()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'profile_id', c.profile_id, 'username', c.username, 'full_name', c.card->>'full_name',
           'position', ma.position, 'seat', ma.seat, 'team', a.name, 'team_key', a.key, 'term_ends', a.term_ends,
           'current', public.officer_term_current(a.term_ends))
           order by public.officer_term_current(a.term_ends) desc, a.term_ends desc nulls first, a.sort, a.key, ma.seat, c.member_no), '[]'::jsonb)
    from public.member_affiliations ma
    join public.affiliations a on a.key = ma.key and a.officers
    join public.published_cards c on c.profile_id = ma.member_id;
$$;

-- ---------------------------------------------------------------- admin
-- Makes an affiliation an officers' team (with the day its term ends, if known) or a plain one again.
create or replace function public.admin_set_officers(p_key text, p_officers boolean, p_term_ends date)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  update public.affiliations
     set officers = coalesce(p_officers, false), term_ends = case when coalesce(p_officers, false) then p_term_ends end
   where key = p_key;
  if not found then raise exception 'NO_SUCH_AFFILIATION' using errcode = 'P0001'; end if;
end;
$$;

-- Names a member of the hall an officer of a team, or changes their position and seat. (Taking
-- someone off the team is set_member_affiliation(member, key, false), as for any affiliation.)
create or replace function public.admin_set_officer(p_member uuid, p_key text, p_position text, p_seat integer)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  pos text := nullif(trim(coalesce(p_position, '')), '');
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  if not exists (select 1 from public.affiliations where key = p_key) then raise exception 'NO_SUCH_AFFILIATION' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.affiliations where key = p_key and officers) then raise exception 'NOT_OFFICERS' using errcode = 'P0001'; end if;
  if pos is not null and char_length(pos) not between 2 and 40 then raise exception 'BAD_POSITION' using errcode = 'P0001'; end if;
  if p_seat is null or p_seat not between 1 and 100 then raise exception 'BAD_SEAT' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.published_cards where profile_id = p_member) then raise exception 'NOT_IN_HALL' using errcode = 'P0001'; end if;
  insert into public.member_affiliations (member_id, key, position, seat) values (p_member, p_key, pos, p_seat)
  on conflict (member_id, key) do update set position = excluded.position, seat = excluded.seat;
end;
$$;

-- ---------------------------------------------------------------- function privileges
revoke execute on function public.officer_term_current(date), public.hall_officers(), public.admin_set_officers(text, boolean, date),
  public.admin_set_officer(uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.hall_officers() to anon, authenticated;
grant execute on function public.admin_set_officers(text, boolean, date), public.admin_set_officer(uuid, text, text, integer) to authenticated;
