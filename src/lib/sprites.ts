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
  // Mid-distance tree (D-081): a lit, shaded crown on a two-tone trunk.
  tree: ['....bbbb....', '..bJJbbbbb..', '.bJJJbbbbbb.', 'bJJbbbbbbbNb', 'bJbbbbbbbbNb', 'bbbbbNbbbNNb', 'bbbbbbbbbNNb', '.bbbNbbbNNb.', '..NNbbbNNN..', '....NOON....', '.....OD.....', '.....OD.....', '.....OD.....', '....OODD....'],
  // A grass tuft in the near layer, passing in front of Pip.
  tuft: ['.L...L.', '.gL.Lg.', 'LggLggL', 'gGgggGg'],
  // World depth pass (D-086): a pine for the tree line, a bird in two wing beats, the night moon,
  // and the tuft's second frame so the near grass sways.
  pine: ['....N....', '...NbN...', '..NbJbN..', '...NbN...', '..NbbbN..', '.NbJbbbN.', '..NbbbN..', '.NbbJbbN.', 'NbbbbbbbN', '.NNbbbNN.', '....O....', '....D....'],
  bird0: ['kk...kk', '..k.k..', '...k...'],
  bird1: ['.......', 'kkk.kkk', '...k...'],
  moon: ['..www..', '.wwwww.', 'wwcwwww', 'wwwwwcw', 'wwwwwww', '.wwcww.', '..www..'],
  tuft1: ['L...L..', '.Lg.gL.', 'LggLggL', 'gGgggGg'],
  // Night sky: a four-point sparkle and its smaller twinkle.
  star0: ['..y..', '.yhy.', 'yhhhy', '.yhy.', '..y..'],
  star1: ['.....', '..y..', '.yhy.', '..y..', '.....'],
  clip: ['..kkkkkk..', '.kHHHMMMk.', 'kMHkkkkMMk', 'kMk....kMk'],
  flower: ['.w.', 'wyw', '.g.'],
  grass: ['g.g', 'ggg', '.g.'],
  iconCode: ['.....', '.k.k.', 'k...k', '.k.k.', '.....'],
  iconCase: ['.k.k.', 'kkkkk', 'kk.kk', 'kkkkk', '.....'],
  iconGlobe: ['.kkk.', 'k.k.k', 'kkkkk', 'k.k.k', '.kkk.'],
  // The bell in the top bar (V2-4): a dome, a lip and a clapper.
  iconBell: ['...k...', '..kkk..', '.kk.kk.', '.k...k.', '.k...k.', 'kkkkkkk', '...k...'],
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
  tree: { b: '--color-world-bush' },
  pine: { b: '--color-world-bush' },
  moon: { w: '--color-world-star', c: '--color-world-mountain-snow' },
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
  // Each run of one colour in a row is one rectangle, so a sprite costs a few calls per row.
  for (let j = 0; j < map.length; j++) {
    const row = map[j] ?? '';
    let i = 0;
    while (i < row.length) {
      const key = row[i] ?? '.';
      let end = i + 1;
      while (end < row.length && row[end] === key) end++;
      const color = colors[key];
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(x + (flip ? row.length - end : i), y + j, end - i, 1);
      }
      i = end;
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

/** Which cover keys sit on which depth layer of the Museum diorama (D-083), back to front. */
const COVER_DEPTHS = { sky: 'sc', hills: 'hH', ground: 'gGd' } as const;

/**
 * The pixel cover split into depth layers for the Museum's diorama (D-083): sky and clouds at the
 * back, the hill, the ground, and the emblem in front. Stacked in order they redraw the cover.
 */
export function coverLayers(seed: string): { sky: SpriteMap; hills: SpriteMap; ground: SpriteMap; emblem: SpriteMap } {
  const full = coverSprite(seed);
  const keep = (keys: string) => full.map((row) => [...row].map((ch) => (keys.includes(ch) ? ch : '.')).join(''));
  const layered = COVER_DEPTHS.sky + COVER_DEPTHS.hills + COVER_DEPTHS.ground;
  return {
    sky: keep(COVER_DEPTHS.sky),
    hills: keep(COVER_DEPTHS.hills),
    ground: keep(COVER_DEPTHS.ground),
    emblem: full.map((row) => [...row].map((ch) => (layered.includes(ch) ? '.' : ch)).join('')),
  };
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

/** Rank gems on the badge band (D-080): a different shape per rank, not just a different colour. */
export const RANK_GEMS: Readonly<Record<'member' | 'builder' | 'legend', { sprite: SpriteMap; palette: Palette }>> = {
  member: {
    sprite: ['.kkk.', 'kMHMk', 'kMMMk', 'kMMMk', '.kkk.'],
    palette: { k: '--color-card-ink', M: '--color-card-metal', H: '--color-card-metal-hi' },
  },
  builder: {
    sprite: ['...k...', '..kHk..', '.kHgdk.', 'kHgggdk', '.kggdk.', '..kdk..', '...k...'],
    palette: { k: '--color-card-ink', g: '--color-card-grass', H: '--color-card-grass-light', d: '--color-card-hill-dark' },
  },
  legend: {
    sprite: ['...k...', '..kyk..', 'kkkhkkk', 'kyhhhyk', '.kyyyk.', '.kykyk.', '.kk.kk.'],
    palette: { k: '--color-card-ink', y: '--color-card-coin', h: '--color-card-coin-hi' },
  },
};

export const FRAME_KEYS = Object.keys(FRAME_DOODLES);

// ---------------------------------------------------------------- admin-made badges (D-087)

/** Badge gems an admin can pick: one shape each, coloured by the badge's tone (ink outline). */
export const GEM_SPRITES: Readonly<Record<string, SpriteMap>> = {
  star: ['...k...', '..kmk..', 'kkkhkkk', 'kmhhhmk', '.kmmmk.', '.kmkmk.', '.kk.kk.'],
  circle: ['..kkk..', '.khhmk.', 'khmmmmk', 'kmmmmmk', 'kmmmmmk', '.kmmmk.', '..kkk..'],
  diamond: ['...k...', '..khk..', '.khmmk.', 'khmmmmk', '.kmmmk.', '..kmk..', '...k...'],
  heart: ['.kk.kk.', 'khhkmmk', 'khmmmmk', 'kmmmmmk', '.kmmmk.', '..kmk..', '...k...'],
  shield: ['kkkkkkk', 'khhmmmk', 'khmmmmk', 'kmmmmmk', '.kmmmk.', '..kmk..', '...k...'],
  bolt: ['....kk.', '...khk.', '..khk..', '.kkhkkk', '..kmk..', '.kmk...', '.kk....'],
  crown: ['k..k..k', 'kmkhkmk', 'kmmhmmk', 'kmmmmmk', 'khhhhhk', 'kkkkkkk', '.......'],
  leaf: ['....kkk', '..kkhmk', '.khhmmk', 'khmmmk.', 'kmmmk..', '.kkk...', 'k......'],
};

/** The two tokens (main, highlight) each badge tone paints its gem with. */
export const GEM_TONE_PALETTES: Readonly<Record<string, Palette>> = {
  gold: { k: '--color-card-ink', m: '--color-card-coin', h: '--color-card-coin-hi' },
  green: { k: '--color-card-ink', m: '--color-card-grass', h: '--color-card-grass-light' },
  sky: { k: '--color-card-ink', m: '--color-card-sky', h: '--color-card-cream' },
  plum: { k: '--color-card-ink', m: '--color-card-plum', h: '--color-card-band' },
  red: { k: '--color-card-ink', m: '--color-card-lanyard', h: '--color-card-cream' },
  silver: { k: '--color-card-ink', m: '--color-card-metal', h: '--color-card-metal-hi' },
};

// ---------------------------------------------------------------- event ribbons (D-116)
// A winner's rosette: the number of the place (or a star for a named award) is drawn on its face,
// so the ribbon says what it is by shape as well as colour. Ink outline, two tails in lanyard red.
const RIBBON_GLYPHS: Readonly<Record<'p1' | 'p2' | 'p3' | 'award', readonly string[]>> = {
  p1: ['.k.', 'kk.', '.k.', '.k.', 'kkk'],
  p2: ['kk.', '..k', '.k.', 'k..', 'kkk'],
  p3: ['kk.', '..k', '.k.', '..k', 'kk.'],
  award: ['.k.', 'kkk', '.k.', 'k.k', '...'],
};
const rosette = (glyph: readonly string[]): SpriteMap => {
  const g = glyph.map((row) => row.replace(/\./g, 'm'));
  return ['..kkkkk..', '.khhmmmk.', `khm${g[0]}mmk`, `kmm${g[1]}mmk`, `kmm${g[2]}mmk`, `kmm${g[3]}mmk`, `kmm${g[4]}mmk`, '.kmmmmmk.', '..kkkkk..', '..krkrk..', '.krk.krk.', '.kdk.kdk.', '.kk...kk.'];
};
export const RIBBON_SPRITES: Readonly<Record<'p1' | 'p2' | 'p3' | 'award', SpriteMap>> = {
  p1: rosette(RIBBON_GLYPHS.p1),
  p2: rosette(RIBBON_GLYPHS.p2),
  p3: rosette(RIBBON_GLYPHS.p3),
  award: rosette(RIBBON_GLYPHS.award),
};
/** The same rosettes, compact enough for the badge's holder strip (beside the 7-row gems). */
const pinRosette = (glyph: readonly string[]): SpriteMap => {
  const g = glyph.map((row) => row.replace(/\./g, 'm'));
  return ['.kkkkk.', `kh${g[0]}mk`, `km${g[1]}mk`, `km${g[2]}mk`, `km${g[3]}mk`, `km${g[4]}mk`, '.kkkkk.', '.kr.rk.', '.kd.dk.'];
};
export const RIBBON_PIN_SPRITES: Readonly<Record<'p1' | 'p2' | 'p3' | 'award', SpriteMap>> = {
  p1: pinRosette(RIBBON_GLYPHS.p1),
  p2: pinRosette(RIBBON_GLYPHS.p2),
  p3: pinRosette(RIBBON_GLYPHS.p3),
  award: pinRosette(RIBBON_GLYPHS.award),
};
const tails = { k: '--color-card-ink', r: '--color-card-lanyard', d: '--color-card-lanyard-dark' } as const;
/** Gold, silver and bronze for places; sky for a named award. */
export const RIBBON_PALETTES: Readonly<Record<'p1' | 'p2' | 'p3' | 'award', Palette>> = {
  p1: { ...tails, m: '--color-card-coin', h: '--color-card-coin-hi' },
  p2: { ...tails, m: '--color-card-metal', h: '--color-card-metal-hi' },
  p3: { ...tails, m: '--color-card-block', h: '--color-card-block-hi' },
  award: { ...tails, m: '--color-card-sky', h: '--color-card-cream' },
};

// ---------------------------------------------------------------- officer pin (D-123)
// A current officer's pin: a double chevron, a shape no admin-made badge or ribbon uses, in plum
// with a cream highlight. Decorative: the position is said in words beside it.
export const OFFICER_PIN: SpriteMap = ['k.....k', 'kk...kk', 'khk.khk', 'kmhkhmk', '.kmhmk.', 'k.kmk.k', 'kk.k.kk', 'khk.khk', '.kmkmk.', '..kmk..', '...k...'];
export const OFFICER_PIN_PALETTE: Palette = { k: '--color-card-ink', m: '--color-card-plum', h: '--color-card-cream' };

// ---------------------------------------------------------------- the walkable Museum (V2-11, D-125)
// Props for the Museum's rooms, drawn for this project: a picture light over each exhibit (lit while
// Pip stands in front of it), a trophy cup for the winners of 1st, 2nd and 3rd place (the place is
// also said on the plaque, never by colour alone), a potted plant for the Garden and a flask for the
// Lab. Walls, floors, shelves and columns are drawn from tokens in the walk's level code.
export const MUSEUM_SPR = {
  lamp: ['.....kk.....', '.....kk.....', '.kkkkkkkkkk.', 'khhhhhhhhhhk', 'kmmmmmmmmmmk', '.kLLLLLLLLk.'],
  trophy: [
    '...kkkkkkkkk...',
    'kkkhhGGGGGGdkkk',
    'k.khGGGGGGGdk.k',
    'k.khGGGGGGGdk.k',
    'kk.khGGGGGdk.kk',
    '.kk.khGGGdk.kk.',
    '..kk.khGdk.kk..',
    '....kkhGdkk....',
    '.....khGdk.....',
    '......kGk......',
    '.....khGdk.....',
    '....khGGGdk....',
    '...kkkkkkkkk...',
    '...kWWWWWWWk...',
    '...kkkkkkkkk...',
  ],
  plant: [
    '.....kk.....',
    '...kkLLkk...',
    '..kLLlLLLk..',
    '.kLlLLLlLLk.',
    'kLLLlLLLLlLk',
    'kLlLLLlLLLLk',
    '.kLLLlLLlLk.',
    '..kkLLLLkk..',
    '....kllk....',
    '..kkkkkkkk..',
    '..kPPPPPpk..',
    '..kPPPPPpk..',
    '...kPPPpk...',
    '...kPPPpk...',
    '...kkkkkk...',
  ],
  flask: ['..kkk..', '..kgk..', '..kgk..', '.kgggk.', 'kgggggk', 'kqqqqqk', 'kqqqqqk', '.kkkkk.'],
} as const satisfies Record<string, SpriteMap>;

const lampKeys = { k: '--color-card-ink', h: '--color-museum-lamp-hi', m: '--color-museum-lamp' } as const;
export const LAMP_PALETTES: Readonly<Record<'on' | 'off', Palette>> = {
  on: { ...lampKeys, L: '--color-museum-light' },
  off: { ...lampKeys, L: '--color-museum-light-off' },
};
// Named in full: the theme only keeps the variables its sources name.
const cup = (G: string, h: string, d: string): Palette => ({ k: '--color-card-ink', G, h, d, W: '--color-museum-pedestal-shade' });
export const TROPHY_PALETTES: Readonly<Record<1 | 2 | 3, Palette>> = {
  1: cup('--color-museum-gold', '--color-museum-gold-hi', '--color-museum-gold-shade'),
  2: cup('--color-museum-silver', '--color-museum-silver-hi', '--color-museum-silver-shade'),
  3: cup('--color-museum-bronze', '--color-museum-bronze-hi', '--color-museum-bronze-shade'),
};
export const PLANT_PALETTE: Palette = { k: '--color-card-ink', L: '--color-museum-leaf', l: '--color-museum-leaf-dark', P: '--color-museum-pot', p: '--color-museum-pot-shade' };
export const FLASK_PALETTE: Palette = { k: '--color-card-ink', g: '--color-museum-glass', q: '--color-museum-liquid' };

// ---------------------------------------------------------------- Museum consoles (D-091)
// Five original PIXENDO consoles that hold an exhibit's screen. They are drawn here from simple
// shapes (rounded bodies, discs, slits) so every outline and bevel follows one rule; none copies a
// real console's silhouette, logo or button layout. The screen rect is where the exhibit is laid on
// top as HTML; the power LED is a separate HTML light so it can switch on when the console boots.

export type ConsoleKind = 'pocket' | 'wide' | 'tv' | 'arcade' | 'flip';
export const CONSOLE_KINDS: readonly ConsoleKind[] = ['pocket', 'wide', 'tv', 'arcade', 'flip'];
export const CONSOLE_NAMES: Readonly<Record<ConsoleKind, string>> = {
  pocket: 'Pocket',
  wide: 'Wide',
  tv: 'Home TV',
  arcade: 'Arcade',
  flip: 'Flip',
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface ConsoleArt {
  sprite: SpriteMap;
  /** Where the exhibit shows, in sprite units (16:10). */
  screen: Rect;
  /** The power LED, in sprite units. */
  led: Rect;
  palette: Palette;
}

/** Shared keys: k ink, z/Z bezel, n grille (and the dark screen), o LED (off), r/b/c buttons,
 *  m/M metal, q marquee. a/A/S are the shell and its lit and shaded edges, per console. */
function consolePalette(kind: ConsoleKind): Palette {
  return {
    k: '--color-console-ink',
    z: '--color-console-bezel',
    Z: '--color-console-bezel-hi',
    n: '--color-console-grille',
    o: '--color-console-led-off',
    r: '--color-console-red',
    b: '--color-console-blue',
    c: '--color-console-cream',
    m: '--color-console-metal',
    M: '--color-console-metal-hi',
    q: '--color-console-marquee',
    ...CONSOLE_SHELLS[kind],
  };
}
// Written out in full: Tailwind keeps a theme variable only when its whole name appears in source.
const CONSOLE_SHELLS: Readonly<Record<ConsoleKind, Palette>> = {
  pocket: { a: '--color-console-pocket', A: '--color-console-pocket-hi', S: '--color-console-pocket-shade' },
  wide: { a: '--color-console-wide', A: '--color-console-wide-hi', S: '--color-console-wide-shade' },
  tv: { a: '--color-console-tv', A: '--color-console-tv-hi', S: '--color-console-tv-shade' },
  arcade: { a: '--color-console-arcade', A: '--color-console-arcade-hi', S: '--color-console-arcade-shade' },
  flip: { a: '--color-console-flip', A: '--color-console-flip-hi', S: '--color-console-flip-shade' },
};

type Inside = (x: number, y: number) => boolean;
type Grid = string[][];

const rr =
  (x0: number, y0: number, w: number, h: number, r: number): Inside =>
  (x, y) => {
    if (x < x0 || y < y0 || x >= x0 + w || y >= y0 + h) return false;
    const cx = x < x0 + r ? x0 + r : x >= x0 + w - r ? x0 + w - r - 1 : x;
    const cy = y < y0 + r ? y0 + r : y >= y0 + h - r ? y0 + h - r - 1 : y;
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.8;
  };
const disc =
  (cx: number, cy: number, r: number): Inside =>
  (x, y) =>
    (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.6;
const any =
  (...parts: Inside[]): Inside =>
  (x, y) =>
    parts.some((p) => p(x, y));

/** Paints a solid with a 1px ink outline, a lit top-left edge and a shaded bottom-right edge. */
function solid(g: Grid, inside: Inside, fill: string, hi = fill, shade = fill, outline = 'k') {
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[0]!.length; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      g[y]![x] = edge ? outline : !inside(x, y - 2) || !inside(x - 2, y) ? hi : !inside(x, y + 2) || !inside(x + 2, y) ? shade : fill;
    }
}
function fill(g: Grid, r: Rect, ch: string) {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (g[y]?.[x] !== undefined) g[y]![x] = ch;
}
function line(g: Grid, x0: number, y0: number, x1: number, y1: number, ch: string) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n);
    const y = Math.round(y0 + ((y1 - y0) * i) / n);
    if (g[y]?.[x] !== undefined) g[y]![x] = ch;
  }
}
/** A screen: dark glass inside a bezel ring. */
function screenIn(g: Grid, bezel: Inside, screen: Rect) {
  solid(g, bezel, 'z', 'Z', 'z');
  fill(g, { x: screen.x - 1, y: screen.y - 1, w: screen.w + 2, h: screen.h + 2 }, 'k');
  fill(g, screen, 'n');
}
/** A round button: ink ring, coloured cap, one lit pixel. */
function button(g: Grid, cx: number, cy: number, r: number, ch: string) {
  solid(g, disc(cx, cy, r), ch);
  if (r >= 2) g[cy - 1]![cx - 1] = 'c';
}
function blank(w: number, h: number): Grid {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));
}
const done = (g: Grid): SpriteMap => g.map((row) => row.join(''));

