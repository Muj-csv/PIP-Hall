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

const WORLD_SPRITES = ['pipIdle', 'pipWalk', 'pipJump', 'coin0', 'coin1', 'coin2', 'block', 'used', 'brick', 'ground', 'cloud', 'bush', 'tube', 'star0', 'star1', 'flower'] as const satisfies readonly SpriteName[];

export interface WorldAssets {
  sprites: Record<(typeof WORLD_SPRITES)[number], HTMLCanvasElement>;
  colors: {
    sky: string;
    skyHigh: string;
    skyBand: string;
    mountain: string;
    mountainShade: string;
    mountainSnow: string;
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
  count: number;
  flipped: (i: number) => boolean;
  bump: (i: number) => number;
}

function hills(ctx: CanvasRenderingContext2D, f: WorldFrame, a: WorldAssets, factor: number, spacing: number, r: number) {
  const off = -((f.cam * factor) % spacing);
  for (let hx = off - spacing; hx < f.w + spacing; hx += spacing) {
    const cx = Math.round(hx + spacing / 2);
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
      if (Math.abs(dx) < r - 2) ctx.fillRect(cx + dx, GROUND_Y + dy, 1, 2);
    }
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

  if (f.night) {
    ctx.fillStyle = a.colors.star;
    for (let i = 0; i < 26; i++) {
      const sx = wrap((i * 37 + 11) - cam * 0.1, w, 20);
      if ((((f.t / 30) + i) | 0) % 7 !== 0) ctx.fillRect(Math.round(sx), (i * 23) % 60 + 12, 1, 1);
    }
  }
  mountains(ctx, f, a);
  for (let k = 0; k < 4; k++) ctx.drawImage(s.cloud, Math.round(wrap(k * 70 + 20 - cam * 0.2, w, 30)) - 24, 18 + (k % 2) * 12);
  hills(ctx, f, a, 0.5, 110, 26);
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
