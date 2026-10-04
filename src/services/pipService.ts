// PIP Progression E1. Every grant happens in the database (supabase/migrations/*_pips_core.sql);
// this only asks for one and reads the member's own results.

import type { Achievement, DiscoverResult, LedgerEntry, PipSummary } from '../types/pips';
import { requireSupabase } from './supabase';

export const pipService = {
  async summary(): Promise<PipSummary> {
    const { data, error } = await requireSupabase().rpc('my_pips');
    if (error) throw error;
    return data as PipSummary;
  },

  /** The signed-in member opened this card's profile. Safe to repeat: it pays once. */
  async discover(cardProfileId: string): Promise<DiscoverResult> {
    const { data, error } = await requireSupabase().rpc('discover_card', { p_card: cardProfileId });
    if (error) throw error;
    return data as DiscoverResult;
  },

  /** The member's own newest ledger entries (RLS keeps everyone else's out). */
  async history(limit = 50): Promise<LedgerEntry[]> {
    const { data, error } = await requireSupabase()
      .from('pip_ledger')
      .select('id, amount, reason, ref, created_at')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as LedgerEntry[];
  },

  async catalog(): Promise<Achievement[]> {
    const { data, error } = await requireSupabase().from('achievements').select('key, name, description, reward').order('sort');
    if (error) throw error;
    return (data ?? []) as Achievement[];
  },

  /** A member's unlocked achievement keys (public for members in the hall, D-063). */
  async unlockedBy(memberId: string): Promise<string[]> {
    const { data, error } = await requireSupabase().from('member_achievements').select('key').eq('member_id', memberId);
    if (error) throw error;
    return (data ?? []).map((r) => (r as { key: string }).key);
  },
};
