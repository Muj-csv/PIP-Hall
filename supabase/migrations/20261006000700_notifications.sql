-- Notifications and "Recent in the hall" (docs/plan/V2-LIVING-HALL.md, V2-4; D-100).
--
-- Both read hall_events (D-099); nothing new is invented.
--   * Every event now has a RECIPIENT: the member it concerns (the actor, the project owner for an
--     accepted tag, the tagged member for a request or a published credit). A member's bell lists
--     the events addressed to them, and a read marker says which ones are new.
--   * New events: COLLAB_REQUESTED (private, to the tagged member), CARD_REJECTED (private, with the
--     admin's note) and COLLAB_PUBLISHED (public: an approval put a collaborator's name on a project).
--   * recent_hall_events(): the public strip. Only public events of members still in the hall, and
--     only while the fact is still true (the project is still on the card, the member still
--     featured). Never discoveries (D-063), never counts. Visitors can read it (rule 2).
-- Safe to run again.

-- ---------------------------------------------------------------- recipients and new event types
alter table public.hall_events add column if not exists recipient_id uuid references public.profiles (id) on delete cascade;
update public.hall_events set recipient_id = coalesce((metadata->>'owner')::uuid, actor_id) where recipient_id is null;
create index if not exists hall_events_recipient_idx on public.hall_events (recipient_id, created_at desc);

alter table public.hall_events drop constraint if exists hall_events_event_type_check;
alter table public.hall_events add constraint hall_events_event_type_check check (event_type in (
  'CARD_APPROVED', 'PROJECT_PUBLISHED', 'EXHIBIT_ADDED', 'COLLAB_ACCEPTED', 'ACHIEVEMENT_UNLOCKED',
  'MISSION_COMPLETED', 'MEMBER_FEATURED', 'COLLAB_REQUESTED', 'CARD_REJECTED', 'COLLAB_PUBLISHED'));

-- The recipient comes from metadata.recipient, else metadata.owner, else the actor. log_event()
-- keeps its signature, so the D-099 functions don't change.
create or replace function public.hall_event_recipient()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.recipient_id is null then
    new.recipient_id := coalesce((new.metadata->>'recipient')::uuid, (new.metadata->>'owner')::uuid, new.actor_id);
  end if;
  return new;
end;
$$;
drop trigger if exists hall_events_recipient on public.hall_events;
create trigger hall_events_recipient before insert on public.hall_events
  for each row execute function public.hall_event_recipient();

drop policy if exists "own hall events" on public.hall_events;
create policy "own hall events" on public.hall_events
  for select to authenticated
  using (actor_id = (select auth.uid()) or recipient_id = (select auth.uid()) or metadata->>'owner' = (select auth.uid())::text);

-- Approvals, new projects and featuring (as in D-099), plus COLLAB_PUBLISHED for each collaborator
-- an approval newly credits. The credit is public because the card now shows it (ADR-002).
create or replace function public.events_published_card()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  pr jsonb;
  m jsonb;
  credited uuid;
begin
  if tg_op = 'INSERT' or new.published_at is distinct from old.published_at then
    perform public.log_event(new.profile_id, 'CARD_APPROVED', 'card', new.username, jsonb_build_object('member_no', new.member_no), 'public');
    for pr in select p from jsonb_array_elements(new.card->'projects') p loop
      if pr->>'id' is not null and (tg_op = 'INSERT' or not exists (
            select 1 from jsonb_array_elements(old.card->'projects') o where o->>'id' = pr->>'id')) then
        perform public.log_event(new.profile_id, 'PROJECT_PUBLISHED', 'project', pr->>'id',
          jsonb_build_object('title', pr->>'title', 'makers', 1 + coalesce(jsonb_array_length(pr->'collaborators'), 0)), 'public');
      end if;
      for m in select x from jsonb_array_elements(coalesce(pr->'collaborators', '[]'::jsonb)) x loop
        if tg_op = 'INSERT' or not exists (
             select 1 from jsonb_array_elements(old.card->'projects') o, jsonb_array_elements(coalesce(o->'collaborators', '[]'::jsonb)) oc
              where o->>'id' = pr->>'id' and oc->>'username' = m->>'username') then
          select profile_id into credited from public.published_cards where username = m->>'username';
          if credited is not null then
            perform public.log_event(new.profile_id, 'COLLAB_PUBLISHED', 'project', pr->>'id',
              jsonb_build_object('title', pr->>'title', 'with', m->>'username', 'recipient', credited), 'public');
          end if;
        end if;
      end loop;
    end loop;
  end if;
  if tg_op = 'UPDATE' and new.is_featured and not old.is_featured then
    perform public.log_event(new.profile_id, 'MEMBER_FEATURED', 'card', new.username, '{}'::jsonb, 'public');
  end if;
  return null;
