// MUSEUM (D-069) and affiliations (D-067, D-068). Two sources behind one interface, like cardService:
// the fixture shows every sample project so the gallery can be built and tested without a backend.

import type { ConsoleKind } from '../lib/sprites';
import { DEFAULT_WINGS, parseWings, type Wing } from '../lib/wings';
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
      featured: c.is_featured,
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

  /** The open wings, in order (V2-6). Without a database, or before the wings update, the
   *  default wings (no curator notes). */
  async wings(): Promise<Wing[]> {
    if (!useSupabase) return [...DEFAULT_WINGS];
    const { data, error } = await requireSupabase().rpc('museum_wings');
    if (error) {
      if (error.code === 'PGRST202' || /museum_wings/.test(error.message ?? '')) return [...DEFAULT_WINGS];
      throw error;
    }
    return parseWings(data);
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

  /** Picks the console one of my exhibits hangs in; null goes back to automatic. Never resets review. */
  async setConsole(projectId: string, kind: ConsoleKind | null): Promise<void> {
    const { error } = await requireSupabase().rpc('set_museum_console', { p_project: projectId, p_console: kind });
    if (error) throw error;
  },

  /** Puts one of my live projects in the Museum or takes it out. Never resets review. */
  async set(projectId: string, on: boolean): Promise<boolean> {
    const { data, error } = await requireSupabase().rpc('set_museum', { p_project: projectId, p_on: on });
    if (error) throw error;
    return Boolean(data);
  },
};

export interface AdminWing extends Wing {
  sort: number;
  active: boolean;
}

/** Admin → Museum wings (D-102). The database checks is_admin() and every field. */
export const wingService = {
  async list(): Promise<AdminWing[]> {
    const { data, error } = await requireSupabase().rpc('admin_wings');
    if (error) throw error;
    return (data ?? []) as AdminWing[];
  },

  async save(w: { key: string; name: string; note: string; tags: string[]; sort: number; active: boolean }): Promise<void> {
    const { error } = await requireSupabase().rpc('admin_save_wing', { p_key: w.key, p_name: w.name, p_note: w.note, p_tags: w.tags, p_sort: w.sort, p_active: w.active });
    if (error) throw error;
  },

  async remove(key: string): Promise<void> {
    const { error } = await requireSupabase().rpc('admin_delete_wing', { p_key: key });
    if (error) throw error;
  },
};

export function wingErrorMessage(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? '';
  if (/BAD_TAGS/.test(msg)) return 'A wing needs 1 to 12 tags, each up to 30 characters.';
  if (/BAD_NAME/.test(msg)) return 'A wing’s name is 2 to 30 characters.';
  if (/BAD_NOTE/.test(msg)) return 'Keep the curator’s note to 280 characters.';
  if (/BAD_KEY/.test(msg)) return 'Use letters and numbers for the wing’s name.';
  if (/BUILT_IN/.test(msg)) return 'The Featured and Collab wings can be closed, not removed.';
  if (/NOT_ADMIN/.test(msg)) return 'Only admins can curate wings.';
  return 'That didn’t work. Try again.';
}

export const affiliationService = {
  async list(): Promise<Affiliation[]> {
    if (!useSupabase) return [];
    const { data, error } = await requireSupabase().from('affiliations').select('*').order('sort');
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
  if (/NOT_IN_MUSEUM/.test(msg)) return 'Put the project in the Museum first, then pick its console.';
  if (/BAD_CONSOLE/.test(msg)) return 'That console isn’t one of the five. Pick another.';
  if (/NOT_ADMIN/.test(msg)) return 'Only hall admins can do that.';
  if (/check constraint/.test(msg)) return 'Names need 1–40 characters, and at least two letters or numbers.';
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Can’t reach the hall right now. Try again.';
  return msg || 'That didn’t work. Try again.';
}
