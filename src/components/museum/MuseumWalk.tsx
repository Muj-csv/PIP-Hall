// The walkable Museum (V2-11, D-119, D-125): Pip walks the Museum's rooms on the PIXENDO's screen,
// on one animation loop like the hall's (D-031, ADR-001: hand-written, no library). The rooms come
// in order (the Winners' Hall, each event, each wing, All exhibits, The Archive); exhibits hang on
// the walls in their consoles (D-091) with a plaque under each, winners stand on pedestals with a
// trophy or rosette, and the plaque in front of Pip lights up when it stops. ← → (the MOVE rocker,
// or a drag) walk; Enter or OPEN visits the exhibit; M or MAP jumps to any room. Only the exhibits
// near Pip are mounted, so their pictures load as Pip reaches them. The list view is one link away.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTheme } from '../../app/themeContext';
import { KIND_NAME, kindOf } from '../../lib/events';
import { consoleFor } from '../../lib/museum';
import { awardLine, layoutWalk, planRooms, plaqueBy, plaqueOrigin, roomMakers, stopLine, STOP_SPACING, type MuseumParts, type WalkLayout, type WalkRoom, type WalkStop } from '../../lib/museumWalk';
import { exhibitPath } from '../../lib/publicUrl';
import { dateRange } from '../../lib/seasons';
import { cssVarReader } from '../../lib/sprites';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { ROOM_STYLES, wingRule } from '../../lib/wings';
import { UNIT_PX } from '../carousel/useCarousel';
import { DialogueBox } from '../dialogue/DialogueBox';
import { HandheldShell } from '../shell/HandheldShell';
import { drawIris, IRIS_FRAMES } from '../world/world';
import { ExhibitArt } from './ExhibitArt';
import { Ribbon } from './Ribbon';
import { useWalk } from './useWalk';
import { buildWalkAssets, drawWalk, drawWalkHero, PIP_OFFSET, propSpots, WALK_H, type WalkAssets, type WalkHero } from './walkWorld';

/** Exhibits mounted on each side of the one nearest the camera: more than the widest screen shows. */
const MOUNT = 2;
const STYLE_NAME: Readonly<Record<string, string>> = Object.fromEntries(ROOM_STYLES.map((s) => [s.value, s.label]));
const MOVE = { group: 'Walk between exhibits', prev: 'Previous exhibit', next: 'Next exhibit' };
const MAKERS_SHOWN = 24;
/** How far Pip may trail the exhibit it is walking to, in units. */
const PIP_LAG = 70;

interface Props {
  parts: MuseumParts;
  /** The room the address asks for ('winners', 'wing:web'…), and an exhibit in it to start at. */
  room: string | null;
  at: string | null;
  /** Pip walked into another room, or is about to open an exhibit: the address follows. */
  onRoom: (room: string, at?: string) => void;
}

/** The stop to start at: the named exhibit in the named room, else that room's first, else the first. */
function startStop(layout: WalkLayout, room: string | null, at: string | null): number {
  const r = layout.rooms.find((x) => x.id === room);
  if (!r) return 0;
  for (let i = r.first; i < r.first + r.count; i++) if (layout.stops[i]!.exhibit.project_id === at) return i;
  return r.first;
}

/** A room in words, under its name: what it holds, and the curator's or event's note. */
function aboutRoom(r: WalkRoom): { line: string; note: string | null; noteBy: string } {
  if (r.kind === 'winners') return { line: 'Places and awards from the hall’s events and its archive, as the judges announced them.', note: null, noteBy: '' };
  if (r.kind === 'event' && r.event) {
    const e = r.event;
    const tracks = (e.tracks?.length ?? 0) > 0 ? ` · Tracks: ${e.tracks!.join(', ')}` : '';
    return { line: `${KIND_NAME[kindOf(e)]} · ${dateRange(e.starts_on, e.ends_on)}${tracks}`, note: e.blurb || null, noteBy: 'About the event' };
  }
  if (r.kind === 'wing' && r.wing) return { line: wingRule(r.wing), note: r.wing.note || null, noteBy: 'Curator’s note' };
  if (r.kind === 'all') return { line: 'Every exhibit in the Museum: featured projects first, the rest in a new order each visit.', note: null, noteBy: '' };
  return { line: 'Past projects and hackathon outputs, compiled by the hall’s curators. Members can claim the ones they made.', note: null, noteBy: '' };
}

