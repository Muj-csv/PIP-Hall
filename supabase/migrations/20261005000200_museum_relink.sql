-- Re-links approved projects to their rows for cards approved before the Museum (D-069).
-- The first backfill matched exact titles only; projects renamed after approval were left
-- without an id, so they couldn't go in the Museum. This matches by GitHub link, then project
-- link, then title ignoring case and spaces. Projects that already have an id are untouched.

update public.published_cards c
   set card = jsonb_set(c.card, '{projects}', (
     select jsonb_agg(
              case when x.elem->>'id' is not null then x.elem
                   else x.elem || jsonb_build_object('id', (
                     select pr.id from public.projects pr
                      where pr.profile_id = c.profile_id
                        and (   (pr.github_url  is not null and pr.github_url  = x.elem->>'github_url')
                             or (pr.project_url is not null and pr.project_url = x.elem->>'project_url')
                             or lower(trim(pr.title)) = lower(trim(x.elem->>'title')))
                      order by (pr.github_url = x.elem->>'github_url') desc nulls last,
                               (pr.project_url = x.elem->>'project_url') desc nulls last,
                               pr.sort_order, pr.created_at
                      limit 1)) end
              order by x.n)
       from jsonb_array_elements(c.card->'projects') with ordinality as x(elem, n)))
 where jsonb_array_length(c.card->'projects') > 0;
