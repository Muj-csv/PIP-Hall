// Draws the PIXENDO level (brief §3, §15, §16) on two canvases at 1px per unit: `bg` behind the
// badges (sky, clouds, hills, bushes, tube, flag, bricks, blocks) and `fg` in front (ground, Pip,
// coins). Colours come from theme tokens, resolved once per theme into `WorldAssets`.

import { SLOT_SPACING } from '../../lib/carousel';
import { SPR, WORLD_OVERRIDES, WORLD_PALETTE, resolvePalette, spriteCanvas, type SpriteName } from '../../lib/sprites';

export const LEVEL_H = 144;
export const GROUND_Y = 132;
export const CEIL_Y = 10;
/** Pip's head reaching this height (in units) counts as hitting the badge. */
export const HEAD_HIT_Y = 117;

const WORLD_SPRITES = ['pipIdle', 'pipWalk', 'pipJump', 'coin0', 'coin1', 'coin2', 'block', 'used', 'brick', 'ground', 'cloud', 'bush', 'tube', 'star0', 'star1', 'flower', 'tree', 'tuft', 'pine', 'bird0', 'bird1', 'moon', 'tuft1'] as const satisfies readonly SpriteName[];

export interface WorldAssets {
  sprites: Record<(typeof WORLD_SPRITES)[number], HTMLCanvasElement>;
  colors: {
    sky: string;
    skyHigh: string;
    skyBand: string;
    mountain: string;
    mountainShade: string;
    mountainSnow: string;
    ridge: string;
    firefly: string;
    hill: string;
    hillHi: string;
    hillDark: string;
    star: string;
    ink: string;
    flag: string;
    flagEye: string;
    void: string;
  };
}

export function buildWorldAssets(read: (cssVar: string) => string): WorldAssets {
  const sprites = {} as WorldAssets['sprites'];
  for (const name of WORLD_SPRITES) {
    sprites[name] = spriteCanvas(SPR[name], resolvePalette({ ...WORLD_PALETTE, ...WORLD_OVERRIDES[name] }, read));
  }
  return {
    sprites,
    colors: {
      sky: read('--color-world-sky'),
      skyHigh: read('--color-world-sky-high'),
      skyBand: read('--color-world-sky-band'),
      mountain: read('--color-world-mountain'),
      mountainShade: read('--color-world-mountain-shade'),
      mountainSnow: read('--color-world-mountain-snow'),
      ridge: read('--color-world-ridge'),
      firefly: read('--color-world-coin-hi'),
      hill: read('--color-world-hill'),
      hillHi: read('--color-world-hill-hi'),
      hillDark: read('--color-world-hill-dark'),
      star: read('--color-world-star'),
      ink: read('--color-card-ink'),
      flag: read('--color-world-flag'),
      flagEye: read('--color-card-face'),
      void: read('--color-void'),
    },
  };
}

export interface Hero {
  x: number;
  /** Height above the ground, ≤ 0 while in the air. */
  y: number;
  vy: number;
  face: 1 | -1;
  t: number;
  air: boolean;
  /** Already hit the badge on this jump. */
  hit: boolean;
  walking: boolean;
}

export interface CoinFx {
  x: number;
  y: number;
  vy: number;
  t: number;
}

export interface WorldFrame {
  /** Canvas width in units. */
  w: number;
  cam: number;
  t: number;
  night: boolean;
  /** Reduced motion: nothing moves on its own (the clouds stop drifting). */
  still?: boolean;
  count: number;
  flipped: (i: number) => boolean;
  bump: (i: number) => number;
}

/** A stable pseudo-random number in [0, 1) for a world position, so the scenery never repeats
 *  in step yet stays put as the camera moves (D-086). */
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Rolling hills of varied size: each hill's radius and offset come from its index. */
function hills(ctx: CanvasRenderingContext2D, f: WorldFrame, a: WorldAssets, factor: number, spacing: number, r0: number) {
  const scroll = f.cam * factor;
  const first = Math.floor((scroll - f.w) / spacing) - 1;
  const last = Math.ceil((scroll + f.w) / spacing) + 1;
  for (let k = first; k <= last; k++) {
    const r = Math.round(r0 * (0.7 + hash(k) * 0.6));
    const cx = Math.round(k * spacing + (hash(k + 99) - 0.5) * spacing * 0.5 - scroll + f.w / 2);
    if (cx + r < 0 || cx - r > f.w) continue;
    for (let i = -r; i <= r; i++) {
      const hh = Math.round(Math.sqrt(r * r - i * i) * 0.7);
      ctx.fillStyle = a.colors.hill;
      ctx.fillRect(cx + i, GROUND_Y - hh, 1, hh);
      // A lit crest on the left of each hill, a darker flank on the right.
      ctx.fillStyle = i < 0 ? a.colors.hillHi : a.colors.hillDark;
      if (i < r * 0.6 && i > -r * 0.9) ctx.fillRect(cx + i, GROUND_Y - hh, 1, i < 0 ? 2 : 1);
    }
    ctx.fillStyle = a.colors.hillDark;
    for (const [dx, dy] of [[-6, -8], [4, -12], [10, -5], [-12, -4]] as const) {
      if (Math.abs(dx) < r - 2 && hash(k * 7 + dx) > 0.3) ctx.fillRect(cx + dx, GROUND_Y + dy, 1, 2);
    }
  }
}