export default function MuseumWalk({ parts, room, at, onRoom }: Props) {
  const layout = useMemo(() => layoutWalk(planRooms(parts)), [parts]);
  const xs = useMemo(() => layout.stops.map((s) => s.x), [layout]);
  const spots = useMemo(() => propSpots(layout), [layout]);
  const reduce = useReducedMotion();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [start] = useState(() => startStop(layout, room, at));
  const [missing] = useState(() => Boolean(room) && !layout.rooms.some((r) => r.id === room));
  const walk = useWalk({ xs, start, reduce });
  const { index, near, indexRef, cam, moved, go, step } = walk;
  const [lit, setLit] = useState(-1);
  const [mapOpen, setMapOpen] = useState(false);
  const [moved1, setMoved1] = useState(false);

  const screenRef = useRef<HTMLDivElement>(null);
  const playRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const fgRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const assets = useRef<WalkAssets | null>(null);
  const hero = useRef<WalkHero>({ x: (xs[start] ?? 0) + PIP_OFFSET, face: 1, t: 0, walking: false });
  const litRef = useRef(-1);
  const iris = useRef<{ t: number; mid: () => void; done: boolean } | null>(null);
  /** Exhibits on the screen's layer, with their x along the corridor. */
  const mounted = useRef(new Map<HTMLElement, number>());
  const live = useRef({ layout, xs, spots, reduce });
  useEffect(() => {
    live.current = { layout, xs, spots, reduce };
  });

  // The room's colours follow DAY/NIGHT, like the hall's world.
  useLayoutEffect(() => {
    assets.current = buildWalkAssets(cssVarReader());
  }, [theme]);

  const roomIdx = layout.stops[index]?.room ?? 0;
  const current = layout.rooms[roomIdx];

  // When the rooms change under Pip (the officers arrive, an exhibit is added), stay at the same
  // exhibit in the same room.
  const shown = useRef({ layout, room: current?.id ?? null, project: layout.stops[index]?.exhibit.project_id ?? null });
  useLayoutEffect(() => {
    const was = shown.current;
    if (was.layout === layout) return;
    const r = layout.rooms.find((x) => x.id === was.room);
    let i = r ? r.first : Math.min(indexRef.current, layout.stops.length - 1);
    if (r) for (let k = r.first; k < r.first + r.count; k++) if (layout.stops[k]!.exhibit.project_id === was.project) i = k;
    go(Math.max(0, i), true);
    hero.current.x = (layout.stops[Math.max(0, i)]?.x ?? 0) + PIP_OFFSET;
  }, [layout, go, indexRef]);
  useEffect(() => {
    shown.current = { layout, room: current?.id ?? null, project: layout.stops[index]?.exhibit.project_id ?? null };
  });

  // Walking into another room: the address follows (?wing=…, ?event=…, ?room=…), so it can be shared.
  const announced = useRef(current?.id ?? null);
  useEffect(() => {
    if (!current || announced.current === current.id) return;
    announced.current = current.id;
    onRoom(current.id);
  }, [current, onRoom]);

  /** Walks to a stop, or jumps there through the iris when it is far (the map, another room). */
  const jumpTo = useCallback(
    (i: number) => {
      const target = live.current.xs[i];
      if (target === undefined) return;
      setMoved1(true);
      if (live.current.reduce || Math.abs(target - cam.current.x) <= STOP_SPACING * 3) {
        go(i);
        return;
      }
      iris.current = {
        t: 0,
        done: false,
        mid: () => {
          go(i, true);
          hero.current.x = target + PIP_OFFSET;
        },
      };
    },
    [cam, go],
  );

  // The address changed from outside (a door in the list, a link): go to that room.
  useEffect(() => {
    if (!room || room === announced.current) return;
    const r = layout.rooms.find((x) => x.id === room);
    if (!r) return;
    announced.current = room;
    jumpTo(r.first);
  }, [room, layout, jumpTo]);

  const step1 = useCallback(
    (d: number) => {
      setMoved1(true);
      go(indexRef.current + d);
    },
    [go, indexRef],
  );
  const open = useCallback(
    (i: number) => {
      const s = layout.stops[i];
      if (!s) return;
      onRoom(layout.rooms[s.room]!.id, s.exhibit.project_id); // Back returns to this exhibit
      navigate(exhibitPath(s.exhibit.project_id));
    },
    [layout, navigate, onRoom],
  );
  const closeMap = useCallback(() => {
    setMapOpen(false);
    screenRef.current?.focus({ preventScroll: true });
  }, []);
  const toRoom = useCallback(
    (r: number) => {
      const target = layout.rooms[Math.max(0, Math.min(layout.rooms.length - 1, r))];
      if (target) jumpTo(target.first);
    },
    [layout, jumpTo],
  );

  // ---- positioning the exhibits (also the moment one mounts, so it never flashes at 0)
  /** `width` is the screen's, read once per frame by the loop (reading it per element would make
   *  the browser lay the page out again after every move). */
  const place = useCallback(
    (el: HTMLElement, x: number, width = playRef.current?.clientWidth ?? 0) => {
      el.style.transform = `translate3d(${((x - cam.current.x) * UNIT_PX + width / 2).toFixed(1)}px,0,0) translateX(-50%)`;
    },
    [cam],
  );
  /** One ref for every exhibit: each carries its x in data-x. */
  const register = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;
      const x = Number(el.dataset.x);
      mounted.current.set(el, x);
      place(el, x);
      return () => {
        mounted.current.delete(el);
      };
    },
    [place],
  );

  // ---- the animation loop
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const drawn = { cam: Number.NaN, w: -1, lit: -2, hero: Number.NaN, frame: -1, face: 0, a: null as WalkAssets | null, layout: null as WalkLayout | null };
    let still = false;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(2.5, (now - last) / 16.67) : 1;
      last = now;
      const a = assets.current;
      const play = playRef.current;
      const bgC = bgRef.current;
      const fgC = fgRef.current;
      const bg = bgC?.getContext('2d');
      const fg = fgC?.getContext('2d');
      if (!a || !play || !bgC || !fgC || !bg || !fg) return;
      const L = live.current;

      const playW = play.clientWidth;
      const w = Math.max(60, Math.round(playW / UNIT_PX));
      for (const c of [bgC, fgC]) {
        if (c.width !== w) c.width = w;
        if (c.height !== WALK_H) c.height = WALK_H;
      }
      const settled = step(dt);
      const x = cam.current.x;
      const idx = indexRef.current;
      // The plaque lights up once Pip has stopped in front of it.
      const litNow = settled ? idx : -1;
      if (litNow !== litRef.current) {
        litRef.current = litNow;
        setLit(litNow);
      }

      const h = hero.current;
      const target = (L.xs[idx] ?? 0) + PIP_OFFSET;
      // Pip keeps up with the camera: never more than about half a screen behind it.
      if (Math.abs(target - h.x) > PIP_LAG) h.x = target - Math.sign(target - h.x) * PIP_LAG;
      const dx = target - h.x;
      h.walking = Math.abs(dx) > 0.6 && !L.reduce;
      if (L.reduce || Math.abs(dx) <= 0.6) h.x = target;
      else h.x += Math.max(-4, Math.min(4, dx * 0.2)) * dt;
      h.face = h.walking && dx < 0 ? -1 : 1; // arrived, Pip faces the exhibit
      h.t += dt;
      const pipFrame = h.walking ? ((h.t / 6) | 0) % 2 : 0;

      // Draw only what changed: a still Museum costs nothing per frame.
      const scene = x !== drawn.cam || w !== drawn.w || a !== drawn.a || L.layout !== drawn.layout;
      if (scene || litNow !== drawn.lit) drawWalk(bg, { w, cam: x, lit: litNow, between: L.spots }, a, L.layout);
      if (scene || h.x !== drawn.hero || pipFrame !== drawn.frame || h.face !== drawn.face) drawWalkHero(fg, w, x, h, a);
      if (scene) for (const [el, at] of mounted.current) place(el, at, playW);
      Object.assign(drawn, { cam: x, w, lit: litNow, hero: h.x, frame: pipFrame, face: h.face, a, layout: L.layout });

      // The iris for a jump to a far room (never with reduced motion).
      const ov = overlayRef.current;
      const octx = ov?.getContext('2d');
      const ir = iris.current;
      if (ov && octx && ir) {
        const ow = Math.round(ov.clientWidth / UNIT_PX);
        const oh = Math.round(ov.clientHeight / UNIT_PX);
        if (ov.width !== ow) ov.width = ow;
        if (ov.height !== oh) ov.height = oh;
        ov.hidden = false;
        ir.t += dt;
        drawIris(octx, ow, oh, ir.t, a.void);
        if (ir.t >= IRIS_FRAMES / 2 && !ir.done) {
          ir.done = true;
          ir.mid();
        }
        if (ir.t >= IRIS_FRAMES) iris.current = null;
      } else if (ov && !ov.hidden) ov.hidden = true;

      // Everything has come to rest (camera, Pip, iris): from here on a frame draws nothing.
      // Marked on the level only when it changes, for anyone (or any test) waiting for it.
      const nowStill = settled && !h.walking && !iris.current;
      if (nowStill !== still) {
        still = nowStill;
        play.toggleAttribute('data-still', still);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [cam, indexRef, place, step]);

  // ---- keyboard: ←/→ walk, Page Up/Down change rooms, Home/End, Enter or O opens, M the map
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (mapOpen) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMap();
      }
      return;
    }
    const onScreen = e.target === e.currentTarget;
    const k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowLeft') {
      e.preventDefault();
      if (e.shiftKey) toRoom(roomIdx + (k === 'ArrowRight' ? 1 : -1));
      else step1(k === 'ArrowRight' ? 1 : -1);
    } else if (k === 'PageDown' || k === 'PageUp') {
      e.preventDefault();
      toRoom(roomIdx + (k === 'PageDown' ? 1 : -1));
    } else if (k === 'Home' || k === 'End') {
      e.preventDefault();
      jumpTo(k === 'Home' ? 0 : layout.stops.length - 1);
    } else if ((k === 'Enter' && onScreen) || k === 'o' || k === 'O') {
      e.preventDefault();
      open(index);
    } else if (k === 'm' || k === 'M') {
      e.preventDefault();
      setMapOpen(true);
    }
  };

  // Mounted: the exhibits around the nearest one.
  const from = Math.max(0, near - MOUNT);
  const to = Math.min(layout.stops.length - 1, near + MOUNT);
  const visible: number[] = [];
  for (let i = from; i <= to; i++) visible.push(i);
  if (index < from || index > to) visible.push(index);

  const stop = layout.stops[index];
  const line = !moved1 && missing ? 'That room has nothing on show right now, so Pip starts at the first one. MAP shows every room.' : stopLine(layout, index);

  const screen = (
    <div
      ref={screenRef}
      className="screen walk-screen"
      tabIndex={0}
      role="region"
      aria-roledescription="museum"
      aria-label="The Museum. Left and right arrow keys walk between exhibits, Page Up and Page Down change rooms, Enter opens the exhibit, M opens the map."
      onKeyDown={onKeyDown}
      onPointerDown={mapOpen ? undefined : walk.onPointerDown}
      onClickCapture={(e) => {
        if (moved.current) {
          e.preventDefault(); // a drag never opens or picks anything
          e.stopPropagation();
        }
      }}
    >
      <div ref={playRef} className="play">
        <canvas ref={bgRef} data-layer="bg" aria-hidden="true" />
        <div className="walk-layer">
          {visible.map((i) => (
            <StopView
              key={`${layout.rooms[layout.stops[i]!.room]!.id}|${layout.stops[i]!.exhibit.project_id}|${layout.stops[i]!.x}`}
              stop={layout.stops[i]!}
              current={i === index}
              lit={i === lit}
              mount={register}
              onPick={() => {
                setMoved1(true);
                go(i);
              }}
              onOpen={() => open(i)}
            />
          ))}
        </div>
        <canvas ref={fgRef} data-layer="fg" aria-hidden="true" />
        {/* The room's name stays put at the top while Pip walks (the dialogue line says it too). */}
        {current && stop && (
          <p className="walk-title" aria-hidden="true">
            <span className="walk-title-name">{current.name}</span>
            <span className="walk-title-sub">
              {stop.group ? `${stop.group} · ` : ''}
              {stop.nth} of {current.count}
            </span>
          </p>
        )}
      </div>
      <DialogueBox text={line} />
      {mapOpen && (
        <RoomMap
          rooms={layout.rooms}
          current={roomIdx}
          onBack={closeMap}
          onPick={(r) => {
            setMapOpen(false);
            screenRef.current?.focus({ preventScroll: true });
            toRoom(r);
          }}
        />
      )}
      <canvas ref={overlayRef} className="overlay-canvas pixelated" hidden aria-hidden="true" />
    </div>
  );

  return (
    <>
      <HandheldShell
        screen={screen}
        onPrev={() => step1(-1)}
        onNext={() => step1(1)}
        onFlip={() => setMapOpen(true)}
        onOpen={mapOpen ? closeMap : () => open(index)}
        openLabel={mapOpen ? 'BACK' : 'OPEN'}
        controlsDisabled={layout.stops.length === 0}
        ledBlink={false}
        moveLabels={MOVE}
        flipLabel="MAP"
      />
      {current && (
        <RoomPanel
          layout={layout}
          room={roomIdx}
          onWalk={(i) => {
            jumpTo(i);
            screenRef.current?.focus({ preventScroll: true });
          }}
          onRoom={(r) => {
            toRoom(r);
            screenRef.current?.focus({ preventScroll: true });
          }}
          onMap={() => setMapOpen(true)}
        />
      )}
    </>
  );
}

