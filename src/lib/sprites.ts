// Every piece of pixel art in PIP-Hall, drawn for this project as text maps (D-024, brief §16).
// One character = one pixel unit. '.' is transparent. Letters are palette keys; palettes map
// keys to theme tokens (CSS custom properties), never to raw colours, so NIGHT recolours the world.

export type SpriteMap = readonly string[];

export const SPR = {
  // Pip, the hall's host: antenna bulb, shining eyes, blushing cheeks, shaded on the right.
  pipIdle: ['.....kyk....', '......k.....', '...kkkkkk...', '..kwwwwwwk..', '.kwwwwwwwPk.', '.kwkwwwkwPk.', '.kwkkwwkkPk.', '.kErwwwwErk.', '.kwwwkkwwPk.', '..kwwwwwPk..', '...kkkkkk...', '..kvvk.kvvk.'],
  pipWalk: ['......kyk...', '......k.....', '...kkkkkk...', '..kwwwwwwk..', '.kwwwwwwwPk.', '.kwkwwwkwPk.', '.kwkkwwkkPk.', '.kErwwwwErk.', '.kwwwkkwwPk.', '..kwwwwwPk..', '...kkkkkk...', '...kvvvvk...'],
  pipJump: ['.....kyk....', '......k.....', '.k.kkkkkk.k.', '.kkwwwwwwkk.', '.kwwwwwwwPk.', '.kwkkwwkkPk.', '.kwwwwwwwPk.', '.kErwwwwErk.', '.kwwwrrwwPk.', '..kwwwwwPk..', '...kkkkkk...', '..kvk..kvk..'],
  // A spinning coin: face with an embossed slot, quarter turn, edge.
  coin0: ['..kkkk..', '.khhyyk.', 'khyyyydk', 'khydhydk', 'khydhydk', 'khydhydk', 'khydhydk', 'khyyyydk', '.kyyddk.', '..kkkk..'],
  coin1: ['...kk...', '..khyk..', '..khyk..', '..khdk..', '..khdk..', '..khdk..', '..khdk..', '..khyk..', '..kydk..', '...kk...'],
  coin2: ['...kk...', '...hk...', '...hk...', '...hk...', '...hk...', '...hk...', '...hk...', '...hk...', '...hk...', '...kk...'],
  // The emblem block: riveted, bevelled, the P casting a shadow. Used once flipped.
  block: ['kkkkkkkkkk', 'khhhhhhhbk', 'khsbbbbsbk', 'khbkkksbsk', 'khbkbbkssk', 'khbkkksbsk', 'khbksbbbsk', 'khbksbbbsk', 'kbsssssssk', 'kkkkkkkkkk'],
  used: ['kkkkkkkkkk', 'kuuuuuuuuk', 'kukuuuukuk', 'kuuuuuuuuk', 'kuuuuuuuuk', 'kuuuuuuuuk', 'kuuuuuuuuk', 'kukuuuukuk', 'kuuuuuuuuk', 'kkkkkkkkkk'],
  // Ceiling bricks, each lit on its top and left edge.
  brick: ['mmmmmmmmmm', 'QQQQQmQQQQ', 'QrrrrmQrrr', 'QrrrrmQrrr', 'mmmmmmmmmm', 'QQmQQQQQQQ', 'rrmQrrrrrr', 'rrmQrrrrrr', 'rrmQrrrrrr', 'mmmmmmmmmm'],
  // Ground: grass blades poking up, a dark seam, then soil with pebbles.
  ground: ['.L....L...', 'gLggLgLggL', 'ggLgggggLg', 'GgggGgggGg', 'GGDGGGDGGD', 'dddddddddd', 'dOddDdddOd', 'ddddddDddd', 'dDdOdddddd', 'ddddddOdDd', 'dOddDddddd', 'dddddddddd'],
  cloud: ['.........wwww...........', '.......wwwwwwww...www...', '.....wwwwwwwwwwwwwwwww..', '..wwwwwwwwwwwwwwwwwwwww.', '.wwwwwwwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwwwwwwwww', 'cwwwwwwwwwwwwwwwwwwwwwcc', '.ccccwwwwwwwwwwwwwcccccc', '...ccccccccccccccccccc..'],
  bush: ['.....bJJb...bJb.', '...bbJJJbb.bJJbb', '..bJbbbbbbbbbbbb', '.bbbbbbNbbbbbbNb', 'bbbbNbbbbbbNbbbb', 'bNbbbbbNNbbbbbNb', 'NNNNNNNNNNNNNNNN'],
  // The warp tube: a gold rim (lit, shaded) on a lit, shaded pipe.
  tube: ['kkkkkkkkkkkkkkkk', 'kRhhRRRRRRRRRRdk', 'kRhRRRRRRRRRRRdk', 'kkkkkkkkkkkkkkkk', '.kTHHTTTTTTTXXk.', '.kTHHTTTTTTTXXk.', '.kTHHTTTTTTTXXk.', '.kTHHTTTTTTTXXk.', '.kTHHTTTTTTTXXk.', '.kTHHTTTTTTTXXk.', '.kTHHTTTTTTTXXk.', '.kTHHTTTTTTTXXk.', '.kTHHTTTTTTTXXk.', '.kTHHTTTTTTTXXk.', '.kTHHTTTTTTTXXk.', '.kTHHTTTTTTTXXk.'],
  // Night sky: a four-point sparkle and its smaller twinkle.
  star0: ['..y..', '.yhy.', 'yhhhy', '.yhy.', '..y..'],
  star1: ['.....', '..y..', '.yhy.', '..y..', '.....'],
  clip: ['..kkkkkk..', '.kHHHMMMk.', 'kMHkkkkMMk', 'kMk....kMk'],
  flower: ['.w.', 'wyw', '.g.'],
  grass: ['g.g', 'ggg', '.g.'],
  iconCode: ['.....', '.k.k.', 'k...k', '.k.k.', '.....'],
  iconCase: ['.k.k.', 'kkkkk', 'kk.kk', 'kkkkk', '.....'],
  iconGlobe: ['.kkk.', 'k.k.k', 'kkkkk', 'k.k.k', '.kkk.'],
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
  // Shading tones from the art pass (D-079).
  P: '--color-world-pip-shade',
  E: '--color-world-cheek-hi',
  L: '--color-world-grass-hi',
  O: '--color-world-dirt-hi',
  Q: '--color-world-brick-hi',
  X: '--color-world-tube-dark',
  N: '--color-world-bush-dark',
  J: '--color-world-bush-hi',
};

