// Index math for the hanging-badge carousel (ADR-001, brief §3, §15). Pure, so it is unit-tested.
// Positions are in pixel units (1u = 4px); the camera's x is in the same units as slot positions.

/** Distance between neighbouring badges, in units. */
export const SLOT_SPACING = 66;
/** Pointer travel (CSS px) before a press counts as a drag rather than a tap. */
export const DRAG_THRESHOLD_PX = 6;
/** Release speed (CSS px per ms) that advances exactly one slot regardless of distance. */
export const FLICK_SPEED = 0.5;
/** How far past either end the camera may be dragged, in slots, and how stiff the band is. */
export const EDGE_OVERSHOOT = 0.4;
export const RUBBER_BAND = 0.3;
/** Only the current card and this many on each side are rendered (NFR-02). */
export const RENDER_RADIUS = 2;

export function clampIndex(i: number, count: number): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(i)));
}

export function slotX(index: number): number {
  return index * SLOT_SPACING;
}

/** Drag camera with rubber-banding beyond the first and last slot. */
export function rubberBand(cam: number, count: number): number {
  const min = -SLOT_SPACING * EDGE_OVERSHOOT;
  const max = (Math.max(count, 1) - 1 + EDGE_OVERSHOOT) * SLOT_SPACING;
  if (cam < min) return min + (cam - min) * RUBBER_BAND;
  if (cam > max) return max + (cam - max) * RUBBER_BAND;
  return cam;
}

/**
 * Where the carousel settles after a drag. A fast flick moves exactly one slot in the flick's
 * direction from the current index; otherwise it snaps to the nearest slot.
 * `flick` is pointer velocity in px/ms (negative = moving left = going to the next card).
 */
export function releaseTarget(cam: number, current: number, flick: number, count: number): number {
  if (Math.abs(flick) > FLICK_SPEED) return clampIndex(current + (flick < 0 ? 1 : -1), count);
  return clampIndex(cam / SLOT_SPACING, count);
}

/** Indices to render: current ±RENDER_RADIUS, clipped to the list. */
export function visibleIndices(current: number, count: number, radius = RENDER_RADIUS): number[] {
  const out: number[] = [];
  for (let i = Math.max(0, current - radius); i <= Math.min(count - 1, current + radius); i++) out.push(i);
  return out;
}

export interface SlotLook {
  /** Horizontal offset of the badge's centre from the screen centre, in units. */
  dx: number;
  scale: number;
  opacity: number;
  zIndex: number;
}

/** Neighbours shrink to ~0.84 and fade 12% per slot (brief §3). */
export function slotLook(index: number, cam: number): SlotLook {
  const dx = slotX(index) - cam;
  const dist = Math.abs(dx) / SLOT_SPACING;
  return {
    dx,
    scale: 1 - 0.16 * Math.min(dist, 1.4),
    opacity: 1 - 0.12 * Math.min(dist, 2),
    zIndex: 100 - Math.round(dist * 10),
  };
}

/** One step of the camera spring toward the current slot (k 0.11, damping 0.34). dt in 60fps frames. */
export function stepCamera(cam: number, vel: number, target: number, dt: number): { cam: number; vel: number } {
  const acc = (target - cam) * 0.11 - vel * 0.34;
  let v = vel + acc * dt;
  let c = cam + v * dt;
  if (Math.abs(target - c) < 0.02 && Math.abs(v) < 0.02) {
    c = target;
    v = 0;
  }
  return { cam: c, vel: v };
}
