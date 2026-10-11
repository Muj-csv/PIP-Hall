-- V2-23 (D-136): exhibits you can play. The cartridge and the team wall are drawn from data the
-- Museum already has; this adds the making-of comic: three short lines a member writes for a project
-- (the problem, what we built, what happened). They are part of the card like any field: writing
-- them sends the card back to review (projects_guard), an admin sees them there, and they go live
-- with the card (build_card puts them on each project as `story`, null when there are none).
-- Safe to run again. If the V2-22 update never ran on this database, it stops first and says so.

-- ---------------------------------------------------------------- what this needs first
do $$
begin
  if to_regprocedure('public.set_band(text[])') is null then
    raise exception 'Nothing was changed. This database is missing an earlier migration: run 20261012000100_affiliation_looks.sql first (it names any others it needs), then this one again.'
      using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------- the three lines
alter table public.projects add column if not exists story_problem text;
alter table public.projects add column if not exists story_built text;
alter table public.projects add column if not exists story_result text;
alter table public.projects drop constraint if exists projects_story_check;
alter table public.projects add constraint projects_story_check check (
      (story_problem is null or char_length(trim(story_problem)) between 1 and 90)
  and (story_built is null or char_length(trim(story_built)) between 1 and 90)
  and (story_result is null or char_length(trim(story_result)) between 1 and 90));

-- Members write them on their own projects, like the description (RLS keeps them to their own rows).
grant insert (story_problem, story_built, story_result) on public.projects to authenticated;
grant update (story_problem, story_built, story_result) on public.projects to authenticated;

-- ---------------------------------------------------------------- the published card
-- As in D-089, plus each project's `story` ({problem, built, result}, any of them may be null; null
-- when the member wrote none of the three).
create or replace function public.build_card(p_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'username', p.username,
    'full_name', p.full_name,
    'tagline', p.tagline,
    'bio', p.bio,
    'role', p.role,
    'org_position', p.org_position,
    'department', p.department,
    'avatar_path', p.avatar_path,
    'github_username', p.github_username,
    'linkedin_url', p.linkedin_url,
    'portfolio_url', p.portfolio_url,
    'public_email', case when p.show_email then p.public_email end,
    'skills', to_jsonb(p.skills),
    'theme', p.theme,
    'is_featured', p.is_featured,
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', pr.id,
               'title', pr.title, 'description', pr.description, 'cover_path', pr.cover_path,
               'project_url', pr.project_url, 'github_url', pr.github_url, 'language', pr.language,
               'stars', pr.stars, 'tech_stack', to_jsonb(pr.tech_stack), 'source', pr.source,
               'project_date', pr.project_date,
               'story', case when coalesce(pr.story_problem, pr.story_built, pr.story_result) is not null
                             then jsonb_build_object('problem', trim(pr.story_problem), 'built', trim(pr.story_built), 'result', trim(pr.story_result)) end,
               'collaborators', coalesce((
                 select jsonb_agg(jsonb_build_object('username', c.username, 'full_name', c.card->>'full_name', 'member_no', c.member_no)
                                  order by pc.responded_at, c.member_no)
                   from public.project_collaborators pc
                   join public.published_cards c on c.profile_id = pc.member_id
                  where pc.project_id = pr.id and pc.status = 'accepted'), '[]'::jsonb))
             order by pr.sort_order, pr.created_at)
        from public.projects pr where pr.profile_id = p.id), '[]'::jsonb)
  )
  from public.profiles p where p.id = p_id;
$$;
revoke execute on function public.build_card(uuid) from public, anon, authenticated;
