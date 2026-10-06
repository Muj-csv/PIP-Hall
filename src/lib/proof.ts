// The Proof panel (V2-5, D-101): what on a member's profile is checked, and by what. Every line
// comes from the approved card (ADR-002) or from titles the database works out from real records;
// self-listed things (skills) are labelled as such rather than dressed up as proof.

import type { PublicCard } from '../types/card';
import { collaborationsOf } from './collab';
import { titleOf, type HallTitle } from './titles';

export interface ProofLine {
  /** A short tag that says what kind of fact this is, in words (never colour alone). */
  mark: '✓' | '○' | '★' | '·';
  text: string;
  sub?: string;
}

/** The GitHub owner in a github.com link, lower-cased, or null. */
export function githubOwner(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname !== 'github.com' && u.hostname !== 'www.github.com') return null;
    return u.pathname.split('/').filter(Boolean)[0]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

const list = (xs: readonly string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export function proofOf(card: PublicCard, hall: readonly PublicCard[], titles: HallTitle | null): ProofLine[] {
  const c = card.card;
  const gh = c.github_username?.toLowerCase() ?? null;
  const lines: ProofLine[] = [];

  lines.push(
    gh
      ? { mark: '✓', text: `GitHub verified: @${c.github_username}`, sub: 'Linked by signing in with GitHub, not typed in.' }
      : { mark: '○', text: 'No GitHub account linked.' },
  );

  if (c.projects.length > 0) {
    const onTheirs = c.projects.filter((p) => gh && githubOwner(p.github_url) === gh).length;
    const fromGithub = c.projects.filter((p) => p.source === 'github' && !(gh && githubOwner(p.github_url) === gh)).length;
    const byHand = c.projects.length - onTheirs - fromGithub;
    const parts = [
      onTheirs && `${onTheirs} on their verified GitHub`,
      fromGithub && `${fromGithub} from another GitHub account`,
      byHand && `${byHand} added by hand`,
    ].filter(Boolean) as string[];
    lines.push({ mark: onTheirs ? '✓' : '·', text: `Quest Log: ${list(parts)}.`, sub: 'Every project was reviewed with the card.' });
  }

  const team = [
    ...c.projects.filter((p) => (p.collaborators?.length ?? 0) > 0).map((p) => `“${p.title}” with ${list(p.collaborators!.map((m) => m.full_name))}`),
    ...collaborationsOf(card.username, hall).map(({ project, owner }) => `“${project.title}” with ${owner.card.full_name}`),
  ];
  if (team.length > 0) lines.push({ mark: '✓', text: `Team projects: ${list(team)}.`, sub: 'Each credit was accepted by both makers.' });

  if (c.skills.length > 0) lines.push({ mark: '·', text: `Skills (self-listed): ${c.skills.join(', ')}.` });

  const approved = new Date(card.published_at);
  if (!Number.isNaN(approved.getTime())) {
    lines.push({
      mark: '✓',
      text: `Card approved ${approved.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.`,
      sub: 'What you see here is the card as an admin approved it.',
    });
  }

  for (const key of titles?.earned ?? []) {
    const t = titleOf(key);
    if (t) lines.push({ mark: '★', text: `${t.name}: ${t.rule}` });
  }
  return lines;
}
