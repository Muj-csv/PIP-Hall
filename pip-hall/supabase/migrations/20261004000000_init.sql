-- PIP-Hall — initial schema
-- Implements: docs/ARCHITECTURE.md §4 (data) and §5 (security); decisions D-002, D-003, D-007, D-012, D-014..D-017.
-- Model: `profiles` + `projects` are the member's private DRAFT. `published_cards` is the PUBLIC snapshot,
-- written only by admin functions. Visitors never read the draft tables.

-- ---------------------------------------------------------------- types
create type public.profile_status as enum ('draft', 'pending_review', 'approved', 'rejected', 'unpublished');
create type public.app_role as enum ('member', 'admin');
create type public.project_source as enum ('github', 'manual');

-- ---------------------------------------------------------------- roles
create table public.user_roles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       public.app_role not null default 'member',
  created_at timestamptz not null default now()
);

-- security definer so RLS policies can call it without recursing into user_roles' own RLS
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

-- every new auth user gets a member role row
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.user_roles (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- profiles (draft)
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  username         text not null unique
                   check (username ~ '^[a-z0-9][a-z0-9_-]{2,19}$')
                   check (username <> all (array[
                     'admin','api','app','auth','create','edit','explore','help','login','logout',
                     'me','member','members','hall','new','pip','pip-hall','piphall','pixendo','register','root','settings','support'])),
  full_name        text not null check (char_length(full_name) between 1 and 60),
  tagline          text check (char_length(tagline) <= 80),
  bio              text check (char_length(bio) <= 280),
  role             text check (char_length(role) <= 40),
  org_position     text check (char_length(org_position) <= 40),
  department       text check (char_length(department) <= 40),
  avatar_url       text check (avatar_url ~ '^https://'),
  github_username  text,  -- set only by sync_github_identity(), from the linked identity
  linkedin_url     text check (linkedin_url ~ '^https://([a-z]{2,3}\.)?linkedin\.com/'),
  portfolio_url    text check (portfolio_url ~ '^https://[^\s]+\.[^\s]+$'),
  public_email     text check (public_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  show_email       boolean not null default false,
  email_updates    boolean not null default false,  -- opt-in for update emails (sent after launch)
  skills           text[] not null default '{}'
                   check (cardinality(skills) <= 8),
  theme            text not null default 'classic' check (theme in ('classic')),
  status           public.profile_status not null default 'draft',
  review_note      text check (char_length(review_note) <= 280),
  is_featured      boolean not null default false,
  username_locked  boolean not null default false,
  submitted_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------- projects (draft)
create table public.projects (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  source          public.project_source not null default 'manual',
  github_repo_id  bigint,
  title           text not null check (char_length(title) between 1 and 60),
  description     text check (char_length(description) <= 200),
  cover_url       text check (cover_url ~ '^https://'),
  project_url     text check (project_url ~ '^https://[^\s]+\.[^\s]+$'),
  github_url      text check (github_url ~ '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$'),
  language        text check (char_length(language) <= 30),
  stars           integer check (stars >= 0),
  tech_stack      text[] not null default '{}' check (cardinality(tech_stack) <= 8),
  project_date    date,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (profile_id, github_repo_id),
  check ((source = 'github') = (github_repo_id is not null))
);
create index projects_profile_idx on public.projects (profile_id, sort_order);

-- ---------------------------------------------------------------- published_cards (public)
create table public.published_cards (
  profile_id    uuid primary key references public.profiles (id) on delete cascade,
  username      text not null unique,
  card          jsonb not null,           -- full public card: identity, links, skills, projects
  is_featured   boolean not null default false,
  published_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- triggers on drafts
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

-- A member editing their card moves the draft back to 'draft' (D-002). The public snapshot is untouched.
-- Locked usernames can't change. Runs as owner, so it can write columns members have no grant on.
create or replace function public.profiles_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if current_setting('piphall.internal', true) = 'on' then
    return new;  -- admin/system functions
  end if;
  if new.username is distinct from old.username and old.username_locked then
    raise exception 'USERNAME_LOCKED' using errcode = 'P0001';
  end if;
  if old.status <> 'draft' and (
       new.full_name, new.tagline, new.bio, new.role, new.org_position, new.department, new.avatar_url,
       new.linkedin_url, new.portfolio_url, new.public_email, new.show_email, new.skills, new.username)
     is distinct from
      (old.full_name, old.tagline, old.bio, old.role, old.org_position, old.department, old.avatar_url,
       old.linkedin_url, old.portfolio_url, old.public_email, old.show_email, old.skills, old.username)
  then
    new.status := 'draft';
  end if;
  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

create or replace function public.projects_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  pid uuid := coalesce(new.profile_id, old.profile_id);
begin
  if tg_op = 'INSERT' and (select count(*) from public.projects where profile_id = pid) >= 6 then
    raise exception 'PROJECT_LIMIT' using errcode = 'P0001';
  end if;
  if current_setting('piphall.internal', true) is distinct from 'on' then
    perform set_config('piphall.internal', 'on', true);
    update public.profiles set status = 'draft' where id = pid and status <> 'draft';
    perform set_config('piphall.internal', 'off', true);
  end if;
  return coalesce(new, old);
end;
$$;

create trigger projects_guard before insert or update or delete on public.projects
  for each row execute function public.projects_guard();

-- ---------------------------------------------------------------- member functions
-- Copies the verified GitHub username from the linked identity (D-003). Never trusts client input.
create or replace function public.sync_github_identity()
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  gh text;
begin
  select coalesce(i.identity_data ->> 'user_name', i.identity_data ->> 'preferred_username')
    into gh
    from auth.identities i
   where i.user_id = (select auth.uid()) and i.provider = 'github'
   limit 1;
  perform set_config('piphall.internal', 'on', true);
  update public.profiles set github_username = gh where id = (select auth.uid());
  perform set_config('piphall.internal', 'off', true);
  return gh;
end;
$$;

create or replace function public.submit_for_review()
returns public.profile_status
language plpgsql security definer set search_path = ''
as $$
declare
  p public.profiles;
begin
  select * into p from public.profiles where id = (select auth.uid()) for update;
  if not found then raise exception 'NO_PROFILE' using errcode = 'P0001'; end if;
  if p.status <> 'draft' then raise exception 'NOT_A_DRAFT' using errcode = 'P0001'; end if;
  perform set_config('piphall.internal', 'on', true);
  update public.profiles
     set status = 'pending_review', submitted_at = now(), review_note = null
   where id = p.id;
  perform set_config('piphall.internal', 'off', true);
  return 'pending_review';
end;
$$;

-- Storage files must be removed first through the Storage API (client), then this deletes the account.
create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from auth.users where id = (select auth.uid());
end;
$$;

-- ---------------------------------------------------------------- admin functions
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
    'avatar_url', p.avatar_url,
    'github_username', p.github_username,
    'linkedin_url', p.linkedin_url,
    'portfolio_url', p.portfolio_url,
    'public_email', case when p.show_email then p.public_email end,
    'skills', to_jsonb(p.skills),
    'theme', p.theme,
    'is_featured', p.is_featured,
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
               'title', pr.title, 'description', pr.description, 'cover_url', pr.cover_url,
               'project_url', pr.project_url, 'github_url', pr.github_url, 'language', pr.language,
               'stars', pr.stars, 'tech_stack', to_jsonb(pr.tech_stack), 'source', pr.source,
               'project_date', pr.project_date)
             order by pr.sort_order, pr.created_at)
        from public.projects pr where pr.profile_id = p.id), '[]'::jsonb)
  )
  from public.profiles p where p.id = p_id;
