// The two circles (D-129): the hall's members on one arc and the chosen member's Quest Log on the
// other, the chosen one of each at the arc's apex, facing the middle of the screen where their badge
// and the chosen quest hang. Side by side on wide screens (members left, quests right); on narrow
// ones the members' arc runs along the top and the quests' along the bottom. The Museum uses the
// same two arcs for its rooms and their exhibits. Pure, so it is unit-tested; every number is in CSS
// pixels of the screen, and an arc's position counts items (1 = one item along the arc).

export type ArcSide = 'left' | 'right' | 'top' | 'bottom';

export interface Arc {
  side: ArcSide;
  /** Where the chosen item sits: the point of the arc nearest the middle of the screen. */
  apex: { x: number; y: number };
  /** The circle's radius; its centre is off-screen, behind the apex. */
  radius: number;
  /** Distance between neighbouring items along the arc. */
  spacing: number;
  /** Width and height of one item at full size. */
  item: number;
}

export interface ArcLook {
  /** The item's centre. */
  x: number;
  y: number;
  scale: number;
  opacity: number;
  zIndex: number;
}

/** Items rendered on each side of the chosen one. */
export const ARC_RADIUS = 4;

/** Where item `i` sits when the arc has turned to `pos` (the chosen item at the apex is `pos`). */
export function arcLook(i: number, pos: number, arc: Arc): ArcLook {
  const d = i - pos;
  const a = (d * arc.spacing) / arc.radius;
  const along = arc.radius * Math.sin(a);
  const back = arc.radius * (1 - Math.cos(a));
  const { x, y } = arc.apex;
  const at =
    arc.side === 'left' ? { x: x - back, y: y + along }
    : arc.side === 'right' ? { x: x + back, y: y + along }
    : arc.side === 'top' ? { x: x + along, y: y - back }
    : { x: x + along, y: y + back };
  const dist = Math.abs(d);
  // The chosen item is full size; its neighbours step down, and fade the further round they are.
  const scale = 1 - 0.3 * Math.min(dist, 1) - 0.06 * Math.max(0, Math.min(dist, 4) - 1);
  return { x: at.x, y: at.y, scale, opacity: 1 - 0.16 * Math.min(dist, 4), zIndex: 100 - Math.round(dist * 10) };
}

/** Indices to render around the arc's position, clipped to the list. */
export function arcIndices(pos: number, count: number, radius = ARC_RADIUS): number[] {
  const out: number[] = [];
  const mid = Math.round(pos);
  for (let i = Math.max(0, mid - radius); i <= Math.min(count - 1, mid + radius); i++) out.push(i);
  return out;
}

/** A dotted ring along the arc, as pixel points (every `step` px, inside the screen). */
export function arcDots(arc: Arc, w: number, h: number, step = 8): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const reach = Math.PI * 0.6;
  const n = Math.ceil((reach * arc.radius) / step);
  for (let k = -n; k <= n; k++) {
    const p = arcLook(0, (-k * step) / arc.spacing, arc);
    if (p.x >= 0 && p.y >= 0 && p.x < w && p.y < h) out.push({ x: Math.round(p.x), y: Math.round(p.y) });
  }
  return out;
}

export type CirclesMode = 'side' | 'stack';

export interface CirclesLayout {
  mode: CirclesMode;
  /** The hall's members (the Museum's rooms). */
  first: Arc;
  /** The chosen member's quests (the room's exhibits). */
  second: Arc;
}

/** Screens at least this wide put the arcs side by side. */
export const SIDE_MIN = 560;
/** The HUD's height across the top of the screen. */
const HUD = 24;

/** The two arcs for a screen of this size. */
export function circlesLayout(w: number, h: number): CirclesLayout {
  if (w >= SIDE_MIN) {
    const item = 56;
    const radius = Math.round(h * 0.78);
    const y = Math.round(HUD + (h - HUD) / 2);
    const inset = Math.round(Math.min(104, w * 0.12));
    return {
      mode: 'side',
      first: { side: 'left', apex: { x: inset, y }, radius, spacing: 76, item },
      second: { side: 'right', apex: { x: w - inset, y }, radius, spacing: 76, item },
    };
  }
  const item = 48;
  const radius = Math.round(Math.max(w, 280) * 1.15);
  return {
    mode: 'stack',
    first: { side: 'top', apex: { x: Math.round(w / 2), y: HUD + 44 }, radius, spacing: 62, item },
    // Above the ground, where Pip walks.
    second: { side: 'bottom', apex: { x: Math.round(w / 2), y: h - 100 }, radius, spacing: 62, item },
  };
}

/** Wheel travel (px) that turns an arc by one item. */
export const WHEEL_STEP = 60;

/** Where the badge and the chosen quest's panel go between the arcs, in CSS px. */
export interface CirclesCentre {
  /** The badge's box (its scale applied) and its scale. */
  badge: { left: number; top: number; width: number; height: number; scale: number };
  /** The quest panel's left, width and the line its middle sits on. */
  panel: { left: number; width: number; mid: number };
}

/** The badge at full size: 56 × 88u, plus its strap and clip (8u), at 4px a unit. */
export const BADGE_W = 224;
export const BADGE_H = 384;

export function circlesCentre(l: CirclesLayout, w: number): CirclesCentre {
  if (l.mode === 'side') {
    const gap = 16;
    const from = l.first.apex.x + l.first.item / 2 + gap;
    const to = l.second.apex.x - l.second.item / 2 - gap;
    const room = to - from;
    const scale = Math.max(0.6, Math.min(1, (room - gap - 200) / BADGE_W));
    const bw = Math.round(BADGE_W * scale);
    const pw = Math.max(160, Math.min(300, room - bw - gap));
    const left = Math.round(from + Math.max(0, (room - bw - gap - pw) / 2));
    return {
      badge: { left, top: 80, width: bw, height: Math.round(BADGE_H * scale), scale },
      panel: { left: left + bw + gap, width: pw, mid: l.first.apex.y },
    };
  }
  const gap = 8;
  const top = l.first.apex.y + l.first.item / 2 + 16;
  const bottom = l.second.apex.y - l.second.item / 2 - 16;
  const scale = Math.max(0.5, Math.min(0.85, (bottom - top) / BADGE_H, (w - 16 - gap - 136) / BADGE_W));
  const bw = Math.round(BADGE_W * scale);
  const pw = Math.max(120, Math.min(220, w - 16 - gap - bw));
  const left = Math.round((w - bw - gap - pw) / 2);
  const bh = Math.round(BADGE_H * scale);
  return {
    badge: { left, top, width: bw, height: bh, scale },
    panel: { left: left + bw + gap, width: pw, mid: Math.round(top + bh / 2) },
  };
}
