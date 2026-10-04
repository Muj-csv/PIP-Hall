-- PIP-Hall — stable member numbers (D-033, D-034).
-- The badge prints No.### and the QR serial PIP·###·ABC. Numbering by published_at would
-- renumber everyone after a member whenever their edited card is re-approved, so each member
-- gets a number from a sequence at their FIRST approval and keeps it: through edits,
-- re-approval, unpublish and re-publish. Numbers are never reused, even after account deletion.

create sequence public.member_no_seq as integer;
revoke all on sequence public.member_no_seq from public, anon, authenticated;

-- Moderation column: members have no insert/update grant on it (grants are per column).
alter table public.profiles add column member_no integer unique;
alter table public.published_cards add column member_no integer;

-- Backfill anything already published, in approval order.
with ordered as (
  select profile_id, row_number() over (order by published_at, username) as n
    from public.published_cards
)
update public.profiles p set member_no = o.n from ordered o where p.id = o.profile_id;
update public.published_cards c set member_no = p.member_no from public.profiles p where p.id = c.profile_id;
select setval('public.member_no_seq', coalesce((select max(member_no) from public.profiles), 0) + 1, false);

alter table public.published_cards alter column member_no set not null;
alter table public.published_cards add constraint published_cards_member_no_key unique (member_no);

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
end;
$$;