/** Per-sprite overrides inside the level (same key, different token). */
export const WORLD_OVERRIDES: Partial<Record<SpriteName, Palette>> = {
  cloud: { w: '--color-world-cloud' },
  bush: { b: '--color-world-bush', B: '--color-world-hill-dark' },
  brick: { r: '--color-world-brick', m: '--color-world-mortar' },
  ground: { d: '--color-world-dirt' },
  tube: { H: '--color-world-tube-hi' },
  star0: { y: '--color-world-star', h: '--color-world-coin-hi' },
  star1: { y: '--color-world-star', h: '--color-world-coin-hi' },
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

// ---------------------------------------------------------------- PIP MART frames (E2, D-074)

/**
 * Corner ornaments for each badge frame, drawn where the plain badge has its flowers. The frame's
 * colours themselves are CSS (`.badge[data-frame]`), from existing card tokens only.
 */
export const FRAME_DOODLES: Readonly<Record<string, { sprite: SpriteMap; palette: Palette }>> = {
  meadow: { sprite: ['.f.', 'fyf', '.g.'], palette: { f: '--color-card-cream', y: '--color-card-coin', g: '--color-card-grass-light' } },
  dusk: { sprite: ['y.y', '.w.', 'y.y'], palette: { y: '--color-card-coin-hi', w: '--color-card-cream' } },
  pearl: { sprite: ['.m.', 'mhm', '.m.'], palette: { m: '--color-card-metal', h: '--color-card-metal-hi' } },
  gold: { sprite: ['.h.', 'hyd', '.d.'], palette: { h: '--color-card-coin-hi', y: '--color-card-coin', d: '--color-card-coin-shade' } },
  member: { sprite: ['.H.', 'HMk', '.k.'], palette: { H: '--color-card-metal-hi', M: '--color-card-metal', k: '--color-card-ink' } },
};

export const FRAME_KEYS = Object.keys(FRAME_DOODLES);
