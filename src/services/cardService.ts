// The only way pages get public cards (ADR-002: public pages read published_cards only).
// Two implementations behind one interface, chosen by VITE_DATA_SOURCE, so components don't
// change between the fixture and Supabase.

import type { PublicCard, PublishedCardRow } from '../types/card';
import { requireSupabase } from './supabase';

export interface CardService {
  /** Every published card, in member-number order. */
  listPublished(): Promise<PublicCard[]>;
  getByUsername(username: string): Promise<PublicCard | null>;
}

const COLUMNS = 'profile_id, username, card, is_featured, published_at, member_no';

/** Orders by the stable member number (D-034); the badge prints it as No.###. */
export function numberCards(rows: PublishedCardRow[]): PublicCard[] {
  return [...rows].sort((a, b) => a.member_no - b.member_no).map((row) => ({ ...row, no: row.member_no }));
}

const fixtureService: CardService = {
  async listPublished() {
    // Loaded lazily so the fixture never ships in a Supabase build's main chunk.
    const mod = await import('../data/sample-cards.json');
    return numberCards(mod.default as PublishedCardRow[]);
  },
  async getByUsername(username) {
    return (await this.listPublished()).find((c) => c.username === username.toLowerCase()) ?? null;
  },
};

const supabaseService: CardService = {
  async listPublished() {
    const { data, error } = await requireSupabase().from('published_cards').select(COLUMNS).order('member_no');
    if (error) throw error;
    return numberCards((data ?? []) as PublishedCardRow[]);
  },
  async getByUsername(username) {
    const { data, error } = await requireSupabase()
      .from('published_cards')
      .select(COLUMNS)
      .eq('username', username.toLowerCase())
      .maybeSingle();
    if (error) throw error;
    return data ? numberCards([data as PublishedCardRow])[0]! : null;
  },
};

export const cardService: CardService =
  import.meta.env.VITE_DATA_SOURCE === 'supabase' ? supabaseService : fixtureService;
