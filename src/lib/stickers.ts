// Die-cut stickers on the badge front (brief §13): at most 3, spots chosen from the username
// hash so a card never reshuffles between visits.

import type { CardData } from '../types/card';

export type StickerTone = 'gold' | 'ember' | 'wood' | 'frame';

export interface StickerSpot {
  /** CSS position inside the badge, in pixel units (1u = 4px). Only the set sides are used. */
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  rotate: number;
}

export interface PlacedSticker {
  label: string;
  tone: StickerTone;
  spot: StickerSpot;
}

export const MAX_STICKERS = 3;

// Four spots that overlap the holder's edges without covering real data: the member number,
// name, role, stats and QR stay readable and scannable (the lab's spots hid YR and No.###).
export const STICKER_SPOTS: readonly StickerSpot[] = [
  { top: 29, left: -3, rotate: -8 },
  { top: 62, left: -3, rotate: 7 },
  { bottom: -1.5, left: 6, rotate: -4 },
  { top: -1.5, right: -2.5, rotate: 6 },
];

export function seedOf(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Which stickers a card earns, in priority order. Only real data: nothing is invented. */
export function stickerSources(card: Pick<CardData, 'github_username' | 'is_featured' | 'org_position' | 'skills'>): { label: string; tone: StickerTone }[] {
  const out: { label: string; tone: StickerTone }[] = [];
  if (card.github_username) out.push({ label: '✓ GITHUB', tone: 'gold' });
  if (card.is_featured) out.push({ label: 'FEATURED', tone: 'gold' });
  if (card.org_position) out.push({ label: card.org_position.toUpperCase(), tone: 'wood' });
  for (const skill of card.skills) {
    if (out.length >= MAX_STICKERS) break;
    out.push({ label: skill.toUpperCase(), tone: 'ember' });
  }
  return out.slice(0, MAX_STICKERS);
}

export function placeStickers(card: CardData): PlacedSticker[] {
  const seed = seedOf(card.username);
  return stickerSources(card).map((s, i) => ({
    ...s,
    spot: STICKER_SPOTS[(seed + i) % STICKER_SPOTS.length] ?? STICKER_SPOTS[0]!,
  }));
}
