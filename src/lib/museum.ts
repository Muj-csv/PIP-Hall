// The Museum's order (D-083): featured makers' exhibits are pinned on top in a steady order (by
// member number, then title), and only the rest are shuffled.

import type { Exhibit } from '../types/museum';
import { shuffle } from './shuffle';

export function arrangeMuseum(exhibits: readonly Exhibit[]): { featured: Exhibit[]; rest: Exhibit[] } {
  const featured = exhibits
    .filter((e) => e.featured)
    .sort((a, b) => a.member_no - b.member_no || a.project.title.localeCompare(b.project.title));
  const rest = shuffle(exhibits.filter((e) => !e.featured));
  return { featured, rest };
}
