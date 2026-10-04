// The only way pages get public cards (ADR-002: public pages read published_cards only).
// Two implementations behind one interface, chosen by VITE_DATA_SOURCE, so the card and carousel
// are built on fixtures first and switch to Supabase in Phase 2 with no component changes.

import type { PublicCard, PublishedCardRow } from '../types/card';

export interface CardService {
  /** Every published card, numbered in approval order. */
  listPublished(): Promise<PublicCard[]>;
  getByUsername(username: string): Promise<PublicCard | null>;
}

/** Member numbers follow approval order (brief §13: "Numbers are given in approval order"). */
export function numberCards(rows: PublishedCardRow[]): PublicCard[] {
  return [...rows]
    .sort((a, b) => a.published_at.localeCompare(b.published_at) || a.username.localeCompare(b.username))
    .map((row, i) => ({ ...row, no: i + 1 }));
}

function withLookup(list: () => Promise<PublicCard[]>): CardService {
  return {
    listPublished: list,
    async getByUsername(username) {
      const wanted = username.toLowerCase();
      return (await list()).find((c) => c.username === wanted) ?? null;
    },
  };
}

const fixtureService = withLookup(async () => {
  // Loaded lazily so the fixture never ships in a Supabase build's main chunk.
  const mod = await import('../data/sample-cards.json');
  return numberCards(mod.default as PublishedCardRow[]);
});

const supabaseService = withLookup(async () => {
  throw new Error('The Supabase data source is connected in Phase 2. Set VITE_DATA_SOURCE=fixture for now.');
});

export const cardService: CardService =
  import.meta.env.VITE_DATA_SOURCE === 'supabase' ? supabaseService : fixtureService;