/** The farthest layer: a pale ridge, almost the sky's colour, barely moving. */
function ridge(ctx: CanvasRenderingContext2D, f: WorldFrame, a: WorldAssets) {
  const scroll = f.cam * 0.06;
  ctx.fillStyle = a.colors.ridge;
  for (let x = 0; x < f.w; x++) {
    const wx = x + scroll;
    const top = Math.round(92 - 6 * Math.sin(wx / 23) - 4 * Math.sin(wx / 9 + 1.3) - 2 * Math.sin(wx / 4.1));
    ctx.fillRect(x, top, 1, 110 - top);
  }
}

/** Haze at the foot of the far layers: the sky's band colour dithered over them, thinning upward,
 *  so distance fades into the sky instead of ending in a hard line. */
function haze(ctx: CanvasRenderingContext2D, f: WorldFrame, a: WorldAssets, top: number, bottom: number) {
  ctx.fillStyle = a.colors.skyBand;
  for (let y = top; y < bottom; y++) {
    const step = y > bottom - 3 ? 2 : y > bottom - 7 ? 3 : 4;
    for (let x = (y * 3) % step; x < f.w; x += step) ctx.fillRect(x, y, 1, 1);
  }
}

/** Far mountains: stepped peaks with snow caps and a shaded side, barely moving (parallax). */
function mountains(ctx: CanvasRenderingContext2D, f: WorldFrame, a: WorldAssets) {
  const spacing = 64;
  const off = -((f.cam * 0.12) % spacing);
  const base = 104;
  for (let mx = off - spacing; mx < f.w + spacing; mx += spacing) {
    const peaks = [
      { dx: 18, h: 34 },
      { dx: 44, h: 24 },
    ];
    for (const p of peaks) {
      const cx = Math.round(mx + p.dx);
      for (let y = 0; y < p.h; y++) {
        const half = Math.round(y * 1.15) + 1;
        const yy = base - p.h + y;
        ctx.fillStyle = a.colors.mountain;
        ctx.fillRect(cx - half, yy, half, 1);
        ctx.fillStyle = a.colors.mountainShade;
        ctx.fillRect(cx, yy, half, 1);
        if (y < Math.round(p.h * 0.22)) {
          ctx.fillStyle = a.colors.mountainSnow;
          ctx.fillRect(cx - half, yy, half + (y % 2 ? 0 : 1), 1);
        }
      }
    }
  }
}

/** Wraps a parallax position into [-margin, w + margin). */
function wrap(x: number, w: number, margin: number) {
  const span = w + margin * 2;
  return ((((x + margin) % span) + span) % span) - margin;
}

