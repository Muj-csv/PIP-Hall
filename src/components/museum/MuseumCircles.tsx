// The Museum as two circles (D-129, D-130, D-133): its rooms on one arc (the Winners' Hall, each event,
// Featured Members, each wing, All exhibits, the Archive, or as the admins arranged them), the chosen
// room's exhibits on the other, and between them the chosen exhibit on its console beside its plaque,
// with VISIT (a featured member: their badge, the curator's note and OPEN PROFILE). Changing the room turns the
// exhibits' arc over to that room. MOVE walks exhibit by exhibit, on into the next room at the end
// of one; ROOM goes to the next room. The walk and the list are one link away. A lazy chunk, with
// its own animation loop (the page has no other).

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { SLOT_SPACING, slotX } from '../../lib/carousel';
import { arcDots, circlesCentre, circlesLayout, panelBox, type Arc, type CirclesLayout } from '../../lib/circles';
import { consoleFor } from '../../lib/museum';
import { awardLine, planRooms, plaqueBy, plaqueOrigin, type MuseumParts, type PlannedRoom, type RoomKind } from '../../lib/museumWalk';
import { memberPath } from '../../lib/publicUrl';
import { stopPath } from '../../lib/curation';
import { roomStops } from '../../lib/showcase';
import { cssVarReader } from '../../lib/sprites';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { ArcList, type ArcPlacer } from '../circles/ArcList';
import { QuestArt } from '../circles/QuestArt';
import { UNIT_PX, useCarousel } from '../carousel/useCarousel';
import { HandheldShell } from '../shell/HandheldShell';
import { ExhibitArt } from './ExhibitArt';
import { PortraitArt } from './PortraitArt';
import { PixelAvatar } from '../cards/PixelAvatar';
import { Ribbon } from './Ribbon';

interface Props {
  parts: MuseumParts;
  /** The room the address names, and the exhibit to stand at (coming Back from it). */
  room: string | null;
  at: string | null;
  /** The address follows the room; `at` marks the exhibit opened, so Back returns to it. */
  onRoom: (id: string, at?: string) => void;
}

const GLYPH: Readonly<Record<RoomKind, string>> = { winners: '♛', event: '⚑', members: '☺', wing: '▣', all: '✶', archive: '▤' };
const MOVE = { group: 'Move between exhibits', prev: 'Previous exhibit', next: 'Next exhibit' };
/** Rooms carry their names under their doors, so their arc spaces them wider when side by side. */
const ROOM_SPACING = 96;