$$;

create or replace function public.approve_profile(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  p public.profiles;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  select * into p from public.profiles where id = p_id for update;
  if not found or p.status <> 'pending_review' then
    raise exception 'NOT_PENDING' using errcode = 'P0001';
  end if;
  perform set_config('piphall.internal', 'on', true);
  update public.profiles
     set status = 'approved', review_note = null, username_locked = true
   where id = p_id;
  insert into public.published_cards (profile_id, username, card, is_featured, published_at)
  values (p_id, p.username, public.build_card(p_id), p.is_featured, now())
  on conflict (profile_id) do update
    set username = excluded.username, card = excluded.card,
        is_featured = excluded.is_featured, published_at = excluded.published_at;
  perform set_config('piphall.internal', 'off', true);
end;
$$;

create or replace function public.reject_profile(p_id uuid, p_note text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'NOTE_REQUIRED' using errcode = 'P0001'; end if;
  perform set_config('piphall.internal', 'on', true);
  update public.profiles set status = 'rejected', review_note = left(p_note, 280)
   where id = p_id and status = 'pending_review';
  if not found then raise exception 'NOT_PENDING' using errcode = 'P0001'; end if;
  perform set_config('piphall.internal', 'off', true);
end;
$$;

create or replace function public.unpublish_profile(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  delete from public.published_cards where profile_id = p_id;
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
  update public.profiles set is_featured = p_featured where id = p_id;
  update public.published_cards
     set is_featured = p_featured, card = jsonb_set(card, '{is_featured}', to_jsonb(p_featured))
   where profile_id = p_id;
  perform set_config('piphall.internal', 'off', true);
end;
$$;

create or replace function public.admin_set_username(p_id uuid, p_username text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  perform set_config('piphall.internal', 'on', true);
  update public.profiles set username = lower(p_username) where id = p_id;
  update public.published_cards
     set username = lower(p_username), card = jsonb_set(card, '{username}', to_jsonb(lower(p_username)))
   where profile_id = p_id;
  perform set_config('piphall.internal', 'off', true);
end;
$$;

-- ---------------------------------------------------------------- privileges
-- Start from nothing, grant back exactly what each role needs.
revoke all on public.user_roles, public.profiles, public.projects, public.published_cards from anon, authenticated;

grant select on public.user_roles to authenticated;
grant select on public.published_cards to anon, authenticated;

grant select on public.profiles to authenticated;
grant insert (id, username, full_name, tagline, bio, role, org_position, department, avatar_url,
              linkedin_url, portfolio_url, public_email, show_email, email_updates, skills)
  on public.profiles to authenticated;
grant update (username, full_name, tagline, bio, role, org_position, department, avatar_url,
              linkedin_url, portfolio_url, public_email, show_email, email_updates, skills)
  on public.profiles to authenticated;

grant select, delete on public.projects to authenticated;
grant insert (profile_id, source, github_repo_id, title, description, cover_url, project_url, github_url,
              language, stars, tech_stack, project_date, sort_order)
  on public.projects to authenticated;
grant update (title, description, cover_url, project_url, github_url, language, stars, tech_stack,
              project_date, sort_order)
  on public.projects to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.is_admin(), public.sync_github_identity(), public.submit_for_review(),
  public.delete_my_account(), public.approve_profile(uuid), public.reject_profile(uuid, text),
  public.unpublish_profile(uuid), public.set_featured(uuid, boolean), public.admin_set_username(uuid, text)
  to authenticated;

-- ---------------------------------------------------------------- row level security
alter table public.user_roles      enable row level security;
alter table public.profiles        enable row level security;
alter table public.projects        enable row level security;
alter table public.published_cards enable row level security;

create policy "own role or admin" on public.user_roles
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "public cards are public" on public.published_cards
  for select to anon, authenticated using (true);

create policy "read own draft or admin" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
create policy "create own draft" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "edit own draft" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "read own projects or admin" on public.projects
  for select to authenticated using (profile_id = (select auth.uid()) or (select public.is_admin()));
create policy "add own projects" on public.projects
  for insert to authenticated with check (profile_id = (select auth.uid()));
create policy "edit own projects" on public.projects
  for update to authenticated using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy "remove own projects" on public.projects
  for delete to authenticated using (profile_id = (select auth.uid()));