export function drawBackground(ctx: CanvasRenderingContext2D, f: WorldFrame, a: WorldAssets) {
  const { w, cam } = f;
  const half = w / 2;
  const s = a.sprites;
  const wx = (x: number) => Math.round(x - cam + half);

  ctx.fillStyle = a.colors.sky;
  ctx.fillRect(0, 0, w, LEVEL_H);
  // Deeper sky overhead, dithered into the main sky.
  ctx.fillStyle = a.colors.skyHigh;
  ctx.fillRect(0, 0, w, 30);
  for (let y = 30; y < 44; y++) for (let x = (y % 2) * ((y - 30) % 4 < 2 ? 1 : 0); x < w; x += 2 + Math.floor((y - 30) / 5)) ctx.fillRect(x, y, 1, 1);
  ctx.fillStyle = a.colors.skyBand;
  for (let y = 86; y < 100; y += 2) for (let x = (y / 2) % 2; x < w; x += 2) ctx.fillRect(x, y, 1, 1);
  ctx.fillRect(0, 100, w, 40);

  const t = f.still ? 0 : f.t;
  if (f.night) {
    ctx.fillStyle = a.colors.star;
    for (let i = 0; i < 26; i++) {
      const sx = wrap((i * 37 + 11) - cam * 0.1, w, 20);
      if ((((f.t / 30) + i) | 0) % 7 !== 0) ctx.fillRect(Math.round(sx), (i * 23) % 60 + 12, 1, 1);
    }
    ctx.drawImage(s.moon, Math.round(wrap(w * 0.12 - cam * 0.03, w, 8)), 30);
  }
  ridge(ctx, f, a);
  mountains(ctx, f, a);
  haze(ctx, f, a, 96, 110);
  // Clouds drift on their own as well as with the camera, each at its own pace (D-081).
  for (let k = 0; k < 4; k++) {
    const drift = t * (0.02 + k * 0.006);
    ctx.drawImage(s.cloud, Math.round(wrap(k * 70 + 20 - cam * 0.2 - drift, w, 30)) - 24, 18 + (k % 2) * 12);
  }
  // Birds cross the day sky in twos, wings beating (D-086); none at night.
  if (!f.night) {
    for (let k = 0; k < 2; k++) {
      const bx = Math.round(wrap(k * 97 + 40 + t * (0.22 + k * 0.05) - cam * 0.3, w, 12));
      const by = 26 + k * 9 + Math.round(Math.sin(t / 24 + k) * 2);
      ctx.drawImage(((t / 9 + k * 3) | 0) % 2 ? s.bird1 : s.bird0, bx, by);
      ctx.drawImage(((t / 9 + k * 3 + 1) | 0) % 2 ? s.bird1 : s.bird0, bx - 9, by + 4);
    }
  }
  hills(ctx, f, a, 0.5, 110, 26);
  haze(ctx, f, a, GROUND_Y - 6, GROUND_Y - 2);
  // A tree line between the hills and the bushes: round trees and pines, in pairs and singles,
  // each picked and placed by its index so the line never repeats in step (D-086).
  {
    const scroll = cam * 0.65;
    const spacing = 34;
    for (let k = Math.floor((scroll - w) / spacing) - 1; k <= Math.ceil((scroll + w) / spacing) + 1; k++) {
      if (hash(k * 3.1) < 0.35) continue; // gaps in the tree line
      const tx = Math.round(k * spacing + hash(k) * 14 - scroll + half);
      const pine = hash(k + 7) < 0.4;
      ctx.drawImage(pine ? s.pine : s.tree, tx - 6, GROUND_Y - (pine ? 12 : 14));
      if (hash(k + 13) > 0.6) ctx.drawImage(s.tree, tx + 7, GROUND_Y - 12);
    }
  }
  for (let k = 0; k < 6; k++) ctx.drawImage(s.bush, Math.round(wrap(k * 53 + 7 - cam * 0.8, w, 20)) - 10, GROUND_Y - 7);

  // Warp tube before the first slot (leads to Explore), goal flag after the last (brief §3).
  ctx.drawImage(s.tube, wx(-SLOT_SPACING * 0.85) - 8, GROUND_Y - 16);
  if (f.count > 0) {
    const fx = wx((f.count - 1) * SLOT_SPACING + SLOT_SPACING * 0.8);
    ctx.fillStyle = a.colors.ink;
    ctx.fillRect(fx, GROUND_Y - 44, 1, 44);
    ctx.drawImage(s.coin1, fx - 4, GROUND_Y - 53); // a gold finial
    ctx.fillRect(fx - 2, GROUND_Y - 2, 5, 2); // base
    ctx.fillStyle = a.colors.flag;
    for (let r = 0; r < 9; r++) ctx.fillRect(fx + 1, GROUND_Y - 43 + r, 9 - r, 1);
    ctx.fillStyle = a.colors.flagEye;
    ctx.fillRect(fx + 3, GROUND_Y - 40, 2, 2);
  }

  // Ceiling of bricks with one emblem block per member.
  for (let t = Math.floor((cam - half) / 10) - 1; t < Math.ceil((cam + half) / 10) + 1; t++) ctx.drawImage(s.brick, Math.round(t * 10 - cam + half), CEIL_Y);
  const first = Math.max(0, Math.floor((cam - half) / SLOT_SPACING) - 1);
  const last = Math.min(f.count - 1, Math.ceil((cam + half) / SLOT_SPACING) + 1);
  for (let i = first; i <= last; i++) {
    ctx.drawImage(f.flipped(i) ? s.used : s.block, wx(i * SLOT_SPACING) - 5, CEIL_Y + (f.bump(i) > 0 ? -2 : 0));
  }
}

