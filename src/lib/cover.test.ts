import { describe, expect, it } from 'vitest';
import { COVER_H, COVER_PALETTE, COVER_W, coverSprite } from './sprites';

describe('coverSprite', () => {
  it('is the same picture for the same title, and a different one for another', () => {
    expect(coverSprite('Tide Tables')).toEqual(coverSprite('Tide Tables'));
    expect(coverSprite('Tide Tables')).not.toEqual(coverSprite('Pixel Diary'));
  });

  it('is a 32 × 20 map that uses only cover palette keys', () => {
    const map = coverSprite('Anything');
    expect(map).toHaveLength(COVER_H);
    for (const row of map) expect(row).toHaveLength(COVER_W);
    const keys = new Set(map.join(''));
    for (const k of keys) expect(Object.keys(COVER_PALETTE)).toContain(k);
  });

  it('always has an emblem that is mirrored around its middle column', () => {
    for (const seed of ['', 'a', 'Map Maker', 'quest solo']) {
      const map = coverSprite(seed);
      const emblem = map.slice(4, 11).map((row) => row.slice(12, 19));
      const ink = emblem.join('').replace(/[skch]/g, '');
      expect(ink.length).toBeGreaterThan(0);
      for (const row of emblem) {
        const shape = [...row].map((ch) => (/[abpl]/.test(ch) ? 1 : 0));
        expect(shape).toEqual([...shape].reverse());
      }
    }
  });
});