export default function MuseumCircles({ parts, room, at, onRoom }: Props) {
  const rooms = useMemo<PlannedRoom[]>(() => planRooms(parts), [parts]);
  const stopsOf = useMemo(() => rooms.map(roomStops), [rooms]);
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const screen = useRef<HTMLDivElement>(null);
  const ringCanvas = useRef<HTMLCanvasElement>(null);
  const play = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const base = useMemo<CirclesLayout | null>(() => (size ? circlesLayout(size.w, size.h) : null), [size]);
  const layout = useMemo<CirclesLayout | null>(
    () => (base && base.mode === 'side' ? { ...base, first: { ...base.first, spacing: ROOM_SPACING } } : base),
    [base],
  );
  const centre = useMemo(() => (layout && size ? circlesCentre(layout, size.w) : null), [layout, size]);
  const mode = layout?.mode ?? 'side';

  const startRoom = Math.max(0, rooms.findIndex((r) => r.id === room));
  const roomDial = useCarousel({
    count: rooms.length,
    reduce,
    axis: mode === 'side' ? 'y' : 'x',
    slotPx: mode === 'side' ? ROOM_SPACING : 62,
    onIndexChange: (i) => onRoom(rooms[i]!.id),
  });
  const { go: goRoom, indexRef: roomIndexRef, cam: roomCamRef } = roomDial;
  const ri = Math.min(roomDial.index, Math.max(0, rooms.length - 1));
  const stops = stopsOf[ri] ?? [];
  const exDial = useCarousel({ count: stops.length, reduce, axis: mode === 'side' ? 'y' : 'x', slotPx: layout?.second.spacing ?? 76 });
  const { go: goExhibit, indexRef: exIndexRef, cam: exCamRef } = exDial;

  // Start in the room (and at the exhibit) the address names.
  useLayoutEffect(() => {
    goRoom(startRoom);
    roomCamRef.current.x = slotX(startRoom);
    // Once, on arrival; later changes come from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** Where the exhibits' arc starts in a room just entered: its first exhibit, its last, or `at`. */
  const enterAt = useRef<'first' | 'last' | string | null>(at);
  useEffect(() => {
    const want = enterAt.current;
    enterAt.current = null;
    const i = want === 'last' ? stops.length - 1 : want && want !== 'first' ? Math.max(0, stops.findIndex((s) => s.exhibit.project_id === want)) : 0;
    goExhibit(i);
    if (reduce || want === null || (want !== 'first' && want !== 'last')) {
      exCamRef.current.x = slotX(i);
    } else exCamRef.current.x = slotX(i) + (want === 'last' ? 1.5 : -1.5) * SLOT_SPACING;
    exCamRef.current.v = 0;
    // The dial's functions are stable; this follows the room only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ri]);

  useLayoutEffect(() => {
    const el = play.current;
    if (!el) return;
    const measure = () => setSize((s) => (s && s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The rings: dotted, drawn once for each size.
  useEffect(() => {
    const c = ringCanvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx || !layout || !size) return;
    c.width = Math.round(size.w / UNIT_PX);
    c.height = Math.round(size.h / UNIT_PX);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = cssVarReader(c)('--color-card-cream');
    for (const arc of [layout.first, layout.second] as Arc[]) for (const d of arcDots(arc, size.w, size.h, 8)) ctx.fillRect(Math.round(d.x / UNIT_PX), Math.round(d.y / UNIT_PX), 1, 1);
  }, [layout, size]);

  // One loop turns both arcs; once they rest, it writes nothing.
  const roomsPlacer = useRef<ArcPlacer | null>(null);
  const exPlacer = useRef<ArcPlacer | null>(null);
  const registerRooms = useCallback((f: ArcPlacer | null) => {
    roomsPlacer.current = f;
  }, []);
  const registerExhibits = useCallback((f: ArcPlacer | null) => {
    exPlacer.current = f;
  }, []);
  const live = useRef({ layout, roomDial, exDial });
  useEffect(() => {
    live.current = { layout, roomDial, exDial };
  });
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const was = { r: NaN, e: NaN, layout: null as CirclesLayout | null, still: false };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(2.5, (now - last) / 16.67) : 1;
      last = now;
      const l = live.current;
      if (!l.layout) return;
      l.roomDial.step(dt);
      l.exDial.step(dt);
      const r = l.roomDial.cam.current.x / SLOT_SPACING;
      const e = l.exDial.cam.current.x / SLOT_SPACING;
      const relaid = was.layout !== l.layout;
      if (relaid || Math.abs(r - was.r) > 0.0005) roomsPlacer.current?.(r, l.layout.first);
      if (relaid || Math.abs(e - was.e) > 0.0005) exPlacer.current?.(e, l.layout.second);
      // Marked on the screen only when it changes, for anyone (or any test) waiting for it to rest.
      const still = !relaid && Math.abs(r - was.r) <= 0.0005 && Math.abs(e - was.e) <= 0.0005;
      if (still !== was.still) play.current?.toggleAttribute('data-still', still);
      Object.assign(was, { r, e, layout: l.layout, still });
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const ei = Math.min(exDial.index, Math.max(0, stops.length - 1));
  const stop = stops[ei];
  const current = rooms[ri];

  /** MOVE: exhibit by exhibit, on into the next (or back into the previous) room at the ends. */
  const move = useCallback(
    (d: 1 | -1) => {
      const i = exIndexRef.current;
      const r = roomIndexRef.current;
      const n = stopsOf[r]?.length ?? 0;
      if (i + d >= 0 && i + d < n) goExhibit(i + d);
      else if (r + d >= 0 && r + d < rooms.length) {
        enterAt.current = d > 0 ? 'first' : 'last';
        goRoom(r + d);
      } else goExhibit(i + d); // the very end: a bump
    },
    [exIndexRef, roomIndexRef, goExhibit, goRoom, stopsOf, rooms.length],
  );
  const nextRoom = useCallback(() => {
    enterAt.current = 'first';
    goRoom((roomIndexRef.current + 1) % Math.max(1, rooms.length));
  }, [goRoom, roomIndexRef, rooms.length]);
  const pickRoom = useCallback(
    (i: number) => {
      enterAt.current = 'first';
      goRoom(i);
    },
    [goRoom],
  );
  const visit = useCallback(() => {
    const r = rooms[roomIndexRef.current];
    const s = stopsOf[roomIndexRef.current]?.[exIndexRef.current];
    if (!r || !s) return;
    onRoom(r.id, s.exhibit.project_id); // Back returns to this exhibit
    navigate(stopPath(s.exhibit));
  }, [rooms, stopsOf, roomIndexRef, exIndexRef, onRoom, navigate]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') move(e.key === 'ArrowRight' ? 1 : -1);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      enterAt.current = 'first';
      goRoom(roomIndexRef.current + (e.key === 'ArrowDown' ? 1 : -1));
    } else if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) visit();
    else return;
    e.preventDefault();
  };

  const by = stop ? plaqueBy(stop.exhibit) : null;
  const origin = stop ? plaqueOrigin(stop.exhibit) : null;
  const screenEl = (
    <div
      ref={screen}
      className="screen museum-circles"
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label="The Museum’s rooms and their exhibits. Left and right arrow keys move between exhibits, up and down between rooms, Enter visits the exhibit."
      onKeyDown={onKeyDown}
    >
      <div ref={play} className="play museum-room-backdrop" data-style={current?.style} data-mode={mode}>
        <canvas ref={ringCanvas} className="circles-rings pixelated" aria-hidden="true" />
        {current && (
          <p className="room-banner m-0" aria-live="polite">
            <span aria-hidden="true">{GLYPH[current.kind]} </span>
            {current.name}{' '}
            <span className="room-banner-count">
              · {stops.length} {current.kind === 'members' ? (stops.length === 1 ? 'member' : 'members') : stops.length === 1 ? 'exhibit' : 'exhibits'}
            </span>
          </p>
        )}
        <div className="circles" data-mode={mode}>
          {layout && centre && current && (
            <>
              <ArcList
                id="museum-rooms"
                label="Rooms"
                className="arc-members arc-rooms"
                count={rooms.length}
                index={ri}
                near={roomDial.near}
                optionLabel={(i) => `${rooms[i]!.name}, room ${i + 1} of ${rooms.length}, ${stopsOf[i]!.length} ${stopsOf[i]!.length === 1 ? 'exhibit' : 'exhibits'}`}
                renderOption={(i) => (
                  <>
                    <span className="arc-tile room-tile" data-style={rooms[i]!.style}>
                      <span className="room-glyph" aria-hidden="true">
                        {GLYPH[rooms[i]!.kind]}
                      </span>
                    </span>
                    <span className="room-name" aria-hidden="true">
                      {rooms[i]!.name}
                    </span>
                  </>
                )}
                onPick={pickRoom}
                onOpen={visit}
                onPointerDown={roomDial.onPointerDown}
                moved={roomDial.moved}
                register={registerRooms}
              />
              <ArcList
                id="museum-exhibits"
                label={`Exhibits in ${current.name}`}
                className="arc-quests"
                count={stops.length}
                index={ei}
                near={exDial.near}
                optionLabel={(i) =>
                  stops[i]!.exhibit.portrait
                    ? `${stops[i]!.exhibit.full_name}, member ${i + 1} of ${stops.length}`
                    : `${stops[i]!.exhibit.project.title}, exhibit ${i + 1} of ${stops.length}${stops[i]!.awards.length ? `, ${awardLine(stops[i]!.awards[0]!)}` : ''}`
                }
                renderOption={(i) => (
                  <span className="arc-tile quest-tile">
                    {stops[i]!.exhibit.portrait ? (
                      <PixelAvatar username={stops[i]!.exhibit.username} name={stops[i]!.exhibit.full_name} avatarPath={stops[i]!.exhibit.avatar_path} />
                    ) : (
                      <QuestArt project={stops[i]!.exhibit.project} className="quest-thumb" />
                    )}
                    {stops[i]!.awards.length > 0 && (
                      <span className="quest-no" aria-hidden="true">
                        ♛
                      </span>
                    )}
                  </span>
                )}
                onPick={(i) => goExhibit(i)}
                onOpen={visit}
                onPointerDown={exDial.onPointerDown}
                moved={exDial.moved}
                register={registerExhibits}
              />
              {stop?.exhibit.portrait && (
                <>
                  <div
                    className="circles-portrait"
                    style={{ left: centre.badge.left, top: Math.max(0, centre.panel.mid - Math.round((352 * centre.badge.scale) / 2)) }}
                  >
                    <PortraitArt key={stop.exhibit.project_id} card={stop.exhibit.portrait.card} scale={centre.badge.scale as 0.5 | 0.75 | 1} />
                  </div>
                  <section className="quest-panel" style={panelBox(centre)} aria-labelledby="museum-plaque-title">
                    <p className="quest-count m-0">
                      FEATURED MEMBER {ei + 1}/{stops.length}
                    </p>
                    <h3 id="museum-plaque-title" className="quest-title m-0">
                      {stop.exhibit.full_name}
                    </h3>
                    {stop.exhibit.portrait.card.card.role && <p className="quest-facts m-0">{stop.exhibit.portrait.card.card.role}</p>}
                    {stop.exhibit.portrait.note && (
                      <q className="quest-desc m-0">
                        <span className="sr-only">Curator’s note: </span>
                        {stop.exhibit.portrait.note}
                      </q>
                    )}
                    <button type="button" className="pixel-btn quest-view" data-variant="primary" onClick={visit}>
                      <span aria-hidden="true">▶ </span>OPEN PROFILE<span className="sr-only"> of {stop.exhibit.full_name}</span>
                    </button>
                  </section>
                </>
              )}
              {stop && !stop.exhibit.portrait && (
                <>
                  <div className="circles-console" style={{ left: centre.badge.left, width: centre.badge.width, top: centre.panel.mid }}>
                    <ExhibitArt key={stop.exhibit.project_id} project={stop.exhibit.project} console={consoleFor(stop.exhibit.project_id, stop.exhibit.console)} featured={stop.exhibit.featured} eager />
                  </div>
                  <section className="quest-panel" style={panelBox(centre)} aria-labelledby="museum-plaque-title">
                    <p className="quest-count m-0">
                      EXHIBIT {ei + 1}/{stops.length}
                    </p>
                    <h3 id="museum-plaque-title" className="quest-title m-0">
                      {stop.exhibit.project.title}
                    </h3>
                    {stop.awards.map((a) => (
                      <p key={`${awardLine(a)}`} className="award-plate m-0" data-place={a.award.place ?? 'award'}>
                        <Ribbon award={a.award} />
                        <span className="text-caption">{awardLine(a)}</span>
                      </p>
                    ))}
                    {by &&
                      (stop.exhibit.archive ? (
                        <p className="quest-facts m-0">by {by}</p>
                      ) : (
                        <p className="quest-facts m-0">
                          by{' '}
                          <Link to={memberPath(stop.exhibit.username)} className="underline decoration-2">
                            {by}
                          </Link>
                        </p>
                      ))}
                    {origin && <p className="quest-facts m-0">▤ From the Archive · {origin}</p>}
                    {stop.exhibit.project.description && <p className="quest-desc m-0">{stop.exhibit.project.description}</p>}
                    <button type="button" className="pixel-btn quest-view" data-variant="primary" onClick={visit}>
                      <span aria-hidden="true">▶ </span>VISIT<span className="sr-only"> {stop.exhibit.project.title}</span>
                    </button>
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <HandheldShell
      screen={screenEl}
      onPrev={() => move(-1)}
      onNext={() => move(1)}
      onFlip={nextRoom}
      onOpen={visit}
      openLabel="OPEN"
      controlsDisabled={rooms.length === 0}
      ledBlink={false}
      moveLabels={MOVE}
      flipLabel="ROOM"
    />
  );
}
