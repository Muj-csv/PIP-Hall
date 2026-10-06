// Admin-made rewards (D-087): the presets a border or badge is built from. These mirror the lists
// the database enforces (reward_tones(), valid_frame_style(), the achievements checks), so the
// builder only offers what will be accepted; the database still decides.

import type { CSSProperties } from 'react';

/** Card tones a border may use: each names a --color-card-* token. */
export const TONES = [
  'band', 'plum', 'ink', 'cream', 'face', 'metal', 'metal-hi', 'sky', 'hill', 'hill-dark', 'ground', 'grass',
  'grass-light', 'block', 'block-hi', 'block-shade', 'coin', 'coin-shade', 'coin-hi', 'gold', 'lanyard', 'lanyard-dark',
] as const;
export type Tone = (typeof TONES)[number];

export const MOTIONS = ['none', 'flow', 'twinkle', 'pulse', 'gleam'] as const;
export type Motion = (typeof MOTIONS)[number];
export const MOTION_LABEL: Record<Motion, string> = { none: 'Still', flow: 'Flowing', twinkle: 'Twinkling', pulse: 'Pulsing', gleam: 'Gleaming' };

export const DOODLES = ['none', 'meadow', 'dusk', 'pearl', 'gold', 'member'] as const;
export type Doodle = (typeof DOODLES)[number];
export const DOODLE_LABEL: Record<Doodle, string> = { none: 'None', meadow: 'Flowers', dusk: 'Stars', pearl: 'Pearls', gold: 'Coins', member: 'Rivets' };

export interface FrameStyle {
  frame: Tone;
  hi: Tone;
  shade: Tone;
  trim: Tone;
  gap: number;
  motion: Motion;
  doodle: Doodle;
}

export const GEMS = ['star', 'circle', 'diamond', 'heart', 'shield', 'bolt', 'crown', 'leaf'] as const;
export type Gem = (typeof GEMS)[number];
export const GEM_TONES = ['gold', 'green', 'sky', 'plum', 'red', 'silver'] as const;
export type GemTone = (typeof GEM_TONES)[number];

const isTone = (v: unknown): v is Tone => typeof v === 'string' && (TONES as readonly string[]).includes(v);

/** The client's copy of valid_frame_style(): exactly these seven keys, each from its list. */
export function isFrameStyle(s: unknown): s is FrameStyle {
  if (!s || typeof s !== 'object') return false;
  const o = s as Record<string, unknown>;
  return (
    Object.keys(o).length === 7 &&
    isTone(o.frame) && isTone(o.hi) && isTone(o.shade) && isTone(o.trim) &&
    typeof o.gap === 'number' && Number.isInteger(o.gap) && o.gap >= 2 && o.gap <= 6 &&
    (MOTIONS as readonly unknown[]).includes(o.motion) &&
    (DOODLES as readonly unknown[]).includes(o.doodle)
  );
}

/** The CSS variables a designed border sets on its badge. Only theme tokens, never raw colours. */
export function frameStyleVars(s: FrameStyle): CSSProperties {
  const tok = (t: Tone) => `var(--color-card-${t})`;
  return {
    ['--color-card-frame' as string]: tok(s.frame),
    ['--color-card-frame-hi' as string]: tok(s.hi),
    ['--color-card-frame-shade' as string]: tok(s.shade),
    ['--trim' as string]: tok(s.trim),
    ['--trim-gap' as string]: `calc(var(--p) * ${s.gap})`,
  };
}

/** A sensible starting border for the builder. */
export const DEFAULT_STYLE: FrameStyle = { frame: 'plum', hi: 'band', shade: 'ink', trim: 'coin-hi', gap: 3, motion: 'twinkle', doodle: 'dusk' };

/** A key from a display name: lower-case, dashes, 2–24 characters, as the database requires. */
export function keyFrom(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .replace(/-+$/g, '');
}
