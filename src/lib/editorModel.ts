// Pure pieces of the card editor: form <-> draft mapping, the live preview card, and the copy
// for each review status. Kept out of the components so they can be unit-tested.

import type { EmoteKind } from '../components/dialogue/Emote';
import type { AuthUser } from '../services/authService';
import type { PublicCard } from '../types/card';
import type { CardForm, DraftProfile, DraftProject, MyCard, ProfileStatus } from '../types/draft';
import { suggestUsername } from './validate';

export function formFrom(mine: MyCard, user: AuthUser): CardForm {
  const p = mine.profile;
  return {
    username: p?.username ?? suggestUsername(user.githubHandle, user.email),
    full_name: p?.full_name ?? user.name ?? '',
    tagline: p?.tagline ?? '',
    bio: p?.bio ?? '',
    role: p?.role ?? '',
    org_position: p?.org_position ?? '',
    department: p?.department ?? '',
    linkedin_url: p?.linkedin_url ?? '',
    portfolio_url: p?.portfolio_url ?? '',
    public_email: p?.public_email ?? '',
    show_email: p?.show_email ?? false,
    email_updates: p?.email_updates ?? false,
    skills: p?.skills ?? [],
    avatar_path: p?.avatar_path ?? null,
    projects: mine.projects,
  };
}

/** The badge as it would look once approved (preview in the editor). */
export function previewCard(form: CardForm, mine: MyCard, user: AuthUser): PublicCard {
  const no = mine.profile?.member_no ?? 0;
  return {
    profile_id: user.id,
    username: form.username.trim() || 'your-name',
    is_featured: mine.profile?.is_featured ?? false,
    published_at: new Date().toISOString(),
    member_no: no,
    no,
    card: {
      username: form.username.trim() || 'your-name',
      full_name: form.full_name.trim() || 'Your name',
      tagline: form.tagline || null,
      bio: form.bio || null,
      role: form.role || null,
      org_position: form.org_position || null,
      department: form.department || null,
      avatar_path: form.avatar_path,
      github_username: mine.profile?.github_username ?? user.githubHandle,
      linkedin_url: form.linkedin_url || null,
      portfolio_url: form.portfolio_url || null,
      public_email: form.show_email ? form.public_email || null : null,
      skills: form.skills,
      theme: 'classic',
      is_featured: mine.profile?.is_featured ?? false,
      projects: form.projects.map((p) => ({
        title: p.title || 'Untitled project',
        description: p.description,
        cover_path: p.cover_path,
        project_url: p.project_url,
        github_url: p.github_url,
        language: p.language,
        stars: p.stars,
        tech_stack: p.tech_stack,
        source: p.source,
        project_date: p.project_date,
      })),
    },
  };
}

/**
 * A submitted draft drawn as a badge, the way build_card() would publish it (admin review).
 * Mirrors supabase/migrations/20261004000200_image_paths.sql: the email shows only if opted in.
 */
export function cardFromDraft(profile: DraftProfile, projects: DraftProject[], submittedAt: string | null): PublicCard {
  const no = profile.member_no ?? 0;
  return {
    profile_id: profile.id,
    username: profile.username,
    is_featured: profile.is_featured,
    published_at: submittedAt ?? new Date().toISOString(),
    member_no: no,
    no,
    card: {
      username: profile.username,
      full_name: profile.full_name,
      tagline: profile.tagline,
      bio: profile.bio,
      role: profile.role,
      org_position: profile.org_position,
      department: profile.department,
      avatar_path: profile.avatar_path,
      github_username: profile.github_username,
      linkedin_url: profile.linkedin_url,
      portfolio_url: profile.portfolio_url,
      public_email: profile.show_email ? profile.public_email : null,
      skills: profile.skills,
      theme: 'classic',
      is_featured: profile.is_featured,
      projects: projects.map((p) => ({
        title: p.title,
        description: p.description,
        cover_path: p.cover_path,
        project_url: p.project_url,
        github_url: p.github_url,
        language: p.language,
        stars: p.stars,
        tech_stack: p.tech_stack,
        source: p.source,
        project_date: p.project_date,
      })),
    },
  };
}

export interface StatusView {
  label: string;
  text: string;
  emote?: EmoteKind;
  /** Text for the submit button, or null when submitting isn't possible right now. */
  submit: string | null;
  submitHint?: string;
}

export function statusView(status: ProfileStatus | null, opts: { hasLiveCard: boolean; reviewNote: string | null; dirty: boolean }): StatusView {
  const { hasLiveCard, reviewNote, dirty } = opts;
  switch (status) {
    case null:
      return { label: 'NEW CARD', text: 'Fill in your card, then save it. You can submit it for review once it’s saved.', submit: 'Save and submit for review' };
    case 'draft':
      return hasLiveCard
        ? { label: 'EDITING', text: 'Live version is older — submit changes. Your approved card stays in the hall until the new one is approved.', emote: 'attention', submit: 'Submit changes' }
        : { label: 'DRAFT', text: 'Draft saved. Submit it when it’s ready and an admin will review it.', submit: 'Submit for review' };
    case 'pending_review':
      return {
        label: 'PENDING REVIEW',
        text: dirty ? 'Saving these edits takes the card out of the review queue until you submit it again.' : 'Waiting for an admin to review your card.',
        emote: 'pending',
        submit: dirty ? 'Save and resubmit' : null,
      };
    case 'approved':
      return { label: 'APPROVED', text: 'Approved! Your card is in the hall. Edits go back to review; the live card stays up meanwhile.', emote: 'approved', submit: dirty ? 'Submit changes' : null };
    case 'rejected':
      return {
        label: 'CHANGES REQUESTED',
        text: `An admin asked for changes${reviewNote ? `: “${reviewNote}”` : '.'} Fix them and submit again.`,
        emote: 'attention',
        submit: dirty ? 'Save and resubmit' : null,
        submitHint: dirty ? undefined : 'Make the requested changes to submit again.',
      };
    case 'unpublished':
      return { label: 'UNPUBLISHED', text: 'An admin took this card out of the hall. Update it and submit again to come back.', emote: 'attention', submit: dirty ? 'Save and resubmit' : null, submitHint: dirty ? undefined : 'Edit your card to submit it again.' };
  }
}