end;
$$;

-- A tag is a request to the tagged member. Private: only they (and the owner, the actor) see it.
create or replace function public.events_collab_request()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  owner_id uuid := (select profile_id from public.projects where id = new.project_id);
begin
  perform public.log_event(owner_id, 'COLLAB_REQUESTED', 'project', new.project_id::text,
    jsonb_build_object('recipient', new.member_id), 'private');
  return null;
end;
$$;
drop trigger if exists project_collaborators_request_events on public.project_collaborators;
create trigger project_collaborators_request_events after insert on public.project_collaborators
  for each row execute function public.events_collab_request();

-- "Needs changes": the admin's note goes only to the member.
create or replace function public.events_profile_rejected()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'rejected' and old.status is distinct from 'rejected' then
    perform public.log_event(new.id, 'CARD_REJECTED', 'card', new.username, jsonb_build_object('note', new.review_note), 'private');
  end if;
  return null;
end;
$$;
drop trigger if exists profiles_rejected_events on public.profiles;
create trigger profiles_rejected_events after update of status on public.profiles
  for each row execute function public.events_profile_rejected();

-- ---------------------------------------------------------------- the bell
create table if not exists public.notification_reads (
  member_id  uuid primary key references public.profiles (id) on delete cascade,
  seen_at    timestamptz not null default now()
);
revoke all on public.notification_reads from anon, authenticated;
alter table public.notification_reads enable row level security;

-- {seen_at, items: [{id, type, at, target_type, target_id, title, note, by_username, by_name}]}
-- Events addressed to me, newest first. My own doings (projects I published, exhibits I added,
-- Missions) aren't news to me; a request whose tag was withdrawn is dropped.
create or replace function public.my_notifications(p_limit integer default 30)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'seen_at', (select seen_at from public.notification_reads where member_id = (select auth.uid())),
    'items', coalesce((
      select jsonb_agg(n order by (n->>'id')::bigint desc) from (
        select jsonb_build_object(
                 'id', e.id, 'type', e.event_type, 'at', e.created_at,
                 'target_type', e.target_type, 'target_id', e.target_id,
                 'title', case when e.target_type = 'project' then coalesce(pr.title, e.metadata->>'title')
                               when e.target_type = 'achievement' then a.name end,
                 'note', e.metadata->>'note',
                 'by_username', case when e.actor_id is distinct from e.recipient_id then ap.username end,
                 'by_name', case when e.actor_id is distinct from e.recipient_id then coalesce(ac.card->>'full_name', ap.full_name) end) as n
          from public.hall_events e
          left join public.projects pr on e.target_type = 'project' and pr.id::text = e.target_id
          left join public.achievements a on e.target_type = 'achievement' and a.key = e.target_id
          left join public.profiles ap on ap.id = e.actor_id
          left join public.published_cards ac on ac.profile_id = e.actor_id
         where e.recipient_id = (select auth.uid())
           and e.event_type in ('CARD_APPROVED', 'CARD_REJECTED', 'COLLAB_REQUESTED', 'COLLAB_ACCEPTED',
                                'COLLAB_PUBLISHED', 'ACHIEVEMENT_UNLOCKED', 'MEMBER_FEATURED')
           and (e.event_type <> 'COLLAB_REQUESTED' or exists (
                 select 1 from public.project_collaborators pc
                  where pc.project_id::text = e.target_id and pc.member_id = e.recipient_id))
         order by e.id desc
         limit greatest(1, least(coalesce(p_limit, 30), 50))
      ) x(n)), '[]'::jsonb));
