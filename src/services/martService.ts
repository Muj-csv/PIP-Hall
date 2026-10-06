// PIP MART (E2). Buying and equipping happen in the database (supabase/migrations/*_pip_mart.sql);
// this only asks. Prices and balances are never computed here.

import type { AdminMartItem, Appearance, MyMart, Pin } from '../types/mart';
import type { FrameStyle } from '../lib/rewards';
import { parseHallTitle, type HallTitle, type TitleKey } from '../lib/titles';
import { requireSupabase } from './supabase';

const useSupabase = import.meta.env.VITE_DATA_SOURCE === 'supabase';

export interface MyTitles {
  eligible: boolean;
  title: TitleKey | null;
  plate: string | null;
  earned: TitleKey[];
}

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

  /** Earned titles, the one worn and its plate, for every member in the hall (public, D-101). Empty
   *  without a database or before the identity update. */
  async titles(): Promise<Map<string, HallTitle>> {
    if (!useSupabase) return new Map();
    const { data, error } = await requireSupabase().rpc('hall_titles');
    if (error) throw error;
    return new Map(((data ?? []) as { profile_id: string; earned?: unknown; title?: unknown; plate_style?: unknown }[]).map((r) => [r.profile_id, parseHallTitle(r)]));
  },

  /** The member's own titles: which are earned, which is worn, which plate. */
  async myTitles(): Promise<MyTitles> {
    const { data, error } = await requireSupabase().rpc('my_titles');
    if (error) throw error;
    const r = data as { eligible: boolean; title: TitleKey | null; plate: string | null; titles: { key: TitleKey; earned: boolean }[] };
    return { eligible: Boolean(r.eligible), title: r.title ?? null, plate: r.plate ?? null, earned: (r.titles ?? []).filter((t) => t.earned).map((t) => t.key) };
  },

  /** Wears an earned title (null wears none). The database checks it is earned. */
  async equipTitle(title: TitleKey | null): Promise<void> {
    const { error } = await requireSupabase().rpc('equip_title', { p_title: title });
    if (error) throw error;
  },

  /** Puts the title on an owned plate (null: the plain plate). */
  async equipPlate(plate: string | null): Promise<void> {
    const { error } = await requireSupabase().rpc('equip_plate', { p_plate: plate });
    if (error) throw error;
  },

  /** Every badge's frame, keyed by profile id (public). Empty without a database. */
  async appearances(): Promise<Map<string, Appearance>> {
    if (!useSupabase) return new Map();
    const { data, error } = await requireSupabase().rpc('card_appearances');
    if (error) throw error;
    return new Map(((data ?? []) as (Appearance & { profile_id: string })[]).map((a) => [a.profile_id, { frame: a.frame, label: a.label, style: a.style ?? null }]));
  },

  /** Every member's admin-made badges, keyed by profile id (public, D-087). Empty without a database
   *  or before the admin-rewards update. */
  async pins(): Promise<Map<string, Pin[]>> {
    if (!useSupabase) return new Map();
    const { data, error } = await requireSupabase().rpc('card_pins');
    if (error) throw error;
    return new Map(((data ?? []) as { profile_id: string; pins: Pin[] }[]).map((r) => [r.profile_id, r.pins]));
  },

  // ---- Admin → Rewards (D-087). The database checks is_admin() and every preset.
  async adminItems(): Promise<AdminMartItem[]> {
    const { data, error } = await requireSupabase().rpc('admin_mart_items');
    if (error) throw error;
    return (data ?? []) as AdminMartItem[];
  },

  async saveFrame(f: { key: string; name: string; description: string; price: number; forSale: boolean; style: FrameStyle }): Promise<void> {
    const { error } = await requireSupabase().rpc('admin_save_frame', {
      p_key: f.key, p_name: f.name, p_description: f.description, p_price: f.price, p_for_sale: f.forSale, p_style: f.style,
    });
    if (error) throw error;
  },

  async setItemActive(key: string, active: boolean): Promise<void> {
    const { error } = await requireSupabase().rpc('admin_set_item_active', { p_key: key, p_active: active });
    if (error) throw error;
  },

  async saveBadge(b: { key: string; name: string; description: string; reward: number; gem: string; tone: string; frame: string | null }): Promise<void> {
    const { error } = await requireSupabase().rpc('admin_save_badge', {
      p_key: b.key, p_name: b.name, p_description: b.description, p_reward: b.reward, p_gem: b.gem, p_tone: b.tone, p_frame: b.frame,
    });
    if (error) throw error;
  },

  /** True if the member didn't have it yet (and so got its PIPs and border). */
  async grantBadge(memberId: string, key: string): Promise<boolean> {
    const { data, error } = await requireSupabase().rpc('admin_grant_badge', { p_member: memberId, p_key: key });
    if (error) throw error;
    return Boolean(data);
  },

  async revokeBadge(memberId: string, key: string): Promise<boolean> {
    const { data, error } = await requireSupabase().rpc('admin_revoke_badge', { p_member: memberId, p_key: key });
    if (error) throw error;
    return Boolean(data);
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
  if (/BAD_STYLE/.test(msg)) return 'That border mixes options the hall doesn’t allow. Pick from the lists.';
  if (/BAD_KEY/.test(msg)) return 'Give it a name of at least two letters or numbers.';
  if (/BAD_NAME/.test(msg)) return 'Names are 2 to 40 characters.';
  if (/BAD_DESCRIPTION/.test(msg)) return 'Descriptions are 2 to 120 characters.';
  if (/BAD_PRICE/.test(msg)) return 'Prices are 1 to 100,000 PIPs.';
  if (/BAD_REWARD/.test(msg)) return 'PIP rewards are 0 to 5,000.';
  if (/BUILT_IN/.test(msg)) return 'That name belongs to one of the hall’s built-in items. Pick another.';
  if (/NO_SUCH_BADGE/.test(msg)) return 'That badge doesn’t exist anymore.';
  if (/NOT_PUBLISHED/.test(msg)) return 'Badges go to members whose card is in the hall.';
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Can’t reach the hall right now. Try again.';
  return msg || 'That didn’t work. Try again.';
}
