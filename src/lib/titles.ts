// Titles and title plates (V2-5, D-101). The database decides which titles a member has earned
// (earned_titles(), from the records that prove them); this is the client's copy of the catalogue,
// for the words, and the plate colours, which only ever name card tokens.

import type { CSSProperties } from 'react';
import { TONES, type Tone } from './rewards';

export const TITLES = [
  { key: 'card_holder', name: 'Card Holder', rule: 'Has a card in the hall.' },
  { key: 'pioneer', name: 'Pioneer', rule: 'One of the hall’s first 10 members.' },
  { key: 'explorer', name: 'Explorer', rule: 'Met 10 members of the hall.' },
  { key: 'connector', name: 'Connector', rule: 'Credited on a team project with another member.' },
  { key: 'curator', name: 'Curator', rule: 'Has 3 projects on show in the Museum.' },
  { key: 'pathfinder', name: 'Pathfinder', rule: 'Completed 10 Missions.' },
  { key: 'champion', name: 'Champion', rule: 'Made a project that won a place or an award at a hall event.' },
] as const;

export type TitleKey = (typeof TITLES)[number]['key'];
export type Title = (typeof TITLES)[number];

export function titleOf(key: string | null | undefined): Title | null {
  return TITLES.find((t) => t.key === key) ?? null;
}

/** A plate's look: the plate and the ink written on it, each a card tone. */
export interface PlateStyle {
  plate: Tone;
  ink: Tone;
}

const isTone = (v: unknown): v is Tone => typeof v === 'string' && (TONES as readonly string[]).includes(v);

export function isPlateStyle(s: unknown): s is PlateStyle {
  if (!s || typeof s !== 'object') return false;
  const o = s as Record<string, unknown>;
  return Object.keys(o).length === 2 && isTone(o.plate) && isTone(o.ink);
}

/** CSS variables for a plate; without one, the plain plate's own tokens apply. */
export function plateVars(s: PlateStyle | null | undefined): CSSProperties | undefined {
  if (!isPlateStyle(s)) return undefined;
  return { ['--plate' as string]: `var(--color-card-${s.plate})`, ['--plate-ink' as string]: `var(--color-card-${s.ink})` };
}

/** What the hall knows about a member's titles (hall_titles()). */
export interface HallTitle {
  earned: TitleKey[];
  title: TitleKey | null;
  plateStyle: PlateStyle | null;
}

/** Parses one hall_titles() row, dropping anything the client doesn't know. */
export function parseHallTitle(row: { earned?: unknown; title?: unknown; plate_style?: unknown }): HallTitle {
  const known = (k: unknown): k is TitleKey => typeof k === 'string' && TITLES.some((t) => t.key === k);
  const earned = Array.isArray(row.earned) ? row.earned.filter(known) : [];
  return {
    earned: TITLES.filter((t) => earned.includes(t.key)).map((t) => t.key),
    title: known(row.title) && earned.includes(row.title) ? row.title : null,
    plateStyle: isPlateStyle(row.plate_style) ? row.plate_style : null,
  };
}
