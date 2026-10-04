// Every piece of pixel art in PIP-Hall, drawn for this project as text maps (D-024, brief §16).
// One character = one pixel unit. '.' is transparent. Letters are palette keys; palettes map
// keys to theme tokens (CSS custom properties), never to raw colours, so NIGHT recolours the world.

export type SpriteMap = readonly string[];

export const SPR = {
  pipIdle: ['.....kk.....', '......k.....', '....kkkk....', '...kwwwwk...', '..kwwwwwwk..', '..kwkwwkwk..', '..kwwwwwwk..', '..kwwrrwwk..', '...kwwwwk...', '....kkkk....', '...kvk.kvk..', '...kk...kk..'],
  pipWalk: ['.....kk.....', '......k.....', '....kkkk....', '...kwwwwk...', '..kwwwwwwk..', '..kwwkwwkk..', '..kwwwwwwk..', '..kwwwrrwk..', '...kwwwwk...', '....kkkk....', '....kvvk....', '....kkkk....'],
  pipJump: ['.....kk.....', '.....k......', '....kkkk....', '.k.kwwwwk.k.', '.kkwwwwwwkk.', '..kwkwwkwk..', '..kwwwwwwk..', '..kwwrrwwk..', '...kwwwwk...', '....kkkk....', '..kvk..kvk..', '..kk....kk..'],
  coin0: ['..kkkk..', '.kyyyyk.', 'kyyhhyyk', 'kyhyyyyk', 'kyhyydyk', 'kyhyydyk', 'kyyyydyk', 'kyydddyk', '.kyyyyk.', '..kkkk..'],
  coin1: ['...kk...', '..kyyk..', '..kyhk..', '..kyhk..', '..kyhk..', '..kyhk..', '..kydk..', '..kydk..', '..kyyk..', '...kk...'],
  coin2: ['...kk...', '...kk...', '...kk...', '...kk...', '...kk...', '...kk...', '...kk...', '...kk...', '...kk...', '...kk...'],
  block: ['kkkkkkkkkk', 'khhhhhhhbk', 'khbbbbbbsk', 'khbkkkbbsk', 'khbkbbkbsk', 'khbkkkbbsk', 'khbkbbbbsk', 'khbkbbbbsk', 'kbsssssssk', 'kkkkkkkkkk'],
  used: ['kkkkkkkkkk', 'kuuuuuuuuk', 'kuuuuuuuuk', 'kuuuuuuuuk', 'kuuuuuuuuk', 'kuuuuuuuuk', 'kuuuuuuuuk', 'kuuuuuuuuk', 'kuuuuuuuuk', 'kkkkkkkkkk'],
  brick: ['mmmmmmmmmm', 'rrrrHmrrrr', 'rrrrrmrrrr', 'rrrrrmrrrr', 'mmmmmmmmmm', 'rrmrrrrHrr', 'rrmrrrrrrr', 'rrmrrrrrrr', 'rrmrrrrrrr', 'mmmmmmmmmm'],
  ground: ['gggggggggg', 'gGgggggGgg', 'GGgGGGGGgG', 'dddddddddd', 'ddDddddddd', 'dddddddDdd', 'dddddddddd', 'dDdddddddd', 'ddddddDddd', 'dddddddddd', 'ddddDddddd', 'dddddddddd'],
  cloud: ['......wwww..........', '....wwwwwwww..ww....', '..wwwwwwwwwwwwwwww..', '.wwwwwwwwwwwwwwwwww.', 'wwwwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwwwww', '.cccccccccccccccccc.'],
  bush: ['....bbbb......', '..bbbbbbbb.bb.', '.bbBbbbbbbbbbb', 'bbbbbbbBbbbbbb', 'bbbbbbbbbbbbbb'],
  tube: ['kkkkkkkkkkkkkk', 'kRRHRRRRRRRRRk', 'kRRHRRRRRRRRRk', 'kkkkkkkkkkkkkk', '.kTTHTTTTTTTk.', '.kTTHTTTTTTTk.', '.kTTHTTTTTTTk.', '.kTTHTTTTTTTk.', '.kTTHTTTTTTTk.', '.kTTHTTTTTTTk.', '.kTTHTTTTTTTk.', '.kTTHTTTTTTTk.', '.kTTHTTTTTTTk.', '.kTTHTTTTTTTk.'],
  star0: ['..y..', '..y..', 'yyyyy', '..y..', '..y..'],
  star1: ['.....', '..y..', '.yyy.', '..y..', '.....'],
  clip: ['..kkkkkk..', '.kMMMMMMk.', 'kMHkkkkMMk', 'kMk....kMk'],
  flower: ['.w.', 'wyw', '.w.'],
  grass: ['g.g', 'ggg', '...'],
  iconCode: ['.....', '.k.k.', 'k...k', '.k.k.', '.....'],
  iconCase: ['.kkk.', 'kkkkk', 'k.k.k', 'kkkkk', '.....'],
  iconGlobe: ['.kkk.', 'kk.kk', 'kkkkk', 'kk.kk', '.kkk.'],
} as const satisfies Record<string, SpriteMap>;

