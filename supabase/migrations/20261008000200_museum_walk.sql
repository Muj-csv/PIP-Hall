-- The walkable Museum (docs/plan/V2-NEXT.md, V2-11; D-119, D-125).
--
-- Pip walks through the Museum room by room, and every room has a STYLE: its walls, floor and props,
-- picked from a fixed list of original presets (arcade, lab, library, garden, trophy). Admins pick
-- each wing's style in Admin → Wings; the Winners' Hall, the event rooms, All exhibits and the
-- Archive have fixed styles in the app. A style is a look only: it never changes which exhibits hang
-- in a room, and none is behind PIPs (rules 5, 6). Nothing else in the database changes.
-- Safe to run again. If you ever re-run the wings migration, run this one again after it.

-- ---------------------------------------------------------------- a style per wing
alter table public.museum_wings add column if not exists style text;
-- The built-in wings start with a style that fits them, so neighbouring rooms differ.
update public.museum_wings
   set style = case
         when kind = 'featured' then 'garden'
         when kind = 'collab' then 'lab'
         when kind = 'officers' then 'library'
         when key = 'web' then 'garden'
         when key = 'games' then 'arcade'
         when key = 'data' then 'lab'
         else 'arcade'
       end
 where style is null;
alter table public.museum_wings alter column style set default 'arcade';
alter table public.museum_wings alter column style set not null;
alter table public.museum_wings drop constraint if exists museum_wings_style_check;
alter table public.museum_wings add constraint museum_wings_style_check check (style in ('arcade', 'lab', 'library', 'garden', 'trophy'));

-- ---------------------------------------------------------------- public
-- [{key, kind, name, note, tags, style}] for the wings that are open, in order.
create or replace function public.museum_wings()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('key', w.key, 'kind', w.kind, 'name', w.name, 'note', w.note, 'tags', to_jsonb(w.tags), 'style', w.style)
                            order by w.sort, w.name), '[]'::jsonb)
    from public.museum_wings w
   where w.active;
$$;

-- ---------------------------------------------------------------- admin
create or replace function public.admin_wings()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('key', w.key, 'kind', w.kind, 'name', w.name, 'note', w.note,
                     'tags', to_jsonb(w.tags), 'sort', w.sort, 'active', w.active, 'style', w.style) order by w.sort, w.name)
                     from public.museum_wings w), '[]'::jsonb);
end;
$$;

-- The same as before, plus the room's style. Leaving the style out (as the app did before this
-- update) keeps the wing's style, so saving from an older page never resets it. One version of the
-- function only: two would make the six-argument call ambiguous.
drop function if exists public.admin_save_wing(text, text, text, text[], integer, boolean);
create or replace function public.admin_save_wing(p_key text, p_name text, p_note text, p_tags text[], p_sort integer, p_active boolean, p_style text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_kind text;
  v_tags text[];
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  if p_key is null or p_key !~ '^[a-z0-9][a-z0-9-]{1,23}$' then raise exception 'BAD_KEY' using errcode = 'P0001'; end if;
  if coalesce(char_length(trim(p_name)), 0) not between 2 and 30 then raise exception 'BAD_NAME' using errcode = 'P0001'; end if;
  if coalesce(char_length(trim(p_note)), 0) > 280 then raise exception 'BAD_NOTE' using errcode = 'P0001'; end if;
  if p_style is not null and p_style not in ('arcade', 'lab', 'library', 'garden', 'trophy') then raise exception 'BAD_STYLE' using errcode = 'P0001'; end if;
  select kind into v_kind from public.museum_wings where key = p_key;
  if coalesce(v_kind, 'tags') = 'tags' then
    -- Tags: trimmed, each 1–30 characters, no repeats (ignoring case), 1–12 of them.
    select coalesce(array_agg(t order by first), '{}') into v_tags from (
      select min(trim(x)) as t, min(o) as first
        from unnest(coalesce(p_tags, '{}')) with ordinality as u(x, o)
       where trim(x) <> ''
       group by lower(trim(x))) d;
    if cardinality(v_tags) = 0 or cardinality(v_tags) > 12 or exists (select 1 from unnest(v_tags) t where char_length(t) > 30) then
      raise exception 'BAD_TAGS' using errcode = 'P0001';
    end if;
  else
    v_tags := '{}';
  end if;
  insert into public.museum_wings as w (key, kind, name, note, tags, sort, active, style, updated_at)
  values (p_key, coalesce(v_kind, 'tags'), trim(p_name), coalesce(trim(p_note), ''), v_tags, coalesce(p_sort, 100), coalesce(p_active, true), coalesce(p_style, 'arcade'), now())
  on conflict (key) do update
    set name = excluded.name, note = excluded.note, tags = excluded.tags, sort = excluded.sort,
        active = excluded.active, style = coalesce(p_style, w.style), updated_at = now();
end;
$$;

-- ---------------------------------------------------------------- function privileges
revoke execute on function public.museum_wings(), public.admin_wings(), public.admin_save_wing(text, text, text, text[], integer, boolean, text)
  from public, anon, authenticated;
grant execute on function public.museum_wings() to anon, authenticated;
grant execute on function public.admin_wings(), public.admin_save_wing(text, text, text, text[], integer, boolean, text) to authenticated;
