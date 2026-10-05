-- The Museum pins featured members on top (D-083): each exhibit says whether its maker is featured
-- (the admin's Featured toggle on published_cards), so the page can keep them out of the shuffle.
-- Same shape as before plus one field; safe to run again.

create or replace function public.museum_exhibits()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'project_id', e.project_id,
           'username', c.username,
           'full_name', c.card->>'full_name',
           'avatar_path', c.card->'avatar_path',
           'member_no', c.member_no,
           'featured', c.is_featured,
           'project', x.elem)), '[]'::jsonb)
    from public.museum_entries e
    join public.published_cards c on c.profile_id = e.member_id
    cross join lateral (
      select p as elem from jsonb_array_elements(c.card->'projects') p
       where p->>'id' = e.project_id::text limit 1) x
   where public.has_museum_access(e.member_id);
$$;

revoke execute on function public.museum_exhibits() from public;
grant execute on function public.museum_exhibits() to anon, authenticated;
