// The Museum's order (D-083): featured makers' exhibits are pinned on top in a steady order (by
// member number, then title), and only the rest are shuffled.

import type { Exhibit } from '../types/museum';
import { CONSOLE_KINDS, type ConsoleKind } from './sprites.js';
import { shuffle } from './shuffle.js';

export function arrangeMuseum(exhibits: readonly Exhibit[]): { featured: Exhibit[]; rest: Exhibit[] } {
  const featured = exhibits
    .filter((e) => e.featured)
    .sort((a, b) => a.member_no - b.member_no || a.project.title.localeCompare(b.project.title));
  const rest = shuffle(exhibits.filter((e) => !e.featured));
  return { featured, rest };
}

/**
 * The console an exhibit hangs in (D-091): the maker's pick, or one chosen from the project id so
 * it is the same on every visit and every device.
 */
export function consoleFor(projectId: string, chosen?: string | null): ConsoleKind {
  if (chosen && (CONSOLE_KINDS as readonly string[]).includes(chosen)) return chosen as ConsoleKind;
  let h = 0;
  for (const ch of projectId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CONSOLE_KINDS[h % CONSOLE_KINDS.length]!;
}
