// The badge's band (V2-22, D-134): from everything a member has earned (affiliation pins, admin
// badges, ribbons won at events, an officer seat) they pick up to 3, in their order. The database
// checks every pick (set_band); these helpers only shape the choice and say each item in words.

import type { BandItem, Pin } from '../types/mart';
import { awardLabel, type HallAward } from './events';
import { officerLabel, type Officer } from './officers';

export const MAX_BAND = 3;

/** Adds a pick at the end (while there's room) or takes it off. */
export function toggleBand(picks: readonly string[], ref: string): string[] {
  if (picks.includes(ref)) return picks.filter((r) => r !== ref);
  return picks.length < MAX_BAND ? [...picks, ref] : [...picks];
}

/** Moves a pick one place earlier (-1) or later (+1). */
export function moveBand(picks: readonly string[], ref: string, by: -1 | 1): string[] {
  const i = picks.indexOf(ref);
  const j = i + by;
  if (i < 0 || j < 0 || j >= picks.length) return [...picks];
  const next = [...picks];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/** The picks that are still earned, in the member's order (an item can go: a logo removed, a term over). */
export function bandInOrder(picks: readonly string[], items: readonly BandItem[]): BandItem[] {
  const byRef = new Map(items.map((i) => [i.ref, i]));
  return picks.flatMap((r) => (byRef.has(r) ? [byRef.get(r)!] : []));
}

/** Each item in words, for its tooltip, screen readers and the picker (whose kind is said apart). */
export function bandLabel(item: BandItem): string {
  switch (item.kind) {
    case 'officer':
      return `Officer: ${officerLabel(item)}`;
    case 'award':
      return `${awardLabel(item)} at ${item.event}`;
    case 'pin':
    case 'badge':
      return item.name;
  }
}

/** The band before a member chooses (as it has always been): their officer seat, their two newest
 *  ribbons, then the admin-made badges pinned on them. */
export function defaultBand(officer: Officer | null, awards: readonly HallAward[], pins: readonly Pin[], maxRibbons = 2): BandItem[] {
  return [
    ...(officer ? [{ ref: `officer:${officer.team_key}`, kind: 'officer' as const, key: officer.team_key, team: officer.team, position: officer.position }] : []),
    ...awards.slice(0, maxRibbons).map((a) => ({ ...a, ref: `award:${a.event_key}-${a.project_id}-${a.place ?? a.name ?? ''}-${a.track ?? ''}`, kind: 'award' as const })),
    ...pins.map((p) => ({ ref: `badge:${p.key}`, kind: 'badge' as const, key: p.key, name: p.name, gem: p.gem, tone: p.tone })),
  ];
}

/** What kind of thing it is, in a word, for the picker. */
export const BAND_KIND: Record<BandItem['kind'], string> = { officer: 'Officer seat', award: 'Ribbon', pin: 'Affiliation pin', badge: 'Badge' };
