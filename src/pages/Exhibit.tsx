// /museum/:id — one exhibit on its own page (D-073): the framed project as approved, its plaque,
// its links, its maker, a Share button, and the neighbouring exhibits. Shareable like a badge.
// Since V2-6 (D-102) it also says which wings it hangs in and leads on to others in them.
// Since V2-9 (D-115, D-116) a project entered in a hall event opens here too, and its plaque says
// which event it was entered in, and what it won there. Since V2-10 (D-118) so does a past project
// from the archive: where and when it was made, by whom, what it won, and "Is this yours?".
// The phone companion (V2-12, D-120): a placard's QR opens it here (?via=placard&room=…): "You found
// this exhibit!", its Passport stamp, its makers, and the next exhibit in the room it hangs in. Its
// poster (PNG) is drawn in the browser, like the badge.

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useSession } from '../app/sessionContext';
import { useAppearance } from '../app/appearanceContext';
import { FlipBadge } from '../components/cards/BadgeStage';
import { QrFullscreen } from '../components/cards/QrFullscreen';
import { DialogueBox } from '../components/dialogue/DialogueBox';
import { ExhibitArt } from '../components/museum/ExhibitArt';
import { MenuPage } from '../components/shell/MenuPage';
import { creditLine, makersOf } from '../lib/collab';
import { exhibitPath, exhibitUrl, memberPath } from '../lib/publicUrl';
import { consoleFor } from '../lib/museum';
import { CONSOLE_NAMES } from '../lib/sprites';
import { useCards } from '../lib/useCards';
import { usePassport } from '../lib/usePassport';
import type { PublicCard } from '../types/card';
import { DEFAULT_WINGS, relatedTo, wingPath, type Wing } from '../lib/wings';
import { officerUsernames } from '../lib/officers';
import { awardLabel, eventRoomPath, winnersOf, type MuseumEvent } from '../lib/events';
import { Ribbon } from '../components/museum/Ribbon';
import { ArchiveClaim } from '../components/museum/ArchiveClaim';
import { ArchiveCredit } from '../components/museum/ArchiveCredit';
import { archiveAsExhibit, archiveAward, archiveOrigin, archiveRoomPath } from '../lib/archive';
import { archiveService } from '../services/archiveService';
import { eventService } from '../services/eventService';
import { museumService } from '../services/museumService';
import { awardsByProject } from '../lib/museumWalk';
import { inRoomPath, nextInRoom, showcaseRooms, type MuseumData } from '../lib/showcase';
import type { Exhibit as ExhibitRow } from '../types/museum';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; exhibits: ExhibitRow[]; events: MuseumEvent[]; data: Omit<MuseumData, 'wings'> };

