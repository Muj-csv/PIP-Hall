// /museum (D-069): a walk through members' projects, shuffled on every visit. Members with
// Museum access choose which of their approved projects hang here; exhibits show them as approved.
// Featured makers' exhibits are pinned in their own row on top; Shuffle never moves them (D-083).
// Wings (V2-6, D-102): doorways at the top lead into rooms built from the exhibits themselves
// (/museum?wing=web), each with its curator's note and the way on to the other wings.
// Events (V2-9, D-115, D-116): the Winners' Hall comes first, with every announced place and award
// on a pedestal with its ribbon and the judges' note; each hackathon or building event has its own
// room (/museum?event=key) with its entries by track, open from its first day.
// The archive (V2-10, D-118): past projects hang with the rest, in their wings and their event's
// room, their winners in the Winners' Hall, and all of them in The Archive (/museum?room=archive),
// by year.

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
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
import { dateRange } from '../lib/seasons';
import { DEFAULT_WINGS, wingPath, wingRooms, type Wing, type WingRoom } from '../lib/wings';
import { archiveService } from '../services/archiveService';
import { eventService } from '../services/eventService';
import { museumService } from '../services/museumService';
import { ArchiveCredit } from '../components/museum/ArchiveCredit';
import { ExhibitArt } from '../components/museum/ExhibitArt';
import { Ribbon } from '../components/museum/Ribbon';
import type { Exhibit } from '../types/museum';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; exhibits: Exhibit[] };
type Events = 'loading' | 'error' | MuseumEvent[];
type Archive = 'loading' | 'error' | ArchiveExhibit[];

/** A hall event's case in the Winners' Hall. */
const eventCase = (e: MuseumEvent): TrophyCase => ({
  key: e.key,
  title: e.name,
  sub: `${KIND_NAME[kindOf(e)]} · ${dateRange(e.starts_on, e.ends_on)}`,
  eventKey: e.key,
  year: null,
  sort: e.starts_on,
  winners: winnersOf(e),
});

