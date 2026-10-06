// /museum (D-069): a walk through members' projects, shuffled on every visit. Members with
// Museum access choose which of their approved projects hang here; exhibits show them as approved.
// Featured makers' exhibits are pinned in their own row on top; Shuffle never moves them (D-083).
// Wings (V2-6, D-102): doorways at the top lead into rooms built from the exhibits themselves
// (/museum?wing=web), each with its curator's note and the way on to the other wings.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { DialogueBox } from '../components/dialogue/DialogueBox';
import { MenuPage } from '../components/shell/MenuPage';
import { exhibitPath, memberPath } from '../lib/publicUrl';
import { creditLine } from '../lib/collab';
import { arrangeMuseum, consoleFor } from '../lib/museum';
import { DEFAULT_WINGS, wingPath, wingRooms, type Wing, type WingRoom } from '../lib/wings';
import { museumService } from '../services/museumService';
import { ExhibitArt } from '../components/museum/ExhibitArt';
import type { Exhibit } from '../types/museum';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; exhibits: Exhibit[] };

export default function Museum() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [round, setRound] = useState(0);
  const [wings, setWings] = useState<Wing[] | null>(null);
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
    return () => {
      on = false;
    };
  }, [attempt]);

  const exhibits = load.status === 'ready' ? load.exhibits : null;
  // A new order on every visit and every Shuffle (round is the trigger); featured stay pinned.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { featured, rest } = useMemo(() => arrangeMuseum(exhibits ?? []), [exhibits, round]);
  const rooms = useMemo(() => wingRooms(wings ?? [], exhibits ?? []), [wings, exhibits]);
  const wingKey = params.get('wing');
  const room = rooms.find((r) => r.wing.key === wingKey) ?? null;
  // A new order in the room too; it follows Shuffle like the main hall.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const roomOrder = useMemo(() => (room ? arrangeMuseum(room.exhibits) : null), [room, round]);
  const retry = useCallback(() => {
    setLoad({ status: 'loading' });
    setAttempt((a) => a + 1);
  }, []);

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
      {exhibits && exhibits.length === 0 && (
        <DialogueBox text="The Museum is waiting for its first exhibit. Members with Museum access can add projects from their card editor." />
      )}
      {exhibits && exhibits.length > 0 && rooms.length > 0 && <WingDoors rooms={rooms} current={room?.wing.key ?? null} />}
      {exhibits && exhibits.length > 0 && wingKey && !room && wings && (
        <DialogueBox text="That wing has nothing on show right now. Every other room is still open." emote="attention">
          <Link to="/museum" className="hw-btn no-underline" data-variant="small">
            ALL EXHIBITS
          </Link>
        </DialogueBox>
      )}
      {exhibits && room && roomOrder && <WingRoomView room={room} order={[...roomOrder.featured, ...roomOrder.rest]} onShuffle={() => setRound((r) => r + 1)} />}
      {exhibits && exhibits.length > 0 && !wingKey && (
        <>
          <DialogueBox text={featured.length > 0 ? 'Welcome to the Museum! Featured makers hang up top; the rest are in a new order every visit.' : 'Welcome to the Museum: projects from members of the hall, in a new order every visit.'} />
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

function ExhibitFrame({ exhibit: e }: { exhibit: Exhibit }) {
  const p = e.project;
  const facts = [p.language, ...p.tech_stack].filter(Boolean).slice(0, 4).join(' · ');
  return (
    <article className="exhibit" aria-labelledby={`ex-${e.project_id}`}>
      <Link to={exhibitPath(e.project_id)} className="exhibit-art-link" tabIndex={-1} aria-hidden="true">
        <ExhibitArt project={p} console={consoleFor(e.project_id, e.console)} featured={e.featured} />
      </Link>
      <div className="exhibit-plaque">
        <h2 id={`ex-${e.project_id}`} className="m-0 font-display text-h3 font-normal">
          <Link to={exhibitPath(e.project_id)} className="exhibit-title-link">
            {p.title}
          </Link>
        </h2>
        {p.description && <p className="m-0">{p.description}</p>}
        {facts && <p className="m-0 text-caption text-text-secondary">{facts}</p>}
        <p className="m-0 text-caption">
          by{' '}
          <Link to={memberPath(e.username)} className="underline decoration-2">
            {e.full_name}
          </Link>
          {(p.collaborators?.length ?? 0) > 0 && <> with {creditLine(p.collaborators!.map((c) => c.full_name))}</>}{' '}
          <span className="text-text-secondary">· No.{String(e.member_no).padStart(3, '0')}</span>
        </p>
      </div>
    </article>
  );
}

/** The doorways into the wings: the world's way round, and a plain list of links underneath. */
function WingDoors({ rooms, current }: { rooms: WingRoom[]; current: string | null }) {
  return (
    <nav className="wing-doors" aria-label="Wings">
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
      </ul>
    </nav>
  );
}

const RULE: Record<Wing['kind'], (w: Wing) => string> = {
  featured: () => 'Exhibits by members the curators featured.',
  collab: () => 'Projects made by more than one member of the hall.',
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