function drawPocket(): Omit<ConsoleArt, 'palette'> {
  const g = blank(54, 88);
  const screen = { x: 7, y: 9, w: 40, h: 25 };
  solid(g, rr(0, 0, 54, 88, 6), 'a', 'A', 'S');
  fill(g, { x: 6, y: 3, w: 42, h: 1 }, 'S'); // a ridge along the top
  screenIn(g, rr(4, 6, 46, 34, 3), screen);
  // A round thumb dial on the left, a 2×2 block of buttons on the right.
  solid(g, disc(15, 55, 8), 'z', 'Z', 'z');
  solid(g, disc(15, 55, 6), 'm', 'M', 'S');
  fill(g, { x: 15, y: 50, w: 1, h: 3 }, 'k');
  button(g, 36, 50, 3, 'r');
  button(g, 44, 50, 3, 'b');
  button(g, 36, 58, 3, 'b');
  button(g, 44, 58, 3, 'r');
  solid(g, rr(20, 70, 14, 4, 1), 'z', 'Z', 'z'); // menu bar
  for (let y = 74; y <= 82; y += 3) for (let x = 38; x <= 47; x += 3) g[y]![x] = 'n'; // speaker dots
  return { sprite: done(g), screen, led: { x: 8, y: 36, w: 2, h: 2 } };
}

