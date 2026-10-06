import { describe, expect, it } from 'vitest';
import type { Exhibit } from '../types/museum';
import { arrangeMuseum, consoleFor } from './museum';
import { CONSOLE_KINDS } from './sprites';

const ex = (id: string, no: number, featured: boolean, title = id): Exhibit => ({
  project_id: id,
  username: `u${no}`,
  full_name: `U ${no}`,
  avatar_path: null,
  member_no: no,
  featured,
  project: { title } as Exhibit['project'],
});

describe('arrangeMuseum', () => {
  const all = [ex('a', 3, false), ex('b', 2, true, 'Zed'), ex('c', 1, false), ex('d', 2, true, 'Alpha'), ex('e', 1, true)];

  it('pins featured makers on top in a steady order', () => {
    for (let i = 0; i < 20; i++) {
      expect(arrangeMuseum(all).featured.map((e) => e.project_id)).toEqual(['e', 'd', 'b']);
    }
  });

  it('shuffles only the rest, and never loses or repeats an exhibit', () => {
    const { featured, rest } = arrangeMuseum(all);
    expect(rest.every((e) => !e.featured)).toBe(true);
    expect([...featured, ...rest].map((e) => e.project_id).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('consoleFor (D-091)', () => {
  it('uses the maker’s pick', () => {
    expect(consoleFor('any-id', 'tv')).toBe('tv');
  });
  it('picks the same console for the same project every time, and ignores unknown picks', () => {
    const id = '00000000-0000-4000-8000-00000000f001';
    expect(consoleFor(id)).toBe(consoleFor(id));
    expect(consoleFor(id, null)).toBe(consoleFor(id));
    expect(consoleFor(id, 'gamecube')).toBe(consoleFor(id));
  });
  it('spreads projects over all five consoles', () => {
    const seen = new Set(Array.from({ length: 60 }, (_, i) => consoleFor(`project-${i}`)));
    expect([...seen].sort()).toEqual([...CONSOLE_KINDS].sort());
  });
});
