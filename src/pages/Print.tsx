// /print — placards for the showcase (V2-12, D-120): one label per exhibit, to stand beside its demo:
// title, makers or team, event and year, award ribbon, judges' note and a QR that opens it on a
// phone (and stamps the Passport). A6, four to an A4 page, printed with the browser's own print, so
// no PDF tool is needed. /print?event=key prints an event's room, ?room=<room> any room,
// ?exhibit=<id> one exhibit; with none, it lists the rooms. The labels follow the room's fixed
// order, so a placard's "next in this room" is the one beside it. Posters (PNG) for the event's
// winners or the one exhibit are drawn here too.

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { DialogueBox } from '../components/dialogue/DialogueBox';
import { QrCode } from '../components/cards/QrCode';
import { Ribbon } from '../components/museum/Ribbon';
import { awardsByProject, awardLine, roomParams } from '../lib/museumWalk';
import { publicOrigin } from '../lib/publicUrl';
import { placardsFor, printPath, printTarget, roomStops, sheets, type Placard } from '../lib/showcase';
import { useShowcaseRooms } from '../lib/useShowcaseRooms';

export default function Print() {
  const [params] = useSearchParams();
  const query = params.toString();
  const [attempt, setAttempt] = useState(0);
  const load = useShowcaseRooms(attempt);
  const [poster, setPoster] = useState<'idle' | 'busy' | 'failed'>('idle');

  const target = useMemo(() => printTarget(new URLSearchParams(query)), [query]);
  const set = useMemo(() => (load.status === 'ready' && target ? placardsFor(load.rooms, target) : null), [load, target]);
  const event = load.status === 'ready' && target?.kind === 'event' ? load.events.find((e) => e.key === target.key) : undefined;
  const title = set ? `Placards · ${set.title}` : 'Placards';
  useEffect(() => {
    document.title = `${title} · PIP-Hall`;
  }, [title]);

  const drawPoster = async () => {
    if (load.status !== 'ready' || !set) return;
    setPoster('busy');
    try {
      const posters = await import('../services/posterService');
      if (event) await posters.saveWinnersPoster(event);
      else if (set.placards[0]) {
        const e = set.placards[0].exhibit;
        await posters.saveExhibitPoster(e, awardsByProject(load.events, load.data.archive).get(e.project_id) ?? []);
      }
      setPoster('idle');
    } catch {
      setPoster('failed');
    }
  };

  const pages = set ? sheets(set.placards) : [];
  return (
    <div className="print-page">
      <div className="print-tools">
        <Link to="/museum" className="pixel-btn justify-self-start">
          <span aria-hidden="true">◀ </span>Museum
        </Link>
        <h1 className="m-0 font-display text-h1 font-normal">{title}</h1>

        {load.status === 'loading' && <DialogueBox text="Gathering the exhibits…" emote="pending" />}
        {load.status === 'error' && (
          <DialogueBox text="Can’t reach the Museum right now. Check your connection and try again." emote="attention">
            <button type="button" className="hw-btn" data-variant="small" onClick={() => setAttempt((a) => a + 1)}>
              RETRY
            </button>
          </DialogueBox>
        )}
        {load.status === 'ready' && target && !set && (
          <DialogueBox text="There’s nothing on show there. Pick a room below, or go back to the Museum." emote="attention" />
        )}
        {load.status === 'ready' && load.rooms.length === 0 && <DialogueBox text="The Museum is waiting for its first exhibit, so there are no placards to print yet." />}

        {set && (
          <>
            <p className="m-0">
              {set.placards.length} {set.placards.length === 1 ? 'placard' : 'placards'} on {pages.length} {pages.length === 1 ? 'page' : 'pages'}: four A6 placards to an A4 page. Print at 100% (no
              scaling), then cut along the dashed lines.
            </p>
            <div className="flex flex-wrap gap-space-2">
              <button type="button" className="pixel-btn" data-variant="primary" onClick={() => window.print()}>
                Print placards
              </button>
              {(event ? event.awards.length > 0 : target?.kind === 'exhibit') && (
                <button type="button" className="pixel-btn" disabled={poster === 'busy'} onClick={() => void drawPoster()}>
                  {poster === 'busy' ? 'Drawing the poster…' : event ? 'Save winners poster' : 'Save poster'}
                </button>
              )}
            </div>
            {poster === 'failed' && (
              <p className="notice notice-bad m-0" role="status">
                <span aria-hidden="true">! </span>Couldn’t draw the poster. Try again.
              </p>
            )}
          </>
        )}

        {load.status === 'ready' && load.rooms.length > 0 && (!target || !set) && (
          <nav aria-label="Rooms to print">
            <ul className="grid gap-space-2 m-0 p-0 list-none">
              {load.rooms.map((r) => {
                const [k, v] = roomParams(r.id);
                const n = roomStops(r).length;
                return (
                  <li key={r.id}>
                    <Link to={k === 'event' ? printPath({ kind: 'event', key: v }) : printPath({ kind: 'room', id: r.id })} className="underline decoration-2">
                      {r.name}
                    </Link>{' '}
                    <span className="text-caption text-text-secondary">
                      {n} {n === 1 ? 'placard' : 'placards'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </div>

      {pages.map((page, i) => (
        <section key={i} className="print-sheet" aria-label={`Page ${i + 1} of ${pages.length}`}>
          {page.map((p) => (
            <PlacardCard key={p.exhibit.project_id} p={p} />
          ))}
        </section>
      ))}
    </div>
  );
}

function PlacardCard({ p }: { p: Placard }) {
  const site = publicOrigin().replace(/^https?:\/\//, '');
  return (
    <article className="placard" aria-labelledby={`placard-${p.exhibit.project_id}`}>
      <p className="placard-kicker">PIXENDO MUSEUM · {p.roomName}</p>
      <h2 id={`placard-${p.exhibit.project_id}`} className="placard-title">
        {p.title}
      </h2>
      {p.by && <p className="placard-by">by {p.by}</p>}
      {p.team && !p.by?.includes(p.team) && <p className="placard-line">Team {p.team}</p>}
      {p.origin && <p className="placard-line">{p.origin}</p>}
      {p.awards.length > 0 && (
        <ul className="placard-awards" aria-label="Awards">
          {p.awards.slice(0, 3).map((a) => (
            <li key={`${a.award.place ?? a.award.name}-${a.award.track ?? ''}-${a.event ?? ''}`}>
              <Ribbon award={a.award} className="placard-ribbon" />
              {awardLine(a)}
            </li>
          ))}
        </ul>
      )}
      {p.exhibit.project.description && !p.note && <p className="placard-desc">{p.exhibit.project.description}</p>}
      {p.note && (
        <q className="placard-note">
          <span className="sr-only">Judges’ note: </span>
          {p.note}
        </q>
      )}
      <div className="placard-qr">
        <QrCode value={p.qr} title={`QR code for ${p.title}`} />
        <p>
          <b>SCAN ME</b>
          Open it on your phone and stamp your Passport.
          <span className="placard-site">{site}</span>
        </p>
      </div>
    </article>
  );
}