function drawWide(): Omit<ConsoleArt, 'palette'> {
  const g = blank(100, 56);
  const screen = { x: 22, y: 9, w: 56, h: 35 };
  solid(g, any(rr(6, 0, 18, 8, 2), rr(76, 0, 18, 8, 2)), 'S', 'a', 'S'); // shoulder buttons
  solid(g, any(rr(18, 3, 64, 51, 4), rr(0, 7, 30, 46, 10), rr(70, 7, 30, 46, 10)), 'a', 'A', 'S');
  screenIn(g, rr(19, 6, 62, 42, 3), screen);
  // Left grip: a stick and a small menu key. Right grip: three buttons in a triangle, speaker dots.
  solid(g, disc(10, 24, 6), 'z', 'Z', 'z');
  solid(g, disc(10, 24, 4), 'm', 'M', 'S');
  solid(g, rr(5, 36, 10, 4, 1), 'c');
  button(g, 90, 17, 3, 'r');
  button(g, 86, 26, 3, 'b');
  button(g, 94, 26, 3, 'c');
  for (let y = 37; y <= 45; y += 3) for (let x = 85; x <= 94; x += 3) g[y]![x] = 'n';
  return { sprite: done(g), screen, led: { x: 74, y: 50, w: 2, h: 2 } };
}

