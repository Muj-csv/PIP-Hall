// /museum (D-069): a walk through the hall's projects, shuffled on every visit; exhibits show them
// as approved. Since D-130 the Museum is curated: projects an admin features (pinned in their own
// row on top; Shuffle never moves them, D-083), the winners of the hall's events, and the archive.
// Wings (V2-6, D-102): doorways at the top lead into rooms built from the exhibits themselves
// (/museum?wing=web), each with its curator's note and the way on to the other wings.
// Events (V2-9, D-115, D-116): the Winners' Hall comes first, with every announced place and award
// on a pedestal with its ribbon and the judges' note; each hackathon or building event has its own
// room (/museum?event=key) with its winners by track, once announced (D-130).
// The archive (V2-10, D-118): past projects hang with the rest, in their wings and their event's
// room, their winners in the Winners' Hall, and all of them in The Archive (/museum?room=archive),
// by year.
// The walkable Museum (V2-11, D-119): Pip walks the rooms on the PIXENDO's screen (MuseumWalk, a
// lazy chunk, ?view=walk); this page's rooms and grids are the List view (?view=list), what very
// narrow screens (and 400% zoom) open first. Since D-129 the Museum opens as two circles (rooms and
// their exhibits, MuseumCircles, another lazy chunk). All three views share the address.

import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAppearance } from '../app/appearanceContext';
import { DialogueBox } from '../components/dialogue/DialogueBox';
import { MenuPage } from '../components/shell/MenuPage';
import { officerUsernames } from '../lib/officers';
import { exhibitPath, memberPath } from '../lib/publicUrl';
import { creditLine } from '../lib/collab';
import { ARCHIVE_ROOM, archiveAsExhibit, archiveAward, archiveCases, archiveOrigin, archiveRoomPath, byYear, withArchive, type ArchiveExhibit, type TrophyCase } from '../lib/archive';
import { awardLabel, entriesByTrack, eventRoomPath, KIND_NAME, kindOf, phaseLine, winnersOf, type Award, type MuseumEvent } from '../lib/events';
import { arrangeMuseum, consoleFor } from '../lib/museum';
import { roomFromParams, roomParams, type MuseumParts } from '../lib/museumWalk';
import { eventCase } from '../lib/showcase';
import { useMediaQuery } from '../lib/useMediaQuery';
import { dateRange } from '../lib/seasons';
import { DEFAULT_WINGS, wingPath, wingRooms, wingRule, type Wing, type WingRoom } from '../lib/wings';
import { archiveService } from '../services/archiveService';
import { eventService } from '../services/eventService';
import { museumService } from '../services/museumService';
import { ArchiveCredit } from '../components/museum/ArchiveCredit';
import { ExhibitArt } from '../components/museum/ExhibitArt';
import { Ribbon } from '../components/museum/Ribbon';
import type { Exhibit, MuseumCuration } from '../types/museum';
import { arrangeRooms, isShut, MEMBERS_ROOM, NO_CURATION, picksByWing, portraits, signOf } from '../lib/curation';
import { useCards } from '../lib/useCards';
import { PortraitArt } from '../components/museum/PortraitArt';

const MuseumWalk = lazy(() => import('../components/museum/MuseumWalk'));
const MuseumCircles = lazy(() => import('../components/museum/MuseumCircles'));

/** A list-view address keeps the list view. */
const inList = (path: string) => `${path}${path.includes('?') ? '&' : '?'}view=list`;

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; exhibits: Exhibit[] };
const EMPTY = 'The Museum is waiting for its first exhibit. It shows what the hall’s admins hang: featured projects and members, the winners of its events, and its archive.';
type Events = 'loading' | 'error' | MuseumEvent[];
type Archive = 'loading' | 'error' | ArchiveExhibit[];