export default function Exhibit() {
  const { id = '' } = useParams();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [shared, setShared] = useState<string | null>(null);
  const [qrCard, setQrCard] = useState<PublicCard | null>(null);
  const [wings, setWings] = useState<Wing[]>([]);
  const [poster, setPoster] = useState<'idle' | 'busy' | 'failed'>('idle');
  const cards = useCards();
  const { session } = useSession();
  // Scanned from a placard (?via=placard): greet the finder once, then tidy the address. The room
  // stays, so "Next in this room" keeps leading round the room the placard hangs in.
  const [params, setParams] = useSearchParams();
  const [scanned] = useState(() => (params.get('via') === 'placard' ? id : null));
  const found = scanned === id; // walking on to the next exhibit is not a scan
  const roomId = params.get('room');
  useEffect(() => {
    if (!params.has('via')) return;
    const next = new URLSearchParams(params);
    next.delete('via');
    setParams(next, { replace: true });
  }, [params, setParams]);

  useEffect(() => {
    let on = true;
    // Event rooms and the archive are extra: if they can't be read, the Museum's own exhibits still open.
    Promise.all([museumService.exhibits(), eventService.museumEvents().catch(() => []), archiveService.list().catch(() => [])])
      .then(([shown, events, past]) => {
        if (!on) return;
        const seen = new Set(shown.map((e) => e.project_id));
        const entered = events.flatMap((ev) => ev.entries).filter((e) => !seen.has(e.project_id) && (seen.add(e.project_id), true));
        setLoad({ status: 'ready', exhibits: [...shown, ...entered, ...past.map(archiveAsExhibit)], events, data: { exhibits: shown, events, archive: past } });
      })
      .catch(() => on && setLoad({ status: 'error' }));
    museumService
      .wings()
      .then((w) => on && setWings(w))
      .catch(() => on && setWings([...DEFAULT_WINGS]));
    return () => {
      on = false;
    };
  }, [attempt]);

  // A stable walking order (by title), so Previous and Next always lead to the same rooms.
  const ordered = useMemo(() => (load.status === 'ready' ? [...load.exhibits].sort((a, b) => a.project.title.localeCompare(b.project.title)) : []), [load]);
  const at = ordered.findIndex((e) => e.project_id === id);
  const exhibit = at >= 0 ? ordered[at] : undefined;
  const prev = ordered.length > 1 && at >= 0 ? ordered[(at - 1 + ordered.length) % ordered.length] : undefined;
  const next = ordered.length > 1 && at >= 0 ? ordered[(at + 1) % ordered.length] : undefined;

  const title = exhibit ? `${exhibit.project.title} · Museum` : load.status === 'ready' ? 'Not on show' : 'Museum';
  // The owner, then the collaborators who accepted, as approved (D-090).
  // Visiting an exhibit stamps the Passport (V2-2).
  const { stampExhibit } = usePassport();
  const exhibitId = exhibit?.project_id;
  useEffect(() => {
    if (exhibitId) stampExhibit(exhibitId);
  }, [exhibitId, stampExhibit]);
  const makers = exhibit && cards.status === 'ready' ? makersOf(exhibit.username, exhibit.project, cards.cards) : [];
  const withNames = (exhibit?.project.collaborators ?? []).map((c) => c.full_name);
  const kind = exhibit ? consoleFor(exhibit.project_id, exhibit.console) : null;
  const { officers } = useAppearance();
  const officerNames = useMemo(() => officerUsernames(officers), [officers]);
  const around = useMemo(() => (exhibit ? relatedTo(exhibit, wings, ordered, 4, { officers: officerNames }) : { wings: [], related: [] }), [exhibit, wings, ordered, officerNames]);
  const rooms = useMemo(() => new Set(load.status === 'ready' ? load.events.map((e) => e.key) : []), [load]);
  // The room the placard hangs in, in the showcase's fixed order (the same as the printed placards).
  const nextHere = useMemo(
    () => (roomId && exhibitId && load.status === 'ready' ? nextInRoom(showcaseRooms({ ...load.data, wings }, { officers: officerNames }), roomId, exhibitId) : null),
    [roomId, exhibitId, load, wings, officerNames],
  );
  const me = session.status === 'signed-in' ? session.user.id : null;
  const mine = Boolean(me && makers.some((m) => m.profile_id === me));

  const savePoster = async () => {
    if (!exhibit || load.status !== 'ready') return;
    setPoster('busy');
    try {
      const won = awardsByProject(load.events, load.data.archive).get(exhibit.project_id) ?? [];
      const { saveExhibitPoster } = await import('../services/posterService');
      await saveExhibitPoster(exhibit, won);
      setPoster('idle');
    } catch {
      setPoster('failed');
    }
  };
  // The events it was entered in, each with what it won (announced results only).
  const entries = useMemo(
    () =>
      load.status === 'ready' && exhibitId
        ? load.events.flatMap((ev) => {
            const entry = ev.entries.find((x) => x.project_id === exhibitId);
            return entry ? [{ event: ev, track: entry.track, awards: winnersOf(ev).filter((w) => w.entry.project_id === exhibitId).map((w) => w.award) }] : [];
          })
        : [],
    [load, exhibitId],
  );

  const share = async () => {
    if (!exhibit) return;
    const url = exhibitUrl(exhibit.project_id);
    try {
      if (navigator.share) {
        await navigator.share({ title: exhibit.project.title, text: `${exhibit.project.title} by ${exhibit.full_name}, in the PIP-Hall Museum`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShared('Link copied.');
    } catch {
      setShared(null); // cancelled, or the clipboard is blocked: nothing to say
    }
  };

  return (
    <MenuPage title={title} wide>
      <Link to="/museum" className="pixel-btn justify-self-start">
        <span aria-hidden="true">◀ </span>Museum
      </Link>

      {load.status === 'loading' && <DialogueBox text="Fetching the exhibit…" emote="pending" />}
      {load.status === 'error' && (
        <DialogueBox text="Can’t reach the Museum right now. Check your connection and try again." emote="attention">
          <button
            type="button"
            className="hw-btn"
            data-variant="small"
            onClick={() => {
              setLoad({ status: 'loading' });
              setAttempt((a) => a + 1);
            }}
          >
            RETRY
          </button>
        </DialogueBox>
      )}
      {load.status === 'ready' && !exhibit && (
        <DialogueBox text="This exhibit isn’t on show anymore. Its maker may have taken it down. The rest of the Museum is one step back." emote="attention">
          <Link to="/museum" className="hw-btn no-underline" data-variant="small">
            MUSEUM
          </Link>
        </DialogueBox>
      )}

      {exhibit && found && (
        <DialogueBox
          text={
            mine
              ? `That’s yours! This is what visitors see when they scan the placard of ${exhibit.project.title}.`
              : `You found this exhibit! ${exhibit.project.title} is stamped in your Passport’s Museum stamp book.`
          }
          emote="approved"
        >
          {makers.length > 0 && (
            <a href="#made-by-title" className="hw-btn no-underline" data-variant="small">
              MAKERS
            </a>
          )}
          <Link to="/passport" className="hw-btn no-underline" data-variant="small">
            PASSPORT
          </Link>
        </DialogueBox>
      )}

      {exhibit && (
        <article className="exhibit-page" aria-labelledby="exhibit-maker">
          <ExhibitArt project={exhibit.project} console={kind!} featured={exhibit.featured} eager />
          <div className="exhibit-plaque">
            {exhibit.archive && <ArchivePlate exhibit={exhibit.archive} rooms={rooms} />}
            {entries.map(({ event, track, awards }) =>
              awards.length > 0 ? (
                awards.map((a) => (
                  <div key={`${event.key}-${a.place ?? a.name}-${a.track ?? ''}`} className="award-plate" data-place={a.place ?? 'award'}>
                    <Ribbon award={a} />
                    <span>
                      <b>{awardLabel(a)}</b> at{' '}
                      <Link to={eventRoomPath(event.key)} className="underline decoration-2">
                        {event.name}
                      </Link>
                      {a.note && (
                        <q className="award-note">
                          <span className="sr-only">Judges’ note: </span>
                          {a.note}
                        </q>
                      )}
                    </span>
                  </div>
                ))
              ) : (
                <p key={event.key} className="m-0">
                  <span aria-hidden="true">⚑ </span>Entered in{' '}
                  <Link to={eventRoomPath(event.key)} className="underline decoration-2">
                    {event.name}
                  </Link>
                  {track && <> · {track} track</>}
                </p>
              ),
            )}
            {exhibit.project.description && <p className="m-0">{exhibit.project.description}</p>}
            <Facts exhibit={exhibit} />
            {exhibit.archive ? (
              <p id="exhibit-maker" className="m-0">
                {exhibit.archive.team_size > 0 && (
                  <>
                    Made by <ArchiveCredit archive={exhibit.archive} />{' '}
                  </>
                )}
                <span className="text-text-secondary">
                  ·{' '}
                  <Link to={archiveRoomPath()} className="underline decoration-2">
                    From the Archive
                  </Link>{' '}
                  · {archiveOrigin(exhibit.archive)}
                </span>
              </p>
            ) : (
              <p id="exhibit-maker" className="m-0">
                Made by{' '}
                <Link to={memberPath(exhibit.username)} className="underline decoration-2">
                  {exhibit.full_name}
                </Link>
                {withNames.length > 0 && <> with {creditLine(withNames)}</>}{' '}
                <span className="text-text-secondary">· No.{String(exhibit.member_no).padStart(3, '0')}</span>
              </p>
            )}
            {kind && <p className="m-0 text-caption text-text-secondary">On show on a PIXENDO {CONSOLE_NAMES[kind]}</p>}
            <div className="flex flex-wrap gap-space-2">
              {exhibit.project.project_url && (
                <a href={exhibit.project.project_url} target="_blank" rel="noopener noreferrer" className="pixel-btn" data-variant="primary">
                  Open project<span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
              {exhibit.project.github_url && (
                <a href={exhibit.project.github_url} target="_blank" rel="noopener noreferrer" className="pixel-btn">
                  Code on GitHub<span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
              {exhibit.archive?.video_url && (
                <a href={exhibit.archive.video_url} target="_blank" rel="noopener noreferrer" className="pixel-btn">
                  Watch the video<span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
              <button type="button" className="pixel-btn" onClick={() => void share()}>
                Share
              </button>
              <button type="button" className="pixel-btn" disabled={poster === 'busy'} onClick={() => void savePoster()}>
                {poster === 'busy' ? 'Drawing the poster…' : 'Save poster'}
              </button>
            </div>
            {poster === 'failed' && (
              <p className="notice notice-bad m-0" role="status">
                <span aria-hidden="true">! </span>Couldn’t draw the poster. Try again.
              </p>
            )}
            {shared && (
              <p className="notice m-0" role="status">
                {shared}
              </p>
            )}
          </div>
        </article>
      )}

      {exhibit && nextHere && (
        <nav className="menu-panel next-in-room" aria-label="Next in this room">
          <p className="m-0 font-display tracking-[0.04em]">
            Next in {nextHere.stop.roomName} · {nextHere.nth} of {nextHere.count}
          </p>
          <Link to={inRoomPath(nextHere.stop.exhibit.project_id, nextHere.stop.room)} className="pixel-btn justify-self-start" data-variant="primary">
            {nextHere.stop.exhibit.project.title}
            <span aria-hidden="true"> ▶</span>
          </Link>
        </nav>
      )}

      {exhibit?.archive && <ArchiveClaim exhibitId={exhibit.project_id} title={exhibit.project.title} />}

      {exhibit && makers.length > 0 && (
        <section className="made-by" aria-labelledby="made-by-title">
          <h2 id="made-by-title" className="panel-title">
            Made by{makers.length > 1 ? ` · ${makers.length} makers` : ''}
          </h2>
          <ul className="made-by-list" aria-label="Makers">
            {makers.map((c) => (
              <li key={c.username}>
                <FlipBadge card={c} label={c.card.full_name} onShowQr={() => setQrCard(c)} />
                <Link to={memberPath(c.username)} className="pixel-btn justify-self-center">
                  Open profile<span className="sr-only"> of {c.card.full_name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {exhibit && around.wings.length > 0 && (
        <section className="menu-panel" aria-labelledby="exhibit-wings">
          <h2 id="exhibit-wings" className="panel-title">
            In the Museum’s wings
          </h2>
          <ul className="wing-chips" aria-label="Wings this exhibit hangs in">
            {around.wings.map((w) => (
              <li key={w.key}>
                <Link to={wingPath(w.key)} className="pixel-btn">
                  <span aria-hidden="true">▥ </span>
                  {w.name}
                </Link>
              </li>
            ))}
          </ul>
          {around.related.length > 0 && (
            <>
              <p className="m-0 font-display tracking-[0.04em]">More in these wings</p>
              <ul className="grid gap-space-2 m-0 p-0 list-none" aria-label="More in these wings">
                {around.related.map((r) => (
                  <li key={r.project_id}>
                    <Link to={exhibitPath(r.project_id)} className="underline decoration-2">
                      {r.project.title}
                    </Link>{' '}
                    <span className="text-caption text-text-secondary">by {r.full_name}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {exhibit && prev && next && (
        <nav aria-label="More exhibits" className="flex flex-wrap justify-between gap-space-2">
          <Link to={exhibitPath(prev.project_id)} className="pixel-btn">
            <span aria-hidden="true">◀ </span>
            {prev.project.title}
          </Link>
          {next.project_id !== prev.project_id && (
            <Link to={exhibitPath(next.project_id)} className="pixel-btn">
              {next.project.title}
              <span aria-hidden="true"> ▶</span>
            </Link>
          )}
        </nav>
      )}
      {qrCard && <QrFullscreen card={qrCard} onClose={() => setQrCard(null)} />}
    </MenuPage>
  );
}

function Facts({ exhibit }: { exhibit: ExhibitRow }) {
  const p = exhibit.project;
  const rows: [string, string][] = [];
  if (p.language) rows.push(['Language', p.language]);
  if (p.tech_stack.length) rows.push(['Built with', p.tech_stack.join(' · ')]);
  if (p.stars) rows.push(['Stars', String(p.stars)]);
  if (p.project_date) rows.push(['Date', p.project_date]);
  if (!rows.length) return null;
  return (
    <dl className="exhibit-facts">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** An archive exhibit's award, with the event it was won at (its room, when it has one). */
function ArchivePlate({ exhibit: a, rooms }: { exhibit: NonNullable<ExhibitRow['archive']>; rooms: ReadonlySet<string> }) {
  const award = archiveAward(a);
  if (!award) return null;
  return (
    <div className="award-plate" data-place={award.place ?? 'award'}>
      <Ribbon award={award} />
      <span>
        <b>{awardLabel(award)}</b>
        {a.event && (
          <>
            {' '}
            at{' '}
            {a.event_key && rooms.has(a.event_key) ? (
              <Link to={eventRoomPath(a.event_key)} className="underline decoration-2">
                {a.event}
              </Link>
            ) : (
              a.event
            )}
          </>
        )}
        {award.note && (
          <q className="award-note">
            <span className="sr-only">Judges’ note: </span>
            {award.note}
          </q>
        )}
      </span>
    </div>
  );
}