function drawTv(): Omit<ConsoleArt, 'palette'> {
  const g = blank(80, 86);
  const screen = { x: 11, y: 20, w: 48, h: 30 };
  // Rabbit-ear antenna.
  line(g, 40, 13, 27, 1, 'k');
  line(g, 41, 13, 54, 2, 'k');
  solid(g, disc(27, 1, 1), 'r');
  solid(g, disc(54, 2, 1), 'r');
  solid(g, rr(34, 9, 12, 6, 2), 'm', 'M', 'S');
  solid(g, rr(2, 13, 76, 58, 4), 'a', 'A', 'S');
  screenIn(g, rr(7, 16, 56, 38, 5), screen);
  // Side panel: two dials over speaker slits. A strip of trim under the screen.
  for (const cy of [23, 33]) {
    solid(g, disc(70, cy, 4), 'm', 'M', 'S');
    fill(g, { x: 70, y: cy - 3, w: 1, h: 3 }, 'k');
  }
  for (let y = 42; y <= 52; y += 2) fill(g, { x: 66, y, w: 9, h: 1 }, 'n');
  fill(g, { x: 18, y: 59, w: 36, h: 2 }, 'S');
  fill(g, { x: 8, y: 71, w: 6, h: 3 }, 'k');
  fill(g, { x: 66, y: 71, w: 6, h: 3 }, 'k');
  // The console in front of the TV: a cartridge slot, two keys and its LED.
  solid(g, rr(12, 73, 56, 13, 2), 'z', 'Z', 'z');
  fill(g, { x: 22, y: 76, w: 36, h: 2 }, 'n');
  solid(g, rr(18, 80, 8, 4, 1), 'c');
  solid(g, rr(28, 80, 8, 4, 1), 'c');
  return { sprite: done(g), screen, led: { x: 60, y: 81, w: 2, h: 2 } };
}

