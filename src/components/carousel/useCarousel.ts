// Index, camera spring and gestures for the hanging-badge carousel (ADR-001).
// The camera lives in refs and is stepped by the level's animation loop; React state changes only
// when the current (or nearest) index changes, so dragging never re-renders every frame.

import { useCallback, useEffect, useRef, useState } from 'react';
import { DRAG_THRESHOLD_PX, clampIndex, releaseTarget, rubberBand, slotX, stepCamera } from '../../lib/carousel';

/** CSS px per pixel unit. */
export const UNIT_PX = 4;

interface Options {
  count: number;
  reduce: boolean;
  onIndexChange?: (index: number, count: number) => void;
}

export function useCarousel({ count, reduce, onIndexChange }: Options) {
  const [index, setIndex] = useState(0);
  /** Slot nearest the camera while dragging, so neighbours render before the drag ends. */
  const [near, setNear] = useState(0);
  const indexRef = useRef(0);
  const cam = useRef({ x: 0, v: 0, prevV: 0 });
  const drag = useRef({ active: false, startX: 0, startCam: 0, lastX: 0, lastT: 0, flick: 0 });
  /** True from the moment a press becomes a drag until just after release: taps check it. */
  const moved = useRef(false);
  const opts = useRef({ count, reduce, onIndexChange });
  useEffect(() => {
    opts.current = { count, reduce, onIndexChange };
  });

  const go = useCallback((i: number) => {
    const { count: n, reduce: r, onIndexChange: cb } = opts.current;
    if (n === 0) return;
    const next = clampIndex(i, n);
    if (next === indexRef.current && !drag.current.active && !r) {
      cam.current.v += i < next ? -1.5 : i > next ? 1.5 : 0; // bump against the ends
    }
    indexRef.current = next;
    setIndex(next);
    setNear(next);
    if (r) {
      cam.current.x = slotX(next);
      cam.current.v = 0;
    }
    cb?.(next, n);
  }, []);

  // Keep the index valid when the list changes (e.g. cards finish loading).
  useEffect(() => {
    if (count > 0 && indexRef.current > count - 1) go(count - 1);
  }, [count, go]);

  /** Advances the camera spring by dt frames; returns the camera's acceleration for the swing. */
  const step = useCallback((dt: number) => {
    const c = cam.current;
    const target = slotX(indexRef.current);
    if (opts.current.reduce && !drag.current.active) {
      c.x = target;
      c.v = 0;
    } else if (!drag.current.active) {
      const s = stepCamera(c.x, c.v, target, dt);
      c.x = s.cam;
      c.v = s.vel;
    }
    const acc = (c.v - c.prevV) / Math.max(dt, 0.01);
    c.prevV = c.v;
    return acc;
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = drag.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    if (!moved.current && Math.abs(dx) > DRAG_THRESHOLD_PX) moved.current = true;
    if (!moved.current) return;
    const now = performance.now();
    const c = cam.current;
    const nc = rubberBand(d.startCam - dx / UNIT_PX, opts.current.count);
    c.v = nc - c.x;
    c.x = nc;
    d.flick = (e.clientX - d.lastX) / Math.max(1, now - d.lastT);
    d.lastX = e.clientX;
    d.lastT = now;
    setNear(clampIndex(nc / slotX(1), opts.current.count));
  }, []);

  const onPointerUp = useCallback(() => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    window.removeEventListener('pointermove', onPointerMove);
    if (moved.current) go(releaseTarget(cam.current.x, indexRef.current, d.flick, opts.current.count));
    // The click that follows a drag must not flip the card; clear the flag after it fires.
    window.setTimeout(() => {
      moved.current = false;
    }, 0);
  }, [go, onPointerMove]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button > 0 || opts.current.count === 0) return;
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

  return { index, near, indexRef, cam, moved, go, step, onPointerDown };
}
