-- Phase 4: the admin screen offers Feature and Unpublish only for cards in the hall; the
-- functions now refuse anything else instead of quietly changing a draft (e.g. unpublishing a
-- card that is still pending review would have marked it 'unpublished' with nothing to take down).

create or replace function public.unpublish_profile(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  delete from public.published_cards where profile_id = p_id;
  if not found then raise exception 'NOT_PUBLISHED' using errcode = 'P0001'; end if;
  perform set_config('piphall.internal', 'on', true);
  update public.profiles set status = 'unpublished', is_featured = false where id = p_id;
  perform set_config('piphall.internal', 'off', true);
end;
$$;

create or replace function public.set_featured(p_id uuid, p_featured boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  perform set_config('piphall.internal', 'on', true);
  update public.published_cards
     set is_featured = p_featured, card = jsonb_set(card, '{is_featured}', to_jsonb(p_featured))
   where profile_id = p_id;
  if not found then raise exception 'NOT_PUBLISHED' using errcode = 'P0001'; end if;
  update public.profiles set is_featured = p_featured where id = p_id;
  perform set_config('piphall.internal', 'off', true);
end;
$$;

-- A rename must hit an existing member; the profiles check constraints validate the name.
create or replace function public.admin_set_username(p_id uuid, p_username text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  perform set_config('piphall.internal', 'on', true);
  update public.profiles set username = lower(trim(p_username)) where id = p_id;
  if not found then raise exception 'NO_PROFILE' using errcode = 'P0001'; end if;
  update public.published_cards
     set username = lower(trim(p_username)), card = jsonb_set(card, '{username}', to_jsonb(lower(trim(p_username))))
   where profile_id = p_id;
  perform set_config('piphall.internal', 'off', true);
end;
$$;

-- create or replace keeps existing grants; restate them so this file reads on its own.
revoke execute on function public.unpublish_profile(uuid), public.set_featured(uuid, boolean),
  public.admin_set_username(uuid, text) from public, anon;
grant execute on function public.unpublish_profile(uuid), public.set_featured(uuid, boolean),
  public.admin_set_username(uuid, text) to authenticated;
