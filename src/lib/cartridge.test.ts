import { describe, expect, it } from 'vitest';
import { startLink, stripeTone, STRIPE_TONES } from './cartridge';

describe('cartridges', () => {
  it('give every language a stable stripe from the badge’s tones, and none a plain metal one', () => {
    expect(stripeTone('TypeScript')).toBe(stripeTone(' typescript '));
    expect(STRIPE_TONES).toContain(stripeTone('Python'));
    expect(stripeTone(null)).toBe('metal');
    expect(stripeTone('')).toBe('metal');
    expect(new Set(['TypeScript', 'Python', 'Rust', 'Go', 'Ruby', 'Kotlin', 'Swift', 'HTML'].map(stripeTone)).size).toBeGreaterThan(3);
  });

  it('PRESS START opens the live project, else the code, else nothing', () => {
    expect(startLink({ project_url: 'https://a.example', github_url: 'https://github.com/a/b' })).toEqual({ href: 'https://a.example', what: 'live' });
    expect(startLink({ project_url: null, github_url: 'https://github.com/a/b' })).toEqual({ href: 'https://github.com/a/b', what: 'code' });
    expect(startLink({ project_url: null, github_url: null })).toBeNull();
  });
});
