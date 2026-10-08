// Draws the walkable Museum (V2-11, D-119, D-125) on canvases like the hall's level: 1px per unit,
// 144 units tall. Each room style is drawn once per theme into a 64-unit strip of wall, wainscot and
// floor that repeats along the corridor, and its prop (neon, flasks, a bookcase, a plant and ivy, a
// column) once into its own canvas, so a frame is a few image copies however long the Museum is.
// Colours come from theme tokens; every shape here is original. Text (signs, plaques) is HTML.

import { STOP_SPACING, type WalkLayout } from '../../lib/museumWalk';
import { FLASK_PALETTE, LAMP_PALETTES, MUSEUM_SPR, PLANT_PALETTE, RIBBON_PALETTES, RIBBON_SPRITES, SPR, TROPHY_PALETTES, WORLD_OVERRIDES, WORLD_PALETTE, resolvePalette, spriteCanvas } from '../../lib/sprites';
import type { RoomStyle } from '../../lib/wings';

export const WALK_H = 144;
/** The wall's chair rail, the floor's edge, and where Pip's feet stand. */
const RAIL_Y = 96;
const BASE_Y = 118;
export const FLOOR_Y = 121;
const FEET_Y = 134;
/** Where Pip stands to look at an exhibit: just left of it, facing it. */
export const PIP_OFFSET = -31;
const TILE = 64;
const STYLES: readonly RoomStyle[] = ['arcade', 'lab', 'library', 'garden', 'trophy'];

type Read = (cssVar: string) => string;

// Every token is named in full: the theme only keeps the variables its sources name (Tailwind).
const STYLE_TOKENS: Readonly<Record<RoomStyle, Readonly<Record<'wall' | 'wall-shade' | 'pattern' | 'floor' | 'floor-alt' | 'accent', string>>>> = {
  arcade: {
    wall: '--color-museum-arcade-wall',
    'wall-shade': '--color-museum-arcade-wall-shade',
    pattern: '--color-museum-arcade-pattern',
    floor: '--color-museum-arcade-floor',
    'floor-alt': '--color-museum-arcade-floor-alt',
    accent: '--color-museum-arcade-accent',
  },
  lab: {
    wall: '--color-museum-lab-wall',
    'wall-shade': '--color-museum-lab-wall-shade',
    pattern: '--color-museum-lab-pattern',
    floor: '--color-museum-lab-floor',
    'floor-alt': '--color-museum-lab-floor-alt',
    accent: '--color-museum-lab-accent',
  },
  library: {
    wall: '--color-museum-library-wall',
    'wall-shade': '--color-museum-library-wall-shade',
    pattern: '--color-museum-library-pattern',
    floor: '--color-museum-library-floor',
    'floor-alt': '--color-museum-library-floor-alt',
    accent: '--color-museum-library-accent',
  },
  garden: {
    wall: '--color-museum-garden-wall',
    'wall-shade': '--color-museum-garden-wall-shade',
    pattern: '--color-museum-garden-pattern',
    floor: '--color-museum-garden-floor',
    'floor-alt': '--color-museum-garden-floor-alt',
    accent: '--color-museum-garden-accent',
  },
  trophy: {
    wall: '--color-museum-trophy-wall',
    'wall-shade': '--color-museum-trophy-wall-shade',
    pattern: '--color-museum-trophy-pattern',
    floor: '--color-museum-trophy-floor',
    'floor-alt': '--color-museum-trophy-floor-alt',
    accent: '--color-museum-trophy-accent',
  },
};
const BOOKS = ['--color-museum-book-a', '--color-museum-book-b', '--color-museum-book-c', '--color-museum-book-d'] as const;