$$;

create or replace function public.mark_notifications_seen()
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  at timestamptz := now();
begin
  if me is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = me) then raise exception 'NO_PROFILE' using errcode = 'P0001'; end if;
  insert into public.notification_reads (member_id, seen_at) values (me, at)
    on conflict (member_id) do update set seen_at = excluded.seen_at;
  return at;
end;
$$;

-- ---------------------------------------------------------------- Recent in the hall (public)
-- [{id, type, at, username, full_name, title, project_id, with_username, with_name}]
-- A first approval reads "joined the hall"; later approvals and the projects that arrive with the
-- first one are left out, so one approval is one line.
create or replace function public.recent_hall_events(p_limit integer default 8)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(r order by (r->>'id')::bigint desc), '[]'::jsonb) from (
    select jsonb_build_object(
             'id', e.id, 'type', e.event_type, 'at', e.created_at,
             'username', c.username, 'full_name', c.card->>'full_name',
             'title', case when e.event_type = 'ACHIEVEMENT_UNLOCKED' then a.name else pj.p->>'title' end,
             'project_id', case when e.target_type in ('project', 'exhibit') then e.target_id end,
             'with_username', w.username, 'with_name', w.card->>'full_name') as r
      from (select * from public.hall_events
             where visibility = 'public'
               and event_type in ('CARD_APPROVED', 'PROJECT_PUBLISHED', 'EXHIBIT_ADDED', 'COLLAB_PUBLISHED',
                                  'ACHIEVEMENT_UNLOCKED', 'MEMBER_FEATURED')
             order by id desc limit 400) e
      join public.published_cards c on c.profile_id = e.actor_id
      left join lateral (select x as p from jsonb_array_elements(c.card->'projects') x
                          where e.target_type in ('project', 'exhibit') and x->>'id' = e.target_id limit 1) pj on true
      left join public.published_cards w on e.event_type = 'COLLAB_PUBLISHED' and w.username = e.metadata->>'with'
      left join public.achievements a on e.event_type = 'ACHIEVEMENT_UNLOCKED' and a.key = e.target_id
     where case e.event_type
             when 'CARD_APPROVED' then not exists (select 1 from public.hall_events f
                                                    where f.actor_id = e.actor_id and f.event_type = 'CARD_APPROVED' and f.id < e.id)
             when 'PROJECT_PUBLISHED' then pj.p is not null and not exists (
                                                    select 1 from public.hall_events f
                                                     where f.actor_id = e.actor_id and f.event_type = 'CARD_APPROVED' and f.created_at = e.created_at
                                                       and not exists (select 1 from public.hall_events g
                                                                        where g.actor_id = e.actor_id and g.event_type = 'CARD_APPROVED' and g.id < f.id))
             when 'EXHIBIT_ADDED' then pj.p is not null and exists (select 1 from public.museum_entries me where me.project_id::text = e.target_id)
             when 'COLLAB_PUBLISHED' then w.profile_id is not null and exists (
                                                    select 1 from jsonb_array_elements(coalesce(pj.p->'collaborators', '[]'::jsonb)) m
                                                     where m->>'username' = w.username)
             when 'ACHIEVEMENT_UNLOCKED' then a.key is not null
             when 'MEMBER_FEATURED' then c.is_featured
           end
     order by e.id desc
     limit greatest(1, least(coalesce(p_limit, 8), 20))
  ) x(r);
$$;

-- ---------------------------------------------------------------- function privileges
revoke execute on function public.hall_event_recipient(), public.events_collab_request(), public.events_profile_rejected()
  from public, anon, authenticated;
revoke execute on function public.my_notifications(integer), public.mark_notifications_seen(), public.recent_hall_events(integer)
  from public, anon, authenticated;
grant execute on function public.my_notifications(integer), public.mark_notifications_seen() to authenticated;
grant execute on function public.recent_hall_events(integer) to anon, authenticated;