function drawArcade(): Omit<ConsoleArt, 'palette'> {
  const g = blank(60, 106);
  const screen = { x: 10, y: 22, w: 40, h: 25 };
  solid(g, any(rr(4, 0, 52, 106, 2), rr(0, 52, 60, 13, 2), rr(2, 97, 56, 9, 1)), 'a', 'A', 'S');
  // Lit marquee with a row of stars.
  solid(g, rr(7, 3, 46, 11, 1), 'q', 'c', 'q');
  for (const x of [14, 22, 30, 38, 46]) {
    g[8]![x] = 'r';
    g[7]![x] = 'r';
    g[8]![x - 1] = 'r';
    g[8]![x + 1] = 'r';
    g[9]![x] = 'r';
  }
  screenIn(g, rr(6, 18, 48, 33, 3), screen);
  // Control deck: a ball-top stick and a row of four buttons.
  solid(g, rr(1, 53, 58, 11, 2), 'z', 'Z', 'z');
  fill(g, { x: 12, y: 54, w: 2, h: 6 }, 'm');
  solid(g, disc(12, 54, 3), 'r');
  for (const [i, ch] of (['b', 'r', 'c', 'b'] as const).entries()) button(g, 27 + i * 8, 58, 2, ch);
  // Coin door: two lit slots and a kick plate.
  solid(g, rr(18, 70, 24, 20, 1), 'S', 'a', 'S');
  fill(g, { x: 23, y: 74, w: 2, h: 6 }, 'q');
  fill(g, { x: 35, y: 74, w: 2, h: 6 }, 'q');
  fill(g, { x: 6, y: 99, w: 48, h: 2 }, 'S');
  return { sprite: done(g), screen, led: { x: 29, y: 84, w: 2, h: 2 } };
}

