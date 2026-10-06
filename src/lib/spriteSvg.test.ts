import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { avatarSpec } from './avatar';
import { avatarToSvg, paletteColors, spriteRects, spriteToSvg, themeColors } from './spriteSvg';
import { CARD_PALETTE, CONSOLE_KINDS, consoleArt, SPR } from './sprites';

const css = readFileSync(new URL('../styles/theme.css', import.meta.url), 'utf8');

describe('spriteSvg (D-095)', () => {
  it('reads the DAY colours from the theme, not the NIGHT overrides', () => {
    const t = themeColors(css);
    expect(t['--color-card-ink']).toMatch(/^#[0-9A-F]{6}$/i);
    expect(t['--color-bg']).toBe(css.match(/--color-bg:\s*(#[0-9A-Fa-f]{6})/)![1]);
  });

  it('merges each row into runs of one colour, and skips transparent pixels', () => {
    expect(spriteRects(['aab.', '.bbb'], { a: '#000001', b: '#000002' })).toEqual([
      { x: 0, y: 0, w: 2, fill: '#000001' },
      { x: 2, y: 0, w: 1, fill: '#000002' },
      { x: 1, y: 1, w: 3, fill: '#000002' },
    ]);
  });

  it('draws every console and card sprite with theme colours only', () => {
    const t = themeColors(css);
    for (const k of CONSOLE_KINDS) {
      const a = consoleArt(k);
      const colors = paletteColors(a.palette, t);
      expect(Object.keys(colors).sort()).toEqual(Object.keys(a.palette).sort()); // every key resolved
      expect(spriteToSvg(a.sprite, colors)).toMatch(/^<svg [^>]*viewBox="0 0 \d+ \d+"/);
    }
    expect(spriteToSvg(SPR.clip, paletteColors(CARD_PALETTE, t))).toContain('<rect');
  });

  it('draws the same generated avatar as the badge', () => {
    const s = avatarToSvg(avatarSpec('octocat'), { ink: '#000000', body: '#111111', eye: '#ffffff', bg: '#222222' });
    expect(s.match(/<rect/g)!.length).toBe(avatarSpec('octocat').pixels.length + 1);
  });
});
