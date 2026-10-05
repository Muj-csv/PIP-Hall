import { describe, expect, it } from 'vitest';
import type { Exhibit } from '../types/museum';
import { arrangeMuseum } from './museum';

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
