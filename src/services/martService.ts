// PIP MART (E2). Buying and equipping happen in the database (supabase/migrations/*_pip_mart.sql);
// this only asks. Prices and balances are never computed here.

import type { Appearance, MyMart } from '../types/mart';
import { requireSupabase } from './supabase';

const useSupabase = import.meta.env.VITE_DATA_SOURCE === 'supabase';

export const martService = {
  async mine(): Promise<MyMart> {
    const { data, error } = await requireSupabase().rpc('my_mart');
    if (error) throw error;
    return data as MyMart;
  },

  /** Returns the balance after paying. Safe to double-click: a second buy is refused. */
  async buy(key: string): Promise<number> {
    const { data, error } = await requireSupabase().rpc('buy_item', { p_key: key });
    if (error) throw error;
    return (data as { balance: number }).balance;
  },

  /** null takes the frame off; 'member' with an affiliation key wears that perk frame. */
  async equip(frame: string | null, affiliation: string | null = null): Promise<void> {
    const { error } = await requireSupabase().rpc('equip_frame', { p_frame: frame, p_affiliation: affiliation });
    if (error) throw error;
  },

  /** Every badge's frame, keyed by profile id (public). Empty without a database. */
  async appearances(): Promise<Map<string, Appearance>> {
    if (!useSupabase) return new Map();
    const { data, error } = await requireSupabase().rpc('card_appearances');
    if (error) throw error;
    return new Map(((data ?? []) as (Appearance & { profile_id: string })[]).map((a) => [a.profile_id, { frame: a.frame, label: a.label }]));
  },

  /** Admins: make an affiliation give its members the member frame, or stop. */
  async setAffiliationFrame(key: string, gives: boolean): Promise<void> {
    const { error } = await requireSupabase().rpc('admin_set_affiliation_frame', { p_key: key, p_frame: gives ? 'member' : null });
    if (error) throw error;
  },
};

/**
 * True when the database doesn't have the Mart yet: its functions or tables are missing because
 * the PIP MART migration (or the PIPs one before it) hasn't been run. Not a connection problem.
 */
export function martNotSetUp(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null;
  return err?.code === 'PGRST202' || err?.code === '42P01' || err?.code === '42883' || /Could not find the function|does not exist/i.test(err?.message ?? '');
}

/** A database refusal in plain words. */
export function martErrorMessage(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? '';
  if (/NOT_ENOUGH_PIPS/.test(msg)) return 'Not enough PIPs for that yet. Discover members and get projects approved to earn more.';
  if (/ALREADY_OWNED/.test(msg)) return 'You already own that.';
  if (/NOT_ELIGIBLE/.test(msg)) return 'The PIP MART opens once your card is in the hall.';
  if (/NO_SUCH_ITEM/.test(msg)) return 'That item isn’t for sale anymore.';
  if (/NOT_OWNED/.test(msg)) return 'Buy that frame first to wear it.';
  if (/NO_SUCH_PERK/.test(msg)) return 'That frame comes with an affiliation you don’t have.';
  if (/NOT_ADMIN/.test(msg)) return 'Only hall admins can do that.';
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Can’t reach the hall right now. Try again.';
  return msg || 'That didn’t work. Try again.';
}
