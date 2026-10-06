// The member's own draft: profiles + projects (FR-03..FR-07). RLS limits every query here to the
// caller's own rows; moderation columns have no write grant, so they're only ever read.

import { blankToNull } from '../lib/validate';
import type { CardForm, DraftProfile, DraftProject, MyCard } from '../types/draft';
import { uploadImage } from './storageService';
import { requireSupabase } from './supabase';

const PROFILE_COLUMNS =
  'id, username, full_name, tagline, bio, role, org_position, department, avatar_path, github_username, linkedin_url, portfolio_url, public_email, show_email, email_updates, skills, status, review_note, is_featured, username_locked, member_no';
const PROJECT_COLUMNS = 'id, source, github_repo_id, title, description, cover_path, project_url, github_url, language, stars, tech_stack, project_date, sort_order';

type ProjectRow = Omit<DraftProject, 'key'> & { id: string; sort_order: number };

/** The editable project columns as the database stores them. */
export function projectRow(p: DraftProject, sortOrder: number) {
  return {
    source: p.source,
    github_repo_id: p.source === 'github' ? p.github_repo_id : null,
    title: p.title.trim(),
    description: blankToNull(p.description),
    cover_path: p.cover_path,
    project_url: blankToNull(p.project_url),
    github_url: blankToNull(p.github_url),
    language: blankToNull(p.language),
    stars: p.stars,
    tech_stack: p.tech_stack,
    project_date: p.project_date,
    sort_order: sortOrder,
  };
}

/** The editable profile columns (members have a write grant on exactly these). */
export function profileRow(form: CardForm, opts: { includeUsername: boolean }) {
  return {
    ...(opts.includeUsername ? { username: form.username.trim() } : {}),
    full_name: form.full_name.trim(),
    tagline: blankToNull(form.tagline),
    bio: blankToNull(form.bio),
    role: blankToNull(form.role),
    org_position: blankToNull(form.org_position),
    department: blankToNull(form.department),
    avatar_path: form.avatar_path,
    linkedin_url: blankToNull(form.linkedin_url),
    portfolio_url: blankToNull(form.portfolio_url),
    public_email: blankToNull(form.public_email),
    show_email: form.show_email,
    email_updates: form.email_updates,
    skills: form.skills,
  };
}

/**
 * The project columns members may change after a project exists (the column grant in
 * supabase/migrations/20261004000000_init.sql). `source` and `github_repo_id` are fixed at insert:
 * sending them in an update makes Postgres refuse the whole row ("permission denied for table projects").
 */
export const PROJECT_UPDATE_COLUMNS = [
  'title', 'description', 'cover_path', 'project_url', 'github_url', 'language', 'stars', 'tech_stack', 'project_date', 'sort_order',
] as const;

export type ProjectUpdate = Pick<ReturnType<typeof projectRow>, (typeof PROJECT_UPDATE_COLUMNS)[number]>;

export function projectUpdate(row: ReturnType<typeof projectRow>): ProjectUpdate {
  const out = {} as Record<string, unknown>;
  for (const k of PROJECT_UPDATE_COLUMNS) out[k] = row[k];
  return out as ProjectUpdate;
}

export interface ProjectPlan {
  remove: string[];
  update: { id: string; row: ProjectUpdate }[];
  insert: ReturnType<typeof projectRow>[];
}

/**
 * What to send for the project list. Deletes go first so a full list of 6 can swap a project
 * without tripping PROJECT_LIMIT; rows that didn't change aren't touched, because every project
 * write sends the card back to draft.
 */
export function planProjects(saved: DraftProject[], next: DraftProject[]): ProjectPlan {
  const keep = new Set(next.filter((p) => p.id).map((p) => p.id!));
  const before = new Map(saved.filter((p) => p.id).map((p, i) => [p.id!, JSON.stringify(projectRow(p, i))]));
  const plan: ProjectPlan = { remove: saved.filter((p) => p.id && !keep.has(p.id)).map((p) => p.id!), update: [], insert: [] };
  next.forEach((p, i) => {
    const row = projectRow(p, i);
    if (!p.id) plan.insert.push(row);
    else if (before.get(p.id) !== JSON.stringify(row)) plan.update.push({ id: p.id, row: projectUpdate(row) });
  });
  return plan;
}

export const profileService = {
  async getMine(userId: string): Promise<MyCard> {
    const sb = requireSupabase();
    const [profile, projects, live] = await Promise.all([
      sb.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle(),
      sb.from('projects').select(PROJECT_COLUMNS).eq('profile_id', userId).order('sort_order').order('created_at'),
      sb.from('published_cards').select('profile_id').eq('profile_id', userId).maybeSingle(),
    ]);
    for (const r of [profile, projects, live]) if (r.error) throw r.error;
    return {
      profile: (profile.data as DraftProfile | null) ?? null,
      projects: ((projects.data ?? []) as ProjectRow[]).map((p) => ({ ...p, key: p.id })),
      hasLiveCard: Boolean(live.data),
    };
  },

  /** Saves the whole card: photo and screen pictures (if new), profile row, then projects. Returns what's stored now. */
  async save(userId: string, form: CardForm, current: MyCard, newPhoto: Blob | null, newCovers: Readonly<Record<string, Blob>> = {}): Promise<MyCard> {
    const sb = requireSupabase();
    const draft = { ...form };
    if (newPhoto) draft.avatar_path = await uploadImage('avatars', userId, newPhoto);
    draft.projects = await Promise.all(
      form.projects.map(async (p) => (newCovers[p.key] ? { ...p, cover_path: await uploadImage('project-covers', userId, newCovers[p.key]!) } : p)),
    );

    if (!current.profile) {
      const { error } = await sb.from('profiles').insert({ id: userId, ...profileRow(draft, { includeUsername: true }) });
      if (error) throw error;
    } else {
      const row = profileRow(draft, { includeUsername: !current.profile.username_locked });
      const { error } = await sb.from('profiles').update(row).eq('id', userId);
      if (error) throw error;
    }

    const plan = planProjects(current.projects, draft.projects);
    if (plan.remove.length) {
      const { error } = await sb.from('projects').delete().in('id', plan.remove);
      if (error) throw error;
    }
    for (const u of plan.update) {
      const { error } = await sb.from('projects').update(u.row).eq('id', u.id);
      if (error) throw error;
    }
    if (plan.insert.length) {
      const { error } = await sb.from('projects').insert(plan.insert.map((row) => ({ ...row, profile_id: userId })));
      if (error) throw error;
    }
    return this.getMine(userId);
  },

  async submitForReview(): Promise<void> {
    const { error } = await requireSupabase().rpc('submit_for_review');
    if (error) throw error;
  },
};

/** Turns a database refusal into a line for the member. */
export function saveErrorMessage(e: unknown): string {
  const err = e as { code?: string; message?: string; details?: string };
  const msg = `${err.message ?? ''} ${err.details ?? ''}`;
  if (err.code === '23505' && /username/.test(msg)) return 'That username is already taken. Try another.';
  if (/USERNAME_LOCKED/.test(msg)) return 'Your username is locked after approval. Ask an admin if it must change.';
  if (/PROJECT_LIMIT/.test(msg)) return 'A card can hold 6 projects. Remove one first.';
  if (/NOT_A_DRAFT/.test(msg)) return 'This card is already waiting for review.';
  if (err.code === '23514') return 'One of the fields didn’t pass the hall’s checks. Look over your links and try again.';
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Can’t reach the hall right now. Your changes are still here; try again.';
  return err.message || 'Saving didn’t work. Your changes are still here; try again.';
}
