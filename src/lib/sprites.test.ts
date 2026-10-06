// Every sprite is a clean rectangle and every pixel has a colour from the theme (D-079).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { coverLayers, coverSprite, GEM_SPRITES, GEM_TONE_PALETTES, CARD_PALETTE, CLIP_PALETTE, DOODLE_PALETTE, FRAME_DOODLES, RANK_GEMS, SPR, WORLD_OVERRIDES, WORLD_PALETTE, type Palette, type SpriteMap } from './sprites';

const theme = readFileSync(new URL('../styles/theme.css', import.meta.url), 'utf8');
const CARD_SPRITES = new Set(['clip', 'flower', 'grass', 'iconCode', 'iconCase', 'iconGlobe', 'block']);

function check(name: string, map: SpriteMap, palette: Palette) {
  expect(map.length, `${name} has rows`).toBeGreaterThan(0);
  const w = map[0]!.length;
  for (const row of map) {
    expect(row.length, `${name} rows are all ${w} wide`).toBe(w);
    for (const key of row) if (key !== '.') expect(palette[key], `${name}: "${key}" has a colour`).toBeDefined();
  }
}

describe('sprites', () => {
  it('world sprites are rectangles with every key in the world palette', () => {
    for (const [name, map] of Object.entries(SPR)) {
      if (CARD_SPRITES.has(name) && name !== 'block') continue;
      check(name, map, { ...WORLD_PALETTE, ...(WORLD_OVERRIDES[name as keyof typeof SPR] ?? {}) });
    }
  });

  it('badge sprites are rectangles with every key in the badge palettes', () => {
    for (const name of CARD_SPRITES) check(name, SPR[name as keyof typeof SPR], { ...CARD_PALETTE, ...DOODLE_PALETTE, ...CLIP_PALETTE });
  });

  it('frame doodles are rectangles with their own palette', () => {
    for (const [name, f] of Object.entries(FRAME_DOODLES)) check(`frame:${name}`, f.sprite, f.palette);
  });

  it('badge gems are rectangles in every tone, one per shape the database allows', () => {
    expect(Object.keys(GEM_SPRITES).sort()).toEqual(['bolt', 'circle', 'crown', 'diamond', 'heart', 'leaf', 'shield', 'star']);
    expect(Object.keys(GEM_TONE_PALETTES).sort()).toEqual(['gold', 'green', 'plum', 'red', 'silver', 'sky']);
    for (const [name, g] of Object.entries(GEM_SPRITES)) for (const [tone, p] of Object.entries(GEM_TONE_PALETTES)) check(`gem:${name}:${tone}`, g, p);
  });

  it('rank gems are rectangles with their own palette', () => {
    for (const [name, g] of Object.entries(RANK_GEMS)) check(`gem:${name}`, g.sprite, g.palette);
  });

  it('every palette colour is a theme token', () => {
    const palettes = [WORLD_PALETTE, CARD_PALETTE, DOODLE_PALETTE, CLIP_PALETTE, ...Object.values(WORLD_OVERRIDES), ...Object.values(FRAME_DOODLES).map((f) => f.palette), ...Object.values(RANK_GEMS).map((g) => g.palette), ...Object.values(GEM_TONE_PALETTES)];
    for (const p of palettes) for (const v of Object.values(p ?? {})) expect(theme, `${v} is in theme.css`).toContain(`${v}:`);
  });

  it('the Museum diorama layers rebuild the cover exactly, each pixel on one layer', () => {
    for (const seed of ['Pixel Garden', 'API', 'a much longer project title here']) {
      const full = coverSprite(seed);
      const l = coverLayers(seed);
      full.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          const on = [l.sky, l.hills, l.ground, l.emblem].map((m) => m[y]![x]).filter((c) => c !== '.');
          expect(on).toEqual([ch]);
        }),
      );
    }
  });
});