export type SpriteName = keyof typeof SPR;

/** Palette: sprite key → CSS custom property holding a theme token. */
export type Palette = Readonly<Record<string, string>>;

/** The level. Follows DAY/NIGHT. */
export const WORLD_PALETTE: Palette = {
  k: '--color-card-ink',
  w: '--color-world-pip-body',
  r: '--color-world-pip-cheek',
  v: '--color-world-pip-feet',
  y: '--color-world-coin',
  d: '--color-world-coin-shade',
  h: '--color-world-coin-hi',
  b: '--color-world-block',
  s: '--color-world-block-shade',
  u: '--color-world-used',
  m: '--color-world-mortar',
  H: '--color-world-block-hi',
  g: '--color-world-grass',
  G: '--color-world-grass-dark',
  D: '--color-world-dirt-dark',
  c: '--color-world-cloud-shade',
  B: '--color-world-hill-dark',
  R: '--color-world-rim',
  T: '--color-world-tube',
  M: '--color-card-metal',
};

/** Per-sprite overrides inside the level (same key, different token). */
export const WORLD_OVERRIDES: Partial<Record<SpriteName, Palette>> = {
  cloud: { w: '--color-world-cloud' },
  bush: { b: '--color-world-bush', B: '--color-world-hill-dark' },
  brick: { r: '--color-world-brick', m: '--color-world-mortar', H: '--color-world-block-hi' },
  ground: { d: '--color-world-dirt' },
  tube: { H: '--color-world-tube-hi' },
  star0: { y: '--color-world-star' },
  star1: { y: '--color-world-star' },
};

/** The badge. Identical in DAY and NIGHT: the card is a physical object. */
export const CARD_PALETTE: Palette = {
  k: '--color-card-ink',
  w: '--color-card-face',
  y: '--color-card-coin',
  d: '--color-card-coin-shade',
  h: '--color-card-coin-hi',
  b: '--color-card-block',
  s: '--color-card-block-shade',
  H: '--color-card-block-hi',
  g: '--color-card-grass',
  M: '--color-card-metal',
};

export const DOODLE_PALETTE: Palette = { w: '--color-card-face', y: '--color-card-gold', g: '--color-card-frame-hi' };
export const CLIP_PALETTE: Palette = { k: '--color-card-ink', M: '--color-card-metal', H: '--color-card-metal-hi' };

/** Resolves a palette's CSS variables to colours once, for a whole frame of drawing. */
export function resolvePalette(palette: Palette, read: (cssVar: string) => string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, cssVar] of Object.entries(palette)) out[key] = read(cssVar);
  return out;
}