export default function Museum() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [round, setRound] = useState(0);
  const [wings, setWings] = useState<Wing[] | null>(null);
  const [events, setEvents] = useState<Events>('loading');
  const [archive, setArchive] = useState<Archive>('loading');
  const [params] = useSearchParams();

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
    return () => {
      on = false;
    };
  }, [attempt]);

  const past = useMemo(() => (Array.isArray(archive) ? archive : []), [archive]);
  // Members' exhibits and the archive's hang together, in every room and wing.
  const exhibits = useMemo(() => (load.status === 'ready' ? [...load.exhibits, ...past.map(archiveAsExhibit)] : null), [load, past]);
  const eventList = useMemo(() => withArchive(Array.isArray(events) ? events : [], past), [events, past]);
  // A new order on every visit and every Shuffle (round is the trigger); featured stay pinned.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { featured, rest } = useMemo(() => arrangeMuseum(exhibits ?? []), [exhibits, round]);
  // The Officers' Wing follows the current officers (D-123).
  const { officers } = useAppearance();
  const officerNames = useMemo(() => officerUsernames(officers), [officers]);
  const rooms = useMemo(() => wingRooms(wings ?? [], exhibits ?? [], { officers: officerNames }), [wings, exhibits, officerNames]);
  const wingKey = params.get('wing');
  const eventKey = params.get('event');
  const archiveOpen = params.get('room') === ARCHIVE_ROOM;
  const room = rooms.find((r) => r.wing.key === wingKey) ?? null;
  const eventRoom = eventList.find((e) => e.key === eventKey) ?? null;
  // A new order in the room too; it follows Shuffle like the main hall.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const roomOrder = useMemo(() => (room ? arrangeMuseum(room.exhibits) : null), [room, round]);
  const trophies = useMemo(
    () => [...eventList.map(eventCase), ...archiveCases(past, new Set(eventList.map((e) => e.key)))].filter((t) => t.winners.length > 0).sort((a, b) => b.sort.localeCompare(a.sort)),
    [eventList, past],
  );
  const retry = useCallback(() => {
    setLoad({ status: 'loading' });
    setEvents('loading');
    setArchive('loading');
    setAttempt((a) => a + 1);
  }, []);

  const anything = Boolean(exhibits && (exhibits.length > 0 || eventList.some((e) => e.entries.length > 0)));
  const lobby = !wingKey && !eventKey && !archiveOpen;
  const current = wingKey ?? (eventKey ? `event:${eventKey}` : archiveOpen ? `room:${ARCHIVE_ROOM}` : null);

  return (
    <MenuPage title="Museum" wide>
      {load.status === 'loading' && <DialogueBox text="Unlocking the gallery…" emote="pending" />}
      {load.status === 'error' && (
        <DialogueBox text="Can’t reach the Museum right now. Check your connection and try again." emote="attention">
          <button type="button" className="hw-btn" data-variant="small" onClick={retry}>
            RETRY
          </button>
        </DialogueBox>
      )}
      {exhibits && !anything && lobby && events !== 'loading' && archive !== 'loading' && (
        <DialogueBox text="The Museum is waiting for its first exhibit. Members with Museum access can add projects from their card editor, and projects entered in the hall’s events hang here too." />
      )}
      {exhibits && (rooms.length > 0 || eventList.length > 0 || past.length > 0) && <Doors rooms={rooms} events={eventList} archive={past.length} current={current} />}

      {exhibits && wingKey && !room && wings && (
        <DialogueBox text="That wing has nothing on show right now. Every other room is still open." emote="attention">
          <Link to="/museum" className="hw-btn no-underline" data-variant="small">
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
      {exhibits && eventKey && Array.isArray(events) && !eventRoom && (
        <DialogueBox text="That event room isn’t open. A room opens on its event’s first day." emote="attention">
          <Link to="/museum" className="hw-btn no-underline" data-variant="small">
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
      {exhibits && archiveOpen && Array.isArray(archive) && <ArchiveRoomView archive={archive} />}

      {exhibits && lobby && anything && (
        <DialogueBox
          text={
            trophies.length > 0
              ? 'Welcome to the Museum! The winners of the hall’s events stand in the Winners’ Hall; every other exhibit is in a new order each visit.'
              : featured.length > 0
                ? 'Welcome to the Museum! Featured makers hang up top; the rest are in a new order every visit.'
                : 'Welcome to the Museum: projects from members of the hall, in a new order every visit.'
          }
        />
      )}
      {exhibits && lobby && trophies.length > 0 && <WinnersHall trophies={trophies} />}
      {exhibits && lobby && exhibits.length > 0 && (
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
function Doors({ rooms, events, archive, current }: { rooms: WingRoom[]; events: MuseumEvent[]; archive: number; current: string | null }) {
  return (
    <nav className="wing-doors" aria-label="Rooms">
      <ul>
        <li>
          <Link to="/museum" className="wing-door" aria-current={current === null ? 'page' : undefined}>
            <span className="wing-arch" aria-hidden="true" />
            <span>All exhibits</span>
          </Link>
        </li>
        {rooms.map(({ wing, exhibits }) => (
          <li key={wing.key}>
            <Link to={wingPath(wing.key)} className="wing-door" data-kind={wing.kind} aria-current={current === wing.key ? 'page' : undefined}>
              <span className="wing-arch" aria-hidden="true" />
              <span>{wing.name}</span>
              <span className="text-caption text-text-secondary">
                {exhibits.length} {exhibits.length === 1 ? 'exhibit' : 'exhibits'}
              </span>
            </Link>
          </li>
        ))}
        {archive > 0 && (
          <li>
            <Link to={archiveRoomPath()} className="wing-door" data-kind="archive" aria-current={current === `room:${ARCHIVE_ROOM}` ? 'page' : undefined}>
              <span className="wing-arch" aria-hidden="true" />
              <span>The Archive</span>
              <span className="text-caption text-text-secondary">
                {archive} {archive === 1 ? 'exhibit' : 'exhibits'}
              </span>
            </Link>
          </li>
        )}
        {events.map((e) => (
          <li key={e.key}>
            <Link to={eventRoomPath(e.key)} className="wing-door" data-kind="event" aria-current={current === `event:${e.key}` ? 'page' : undefined}>
              <span className="wing-arch" aria-hidden="true" />
              <span>{e.name}</span>
              <span className="text-caption text-text-secondary">
                {e.phase === 'results' ? '♛ Results in' : `${e.entries.length} ${e.entries.length === 1 ? 'entry' : 'entries'}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The Winners' Hall (D-116): each event's places and awards on pedestals, newest event first,
 *  from the hall's own events and from the archive (D-118). */
function WinnersHall({ trophies }: { trophies: TrophyCase[] }) {
  return (
    <section className="winners-hall" aria-labelledby="winners-title">
      <h2 id="winners-title" className="panel-title">
        <span aria-hidden="true">♛ </span>Winners’ Hall
      </h2>
      <p className="m-0 text-caption">Places and awards from the hall’s events and its archive, as the judges announced them.</p>
      {trophies.map((t) => (
        <section key={t.key} className="trophy-case" aria-labelledby={`case-${t.key}`}>
          <h3 id={`case-${t.key}`} className="m-0 font-display font-normal">
            {t.eventKey ? (
              <Link to={eventRoomPath(t.eventKey)} className="underline decoration-2">
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

/** One event's room: where it stands, its winners (once announced), then its entries by track. */
function EventRoomView({ event }: { event: MuseumEvent }) {
  const winners = winnersOf(event);
  const awardsOf = (id: string) => winners.filter((w) => w.entry.project_id === id).map((w) => w.award);
  const groups = entriesByTrack(event);
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
      {groups.length === 0 ? (
        <DialogueBox text={event.phase === 'open' ? 'No entries yet. Members enter their projects from the event panel in the hall.' : 'No entries are on show from this event.'} />
      ) : (
        groups.map((g) => (
          <section key={g.track ?? 'all'} className="grid gap-space-3" aria-labelledby={`track-${g.track ?? 'all'}`}>
            <h3 id={`track-${g.track ?? 'all'}`} className="m-0 font-display font-normal">
              {g.track ? `${g.track} track` : 'Entries'}{' '}
              <span className="text-caption text-text-secondary">
                · {g.entries.length} {g.entries.length === 1 ? 'entry' : 'entries'}
              </span>
            </h3>
            <ul className="museum-grid" aria-label={g.track ? `Entries in the ${g.track} track` : `Entries in ${event.name}`}>
              {g.entries.map((e) => (
                <li key={e.project_id}>
                  <ExhibitFrame exhibit={e} awards={awardsOf(e.project_id)} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}

/** The Archive (D-118): every past project, by year, newest first. */
function ArchiveRoomView({ archive }: { archive: ArchiveExhibit[] }) {
  const years = byYear(archive);
  return (
    <section className="wing-room archive-room" aria-labelledby="archive-title">
      <h2 id="archive-title" className="panel-title">
        <span aria-hidden="true">▤ </span>The Archive
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

const RULE: Record<Wing['kind'], (w: Wing) => string> = {
  featured: () => 'Exhibits by members the curators featured.',
  collab: () => 'Projects made by more than one member of the hall.',
  officers: () => 'Projects by the hall’s current officers, as named by its admins.',
  tags: (w) => `Projects built with ${w.tags.slice(0, 6).join(', ')}${w.tags.length > 6 ? '…' : ''}.`,
};

function WingRoomView({ room, order, onShuffle }: { room: WingRoom; order: Exhibit[]; onShuffle: () => void }) {
  const { wing } = room;
  return (
    <section className="wing-room" aria-labelledby="wing-title">
      <h2 id="wing-title" className="panel-title">
        {wing.name}
      </h2>
      <p className="m-0 text-caption text-text-secondary">{RULE[wing.kind](wing)}</p>
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
