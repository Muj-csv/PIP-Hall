// The archive (V2-10, D-118, D-122): past projects and hackathon outputs in the Museum, members'
// claims on them, and Admin → Archive. The database checks every rule (who may be named, which
// events may be linked, who may claim) and keeps drafts private. Without a database there is no
// archive: no past project is invented (rule 7).

import { parseArchive, type ArchiveExhibit } from '../lib/archive';
import { uploadImage } from './storageService';
import { requireSupabase } from './supabase';

const useSupabase = import.meta.env.VITE_DATA_SOURCE === 'supabase';
/** Before the archive update the functions don't exist: an empty archive rather than an error. */
const notYet = (e: { code?: string; message?: string }, fn: string) => e.code === 'PGRST202' || new RegExp(fn).test(e.message ?? '');

export interface MyArchive {
  eligible: boolean;
  claims: { exhibit_id: string; status: 'pending' | 'confirmed' | 'declined' }[];
  /** Exhibits I'm linked on. */
  credited: string[];
}

export interface AdminMaker {
  id?: number;
  member_id: string | null;
  name: string | null;
  username?: string | null;
  full_name?: string | null;
}

export interface AdminClaim {
  id: number;
  member_id: string;
  username: string;
  full_name: string;
  note: string;
  at: string;
}

/** One admin_archive() row: the exhibit as stored, drafts too. */
export interface AdminArchive {
  id: string;
  title: string;
  description: string;
  year: number;
  season_key: string | null;
  event_name: string | null;
  event: string | null;
  track: string | null;
  award_place: 1 | 2 | 3 | null;
  award_name: string | null;
  award_in_track: boolean;
  award_note: string;
  team_name: string | null;
  tech: string[];
  project_url: string | null;
  github_url: string | null;
  video_url: string | null;
  cover_path: string | null;
  names_ok: boolean;
  published: boolean;
  makers: AdminMaker[];
  claims: AdminClaim[];
}

/** What Admin → Archive saves. */
export interface ArchiveInput {
  title: string;
  description: string;
  year: number;
  season_key: string | null;
  event_name: string | null;
  track: string | null;
  award_place: number | null;
  award_name: string | null;
  award_in_track: boolean;
  award_note: string;
  team_name: string | null;
  tech: string[];
  project_url: string | null;
  github_url: string | null;
  video_url: string | null;
  cover_path: string | null;
  names_ok: boolean;
  published: boolean;
  makers: { member_id: string | null; name: string | null }[];
}

// The Museum, an exhibit and a profile may all ask; one request a minute is plenty.
let cached: { at: number; value: Promise<ArchiveExhibit[]> } | null = null;

