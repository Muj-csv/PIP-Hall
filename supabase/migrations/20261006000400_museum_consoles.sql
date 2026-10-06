-- Museum console frames (docs/plan/MUSEUM-CONSOLES.md, phase 3; D-091).
-- Each exhibit hangs inside one of five original PIXENDO consoles. The maker may pick one; until
-- they do (console is null) the page picks one from the project id, so it never changes on reload.
-- Picking a console is cosmetic like the Museum switch itself: it saves at once and never sends the
-- card back to review. Safe to run again.

-- ---------------------------------------------------------------- column
alter table public.museum_entries add column if not exists console text;
alter table public.museum_entries drop constraint if exists museum_entries_console_check;
alter table public.museum_entries add constraint museum_entries_console_check
  check (console is null or console in ('pocket', 'wide', 'tv', 'arcade', 'flip'));

-- ---------------------------------------------------------------- member function
-- Sets (or, with null, clears) the console of one of my exhibits. Returns the stored value.
create or replace function public.set_museum_console(p_project uuid, p_console text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  if p_console is not null and p_console not in ('pocket', 'wide', 'tv', 'arcade', 'flip') then
    raise exception 'BAD_CONSOLE' using errcode = 'P0001';
  end if;
  update public.museum_entries set console = p_console
   where project_id = p_project and member_id = me;
  if not found then raise exception 'NOT_IN_MUSEUM' using errcode = 'P0001'; end if;
  return p_console;
end;
$$;

-- ---------------------------------------------------------------- reads, plus the console
-- Same as before plus each entry's console (null = picked automatically).
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
           'console', e.console,
           'project', x.elem)), '[]'::jsonb)
    from public.museum_entries e
    join public.published_cards c on c.profile_id = e.member_id
    cross join lateral (
      select p as elem from jsonb_array_elements(c.card->'projects') p
       where p->>'id' = e.project_id::text limit 1) x
   where public.has_museum_access(e.member_id);
$$;

-- {access, live, projects, entries, consoles: {project id: console}}
create or replace function public.my_museum()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'access', public.has_museum_access((select auth.uid())),
    'live', to_jsonb(public.live_project_ids((select auth.uid()))),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object('id', x->>'id', 'title', x->>'title') order by n)
        from public.published_cards c, jsonb_array_elements(c.card->'projects') with ordinality t(x, n)
       where c.profile_id = (select auth.uid()) and x->>'id' is not null), '[]'::jsonb),
    'entries', coalesce((select jsonb_agg(project_id) from public.museum_entries where member_id = (select auth.uid())), '[]'::jsonb),
    'consoles', coalesce((
      select jsonb_object_agg(project_id, console) from public.museum_entries
       where member_id = (select auth.uid()) and console is not null), '{}'::jsonb)
  );
$$;

-- ---------------------------------------------------------------- function privileges
revoke execute on function public.set_museum_console(uuid, text) from public, anon, authenticated;
grant execute on function public.set_museum_console(uuid, text) to authenticated;
revoke execute on function public.museum_exhibits() from public;
grant execute on function public.museum_exhibits() to anon, authenticated;
revoke execute on function public.my_museum() from public, anon;
grant execute on function public.my_museum() to authenticated;