export default function Museum() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [round, setRound] = useState(0);
  const [wings, setWings] = useState<Wing[] | null>(null);
  const [events, setEvents] = useState<Events>('loading');
  const [archive, setArchive] = useState<Archive>('loading');
  // How the admins arranged it (D-133); until it arrives, nothing arranged.
  const [curation, setCuration] = useState<MuseumCuration | null>(null);
  const cardsState = useCards();
  const [params, setParams] = useSearchParams();
  // The circles by default (D-129); the list first on very narrow screens (D-119). ?view= picks one.
  const narrow = useMediaQuery('(max-width: 359px)');
  const asked = params.get('view');
  const view = asked === 'list' || asked === 'walk' || asked === 'circles' ? asked : narrow ? 'list' : 'circles';

  useEffect(() => {
    let on = true;
    museumService
      .exhibits()
      .then((exhibits) => on && setLoad({ status: 'ready', exhibits }))
      .catch(() => on && setLoad({ status: 'error' }));
    museumService
      .wings()
      .then((w) => on && setWings(w))
      .catch(() => on && setWings([...DEFAULT_WINGS])); // the rooms still work, without notes
    eventService
      .museumEvents()
      .then((e) => on && setEvents(e))
      .catch(() => on && setEvents('error'));
    archiveService
      .list()
      .then((a) => on && setArchive(a))
      .catch(() => on && setArchive('error'));
    museumService
      .curation()
      .then((c) => on && setCuration(c))
      .catch(() => on && setCuration(NO_CURATION)); // the rooms still open, as the database orders them
    return () => {
      on = false;
    };
  }, [attempt]);

  const past = useMemo(() => (Array.isArray(archive) ? archive : []), [archive]);
  // Members' exhibits and the archive's hang together, in every room and wing.
  const exhibits = useMemo(() => (load.status === 'ready' ? [...load.exhibits, ...past.map(archiveAsExhibit)] : null), [load, past]);
  // Event rooms hold their winners and the archive's exhibits from them; a room with neither stays shut.
  const eventList = useMemo(() => withArchive(Array.isArray(events) ? events : [], past).filter((e) => e.entries.length > 0), [events, past]);
  // A new order on every visit and every Shuffle (round is the trigger); featured stay pinned.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { featured, rest } = useMemo(() => arrangeMuseum(exhibits ?? []), [exhibits, round]);
  // The Officers' Wing follows the current officers (D-123).
  const { officers } = useAppearance();
  const officerNames = useMemo(() => officerUsernames(officers), [officers]);
  const arranged = curation ?? NO_CURATION;
  const picks = useMemo(() => picksByWing(arranged), [arranged]);
  const allRooms = useMemo(() => wingRooms(wings ?? [], exhibits ?? [], { officers: officerNames, picks }), [wings, exhibits, officerNames, picks]);
  // A shut wing keeps its exhibits; its door is closed (D-133).
  const rooms = useMemo(() => allRooms.filter((r) => !isShut(arranged, `wing:${r.wing.key}`)).map((r) => ({ ...r, wing: { ...r.wing, name: signOf(arranged, `wing:${r.wing.key}`, r.wing.name) } })), [allRooms, arranged]);
  // The featured members, as portraits (D-133).
  const cards = useMemo(() => (cardsState.status === 'ready' ? cardsState.cards : []), [cardsState]);
  const members = useMemo(() => portraits(arranged, cards), [arranged, cards]);
  const wingKey = params.get('wing');
  const eventKey = params.get('event');
  const archiveOpen = params.get('room') === ARCHIVE_ROOM;
  const membersOpen = params.get('room') === MEMBERS_ROOM;
  const room = rooms.find((r) => r.wing.key === wingKey) ?? null;
  const shutEvent = eventKey !== null && isShut(arranged, `event:${eventKey}`);
  const found = eventList.find((e) => e.key === eventKey) ?? null;
  const eventRoom = found && !shutEvent ? { ...found, name: signOf(arranged, `event:${found.key}`, found.name) } : null;
  // An address for a room the admins shut says so, rather than that it is empty.
  const shutRoom = (wingKey !== null && isShut(arranged, `wing:${wingKey}`)) || shutEvent || (archiveOpen && isShut(arranged, 'archive')) || (membersOpen && isShut(arranged, MEMBERS_ROOM));
  // A new order in the room too; it follows Shuffle like the main hall.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const roomOrder = useMemo(() => (room ? arrangeMuseum(room.exhibits) : null), [room, round]);
  const trophies = useMemo(
    () => [...eventList.map(eventCase), ...archiveCases(past, new Set(eventList.map((e) => e.key)))].filter((t) => t.winners.length > 0).sort((a, b) => b.sort.localeCompare(a.sort)),
    [eventList, past],
  );
  const winnersShut = isShut(arranged, 'winners');
  const allShut = isShut(arranged, 'all');
  // The walk's rooms: each wing in a new order this visit, featured projects first.
  const walkParts = useMemo<MuseumParts>(
    () => ({
      trophies,
      events: eventList,
      wings: allRooms.map((r) => {
        const o = arrangeMuseum(r.exhibits);
        return { wing: r.wing, exhibits: [...o.featured, ...o.rest] };
      }),
      everything: { featured, rest },
      archive: past,
      members,
      curation: arranged,
    }),
    // allRooms, not rooms: planRooms shuts and signs the rooms itself.
    [trophies, eventList, allRooms, featured, rest, past, members, arranged],
  );
  /** Pip walked into another room (the address follows), or opens an exhibit (Back returns to it). */
  const onRoom = useCallback(
    (id: string, at?: string) => {
      const [k, v] = roomParams(id);
      const next = new URLSearchParams({ [k]: v });
      if (asked === 'walk' || asked === 'circles') next.set('view', asked);
      if (at) {
        next.set('at', at);
        // Rewritten in place just before the exhibit opens, so Back lands on this exhibit.
        window.history.replaceState(window.history.state, '', `/museum?${next}`);
      } else setParams(next, { replace: true });
    },
    [asked, setParams],
  );
  const viewHref = (v: 'circles' | 'walk' | 'list') => {
    const next = new URLSearchParams(params);
    next.delete('view');
    next.delete('at');
    if (v !== 'circles' || narrow) next.set('view', v);
    const q = next.toString();
    return q ? `/museum?${q}` : '/museum';
  };
  const retry = useCallback(() => {
    setLoad({ status: 'loading' });
    setEvents('loading');
    setArchive('loading');
    setAttempt((a) => a + 1);
  }, []);

  const anything = Boolean(exhibits && (exhibits.length > 0 || eventList.some((e) => e.entries.length > 0) || members.length > 0));
  const lobby = !wingKey && !eventKey && !archiveOpen && !membersOpen;
  const current = wingKey ? `wing:${wingKey}` : eventKey ? `event:${eventKey}` : archiveOpen ? ARCHIVE_ROOM : membersOpen ? MEMBERS_ROOM : null;
  // The list view's doors, in the admins' order, with their signs; shut rooms have none.
  const doors = useMemo(
    () =>
      arrangeRooms(
        [
          ...(members.length > 0 ? [{ id: MEMBERS_ROOM, name: 'Featured Members', to: `/museum?room=${MEMBERS_ROOM}`, kind: 'members', detail: `${members.length} ${members.length === 1 ? 'member' : 'members'}` }] : []),
          ...allRooms.map(({ wing, exhibits: x }) => ({ id: `wing:${wing.key}`, name: wing.name, to: wingPath(wing.key), kind: wing.kind as string, detail: `${x.length} ${x.length === 1 ? 'exhibit' : 'exhibits'}` })),
          ...(past.length > 0 ? [{ id: ARCHIVE_ROOM, name: 'The Archive', to: archiveRoomPath(), kind: 'archive', detail: `${past.length} ${past.length === 1 ? 'exhibit' : 'exhibits'}` }] : []),
          ...eventList.map((e) => ({ id: `event:${e.key}`, name: e.name, to: eventRoomPath(e.key), kind: 'event', detail: e.phase === 'results' ? '♛ Results in' : `${e.entries.length} ${e.entries.length === 1 ? 'entry' : 'entries'}` })),
        ],
        arranged,
      ),
    [members, allRooms, past, eventList, arranged],
  );

  const settled = wings !== null && events !== 'loading' && archive !== 'loading' && curation !== null && (members.length > 0 || cardsState.status !== 'loading' || arranged.portraits.length === 0);

  return (
    <MenuPage title="Museum" wide>
      <nav className="museum-views" aria-label="How to see the Museum">
        <Link to={viewHref('list')} className="chip" aria-current={view === 'list' ? 'page' : undefined}>
          <span aria-hidden="true">☰ </span>List view<span className="sr-only"> (reads best with a screen reader)</span>
        </Link>
        <Link to={viewHref('circles')} className="chip" aria-current={view === 'circles' ? 'page' : undefined}>
          <span aria-hidden="true">◎ </span>Rooms and exhibits
        </Link>
        <Link to={viewHref('walk')} className="chip" aria-current={view === 'walk' ? 'page' : undefined}>
          <span aria-hidden="true">▶ </span>Walk the Museum
        </Link>
      </nav>
      {load.status === 'loading' && <DialogueBox text="Unlocking the gallery…" emote="pending" />}
      {load.status === 'error' && (
        <DialogueBox text="Can’t reach the Museum right now. Check your connection and try again." emote="attention">
          <button type="button" className="hw-btn" data-variant="small" onClick={retry}>
            RETRY
          </button>
        </DialogueBox>
      )}
      {view !== 'list' && exhibits && !settled && <DialogueBox text="Opening the doors…" emote="pending" />}
      {view !== 'list' && exhibits && settled && !anything && <DialogueBox text={EMPTY} />}
      {view === 'circles' && exhibits && settled && anything && (
        <Suspense fallback={<DialogueBox text="Opening the doors…" emote="pending" />}>
          <MuseumCircles parts={walkParts} room={roomFromParams(params)} at={params.get('at')} onRoom={onRoom} />
        </Suspense>
      )}
      {view === 'walk' && exhibits && settled && anything && (
        <Suspense fallback={<DialogueBox text="Opening the doors…" emote="pending" />}>
          <MuseumWalk parts={walkParts} room={roomFromParams(params)} at={params.get('at')} onRoom={onRoom} />
        </Suspense>
      )}

      {view === 'list' && (
        <>
          {exhibits && !anything && lobby && events !== 'loading' && archive !== 'loading' && (
            <DialogueBox text={EMPTY} />
          )}
          {exhibits && doors.length > 0 && <Doors doors={doors} all={signOf(arranged, 'all', 'All exhibits')} current={current} />}

          {exhibits && shutRoom && (
            <DialogueBox text="That room is closed right now. Every other room is still open." emote="attention">
              <Link to={inList('/museum')} className="hw-btn no-underline" data-variant="small">
                ALL EXHIBITS
              </Link>
            </DialogueBox>
          )}
          {exhibits && membersOpen && !shutRoom && (
            <MembersRoomView members={members} name={signOf(arranged, MEMBERS_ROOM, 'Featured Members')} loading={cardsState.status === 'loading' || curation === null} />
          )}
          {exhibits && wingKey && !room && wings && !shutRoom && (
            <DialogueBox text="That wing has nothing on show right now. Every other room is still open." emote="attention">
              <Link to={inList('/museum')} className="hw-btn no-underline" data-variant="small">
                ALL EXHIBITS
              </Link>
            </DialogueBox>
          )}
          {exhibits && room && roomOrder && <WingRoomView room={room} order={[...roomOrder.featured, ...roomOrder.rest]} onShuffle={() => setRound((r) => r + 1)} />}

          {exhibits && eventKey && events === 'loading' && <DialogueBox text="Opening the event room…" emote="pending" />}
          {exhibits && eventKey && events === 'error' && (
            <DialogueBox text="Can’t open the event rooms right now. Check your connection and try again." emote="attention">
              <button type="button" className="hw-btn" data-variant="small" onClick={retry}>
                RETRY
              </button>
            </DialogueBox>
          )}
          {exhibits && eventKey && Array.isArray(events) && !eventRoom && !shutRoom && (
            <DialogueBox text="That event’s room isn’t open. It opens once the event’s winners are announced." emote="attention">
              <Link to={inList('/museum')} className="hw-btn no-underline" data-variant="small">
                ALL EXHIBITS
              </Link>
            </DialogueBox>
          )}
          {exhibits && eventRoom && <EventRoomView event={eventRoom} />}

          {exhibits && archiveOpen && archive === 'loading' && <DialogueBox text="Dusting off the Archive…" emote="pending" />}
          {exhibits && archiveOpen && archive === 'error' && (
            <DialogueBox text="Can’t open the Archive right now. Check your connection and try again." emote="attention">
              <button type="button" className="hw-btn" data-variant="small" onClick={retry}>
                RETRY
              </button>
            </DialogueBox>
          )}
          {exhibits && archiveOpen && Array.isArray(archive) && !shutRoom && <ArchiveRoomView archive={archive} name={signOf(arranged, ARCHIVE_ROOM, 'The Archive')} />}

          {exhibits && lobby && anything && (
            <DialogueBox
              text={
                trophies.length > 0 && !winnersShut
                  ? 'Welcome to the Museum! The winners of the hall’s events stand in the Winners’ Hall; every other exhibit is in a new order each visit.'
                  : featured.length > 0
                    ? 'Welcome to the Museum! Featured projects hang up top; the rest are in a new order every visit.'
                    : 'Welcome to the Museum: projects from the hall and its archive, in a new order every visit.'
              }
            />
          )}
          {exhibits && lobby && trophies.length > 0 && !winnersShut && <WinnersHall trophies={trophies} name={signOf(arranged, 'winners', 'Winners’ Hall')} />}
          {exhibits && lobby && exhibits.length > 0 && !allShut && (
            <>
              <div className="flex flex-wrap items-center gap-space-3">
                <button type="button" className="pixel-btn" data-variant="primary" onClick={() => setRound((r) => r + 1)}>
                  <span aria-hidden="true">⟳ </span>Shuffle
                </button>
                <p className="m-0 font-display tracking-[0.04em]" role="status">
                  {exhibits.length} {exhibits.length === 1 ? 'exhibit' : 'exhibits'}
                </p>
              </div>
              {featured.length > 0 && (
                <section className="museum-featured" aria-labelledby="museum-featured-title">
                  <h2 id="museum-featured-title" className="panel-title">
                    Featured
                  </h2>
                  <ul className="museum-grid" aria-label="Featured exhibits">
                    {featured.map((e) => (
                      <li key={e.project_id}>
                        <ExhibitFrame exhibit={e} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {rest.length > 0 && (
                <ul className="museum-grid" aria-label={featured.length > 0 ? 'More exhibits' : 'Exhibits'}>
                  {rest.map((e) => (
                    <li key={e.project_id}>
                      <ExhibitFrame exhibit={e} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </MenuPage>
  );
}

function ExhibitFrame({ exhibit: e, awards, event }: { exhibit: Exhibit; awards?: readonly Award[]; event?: string }) {
  const p = e.project;
  const past = e.archive;
  // An archive exhibit carries its own award, wherever it hangs.
  const shown = awards ?? (past ? [archiveAward(past)].filter((a): a is Award => a !== null) : []);
  const at = event ?? past?.event ?? undefined;
  const facts = [p.language, ...p.tech_stack].filter(Boolean).slice(0, 4).join(' · ');
  // A winner can hang twice on one page (the Winners' Hall and its room), so ids are per frame.
  const id = useId();
  return (
    <article className="exhibit" aria-labelledby={id}>
      <Link to={exhibitPath(e.project_id)} className="exhibit-art-link" tabIndex={-1} aria-hidden="true">
        <ExhibitArt project={p} console={consoleFor(e.project_id, e.console)} featured={e.featured} />
      </Link>
      <div className="exhibit-plaque">
        <h2 id={id} className="m-0 font-display text-h3 font-normal">
          <Link to={exhibitPath(e.project_id)} className="exhibit-title-link">
            {p.title}
          </Link>
        </h2>
        {shown.map((a) => (
          <div key={`${a.place ?? a.name}-${a.track ?? ''}`} className="award-plate" data-place={a.place ?? 'award'}>
            <Ribbon award={a} />
            <span>
              <b>{awardLabel(a)}</b>
              {at && <span className="text-caption"> · {at}</span>}
              {a.note && (
                <q className="award-note">
                  <span className="sr-only">Judges’ note: </span>
                  {a.note}
                </q>
              )}
            </span>
          </div>
        ))}
        {p.description && <p className="m-0">{p.description}</p>}
        {facts && <p className="m-0 text-caption text-text-secondary">{facts}</p>}
        {past ? (
          <p className="m-0 text-caption">
            {past.team_size > 0 && (
              <>
                by <ArchiveCredit archive={past} />{' '}
              </>
            )}
            <span className="text-text-secondary">
              · <span aria-hidden="true">▤ </span>From the Archive · {archiveOrigin(past)}
            </span>
          </p>
        ) : (
          <p className="m-0 text-caption">
            by{' '}
            <Link to={memberPath(e.username)} className="underline decoration-2">
              {e.full_name}
            </Link>
            {(p.collaborators?.length ?? 0) > 0 && <> with {creditLine(p.collaborators!.map((c) => c.full_name))}</>}{' '}
            <span className="text-text-secondary">· No.{String(e.member_no).padStart(3, '0')}</span>
          </p>
        )}
      </div>
    </article>
  );
}

/** The doorways: the wings, then one per event room. The world's way round, and plain links. */
interface Door {
  id: string;
  name: string;
  to: string;
  kind: string;
  detail: string;
}

/** The list view's doors (D-133): the lobby, then every open room in the admins' order. */
function Doors({ doors, all, current }: { doors: Door[]; all: string; current: string | null }) {
  return (
    <nav className="wing-doors" aria-label="Rooms">
      <ul>
        <li>
          <Link to={inList('/museum')} className="wing-door" aria-current={current === null ? 'page' : undefined}>
            <span className="wing-arch" aria-hidden="true" />
            <span>{all}</span>
          </Link>
        </li>
        {doors.map((d) => (
          <li key={d.id}>
            <Link to={inList(d.to)} className="wing-door" data-kind={d.kind} aria-current={current === d.id ? 'page' : undefined}>
              <span className="wing-arch" aria-hidden="true" />
              <span>{d.name}</span>
              <span className="text-caption text-text-secondary">{d.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The Featured Members room (D-133): the members the admins featured, each badge with the curator's note. */
function MembersRoomView({ members, name, loading }: { members: Exhibit[]; name: string; loading: boolean }) {
  return (
    <section className="wing-room members-room" aria-labelledby="members-title">
      <h2 id="members-title" className="panel-title">
        <span aria-hidden="true">☺ </span>
        {name}
      </h2>
      <p className="m-0 text-caption text-text-secondary">Members of the hall the curators chose to feature.</p>
      {members.length === 0 ? (
        <DialogueBox text={loading ? 'Hanging the portraits…' : 'No members are featured right now.'} emote={loading ? 'pending' : undefined} />
      ) : (
        <ul className="members-grid" aria-label={name}>
          {members.map((m) => (
            <li key={m.project_id}>
              <article className="portrait-frame" aria-labelledby={`portrait-${m.username}`}>
                <Link to={memberPath(m.username)} tabIndex={-1} aria-hidden="true" className="block">
                  {m.portrait && <PortraitArt card={m.portrait.card} scale={0.75} />}
                </Link>
                <div className="exhibit-plaque">
                  <h3 id={`portrait-${m.username}`} className="m-0 font-display text-h3 font-normal">
                    <Link to={memberPath(m.username)} className="exhibit-title-link">
                      {m.full_name}
                    </Link>
                  </h3>
                  {m.portrait?.card.card.role && <p className="m-0 text-caption">{m.portrait.card.card.role}</p>}
                  {m.portrait?.note && (
                    <figure className="curator-note m-0">
                      <blockquote className="m-0">{m.portrait.note}</blockquote>
                      <figcaption className="text-caption">Curator’s note</figcaption>
                    </figure>
                  )}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The Winners' Hall (D-116): each event's places and awards on pedestals, newest event first,
 *  from the hall's own events and from the archive (D-118). */
function WinnersHall({ trophies, name }: { trophies: TrophyCase[]; name: string }) {
  return (
    <section className="winners-hall" aria-labelledby="winners-title">
      <h2 id="winners-title" className="panel-title">
        <span aria-hidden="true">♛ </span>
        {name}
      </h2>
      <p className="m-0 text-caption">Places and awards from the hall’s events and its archive, as the judges announced them.</p>
      {trophies.map((t) => (
        <section key={t.key} className="trophy-case" aria-labelledby={`case-${t.key}`}>
          <h3 id={`case-${t.key}`} className="m-0 font-display font-normal">
            {t.eventKey ? (
              <Link to={inList(eventRoomPath(t.eventKey))} className="underline decoration-2">
                {t.title}
              </Link>
            ) : (
              t.title
            )}{' '}
            <span className="text-caption text-text-secondary">· {t.sub}</span>
          </h3>
          <ul className="museum-grid trophy-grid" aria-label={`Winners of ${t.title}`}>
            {t.winners.map(({ award, entry }) => (
              <li key={`${award.place ?? award.name}-${award.track ?? ''}-${entry.project_id}`} className="pedestal">
                <ExhibitFrame exhibit={entry} awards={[award]} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

/** One event's room: where it stands, its winners, then the archive's other exhibits from it, by track. */
function EventRoomView({ event }: { event: MuseumEvent }) {
  const winners = winnersOf(event);
  const won = new Set(winners.map((w) => w.entry.project_id));
  const groups = entriesByTrack({ ...event, entries: event.entries.filter((e) => !won.has(e.project_id)) });
  const status = phaseLine(event);
  return (
    <section className="wing-room event-room" aria-labelledby="event-room-title">
      <h2 id="event-room-title" className="panel-title">
        {event.name}
      </h2>
      <p className="m-0 text-caption text-text-secondary">
        {KIND_NAME[kindOf(event)]} · {dateRange(event.starts_on, event.ends_on)}
        {(event.tracks?.length ?? 0) > 0 && ` · Tracks: ${event.tracks!.join(', ')}`}
      </p>
      {status && (
        <p className="m-0 font-display tracking-[0.04em]" role="status">
          {status}
        </p>
      )}
      {event.blurb && (
        <figure className="curator-note">
          <blockquote className="m-0">{event.blurb}</blockquote>
          <figcaption className="text-caption">About the event</figcaption>
        </figure>
      )}
      {winners.length > 0 && (
        <section className="winners-hall" aria-labelledby="event-winners">
          <h3 id="event-winners" className="panel-title">
            <span aria-hidden="true">♛ </span>Winners
          </h3>
          <ul className="museum-grid trophy-grid" aria-label={`Winners of ${event.name}`}>
            {winners.map(({ award, entry }) => (
              <li key={`${award.place ?? award.name}-${award.track ?? ''}`} className="pedestal">
                <ExhibitFrame exhibit={entry} awards={[award]} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {groups.map((g) => (
        <section key={g.track ?? 'all'} className="grid gap-space-3" aria-labelledby={`track-${g.track ?? 'all'}`}>
          <h3 id={`track-${g.track ?? 'all'}`} className="m-0 font-display font-normal">
            {g.track ? `${g.track} track` : 'Also from this event'}{' '}
            <span className="text-caption text-text-secondary">
              · {g.entries.length} {g.entries.length === 1 ? 'exhibit' : 'exhibits'} from the Archive
            </span>
          </h3>
          <ul className="museum-grid" aria-label={g.track ? `From the ${g.track} track` : `Also from ${event.name}`}>
            {g.entries.map((e) => (
              <li key={e.project_id}>
                <ExhibitFrame exhibit={e} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

/** The Archive (D-118): every past project, by year, newest first. */
function ArchiveRoomView({ archive, name }: { archive: ArchiveExhibit[]; name: string }) {
  const years = byYear(archive);
  return (
    <section className="wing-room archive-room" aria-labelledby="archive-title">
      <h2 id="archive-title" className="panel-title">
        <span aria-hidden="true">▤ </span>
        {name}
      </h2>
      <p className="m-0 text-caption text-text-secondary">Past projects and hackathon outputs, compiled by the hall’s curators. Members can claim the ones they made.</p>
      {years.length === 0 ? (
        <DialogueBox text="The Archive is empty for now. The curators are still compiling past projects." />
      ) : (
        years.map(({ year, items }) => (
          <section key={year} className="grid gap-space-3" aria-labelledby={`year-${year}`}>
            <h3 id={`year-${year}`} className="m-0 font-display font-normal archive-year">
              {year}{' '}
              <span className="text-caption text-text-secondary">
                · {items.length} {items.length === 1 ? 'exhibit' : 'exhibits'}
              </span>
            </h3>
            <ul className="museum-grid" aria-label={`From ${year}`}>
              {items.map((a) => (
                <li key={a.id}>
                  <ExhibitFrame exhibit={archiveAsExhibit(a)} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}

function WingRoomView({ room, order, onShuffle }: { room: WingRoom; order: Exhibit[]; onShuffle: () => void }) {
  const { wing } = room;
  return (
    <section className="wing-room" aria-labelledby="wing-title">
      <h2 id="wing-title" className="panel-title">
        {wing.name}
      </h2>
      <p className="m-0 text-caption text-text-secondary">{wingRule(wing)}</p>
      {wing.note && (
        <figure className="curator-note">
          <blockquote className="m-0">{wing.note}</blockquote>
          <figcaption className="text-caption">Curator’s note</figcaption>
        </figure>
      )}
      <div className="flex flex-wrap items-center gap-space-3">
        <button type="button" className="pixel-btn" data-variant="primary" onClick={onShuffle}>
          <span aria-hidden="true">⟳ </span>Shuffle
        </button>
      </div>
      <ul className="museum-grid" aria-label={`Exhibits in the ${wing.name}`}>
        {order.map((e) => (
          <li key={e.project_id}>
            <ExhibitFrame exhibit={e} />
          </li>
        ))}
      </ul>
    </section>
  );
}
