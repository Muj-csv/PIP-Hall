// Every sprite is a clean rectangle and every pixel has a colour from the theme (D-079).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONSOLE_KINDS, consoleArt, coverLayers, coverSprite, GEM_SPRITES, GEM_TONE_PALETTES, RIBBON_PALETTES, RIBBON_PIN_SPRITES, RIBBON_SPRITES, CARD_PALETTE, CLIP_PALETTE, DOODLE_PALETTE, FRAME_DOODLES, RANK_GEMS, SPR, WORLD_OVERRIDES, WORLD_PALETTE, type Palette, type SpriteMap } from './sprites';

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
    for (const [k, r] of Object.entries(RIBBON_SPRITES)) {
      check(`ribbon:${k}`, r, RIBBON_PALETTES[k as keyof typeof RIBBON_PALETTES]);
      expect(r.every((row) => row.length === 9)).toBe(true);
    }
    for (const [k, r] of Object.entries(RIBBON_PIN_SPRITES)) {
      check(`ribbon-pin:${k}`, r, RIBBON_PALETTES[k as keyof typeof RIBBON_PALETTES]);
      expect(r.every((row) => row.length === 7)).toBe(true);
    }
    // Each place reads by its number, not its colour alone.
    expect(new Set(Object.values(RIBBON_SPRITES).map((r) => r.join('/'))).size).toBe(4);
    expect(new Set(Object.values(RIBBON_PIN_SPRITES).map((r) => r.join('/'))).size).toBe(4);
  });

  it('rank gems are rectangles with their own palette', () => {
    for (const [name, g] of Object.entries(RANK_GEMS)) check(`gem:${name}`, g.sprite, g.palette);
  });

  it('every palette colour is a theme token', () => {
    const palettes = [WORLD_PALETTE, CARD_PALETTE, DOODLE_PALETTE, CLIP_PALETTE, ...Object.values(WORLD_OVERRIDES), ...Object.values(FRAME_DOODLES).map((f) => f.palette), ...Object.values(RANK_GEMS).map((g) => g.palette), ...Object.values(GEM_TONE_PALETTES), ...Object.values(RIBBON_PALETTES)];
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

  it('consoles (D-091) are rectangles in theme colours, with a 16:10 screen and an LED on the body', () => {
    expect([...CONSOLE_KINDS].sort()).toEqual(['arcade', 'flip', 'pocket', 'tv', 'wide']); // the database's list
    for (const kind of CONSOLE_KINDS) {
      const { sprite, screen, led, palette } = consoleArt(kind);
      check(`console:${kind}`, sprite, palette);
      for (const v of Object.values(palette)) expect(theme, `${kind}: ${v} is in the theme`).toContain(`${v}:`);
      const h = sprite.length;
      const w = sprite[0]!.length;
      expect(screen.w / screen.h, `${kind} screen is 16:10`).toBe(1.6);
      for (const r of [screen, led]) {
        expect(r.x).toBeGreaterThan(0);
        expect(r.y).toBeGreaterThan(0);
        expect(r.x + r.w).toBeLessThan(w);
        expect(r.y + r.h).toBeLessThan(h);
      }
      // The screen is dark glass framed in ink, so nothing shows at its edge if the cover is late.
      for (let y = screen.y; y < screen.y + screen.h; y++) expect(sprite[y]!.slice(screen.x, screen.x + screen.w)).toBe('n'.repeat(screen.w));
      expect(sprite[screen.y - 1]!.slice(screen.x, screen.x + screen.w)).toBe('k'.repeat(screen.w));
      // The LED sits on something drawn, never in the air.
      expect(sprite[led.y]![led.x]).not.toBe('.');
    }
  });

  it('every console has its own shell colours', () => {
    const shells = CONSOLE_KINDS.map((k) => consoleArt(k).palette.a);
    expect(new Set(shells).size).toBe(CONSOLE_KINDS.length);
  });
});
