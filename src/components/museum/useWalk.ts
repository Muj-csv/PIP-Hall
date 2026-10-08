// The current exhibit, the camera spring and the drag for the walkable Museum (V2-11), like the
// hall's carousel (ADR-001) but along stops at any spacing (rooms have doorways and signs between
// them). The camera lives in refs and is stepped by the Museum's animation loop; React state only
// changes when the current exhibit, or the one nearest a drag, changes.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DRAG_THRESHOLD_PX, stepCamera } from '../../lib/carousel';
import { nearestStop, releaseStop, walkBand } from '../../lib/museumWalk';
import { UNIT_PX } from '../carousel/useCarousel';

interface Options {
  /** Each stop's x, in units, in walking order. */
  xs: readonly number[];
  start: number;
  reduce: boolean;
}

export function useWalk({ xs, start, reduce }: Options) {
  const [index, setIndex] = useState(start);
  const [near, setNear] = useState(start);
  const indexRef = useRef(start);
  const cam = useRef({ x: xs[start] ?? 0, v: 0 });
  const drag = useRef({ active: false, startX: 0, startCam: 0, lastX: 0, lastT: 0, flick: 0 });
  /** True from the moment a press becomes a drag until just after release: clicks check it. */
  const moved = useRef(false);
  const pts = useMemo(() => xs.map((x) => ({ x })), [xs]);
  const opts = useRef({ xs, pts, reduce });
  useEffect(() => {
    opts.current = { xs, pts, reduce };
  });

  /** Walks to a stop; `cut` puts the camera there at once (a jump through the room map). */
  const go = useCallback((i: number, cut = false) => {
    const { xs: at, reduce: r } = opts.current;
    if (at.length === 0) return;
    const next = Math.max(0, Math.min(at.length - 1, Math.round(i)));
    if (next === indexRef.current && !r && !cut && !drag.current.active) cam.current.v += i < next ? -1.5 : i > next ? 1.5 : 0; // bump against the ends
    indexRef.current = next;
    setIndex(next);
    setNear(next);
    if (r || cut) {
      cam.current.x = at[next]!;
      cam.current.v = 0;
    }
  }, []);

  /** Advances the camera spring by dt frames. True once it has settled on the current stop. */
  const step = useCallback((dt: number): boolean => {
    const c = cam.current;
    const target = opts.current.xs[indexRef.current] ?? 0;
    if (drag.current.active) return false;
    if (opts.current.reduce) {
      c.x = target;
      c.v = 0;
    } else {
      const s = stepCamera(c.x, c.v, target, dt);
      c.x = s.cam;
      c.v = s.vel;
    }
    return c.x === target && c.v === 0;
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = drag.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    if (!moved.current && Math.abs(dx) > DRAG_THRESHOLD_PX) moved.current = true;
    if (!moved.current) return;
    const now = performance.now();
    const c = cam.current;
    const nc = walkBand(opts.current.pts, d.startCam - dx / UNIT_PX);
    c.v = nc - c.x;
    c.x = nc;
    d.flick = (e.clientX - d.lastX) / Math.max(1, now - d.lastT);
    d.lastX = e.clientX;
    d.lastT = now;
    setNear(nearestStop(opts.current.pts, nc));
  }, []);

  const onPointerUp = useCallback(() => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    window.removeEventListener('pointermove', onPointerMove);
    if (moved.current) go(releaseStop(opts.current.pts, cam.current.x, indexRef.current, d.flick));
    // The click that follows a drag must not open or pick anything; clear the flag after it fires.
    window.setTimeout(() => {
      moved.current = false;
    }, 0);
  }, [go, onPointerMove]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button > 0 || opts.current.xs.length === 0) return;
      const now = performance.now();
      drag.current = { active: true, startX: e.clientX, startCam: cam.current.x, lastX: e.clientX, lastT: now, flick: 0 };
      moved.current = false;
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp, { once: true });
      window.addEventListener('pointercancel', onPointerUp, { once: true });
    },
    [onPointerMove, onPointerUp],
  );

  useEffect(
    () => () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    },
    [onPointerMove, onPointerUp],
  );

  return { index, near, indexRef, cam, drag, moved, go, step, onPointerDown };
}