function StopView({ stop, current, lit, mount, onPick, onOpen }: { stop: WalkStop; current: boolean; lit: boolean; mount: (el: HTMLElement | null) => void | (() => void); onPick: () => void; onOpen: () => void }) {
  const e = stop.exhibit;
  const p = e.project;
  const by = plaqueBy(e);
  const origin = plaqueOrigin(e);
  const note = stop.awards.find((a) => a.award.note)?.award.note;
  // A plain click opens the exhibit from the walk (so Back returns here); a new-tab click is a link.
  const follow = (ev: React.MouseEvent) => {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    ev.preventDefault();
    onOpen();
  };
  return (
    <div
      ref={mount}
      data-x={stop.x}
      className="walk-stop"
      data-lit={lit || undefined}
      data-current={current || undefined}
      data-pedestal={stop.awards.length > 0 || undefined}
      aria-hidden={current ? undefined : true}
      onClick={
        current
          ? undefined
          : (ev) => {
              ev.preventDefault(); // a neighbour: walk to it first
              onPick();
            }
      }
    >
      <Link to={exhibitPath(e.project_id)} className="walk-console" tabIndex={-1} aria-hidden="true" onClick={current ? follow : undefined}>
        <ExhibitArt project={p} console={consoleFor(e.project_id, e.console)} featured={e.featured} />
      </Link>
      <div className="walk-plaque">
        <h3 className="walk-plaque-title">
          <Link to={exhibitPath(e.project_id)} className="walk-plaque-link" tabIndex={current ? undefined : -1} onClick={current ? follow : undefined}>
            {p.title}
          </Link>
        </h3>
        {by && <p className="m-0">by {by}</p>}
        {stop.awards.map((a) => (
          <p key={`${a.award.place ?? a.award.name}-${a.award.track ?? ''}-${a.event ?? ''}`} className="walk-award m-0">
            <Ribbon award={a.award} />
            <span>{awardLine(a)}</span>
          </p>
        ))}
        {stop.awards.length === 0 && origin && <p className="m-0 walk-origin">From the Archive · {origin}</p>}
        {lit && note && (
          <q className="award-note walk-note">
            <span className="sr-only">Judges’ note: </span>
            {note}
          </q>
        )}
      </div>
    </div>
  );
}

