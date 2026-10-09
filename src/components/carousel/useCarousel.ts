// Index, camera spring and gestures for the hanging-badge carousel (ADR-001), and for the arcs of
// the two circles (D-129), which drag along either axis with their own spacing.
// The camera lives in refs and is stepped by the level's animation loop; React state changes only
// when the current (or nearest) index changes, so dragging never re-renders every frame.

import { useCallback, useEffect, useRef, useState } from 'react';
import { DRAG_THRESHOLD_PX, SLOT_SPACING, clampIndex, releaseTarget, rubberBand, slotX, stepCamera } from '../../lib/carousel';
import { GRAB_HOLD_MS } from '../../lib/grab';

/** CSS px per pixel unit. */
export const UNIT_PX = 4;

interface Options {
  count: number;
  reduce: boolean;
  onIndexChange?: (index: number, count: number) => void;
  /** Whether a press may grab the badge (D-082): only on the current badge, never with reduced motion. */
  canGrab?: (target: EventTarget | null) => boolean;
  onGrab?: () => void;
  /** Which way a drag moves it: sideways (the level) or up and down (an arc on a wide screen). */
  axis?: 'x' | 'y';
  /** Drag distance (CSS px) that moves one item; the level's badges are a whole slot apart. */
  slotPx?: number;
}

export function useCarousel({ count, reduce, onIndexChange, canGrab, onGrab, axis = 'x', slotPx = SLOT_SPACING * UNIT_PX }: Options) {
  const [index, setIndex] = useState(0);
  /** Slot nearest the camera while dragging, so neighbours render before the drag ends. */
  const [near, setNear] = useState(0);
  const indexRef = useRef(0);
  const cam = useRef({ x: 0, v: 0, prevV: 0 });
  const drag = useRef({ active: false, startX: 0, startY: 0, startCam: 0, lastX: 0, lastT: 0, flick: 0 });
  /** A held badge (D-082): while active, sideways movement swings it instead of moving the camera. */
  const grab = useRef({ active: false, dx: 0 });
  const holdTimer = useRef<number | undefined>(undefined);
  /** True from the moment a press becomes a drag until just after release: taps check it. */
  const moved = useRef(false);
  const opts = useRef({ count, reduce, onIndexChange, canGrab, onGrab, axis, slotPx });
  useEffect(() => {
    opts.current = { count, reduce, onIndexChange, canGrab, onGrab, axis, slotPx };
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
    if (grab.current.active) {
      grab.current.dx = dx;
      return;
    }
    const { axis: ax, slotPx: per } = opts.current;
    const along = ax === 'y' ? e.clientY : e.clientX;
    const delta = along - (ax === 'y' ? d.startY : d.startX);
    if (!moved.current && (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(e.clientY - d.startY) > DRAG_THRESHOLD_PX)) {
      window.clearTimeout(holdTimer.current); // moving before the hold ends: a normal drag, not a grab
    }
    if (!moved.current && Math.abs(delta) > DRAG_THRESHOLD_PX) moved.current = true;
    if (!moved.current) return;
    const now = performance.now();
    const c = cam.current;
    const nc = rubberBand(d.startCam - delta * (SLOT_SPACING / per), opts.current.count);
    c.v = nc - c.x;
    c.x = nc;
    d.flick = (along - d.lastX) / Math.max(1, now - d.lastT);
    d.lastX = along;
    d.lastT = now;
    setNear(clampIndex(nc / slotX(1), opts.current.count));
  }, []);

  const onPointerUp = useCallback(() => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    window.clearTimeout(holdTimer.current);
    window.removeEventListener('pointermove', onPointerMove);
    if (grab.current.active) grab.current = { active: false, dx: 0 }; // let go: the swing flings on
    else if (moved.current) {
      // An arc's items are close together: a drag across more than one settles on the nearest.
      const far = opts.current.slotPx !== SLOT_SPACING * UNIT_PX && Math.abs(cam.current.x - d.startCam) > SLOT_SPACING;
      go(far ? clampIndex(cam.current.x / SLOT_SPACING, opts.current.count) : releaseTarget(cam.current.x, indexRef.current, d.flick, opts.current.count));
    }
    // The click that follows a drag must not flip the card; clear the flag after it fires.
    window.setTimeout(() => {
      moved.current = false;
    }, 0);
  }, [go, onPointerMove]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button > 0 || opts.current.count === 0) return;
      const now = performance.now();
      const along = opts.current.axis === 'y' ? e.clientY : e.clientX;
      drag.current = { active: true, startX: e.clientX, startY: e.clientY, startCam: cam.current.x, lastX: along, lastT: now, flick: 0 };
      moved.current = false;
      window.clearTimeout(holdTimer.current);
      const o = opts.current;
      if (!o.reduce && o.canGrab?.(e.target)) {
        holdTimer.current = window.setTimeout(() => {
          if (!drag.current.active || moved.current) return;
          grab.current = { active: true, dx: 0 };
          moved.current = true; // the click that ends a grab must not flip the badge
          opts.current.onGrab?.();
        }, GRAB_HOLD_MS);
      }
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp, { once: true });
      window.addEventListener('pointercancel', onPointerUp, { once: true });
    },
    [onPointerMove, onPointerUp],
  );

  useEffect(
    () => () => {
      window.clearTimeout(holdTimer.current);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    },
    [onPointerMove, onPointerUp],
  );

  return { index, near, indexRef, cam, moved, grab, go, step, onPointerDown };
}
