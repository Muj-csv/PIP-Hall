-- The Museum as a place (docs/plan/V2-LIVING-HALL.md, V2-6; D-102).
--
-- WINGS group exhibits by what they really are. A wing is a name, a short curator note written by
-- an admin, and a rule; which exhibits hang in it is worked out from the exhibits themselves
-- (museum_exhibits()), never typed in, so a wing can't claim a project that doesn't fit it.
--   * featured: exhibits by members an admin featured (D-083).
--   * collab:   team projects (accepted collaborators, D-089).
--   * tags:     projects whose language or tech stack names one of the wing's tags.
-- Wings are open to everyone; no wing is ever behind PIPs (rule 6). Only admins write wings and
-- their notes. Seeded wings start with no note: the words are the curator's. Safe to run again.

create table if not exists public.museum_wings (
  key         text primary key check (key ~ '^[a-z0-9][a-z0-9-]{1,23}$'),
  kind        text not null check (kind in ('featured', 'collab', 'tags')),
  name        text not null check (char_length(name) between 2 and 30),
  note        text not null default '' check (char_length(note) <= 280),
  tags        text[] not null default '{}' check (cardinality(tags) <= 12),
  sort        integer not null default 100,
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);

insert into public.museum_wings (key, kind, name, tags, sort) values
  ('featured', 'featured', 'Featured Wing', '{}', 0),
  ('collab',   'collab',   'Collab Wing',   '{}', 1),
  ('web',      'tags',     'Web Wing',      '{JavaScript,TypeScript,HTML,CSS,React,Vue,Svelte,Next.js,PWA,Node.js}', 10),
  ('games',    'tags',     'Games Wing',    '{Unity,Godot,C#,Phaser,Pygame,Game,Lua,GDScript}', 11),
  ('data',     'tags',     'Data Wing',     '{Python,SQL,Postgres,Pandas,Jupyter,R,Machine Learning,Data}', 12)
on conflict (key) do nothing;

revoke all on public.museum_wings from anon, authenticated;
alter table public.museum_wings enable row level security;

-- ---------------------------------------------------------------- public
-- [{key, kind, name, note, tags}] for the wings that are open, in order.
create or replace function public.museum_wings()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('key', w.key, 'kind', w.kind, 'name', w.name, 'note', w.note, 'tags', to_jsonb(w.tags))
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
                     'tags', to_jsonb(w.tags), 'sort', w.sort, 'active', w.active) order by w.sort, w.name)
                     from public.museum_wings w), '[]'::jsonb);
end;
$$;

-- Creates a tag wing, or changes any wing's name, note, order and whether it is open. The
-- featured and collab wings keep their rule (their tags stay empty).
create or replace function public.admin_save_wing(p_key text, p_name text, p_note text, p_tags text[], p_sort integer, p_active boolean)
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
  insert into public.museum_wings (key, kind, name, note, tags, sort, active, updated_at)
  values (p_key, coalesce(v_kind, 'tags'), trim(p_name), coalesce(trim(p_note), ''), v_tags, coalesce(p_sort, 100), coalesce(p_active, true), now())
  on conflict (key) do update
    set name = excluded.name, note = excluded.note, tags = excluded.tags, sort = excluded.sort,
        active = excluded.active, updated_at = now();
end;
$$;

-- Removes a tag wing. The featured and collab wings can be closed, not removed.
create or replace function public.admin_delete_wing(p_key text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  if exists (select 1 from public.museum_wings where key = p_key and kind <> 'tags') then
    raise exception 'BUILT_IN' using errcode = 'P0001';
  end if;
  delete from public.museum_wings where key = p_key;
  if not found then raise exception 'NO_SUCH_WING' using errcode = 'P0001'; end if;
end;
$$;

-- ---------------------------------------------------------------- function privileges
revoke execute on function public.museum_wings(), public.admin_wings(), public.admin_save_wing(text, text, text, text[], integer, boolean),
  public.admin_delete_wing(text) from public, anon, authenticated;
grant execute on function public.museum_wings() to anon, authenticated;
grant execute on function public.admin_wings(), public.admin_save_wing(text, text, text, text[], integer, boolean),
  public.admin_delete_wing(text) to authenticated;
