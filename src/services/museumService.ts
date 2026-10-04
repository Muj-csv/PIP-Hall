// MUSEUM (D-069) and affiliations (D-067, D-068). Two sources behind one interface, like cardService:
// the fixture shows every sample project so the gallery can be built and tested without a backend.

import type { PublishedCardRow } from '../types/card';
import type { Affiliation, Exhibit, MuseumSummaryRow, MyMuseum } from '../types/museum';
import { requireSupabase } from './supabase';

const useSupabase = import.meta.env.VITE_DATA_SOURCE === 'supabase';

async function fixtureExhibits(): Promise<Exhibit[]> {
  const mod = await import('../data/sample-cards.json');
  return (mod.default as PublishedCardRow[]).flatMap((c) =>
    c.card.projects.map((p, i) => ({
      project_id: `${c.username}-${i}`,
      username: c.username,
      full_name: c.card.full_name,
      avatar_path: c.card.avatar_path,
      member_no: c.member_no,
      project: p,
    })),
  );
}

export const museumService = {
  async exhibits(): Promise<Exhibit[]> {
    if (!useSupabase) return fixtureExhibits();
    const { data, error } = await requireSupabase().rpc('museum_exhibits');
    if (error) throw error;
    return (data ?? []) as Exhibit[];
  },

  async mine(): Promise<MyMuseum> {
    const { data, error } = await requireSupabase().rpc('my_museum');
    if (error) throw error;
    return data as MyMuseum;
  },

  /** Admins: members with Museum access, their approved projects and exhibits. */
  async summary(): Promise<MuseumSummaryRow[]> {
    const { data, error } = await requireSupabase().rpc('admin_museum_summary');
    if (error) throw error;
    return (data ?? []) as MuseumSummaryRow[];
  },

  /** Puts one of my live projects in the Museum or takes it out. Never resets review. */
  async set(projectId: string, on: boolean): Promise<boolean> {
    const { data, error } = await requireSupabase().rpc('set_museum', { p_project: projectId, p_on: on });
    if (error) throw error;
    return Boolean(data);
  },
};

export const affiliationService = {
  async list(): Promise<Affiliation[]> {
    if (!useSupabase) return [];
    const { data, error } = await requireSupabase().from('affiliations').select('key, name, grants_museum, frame_key, sort').order('sort');
    if (error) throw error;
    return (data ?? []) as Affiliation[];
  },

  /** A member's affiliation keys (public for members in the hall). */
  async keysOf(memberId: string): Promise<string[]> {
    if (!useSupabase) return [];
    const { data, error } = await requireSupabase().from('member_affiliations').select('key').eq('member_id', memberId);
    if (error) throw error;
    return (data ?? []).map((r) => (r as { key: string }).key);
  },

  async save(key: string, name: string, grantsMuseum: boolean): Promise<void> {
    const { error } = await requireSupabase().rpc('admin_save_affiliation', { p_key: key, p_name: name, p_grants_museum: grantsMuseum });
    if (error) throw error;
  },

  async remove(key: string): Promise<void> {
    const { error } = await requireSupabase().rpc('admin_delete_affiliation', { p_key: key });
    if (error) throw error;
  },

  async setForMember(memberId: string, key: string, on: boolean): Promise<void> {
    const { error } = await requireSupabase().rpc('set_member_affiliation', { p_member: memberId, p_key: key, p_on: on });
    if (error) throw error;
  },
};

/** "CS Student" → "cs-student" (the key format the database accepts). */
export function affiliationKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .replace(/-+$/, '');
}

/** Turns a database refusal into a line for the member or admin. */
export function museumErrorMessage(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? '';
  if (/NO_MUSEUM_ACCESS/.test(msg)) return 'Your account doesn’t have Museum access. An admin can add it.';
  if (/NOT_LIVE/.test(msg)) return 'Only projects on your approved card can go in the Museum.';
  if (/NOT_YOURS/.test(msg)) return 'That project isn’t on your card.';
  if (/NOT_ADMIN/.test(msg)) return 'Only hall admins can do that.';
  if (/check constraint/.test(msg)) return 'Names need 1–40 characters, and at least two letters or numbers.';
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Can’t reach the hall right now. Try again.';
  return msg || 'That didn’t work. Try again.';
}
