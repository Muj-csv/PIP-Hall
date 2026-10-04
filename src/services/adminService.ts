// Moderation (FR-08). Admins read drafts through RLS ("read own draft or admin") and change
// status only through the security-definer functions in supabase/migrations, which check
// is_admin() themselves. A member who calls these gets NOT_ADMIN from the database.

import { cardFromDraft } from '../lib/editorModel';
import type { PublicCard, PublishedCardRow } from '../types/card';
import type { DraftProfile, DraftProject } from '../types/draft';
import { numberCards } from './cardService';
import { requireSupabase } from './supabase';

const PROFILE_COLUMNS =
  'id, username, full_name, tagline, bio, role, org_position, department, avatar_path, github_username, linkedin_url, portfolio_url, public_email, show_email, email_updates, skills, status, review_note, is_featured, username_locked, member_no, submitted_at';
const PROJECT_COLUMNS = 'id, profile_id, source, github_repo_id, title, description, cover_path, project_url, github_url, language, stars, tech_stack, project_date, sort_order';
const CARD_COLUMNS = 'profile_id, username, card, is_featured, published_at, member_no';

/** A card waiting for review: the submitted draft, and the live card it would replace. */
export interface ReviewItem {
  profile: DraftProfile;
  submittedAt: string | null;
  draft: PublicCard;
  live: PublicCard | null;
}

export interface Queue {
  pending: ReviewItem[];
  published: PublicCard[];
}

type ProfileRow = DraftProfile & { submitted_at: string | null };
type ProjectRow = Omit<DraftProject, 'key'> & { id: string; profile_id: string; sort_order: number };

async function call(fn: string, args: Record<string, unknown>): Promise<void> {
  const { error } = await requireSupabase().rpc(fn, args);
  if (error) throw error;
}

export const adminService = {
  async queue(): Promise<Queue> {
    const sb = requireSupabase();
    const [pending, published] = await Promise.all([
      sb.from('profiles').select(PROFILE_COLUMNS).eq('status', 'pending_review').order('submitted_at', { ascending: true }),
      sb.from('published_cards').select(CARD_COLUMNS).order('member_no'),
    ]);
    if (pending.error) throw pending.error;
    if (published.error) throw published.error;
    const profiles = (pending.data ?? []) as ProfileRow[];
    const live = numberCards((published.data ?? []) as PublishedCardRow[]);

    let projects: ProjectRow[] = [];
    if (profiles.length) {
      const { data, error } = await sb
        .from('projects')
        .select(PROJECT_COLUMNS)
        .in('profile_id', profiles.map((p) => p.id))
        .order('sort_order');
      if (error) throw error;
      projects = (data ?? []) as ProjectRow[];
    }

    return {
      pending: profiles.map(({ submitted_at, ...profile }) => {
        const own = projects.filter((p) => p.profile_id === profile.id).map((p) => ({ ...p, key: p.id }));
        return {
          profile,
          submittedAt: submitted_at,
          draft: cardFromDraft(profile, own, submitted_at),
          live: live.find((c) => c.profile_id === profile.id) ?? null,
        };
      }),
      published: live,
    };
  },

  approve: (id: string) => call('approve_profile', { p_id: id }),
  reject: (id: string, note: string) => call('reject_profile', { p_id: id, p_note: note }),
  unpublish: (id: string) => call('unpublish_profile', { p_id: id }),
  setFeatured: (id: string, featured: boolean) => call('set_featured', { p_id: id, p_featured: featured }),
  rename: (id: string, username: string) => call('admin_set_username', { p_id: id, p_username: username }),
};

/** Turns a database refusal into a line for the admin. */
export function adminErrorMessage(e: unknown): string {
  const err = e as { code?: string; message?: string; details?: string };
  const msg = `${err.message ?? ''} ${err.details ?? ''}`;
  if (/NOT_ADMIN/.test(msg) || err.code === '42501') return 'Only hall admins can do that.';
  if (/NOT_PENDING/.test(msg)) return 'That card isn’t waiting for review any more. The member may have edited it. Refresh the queue.';
  if (/NOT_PUBLISHED/.test(msg)) return 'That card isn’t in the hall any more. Refresh the queue.';
  if (/NOTE_REQUIRED/.test(msg)) return 'Write a note so the member knows what to change.';
  if (err.code === '23505') return 'That username is already taken.';
  if (err.code === '23514') return 'Usernames are 3–20 characters: lowercase letters, numbers, - and _, and not a reserved word.';
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Can’t reach the hall right now. Try again.';
  return err.message || 'That didn’t work. Try again.';
}
