// Card validation that mirrors the database checks in supabase/migrations/ (ARCHITECTURE §5).
// The database is the real gate; this gives members the error under the field before they save.

import type { CardForm, DraftProject } from '../types/draft';

export const LIMITS = {
  full_name: 60,
  tagline: 80,
  bio: 280,
  role: 40,
  org_position: 40,
  department: 40,
  skills: 8,
  skill: 24, // not a database check: keeps the badge's power-up tags readable
  projects: 6,
  project_title: 60,
  project_description: 200,
  project_language: 30,
  tech_stack: 8,
} as const;

/** Same list as the profiles.username check constraint. */
export const RESERVED_USERNAMES = [
  'admin', 'api', 'app', 'auth', 'create', 'edit', 'explore', 'help', 'login', 'logout',
  'me', 'member', 'members', 'hall', 'new', 'pip', 'pip-hall', 'piphall', 'pixendo', 'register', 'root', 'settings', 'support',
] as const;

export const PATTERNS = {
  username: /^[a-z0-9][a-z0-9_-]{2,19}$/,
  linkedin: /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\//,
  url: /^https:\/\/[^\s]+\.[^\s]+$/,
  email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
  githubRepo: /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/,
} as const;

/** Error messages keyed by field: `full_name`, `skills`, `projects.<key>.title`, … */
export type FieldErrors = Record<string, string>;

const tooLong = (label: string, max: number) => `${label} can be at most ${max} characters.`;

export function validateUsername(u: string): string | null {
  if (!u) return 'Pick a username. It becomes your card’s web address.';
  if (!PATTERNS.username.test(u)) return 'Use 3–20 lowercase letters, numbers, - or _, starting with a letter or number.';
  if ((RESERVED_USERNAMES as readonly string[]).includes(u)) return 'That username is reserved. Try another.';
  return null;
}

export function validateProject(p: DraftProject, prefix: string, errors: FieldErrors): void {
  const title = p.title.trim();
  if (!title) errors[`${prefix}.title`] = 'Give the project a title.';
  else if (title.length > LIMITS.project_title) errors[`${prefix}.title`] = tooLong('Title', LIMITS.project_title);
  if ((p.description ?? '').trim().length > LIMITS.project_description) errors[`${prefix}.description`] = tooLong('Description', LIMITS.project_description);
  if (p.project_url && !PATTERNS.url.test(p.project_url.trim())) errors[`${prefix}.project_url`] = 'Use a full https:// link.';
  if (p.github_url && !PATTERNS.githubRepo.test(p.github_url.trim())) errors[`${prefix}.github_url`] = 'Use a GitHub repo link like https://github.com/you/repo.';
  if ((p.language ?? '').length > LIMITS.project_language) errors[`${prefix}.language`] = tooLong('Language', LIMITS.project_language);
  if (p.tech_stack.length > LIMITS.tech_stack) errors[`${prefix}.tech_stack`] = `At most ${LIMITS.tech_stack} tags.`;
  if (p.source === 'github' && p.github_repo_id === null) errors[`${prefix}.title`] = 'This GitHub project lost its repo link. Remove it and pick it again.';
}

export function validateCard(form: CardForm, opts: { usernameLocked?: boolean } = {}): FieldErrors {
  const e: FieldErrors = {};
  if (!opts.usernameLocked) {
    const u = validateUsername(form.username.trim());
    if (u) e.username = u;
  }
  const name = form.full_name.trim();
  if (!name) e.full_name = 'Your name goes on the badge.';
  else if (name.length > LIMITS.full_name) e.full_name = tooLong('Name', LIMITS.full_name);
  for (const k of ['tagline', 'bio', 'role', 'org_position', 'department'] as const) {
    const label = { tagline: 'Tagline', bio: 'Bio', role: 'Role', org_position: 'Position', department: 'Department' }[k];
    if (form[k].trim().length > LIMITS[k]) e[k] = tooLong(label, LIMITS[k]);
  }
  const li = form.linkedin_url.trim();
  if (li && !PATTERNS.linkedin.test(li)) e.linkedin_url = 'Use your LinkedIn link, like https://www.linkedin.com/in/you.';
  const web = form.portfolio_url.trim();
  if (web && !PATTERNS.url.test(web)) e.portfolio_url = 'Use a full https:// link.';
  const mail = form.public_email.trim();
  if (mail && !PATTERNS.email.test(mail)) e.public_email = 'That doesn’t look like an email address.';
  if (form.show_email && !mail) e.public_email = 'Add the email to show, or turn off “Show my email”.';
  if (form.skills.length > LIMITS.skills) e.skills = `At most ${LIMITS.skills} skills.`;
  else if (form.skills.some((s) => s.length > LIMITS.skill)) e.skills = `Keep each skill under ${LIMITS.skill} characters.`;
  if (form.projects.length > LIMITS.projects) e.projects = `At most ${LIMITS.projects} projects on a card.`;
  form.projects.forEach((p) => validateProject(p, `projects.${p.key}`, e));
  return e;
}

/** Trims text and turns empty strings into null, the way the database stores "not set". */
export function blankToNull(s: string | null | undefined): string | null {
  const t = (s ?? '').trim();
  return t ? t : null;
}

/** Suggests a username from a GitHub handle or an email, cleaned to the allowed shape. */
export function suggestUsername(githubHandle: string | null, email: string | null): string {
  const raw = (githubHandle ?? email?.split('@')[0] ?? '').toLowerCase();
  let s = raw.replace(/[^a-z0-9_-]+/g, '-').replace(/^[-_]+/, '').slice(0, 20);
  if (s.length < 3) s = (s + 'player').slice(0, 20);
  return (RESERVED_USERNAMES as readonly string[]).includes(s) ? `${s}-1`.slice(0, 20) : s;
}

/** Normalises a skill tag as typed: trimmed, inner whitespace collapsed. */
export function cleanSkill(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}
