// "Make your card" guide (D-078): the steps from signing in to hanging in the hall, worked out from
// the editor's current form, so new members always see what's done and what's next. Since V2-21
// (D-134) they are grouped into three: Info, Projects, then sending the card for review.

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
  /** What's missing, as a few words for a list ("your name"). */
  short: string;
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
    { key: 'username', title: 'Pick your username', short: 'a username', hint: 'It becomes your page address and QR code.', done: i.username.trim().length >= 3, optional: false, field: 'username' },
    { key: 'name', title: 'Put your name on the badge', short: 'your name', hint: 'The name people will look for.', done: i.fullName.trim().length > 0, optional: false, field: 'full_name' },
    {
      key: 'about',
      title: 'Say what you do',
      short: !i.role.trim() && !i.bio.trim() ? 'a role and a bio' : !i.role.trim() ? 'a role' : 'a bio',
      hint: 'A one-line role and a short bio for the back of the badge.',
      done: i.role.trim().length > 0 && i.bio.trim().length > 0,
      optional: false,
      field: i.role.trim() ? 'bio' : 'role',
    },
    { key: 'photo', title: 'Add a photo', short: 'a photo', hint: 'Optional, but badges with faces get flipped more.', done: i.hasPhoto, optional: true, field: 'photo' },
    { key: 'skills', title: 'Add a few skills', short: 'a few skills', hint: 'Skills help people find you in the hall’s search.', done: i.skills > 0, optional: true, field: 'skills' },
    { key: 'github', title: 'Connect GitHub', short: 'GitHub', hint: 'Adds a verified ✓ GITHUB sticker and lets you pick repos.', done: Boolean(i.githubHandle), optional: true, field: 'repos' },
    { key: 'project', title: 'Add a project', short: 'a project', hint: 'Pick a repo or add one by hand. It fills your Quest Log.', done: i.projects > 0, optional: false, field: 'repos' },
    {
      key: 'submit',
      title: i.hasLiveCard ? 'Your card is in the hall' : 'Send it for review',
      short: 'sending it',
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

export type StageKey = 'info' | 'projects' | 'submit';

export interface GuideStage {
  key: StageKey;
  title: string;
  hint: string;
  /** Its required steps are done (for the last one: the card has been sent). */
  done: boolean;
  /** The required steps still to do, and the optional ones not done. */
  todo: GuideStep[];
  extra: GuideStep[];
  /** Where GO goes: the first field still to do, or null for the Submit button. */
  field: string | null;
}

const STAGE_OF: Record<StepKey, StageKey> = { username: 'info', name: 'info', about: 'info', photo: 'info', skills: 'info', github: 'projects', project: 'projects', submit: 'submit' };

/** The three steps of a first card (D-134): Info → Projects → Send it. */
export function guideStages(steps: GuideStep[]): GuideStage[] {
  const submit = steps.find((s) => s.key === 'submit');
  const meta: Record<StageKey, { title: string; hint: string }> = {
    info: { title: 'Info', hint: 'Your username, your name, what you do and a short bio.' },
    projects: { title: 'Projects', hint: 'Pick a GitHub repo or add a project by hand. It fills your Quest Log.' },
    submit: { title: submit?.title ?? 'Send it for review', hint: submit?.hint ?? '' },
  };
  return (['info', 'projects', 'submit'] as const).map((key) => {
    const mine = steps.filter((s) => STAGE_OF[s.key] === key);
    const todo = mine.filter((s) => !s.done && !s.optional);
    const extra = mine.filter((s) => !s.done && s.optional);
    const field = key === 'submit' ? null : (todo[0] ?? extra[0] ?? mine[0])?.field ?? null;
    return { key, ...meta[key], done: todo.length === 0, todo, extra, field };
  });
}

/** Scrolls to an editor field and puts the cursor in it; null goes to the Submit (or Save) button
 *  in the action bar that is showing. Says whether anything took focus (a disabled button can't). */
export function jumpToField(field: string | null): boolean {
  const shown = (el: HTMLElement) => el.getClientRects().length > 0;
  const target = field
    ? document.querySelector<HTMLElement>(`[data-field="${field}"]`)
    : ([...document.querySelectorAll<HTMLElement>('.editor-actions [data-variant="primary"]')].find(shown) ?? [...document.querySelectorAll<HTMLElement>('.editor-actions button')].find(shown) ?? null);
  if (!target) return false;
  target.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  const controls = 'input:not([type=hidden]):not([hidden]):not(:disabled), textarea:not(:disabled), button:not(:disabled), select:not(:disabled)';
  const focusable = target.matches(controls) ? target : target.querySelector<HTMLElement>(controls);
  focusable?.focus({ preventScroll: true });
  return Boolean(focusable);
}