export interface WalkAssets {
  tiles: Record<RoomStyle, HTMLCanvasElement>;
  props: Record<RoomStyle, { canvas: HTMLCanvasElement; y: number }>;
  lamp: { on: HTMLCanvasElement; off: HTMLCanvasElement };
  cone: HTMLCanvasElement;
  pool: HTMLCanvasElement;
  doors: Record<RoomStyle, HTMLCanvasElement>;
  pedestal: HTMLCanvasElement;
  trophies: Record<1 | 2 | 3, HTMLCanvasElement>;
  rosette: HTMLCanvasElement;
  pip: { idle: HTMLCanvasElement; walk: HTMLCanvasElement };
  void: string;
}

/** A stable pseudo-random number in [0, 1) for a position, so patterns never repeat in step. */
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

/** One 64-unit strip of a room: ceiling, wall with its pattern, chair rail, wainscot, floor. */
function drawTile(style: RoomStyle, read: Read): HTMLCanvasElement {
  const [c, ctx] = canvas(TILE, WALK_H);
  if (!ctx) return c;
  const tok = (part: keyof (typeof STYLE_TOKENS)[RoomStyle]) => read(STYLE_TOKENS[style][part]);
  const px = (color: string, x: number, y: number, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const wall = tok('wall');
  const pattern = tok('pattern');
  const accent = tok('accent');
  const floor = tok('floor');
  const floorAlt = tok('floor-alt');
  const trim = read('--color-museum-trim');
  const ink = read('--color-card-ink');

  px(read('--color-museum-ceiling'), 0, 0, TILE, 8);
  px(trim, 0, 8, TILE, 2);
  px(wall, 0, 10, TILE, RAIL_Y - 10);

  // The wall's pattern.
  for (let y = 10; y < RAIL_Y; y++) {
    for (let x = 0; x < TILE; x++) {
      const wy = y - 10;
      let on: boolean;
      if (style === 'arcade') on = hash(x * 13 + y * 7) < 0.018 || (hash(x * 3 + y * 11) < 0.004 && x > 0 && y > 11);
      else if (style === 'lab') on = x % 8 === 0 || wy % 8 === 0;
      else if (style === 'library') on = x % 8 === 0 || (x % 8 === 4 && hash(x + y * 5) < 0.08);
      else if (style === 'garden') on = (x + y) % 8 === 0 || (((x - y) % 8) + 8) % 8 === 0;
      else on = (x % 8 === 4 && wy % 8 >= 3 && wy % 8 <= 5) || (wy % 8 === 4 && x % 8 >= 3 && x % 8 <= 5);
      if (on) px(pattern, x, y);
    }
  }
  // What runs along every room of a style: neon, a pipe, gold trim.
  if (style === 'arcade') {
    px(accent, 0, 22, TILE, 1);
    px(accent, 0, 90, TILE, 1);
  } else if (style === 'lab') {
    px(accent, 0, 12, TILE, 3);
    px(trim, 0, 12, TILE, 1);
    for (const x of [8, 40]) px(ink, x, 11, 3, 5);
  } else if (style === 'trophy') {
    px(accent, 0, 13, TILE, 1);
    px(accent, 0, 92, TILE, 1);
  }

  // Chair rail and wainscot panels.
  px(trim, 0, RAIL_Y, TILE, 2);
  px(tok('wall-shade'), 0, RAIL_Y + 2, TILE, BASE_Y - RAIL_Y - 2);
  for (const x0 of [4, 36]) {
    px(pattern, x0, 101, 24, 1);
    px(pattern, x0, 114, 24, 1);
    px(pattern, x0, 101, 1, 14);
    px(pattern, x0 + 23, 101, 1, 14);
  }
  // Baseboard.
  px(trim, 0, BASE_Y, TILE, 1);
  px(read('--color-museum-ceiling'), 0, BASE_Y + 1, TILE, FLOOR_Y - BASE_Y - 1);

  // The floor and its pattern.
  px(floor, 0, FLOOR_Y, TILE, WALK_H - FLOOR_Y);
  px(floorAlt, 0, FLOOR_Y, TILE, 1);
  for (let y = FLOOR_Y + 1; y < WALK_H; y++) {
    const fy = y - FLOOR_Y;
    for (let x = 0; x < TILE; x++) {
      let on: boolean;
      if (style === 'arcade') on = ((x >> 3) + (fy >> 2)) % 2 === 1;
      else if (style === 'lab') on = x % 16 === 0 || fy % 6 === 0;
      else if (style === 'library') on = fy % 4 === 0 || x === ((fy >> 2) % 2 ? 16 : 48);
      else if (style === 'garden') {
        const row = (fy / 7) | 0; // flagstones, each row's joints offset from the last
        on = fy % 7 === 0 || x === (row % 2 ? 12 : 44) || x === (row % 2 ? 36 : 20);
      }
      else on = fy >= 7 && fy <= 18;
      if (on) px(floorAlt, x, y);
    }
  }
  if (style === 'trophy') {
    px(accent, 0, FLOOR_Y + 6, TILE, 1);
    px(accent, 0, FLOOR_Y + 19, TILE, 1);
  }
  return c;
}

/** What stands between two exhibits in a room of this style. */
function drawProp(style: RoomStyle, read: Read): { canvas: HTMLCanvasElement; y: number } {
  const tok = (part: keyof (typeof STYLE_TOKENS)[RoomStyle]) => read(STYLE_TOKENS[style][part]);
  const ink = read('--color-card-ink');
  const trim = read('--color-museum-trim');
  if (style === 'arcade') {
    // A neon tube with a lit core, between two brackets.
    const [c, ctx] = canvas(4, 70);
    if (ctx) {
      ctx.fillStyle = ink;
      ctx.fillRect(0, 0, 4, 2);
      ctx.fillRect(0, 68, 4, 2);
      ctx.fillStyle = tok('accent');
      ctx.fillRect(1, 2, 2, 66);
      ctx.fillStyle = read('--color-museum-light');
      ctx.fillRect(1, 4, 1, 62);
    }
    return { canvas: c, y: 24 };
  }
  if (style === 'lab') {
    // A shelf with two flasks on it.
    const [c, ctx] = canvas(18, 12);
    if (ctx) {
      const flask = spriteCanvas(MUSEUM_SPR.flask, resolvePalette(FLASK_PALETTE, read));
      ctx.drawImage(flask, 1, 0);
      ctx.drawImage(flask, 10, 0);
      ctx.fillStyle = ink;
      ctx.fillRect(0, 8, 18, 3);
      ctx.fillStyle = trim;
      ctx.fillRect(0, 8, 18, 1);
      ctx.fillStyle = ink;
      ctx.fillRect(3, 11, 1, 1);
      ctx.fillRect(14, 11, 1, 1);
    }
    return { canvas: c, y: 62 };
  }
  if (style === 'library') {
    // A bookcase: four shelves of spines of different heights and colours.
    const [c, ctx] = canvas(18, BASE_Y + 1 - 22);
    if (ctx) {
      const books = BOOKS.map(read);
      ctx.fillStyle = ink;
      ctx.fillRect(0, 0, 18, c.height);
      ctx.fillStyle = tok('wall-shade');
      ctx.fillRect(1, 1, 16, c.height - 2);
      for (let shelf = 0; shelf < 4; shelf++) {
        const base = 22 + shelf * 23;
        let x = 2;
        let n = 0;
        while (x < 16) {
          const w = 1 + Math.floor(hash(shelf * 31 + n) * 2);
          const h = 9 + Math.floor(hash(shelf * 17 + n * 3) * 8);
          ctx.fillStyle = books[Math.floor(hash(shelf * 7 + n * 13) * books.length)]!;
          ctx.fillRect(x, base - h, Math.min(w, 16 - x), h);
          x += w + (hash(n * 5 + shelf) < 0.2 ? 1 : 0);
          n++;
        }
        ctx.fillStyle = trim;
        ctx.fillRect(1, base, 16, 1);
      }
    }
    return { canvas: c, y: 22 };
  }
  if (style === 'garden') {
    // Ivy hanging from the molding, and a potted plant on the floor.
    const [c, ctx] = canvas(12, FLOOR_Y - 10);
    if (ctx) {
      const leaf = read('--color-museum-leaf');
      const dark = read('--color-museum-leaf-dark');
      for (let y = 0; y < 34; y++) {
        ctx.fillStyle = dark;
        ctx.fillRect(6 + (((y / 6) | 0) % 2), y, 1, 1);
        if (y % 3 === 1) {
          ctx.fillStyle = leaf;
          ctx.fillRect(y % 6 < 3 ? 3 : 8, y, 2, 2);
        }
      }
      const plant = spriteCanvas(MUSEUM_SPR.plant, resolvePalette(PLANT_PALETTE, read));
      ctx.drawImage(plant, 0, c.height - plant.height);
    }
    return { canvas: c, y: 10 };
  }
  // trophy: a marble column with a capital and a base.
  const [c, ctx] = canvas(14, FLOOR_Y - 10);
  if (ctx) {
    const h = c.height;
    ctx.fillStyle = ink;
    ctx.fillRect(0, 0, 14, 4);
    ctx.fillRect(0, h - 4, 14, 4);
    ctx.fillRect(1, 4, 12, h - 8);
    ctx.fillStyle = read('--color-museum-pedestal');
    ctx.fillRect(1, 1, 12, 2);
    ctx.fillRect(1, h - 3, 12, 2);
    ctx.fillRect(2, 4, 10, h - 8);
    ctx.fillStyle = read('--color-museum-pedestal-hi');
    ctx.fillRect(3, 4, 2, h - 8);
    ctx.fillStyle = read('--color-museum-pedestal-shade');
    ctx.fillRect(10, 4, 2, h - 8);
    for (let x = 6; x < 10; x += 2) ctx.fillRect(x, 6, 1, h - 12);
  }
  return { canvas: c, y: 10 };
}

/** A doorway into a room: a trimmed, stepped arch with a glimpse of the room beyond, deeper in. */
function drawDoor(style: RoomStyle, read: Read): HTMLCanvasElement {
  const w = 28;
  const h = FLOOR_Y - 34;
  const [c, ctx] = canvas(w, h);
  if (!ctx) return c;
  const ink = read('--color-card-ink');
  const trim = read('--color-museum-trim');
  const beyond = read(STYLE_TOKENS[style]['wall-shade']);
  const floor = read(STYLE_TOKENS[style]['floor-alt']);
  const dark = read('--color-museum-door');
  for (let y = 0; y < h; y++) {
    const inset = y < 6 ? 6 - y : 0; // the arch steps in toward the top
    ctx.fillStyle = ink;
    ctx.fillRect(inset, y, w - inset * 2, 1);
    if (y > 0) {
      ctx.fillStyle = trim;
      ctx.fillRect(inset + 1, y, w - inset * 2 - 2, 1);
    }
    if (y > 2) {
      // The next room's wall, its floor at the foot, and shadow under the arch and down one side.
      ctx.fillStyle = y > h - 10 ? floor : y < 12 ? dark : beyond;
      ctx.fillRect(inset + 3, y, Math.max(0, w - inset * 2 - 6), 1);
      if (y >= 12 && y <= h - 10) {
        ctx.fillStyle = dark;
        ctx.fillRect(inset + 3, y, 3, 1);
      }
    }
  }
  return c;
}

/** The light from a lit lamp: a dithered cone on the wall, and a pool on the floor. No blur. */
function drawLight(read: Read): { cone: HTMLCanvasElement; pool: HTMLCanvasElement } {
  const light = read('--color-museum-light');
  const [cone, cctx] = canvas(48, 46);
  if (cctx) {
    cctx.fillStyle = light;
    for (let y = 0; y < 46; y++) {
      const half = 4 + y * 0.43;
      for (let x = 0; x < 48; x++) if (Math.abs(x - 23.5) <= half && (x + y) % 2 === 0) cctx.fillRect(x, y, 1, 1);
    }
  }
  const [pool, pctx] = canvas(48, 7);
  if (pctx) {
    pctx.fillStyle = light;
    for (let y = 0; y < 7; y++) {
      const half = 23 * Math.sqrt(1 - ((y - 3) / 3.5) ** 2);
      for (let x = 0; x < 48; x++) if (Math.abs(x - 23.5) <= half && (x + y) % 2 === 0) pctx.fillRect(x, y, 1, 1);
    }
  }
  return { cone, pool };
}

/** A winner's pedestal: a slab, a marble column lit on the left, and a base, standing on the floor. */
function drawPedestal(read: Read): HTMLCanvasElement {
  const w = 54;
  const h = FLOOR_Y - 61;
  const [c, ctx] = canvas(w, h);
  if (!ctx) return c;
  const ink = read('--color-card-ink');
  const box = (x: number, y: number, bw: number, bh: number, fill: string, hi: string, shade: string) => {
    ctx.fillStyle = ink;
    ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = fill;
    ctx.fillRect(x + 1, y + 1, bw - 2, bh - 2);
    ctx.fillStyle = hi;
    ctx.fillRect(x + 1, y + 1, 2, bh - 2);
    ctx.fillStyle = shade;
    ctx.fillRect(x + bw - 4, y + 1, 3, bh - 2);
  };
  const p = read('--color-museum-pedestal');
  const hi = read('--color-museum-pedestal-hi');
  const shade = read('--color-museum-pedestal-shade');
  box(3, 3, w - 6, h - 8, p, hi, shade);
  box(0, 0, w, 4, hi, hi, p);
  box(0, h - 6, w, 6, shade, p, shade);
  return c;
}

export function buildWalkAssets(read: Read): WalkAssets {
  const tiles = {} as WalkAssets['tiles'];
  const props = {} as WalkAssets['props'];
  const doors = {} as WalkAssets['doors'];
  for (const s of STYLES) {
    tiles[s] = drawTile(s, read);
    props[s] = drawProp(s, read);
    doors[s] = drawDoor(s, read);
  }
  const { cone, pool } = drawLight(read);
  const pip = (name: 'pipIdle' | 'pipWalk') => spriteCanvas(SPR[name], resolvePalette({ ...WORLD_PALETTE, ...WORLD_OVERRIDES[name] }, read));
  return {
    tiles,
    props,
    lamp: { on: spriteCanvas(MUSEUM_SPR.lamp, resolvePalette(LAMP_PALETTES.on, read)), off: spriteCanvas(MUSEUM_SPR.lamp, resolvePalette(LAMP_PALETTES.off, read)) },
    cone,
    pool,
    doors,
    pedestal: drawPedestal(read),
    trophies: {
      1: spriteCanvas(MUSEUM_SPR.trophy, resolvePalette(TROPHY_PALETTES[1], read)),
      2: spriteCanvas(MUSEUM_SPR.trophy, resolvePalette(TROPHY_PALETTES[2], read)),
      3: spriteCanvas(MUSEUM_SPR.trophy, resolvePalette(TROPHY_PALETTES[3], read)),
    },
    rosette: spriteCanvas(RIBBON_SPRITES.award, resolvePalette(RIBBON_PALETTES.award, read)),
    pip: { idle: pip('pipIdle'), walk: pip('pipWalk') },
    void: read('--color-void'),
  };
}

export interface WalkHero {
  x: number;
  face: 1 | -1;
  t: number;
  walking: boolean;
}

export interface WalkFrame {
  /** Canvas width in units. */
  w: number;
  cam: number;
  /** The exhibit whose lamp is on (Pip stands in front of it), or -1. */
  lit: number;
  /** Midpoints between neighbouring exhibits in a room, where each style's prop stands. */
  between: readonly { x: number; room: number }[];
}

/** The rooms, doorways, props, lamps and pedestals: everything behind the exhibits. */
export function drawWalk(ctx: CanvasRenderingContext2D, f: WalkFrame, a: WalkAssets, layout: WalkLayout) {
  const { w, cam } = f;
  // One rounding for everything, so tiles and props never open a seam as the camera moves.
  const off = Math.round(w / 2 - cam);
  const left = -off;
  const right = w - off;
  ctx.fillStyle = a.void;
  ctx.fillRect(0, 0, w, WALK_H);

  const rooms = layout.rooms;
  rooms.forEach((r, i) => {
    const from = Math.max(left, i === 0 ? -Infinity : r.x0);
    const to = Math.min(right, i === rooms.length - 1 ? Infinity : r.x1);
    if (to <= from) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(from + off, 0, to - from, WALK_H);
    ctx.clip();
    for (let tx = Math.floor(from / TILE) * TILE; tx < to; tx += TILE) ctx.drawImage(a.tiles[r.style], tx + off, 0);
    ctx.restore();
  });

  for (const b of f.between) {
    if (b.x < left - 20 || b.x > right + 20) continue;
    const prop = a.props[rooms[b.room]!.style];
    ctx.drawImage(prop.canvas, b.x + off - (prop.canvas.width >> 1), prop.y);
  }
  for (const r of rooms) {
    if (r.x0 < left - 20 || r.x0 > right + 20) continue;
    const door = a.doors[r.style];
    ctx.drawImage(door, r.x0 + off - (door.width >> 1), 34);
  }

  const reach = w / 2 + STOP_SPACING;
  for (let i = 0; i < layout.stops.length; i++) {
    const s = layout.stops[i]!;
    if (Math.abs(s.x - cam) > reach) continue;
    const x = s.x + off;
    const lit = i === f.lit;
    if (lit) {
      ctx.drawImage(a.cone, x - 24, 16);
      ctx.drawImage(a.pool, x - 24, FLOOR_Y + 2);
    }
    ctx.drawImage(lit ? a.lamp.on : a.lamp.off, x - 6, 10);
    if (s.awards.length > 0) {
      ctx.drawImage(a.pedestal, x - 27, 61);
      // The cup (a place) or the rosette (a named award) stands in front of the pedestal's base.
      const best = Math.min(...s.awards.map((p) => p.award.place ?? 9));
      const prize = best <= 3 ? a.trophies[best as 1 | 2 | 3] : a.rosette;
      ctx.drawImage(prize, x - (prize.width >> 1), FLOOR_Y - prize.height);
    }
  }
}

/** Pip, in front of everything. */
export function drawWalkHero(ctx: CanvasRenderingContext2D, w: number, cam: number, hero: WalkHero, a: WalkAssets) {
  ctx.clearRect(0, 0, w, WALK_H);
  const sprite = hero.walking && ((hero.t / 6) | 0) % 2 ? a.pip.walk : a.pip.idle;
  const hx = Math.round(hero.x - cam + w / 2 - 6);
  const hy = FEET_Y - 12;
  ctx.save();
  if (hero.face < 0) {
    ctx.translate(hx * 2 + 12, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(sprite, hx, hy);
  ctx.restore();
}

/** Where each style's prop stands: halfway between neighbouring exhibits in the same room. */
export function propSpots(layout: Pick<WalkLayout, 'stops'>): { x: number; room: number }[] {
  const out: { x: number; room: number }[] = [];
  for (let i = 0; i + 1 < layout.stops.length; i++) {
    const a = layout.stops[i]!;
    const b = layout.stops[i + 1]!;
    if (a.room === b.room && b.x - a.x === STOP_SPACING) out.push({ x: (a.x + b.x) / 2, room: a.room });
  }
  return out;
}