export function cssVarReader(el: Element = document.documentElement): (cssVar: string) => string {
  const style = getComputedStyle(el);
  return (cssVar) => style.getPropertyValue(cssVar).trim();
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  map: SpriteMap,
  colors: Record<string, string>,
  x: number,
  y: number,
  flip = false,
): void {
  for (let j = 0; j < map.length; j++) {
    const row = map[j] ?? '';
    for (let i = 0; i < row.length; i++) {
      const color = colors[row[i] ?? '.'];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + (flip ? row.length - 1 - i : i), y + j, 1, 1);
    }
  }
}

export function spriteSize(map: SpriteMap): { w: number; h: number } {
  return { w: map[0]?.length ?? 0, h: map.length };
}

/** An offscreen canvas with the sprite drawn at 1px per unit. */
export function spriteCanvas(map: SpriteMap, colors: Record<string, string>): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const { w, h } = spriteSize(map);
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) drawSprite(ctx, map, colors, 0, 0);
  return c;
}

// ---------------------------------------------------------------- Museum covers (D-073)

/** Covers follow the badge's colours (a physical print), so they look the same in DAY and NIGHT. */
export const COVER_PALETTE: Palette = {
  s: '--color-card-sky',
  c: '--color-card-cream',
  h: '--color-card-hill',
  H: '--color-card-hill-dark',
  g: '--color-card-grass',
  G: '--color-card-grass-light',
  d: '--color-card-ground',
  k: '--color-card-ink',
  a: '--color-card-block',
  b: '--color-card-coin',
  p: '--color-card-plum',
  l: '--color-card-lanyard',
};

export const COVER_W = 32;
export const COVER_H = 20;

/** FNV-1a, then a small PRNG: the same seed always draws the same cover. */
function seededRandom(seed: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let t = h >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A pixel cover for a project without an image: sky, two clouds, a rolling hill, ground, and a
 * mirrored 7×7 emblem made from the seed (the project's title), with an ink drop shadow.
 */
export function coverSprite(seed: string): SpriteMap {
  const rand = seededRandom(seed);
  const px: string[][] = Array.from({ length: COVER_H }, () => Array<string>(COVER_W).fill('s'));
  const set = (x: number, y: number, k: string) => {
    if (x >= 0 && x < COVER_W && y >= 0 && y < COVER_H) px[y]![x] = k;
  };

  // Clouds: one high on the left, one on the right.
  const cloud = ['.cc..', 'cccc.', '.cccc'];
  for (const [cx, cy] of [[1 + Math.floor(rand() * 6), 1 + Math.floor(rand() * 2)], [20 + Math.floor(rand() * 6), 2 + Math.floor(rand() * 2)]] as const) {
    cloud.forEach((row, j) => [...row].forEach((ch, i) => ch === 'c' && set(cx + i, cy + j, 'c')));
  }

  // A rolling hill behind the ground, its crest in the darker shade.
  const phase = rand() * Math.PI * 2;
  for (let x = 0; x < COVER_W; x++) {
    const top = 16 - Math.round(2 + 2 * Math.sin(x / 4 + phase));
    for (let y = top; y < 17; y++) set(x, y, y === top ? 'H' : 'h');
  }

  // Ground: a grass edge with light tufts, then soil.
  for (let x = 0; x < COVER_W; x++) {
    set(x, 17, rand() < 0.2 ? 'G' : 'g');
    set(x, 18, 'd');
    set(x, 19, 'd');
  }

  // The emblem: the left four columns from the seed, mirrored; never empty.
  const colour = (['a', 'b', 'p', 'l'] as const)[Math.floor(rand() * 4)]!;
  const cells: [number, number][] = [];
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 4; x++) {
      if (rand() < 0.55 || (x === 3 && (y === 0 || y === 6))) {
        cells.push([x, y]);
        if (x !== 3) cells.push([6 - x, y]);
      }
    }
  }
  const ox = 12;
  const oy = 4;
  for (const [x, y] of cells) set(ox + x + 1, oy + y + 1, 'k');
  for (const [x, y] of cells) set(ox + x, oy + y, colour);

  return px.map((row) => row.join(''));
}