function RoomMap({ rooms, current, onPick, onBack }: { rooms: readonly WalkRoom[]; current: number; onPick: (r: number) => void; onBack: () => void }) {
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => back.current?.focus({ preventScroll: true }), []);
  return (
    <section className="menu-screen walk-map" aria-labelledby="walk-map-title">
      <button ref={back} type="button" className="hw-btn justify-self-start" data-variant="small" onClick={onBack}>
        ◀ BACK<span className="sr-only"> to the walk</span>
      </button>
      <h2 id="walk-map-title">MUSEUM MAP</h2>
      <p className="meta m-0">Pick a room and Pip goes straight there.</p>
      <ol className="walk-map-rooms" aria-label="Rooms, in walking order">
        {rooms.map((r, i) => (
          <li key={r.id}>
            <button type="button" className="walk-map-room" data-style={r.style} aria-current={i === current ? 'location' : undefined} onClick={() => onPick(i)}>
              <span className="walk-map-swatch" aria-hidden="true" />
              <span className="walk-map-name">{r.name}</span>
              <span className="walk-map-meta">
                {STYLE_NAME[r.style]} · {r.count} {r.count === 1 ? 'exhibit' : 'exhibits'}
                {i === current && <b> · You are here</b>}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function RoomPanel({ layout, room, onWalk, onRoom, onMap }: { layout: WalkLayout; room: number; onWalk: (stop: number) => void; onRoom: (room: number) => void; onMap: () => void }) {
  const r = layout.rooms[room]!;
  const makers = useMemo(() => roomMakers(layout, room), [layout, room]);
  const about = aboutRoom(r);
  const prev = layout.rooms[room - 1];
  const next = layout.rooms[room + 1];
  return (
    <section className="menu-panel walk-room" aria-labelledby="walk-room-title">
      <h2 id="walk-room-title" className="panel-title">
        {r.name}
      </h2>
      <p className="m-0 text-caption text-text-secondary">
        {STYLE_NAME[r.style]} · {r.count} {r.count === 1 ? 'exhibit' : 'exhibits'} · Room {room + 1} of {layout.rooms.length}
      </p>
      <p className="m-0">{about.line}</p>
      {about.note && (
        <figure className="curator-note">
          <blockquote className="m-0">{about.note}</blockquote>
          <figcaption className="text-caption">{about.noteBy}</figcaption>
        </figure>
      )}
      {makers.length > 0 && (
        <div className="grid gap-space-2">
          <h3 className="m-0 font-display font-normal">Makers in this room</h3>
          <ul className="walk-makers" aria-label={`Makers in ${r.name}`}>
            {makers.slice(0, MAKERS_SHOWN).map((m) => (
              <li key={m.username ?? `#${m.name}`}>
                <button type="button" className="chip" onClick={() => onWalk(m.stop)}>
                  <span className="sr-only">Walk to the work of </span>
                  {m.name}
                </button>
              </li>
            ))}
          </ul>
          {makers.length > MAKERS_SHOWN && <p className="m-0 text-caption">and {makers.length - MAKERS_SHOWN} more, on the plaques.</p>}
        </div>
      )}
      <div className="flex flex-wrap gap-space-2">
        {prev && (
          <button type="button" className="pixel-btn" onClick={() => onRoom(room - 1)}>
            <span aria-hidden="true">← </span>
            {prev.name}
            <span className="sr-only"> (previous room)</span>
          </button>
        )}
        {next && (
          <button type="button" className="pixel-btn" data-variant="primary" onClick={() => onRoom(room + 1)}>
            Next room: {next.name}
            <span aria-hidden="true"> →</span>
          </button>
        )}
        <button type="button" className="pixel-btn" onClick={onMap}>
          <span aria-hidden="true">▦ </span>Room map
        </button>
      </div>
    </section>
  );
}