export const archiveService = {
  /** Every published archive exhibit, newest year first. */
  list(): Promise<ArchiveExhibit[]> {
    if (!useSupabase) return Promise.resolve([]);
    if (cached && Date.now() - cached.at < 60_000) return cached.value;
    const value = (async () => {
      const { data, error } = await requireSupabase().rpc('museum_archive');
      if (error) {
        if (notYet(error, 'museum_archive')) return [];
        throw error;
      }
      return parseArchive(data);
    })();
    cached = { at: Date.now(), value };
    value.catch(() => (cached = null));
    return value;
  },

  /** For a signed-in member: what they've claimed and what they're linked on. */
  async mine(): Promise<MyArchive> {
    const { data, error } = await requireSupabase().rpc('my_archive');
    if (error) throw error;
    const r = (data ?? {}) as Partial<MyArchive>;
    return { eligible: Boolean(r.eligible), claims: r.claims ?? [], credited: r.credited ?? [] };
  },

  async claim(id: string, note: string): Promise<void> {
    const { error } = await requireSupabase().rpc('claim_archive', { p_id: id, p_note: note });
    if (error) throw error;
  },

  async leave(id: string): Promise<void> {
    cached = null;
    const { error } = await requireSupabase().rpc('leave_archive', { p_id: id });
    if (error) throw error;
  },

  // ---- Admin → Archive. The database checks is_admin() and every field.
  async adminList(): Promise<AdminArchive[]> {
    const { data, error } = await requireSupabase().rpc('admin_archive');
    if (error) throw error;
    return (data ?? []) as AdminArchive[];
  },

  async save(id: string | null, input: ArchiveInput): Promise<string> {
    cached = null;
    const { data, error } = await requireSupabase().rpc('admin_save_archive', { p_id: id, p_data: input });
    if (error) throw error;
    return data as string;
  },

  /** Uploads an exhibit's picture into the admin's own folder (D-027) and returns its path. */
  uploadPicture(adminId: string, image: Blob): Promise<string> {
    return uploadImage('project-covers', adminId, image);
  },

  async remove(id: string): Promise<void> {
    cached = null;
    const { error } = await requireSupabase().rpc('admin_delete_archive', { p_id: id });
    if (error) throw error;
  },

  async answer(claimId: number, accept: boolean, makerId: number | null, note: string): Promise<void> {
    cached = null;
    const { error } = await requireSupabase().rpc('admin_answer_claim', { p_id: claimId, p_accept: accept, p_maker: makerId, p_note: note });
    if (error) throw error;
  },
};

export function archiveErrorMessage(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? '';
  if (/BAD_TITLE/.test(msg)) return 'Give it a title (up to 80 characters).';
  if (/BAD_YEAR/.test(msg)) return 'Give the year it was made, like 2024.';
  if (/EVENT_NOT_OVER/.test(msg)) return 'That event isn’t over yet. Its own room shows its entries until then.';
  if (/NO_SUCH_EVENT/.test(msg)) return 'Pick one of the hall’s events, or type the event’s name.';
  if (/BAD_EVENT/.test(msg)) return 'An event’s name is 2 to 60 characters.';
  if (/BAD_TRACK/.test(msg)) return 'A track’s name is 2 to 30 characters.';
  if (/BAD_AWARD/.test(msg)) return 'An award is a place or a name (2 to 40 characters), won at an event; a track award needs the track.';
  if (/BAD_NOTE/.test(msg)) return 'Keep the note to 200 characters.';
  if (/BAD_TEAM/.test(msg)) return 'A team name is 2 to 40 characters.';
  if (/BAD_TECH/.test(msg)) return 'Up to 8 tools, each up to 30 characters.';
  if (/BAD_LINK/.test(msg)) return 'Links start with https://.';
  if (/BAD_PICTURE/.test(msg)) return 'Upload the picture again.';
  if (/NOT_IN_HALL/.test(msg)) return 'Only members with a card in the hall can be linked. Type their name instead.';
  if (/BAD_MAKERS/.test(msg)) return 'Up to 12 makers, each member once.';
  if (/BAD_MAKER/.test(msg)) return 'Pick one of the exhibit’s unlinked makers, or add them as a new one.';
  if (/NO_SUCH_CLAIM/.test(msg)) return 'That claim has already been answered.';
  if (/ALREADY_CLAIMED/.test(msg)) return 'Your claim is already with the admins.';
  if (/ALREADY_CREDITED/.test(msg)) return 'You’re already credited on it.';
  if (/TOO_MANY_CLAIMS/.test(msg)) return 'You have 10 claims waiting. Wait for the admins to answer them first.';
  if (/NOT_ELIGIBLE/.test(msg)) return 'Claiming opens once your card is approved.';
  if (/NO_SUCH_EXHIBIT/.test(msg)) return 'That exhibit isn’t on show anymore.';
  if (/NOT_CREDITED/.test(msg)) return 'Your name isn’t on it.';
  if (/NOT_ADMIN/.test(msg)) return 'Only admins can curate the archive.';
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Can’t reach the hall right now. Try again.';
  return 'That didn’t work. Try again.';
}
