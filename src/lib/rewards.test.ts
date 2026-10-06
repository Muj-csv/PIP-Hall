import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLE, frameStyleVars, isFrameStyle, keyFrom } from './rewards';

describe('rewards presets', () => {
  it('accepts a border style made only of presets', () => {
    expect(isFrameStyle(DEFAULT_STYLE)).toBe(true);
  });

  it('refuses anything else, like the database does', () => {
    expect(isFrameStyle({ ...DEFAULT_STYLE, frame: 'red;background:url(x)' })).toBe(false);
    expect(isFrameStyle({ ...DEFAULT_STYLE, motion: 'spin' })).toBe(false);
    expect(isFrameStyle({ ...DEFAULT_STYLE, gap: 9 })).toBe(false);
    expect(isFrameStyle({ ...DEFAULT_STYLE, css: 'x' })).toBe(false);
    expect(isFrameStyle(null)).toBe(false);
  });

  it('turns a style into theme-token variables only', () => {
    const vars = Object.values(frameStyleVars(DEFAULT_STYLE)).join(' ');
    expect(vars).toContain('var(--color-card-plum)');
    expect(vars).not.toMatch(/#[0-9a-f]{3,6}/i);
  });

  it('makes keys the database accepts', () => {
    expect(keyFrom('Most Valuable Player!')).toBe('most-valuable-player');
    expect(keyFrom('  Night  Lights ')).toBe('night-lights');
    expect(keyFrom('A'.repeat(40))).toHaveLength(24);
    expect(/^[a-z0-9][a-z0-9-]{1,23}$/.test(keyFrom('Hackathon Winner 2026'))).toBe(true);
  });
});
