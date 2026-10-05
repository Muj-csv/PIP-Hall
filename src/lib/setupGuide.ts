// "Make your card" guide (D-078): the steps from signing in to hanging in the hall, worked out from
// the editor's current form, so new members always see what's done and what's next.

import type { ProfileStatus } from '../types/draft';

export interface GuideInput {
  username: string;
  fullName: string;
  role: string;
  bio: string;
  hasPhoto: boolean;
  githubHandle: string | null;
  projects: number;
  skills: number;
  /** The saved status, or null before the first save. */
  status: ProfileStatus | null;
  hasLiveCard: boolean;
}

export type StepKey = 'username' | 'name' | 'about' | 'photo' | 'github' | 'project' | 'skills' | 'submit';

export interface GuideStep {
  key: StepKey;
  title: string;
  /** What to do, in one line. */
  hint: string;
  done: boolean;
  /** Optional steps don't block sending for review. */
  optional: boolean;
  /** The editor field to jump to (data-field), if any. */
  field: string | null;
}

const sent = (s: ProfileStatus | null) => s === 'pending_review' || s === 'approved';

export function setupSteps(i: GuideInput): GuideStep[] {
  return [
    { key: 'username', title: 'Pick your username', hint: 'It becomes your page address and QR code.', done: i.username.trim().length >= 3, optional: false, field: 'username' },
    { key: 'name', title: 'Put your name on the badge', hint: 'The name people will look for.', done: i.fullName.trim().length > 0, optional: false, field: 'full_name' },
    { key: 'about', title: 'Say what you do', hint: 'A one-line role and a short bio for the back of the badge.', done: i.role.trim().length > 0 && i.bio.trim().length > 0, optional: false, field: i.role.trim() ? 'bio' : 'role' },
    { key: 'photo', title: 'Add a photo', hint: 'Optional, but badges with faces get flipped more.', done: i.hasPhoto, optional: true, field: 'photo' },
    { key: 'github', title: 'Connect GitHub', hint: 'Adds a verified ✓ GITHUB sticker and lets you pick repos.', done: Boolean(i.githubHandle), optional: true, field: 'repos' },
    { key: 'project', title: 'Add a project', hint: 'Pick a repo or add one by hand. It fills your Quest Log.', done: i.projects > 0, optional: false, field: 'repos' },
    { key: 'skills', title: 'Add a few skills', hint: 'Skills help people find you in the hall’s search.', done: i.skills > 0, optional: true, field: 'skills' },
    {
      key: 'submit',
      title: i.hasLiveCard ? 'Your card is in the hall' : 'Send it for review',
      hint: i.status === 'approved' ? 'Approved! Share your QR code.' : i.status === 'pending_review' ? 'Waiting for an admin. You’ll hang in the hall once approved.' : 'Save, then press Submit. An admin checks it, then it hangs in the hall.',
      done: sent(i.status),
      optional: false,
      field: null,
    },
  ];
}

export function guideProgress(steps: GuideStep[]): { done: number; total: number; next: GuideStep | null; ready: boolean } {
  const done = steps.filter((s) => s.done).length;
  const required = steps.filter((s) => !s.optional && s.key !== 'submit');
  return {
    done,
    total: steps.length,
    next: steps.find((s) => !s.done && !s.optional) ?? steps.find((s) => !s.done) ?? null,
    ready: required.every((s) => s.done),
  };
}

/** Scrolls to an editor field and puts the cursor in it. */
export function jumpToField(field: string | null) {
  const target = field
    ? document.querySelector<HTMLElement>(`[data-field="${field}"]`)
    : document.querySelector<HTMLElement>('.editor-actions:not([hidden]) [data-variant="primary"], .editor-actions:not([hidden]) button');
  if (!target) return;
  target.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  const focusable = target.matches('input, textarea, button, select') ? target : target.querySelector<HTMLElement>('input:not([type=hidden]):not([hidden]), textarea, button, select');
  focusable?.focus({ preventScroll: true });
}
