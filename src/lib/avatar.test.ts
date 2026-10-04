import { describe, expect, it } from 'vitest';
import { AVATAR_BODY_TOKENS, AVATAR_SIZE, avatarSpec, hashHandle } from './avatar';

describe('avatarSpec', () => {
  it('draws the same face for the same handle every time', () => {
    expect(avatarSpec('sample-player-1')).toEqual(avatarSpec('sample-player-1'));
  });
  it('draws different faces for different handles', () => {
    expect(avatarSpec('sample-player-1')).not.toEqual(avatarSpec('sample-player-2'));
  });
  it('is symmetric left to right', () => {
    const { pixels } = avatarSpec('muj-csv');
    const key = (x: number, y: number, k: string) => `${x},${y},${k}`;
    const set = new Set(pixels.map((p) => key(p.x, p.y, p.kind)));
    for (const p of pixels) expect(set.has(key(AVATAR_SIZE - 1 - p.x, p.y, p.kind))).toBe(true);
  });
  it('stays inside the 10 × 10 grid and uses a body colour token', () => {
    const spec = avatarSpec('a');
    for (const p of spec.pixels) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(AVATAR_SIZE);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThan(AVATAR_SIZE);
    }
    expect(AVATAR_BODY_TOKENS).toContain(spec.bodyToken);
  });
  it('hashes with FNV-1a', () => {
    expect(hashHandle('')).toBe(2166136261);
    expect(hashHandle('a')).toBe(0xe40c292c);
  });
});