export function drawForeground(ctx: CanvasRenderingContext2D, f: WorldFrame, a: WorldAssets, hero: Hero, coins: CoinFx[]) {
  const { w, cam } = f;
  const half = w / 2;
  const s = a.sprites;
  ctx.clearRect(0, 0, w, LEVEL_H);
  for (let t = Math.floor((cam - half) / 10) - 1; t < Math.ceil((cam + half) / 10) + 1; t++) {
    ctx.drawImage(s.ground, Math.round(t * 10 - cam + half), GROUND_Y);
    // A flower on some tiles, picked by position so it stays put as the camera moves.
    if (((t * 7919) >>> 0) % 5 === 0) ctx.drawImage(s.flower, Math.round(t * 10 - cam + half) + 3, GROUND_Y - 2);
  }

  const sprite = hero.air ? s.pipJump : hero.walking && ((hero.t / 6) | 0) % 2 ? s.pipWalk : s.pipIdle;
  const hx = Math.round(hero.x - cam + half - 6);
  const hy = Math.round(GROUND_Y - 12 + hero.y);
  ctx.save();
  if (hero.face < 0) {
    ctx.translate(hx * 2 + 12, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(sprite, hx, hy);
  ctx.restore();

  // The near layer: tufts that move faster than the ground and pass in front of Pip (D-081).
  const t = f.still ? 0 : f.t;
  for (let k = 0; k < 5; k++) {
    const sway = ((t / 22 + k) | 0) % 2 ? s.tuft1 : s.tuft;
    ctx.drawImage(sway, Math.round(wrap(k * 47 + 13 - cam * 1.3, w, 10)) - 3, GROUND_Y - 3);
  }
  // Fireflies at night: blinking points drifting over the grass (D-086).
  if (f.night) {
    ctx.fillStyle = a.colors.firefly;
    for (let k = 0; k < 9; k++) {
      if ((((t / 14) | 0) + k * 3) % 5 === 0) continue;
      const fx = wrap(k * 41 + 9 + Math.sin(t / 40 + k) * 6 - cam * 0.9, w, 6);
      const fy = GROUND_Y - 10 - ((k * 7) % 22) + Math.round(Math.sin(t / 30 + k * 2) * 3);
      ctx.fillRect(Math.round(fx), fy, 1, 1);
    }
  }

  const spin = [s.coin0, s.coin1, s.coin2, s.coin1];
  for (const c of coins) ctx.drawImage(spin[((c.t / 4) | 0) % 4]!, Math.round(c.x - cam + half) - 4, Math.round(c.y - 10));
}

/** Pixel iris: closes on the badge, then opens (19 frames each way). `t` in frames. */
export function drawIris(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, color: string) {
  const halfT = 19;
  const maxR = Math.hypot(w, h) / 2 + 4;
  const r = t < halfT ? maxR * (1 - t / halfT) : maxR * ((t - halfT) / halfT);
  const cx = Math.round(w / 2);
  const cy = Math.round(h * 0.42);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = color;
  for (let y = 0; y < h; y++) {
    const dy = y - cy;
    const span = r * r - dy * dy;
    if (span <= 0) {
      ctx.fillRect(0, y, w, 1);
      continue;
    }
    const hw = Math.floor(Math.sqrt(span));
    ctx.fillRect(0, y, Math.max(0, cx - hw), 1);
    ctx.fillRect(cx + hw, y, w, 1);
  }
}
export const IRIS_FRAMES = 38;

/** Boot dissolve: 2u cells revealed in a shuffled order over ~42 frames after a short hold. */
export function drawBoot(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, order: number[], color: string): boolean {
  const cols = Math.ceil(w / 2);
  const total = order.length;
  const shown = Math.min(total, Math.floor(total * Math.max(0, (t - 14) / 42)));
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = color;
  for (let o = shown; o < total; o++) {
    const cell = order[o]!;
    ctx.fillRect((cell % cols) * 2, ((cell / cols) | 0) * 2, 2, 2);
  }
  return shown >= total;
}

export function shuffledCells(w: number, h: number): number[] {
  const n = Math.ceil(w / 2) * Math.ceil(h / 2);
  const order = Array.from({ length: n }, (_, i) => i);
  for (let j = n - 1; j > 0; j--) {
    const r = Math.floor(Math.random() * (j + 1));
    [order[j], order[r]] = [order[r]!, order[j]!];
  }
  return order;
}