function drawFlip(): Omit<ConsoleArt, 'palette'> {
  const g = blank(64, 98);
  const screen = { x: 12, y: 9, w: 40, h: 25 };
  solid(g, rr(2, 0, 60, 47, 5), 'a', 'A', 'S');
  screenIn(g, rr(7, 5, 50, 34, 3), screen);
  solid(g, rr(6, 45, 52, 6, 2), 'm', 'M', 'S'); // hinge
  solid(g, rr(0, 50, 64, 48, 5), 'a', 'A', 'S');
  // Base: a thumb dial, a 3×4 keypad, a red key and speaker slits.
  solid(g, disc(15, 65, 8), 'z', 'Z', 'z');
  solid(g, disc(15, 65, 6), 'm', 'M', 'S');
  fill(g, { x: 15, y: 60, w: 1, h: 3 }, 'k');
  for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) solid(g, rr(33 + i * 9, 56 + j * 7, 7, 5, 1), 'c');
  solid(g, rr(8, 84, 10, 5, 1), 'r');
  for (let y = 85; y <= 91; y += 2) fill(g, { x: 33, y, w: 25, h: 1 }, 'n');
  return { sprite: done(g), screen, led: { x: 50, y: 42, w: 2, h: 2 } };
}

const DRAW: Readonly<Record<ConsoleKind, () => Omit<ConsoleArt, 'palette'>>> = {
  pocket: drawPocket,
  wide: drawWide,
  tv: drawTv,
  arcade: drawArcade,
  flip: drawFlip,
};
const consoleCache = new Map<ConsoleKind, ConsoleArt>();

/** The art for one console, drawn once and kept. */
export function consoleArt(kind: ConsoleKind): ConsoleArt {
  let art = consoleCache.get(kind);
  if (!art) {
    art = { ...DRAW[kind](), palette: consolePalette(kind) };
    consoleCache.set(kind, art);
  }
  return art;
}
