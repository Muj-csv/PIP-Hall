// Plain words for PIP events: what Pip says and what the history shows.

import type { Achievement, DiscoverResult, LedgerEntry } from '../types/pips';

export function reasonLabel(e: Pick<LedgerEntry, 'reason' | 'ref'>, achievements: Achievement[] = []): string {
  switch (e.reason) {
    case 'first_approval':
      return 'Your card joined the hall';
    case 'project_live':
      return 'A project went live';
    case 'discover':
      return 'Discovered a member';
    case 'achievement': {
      const key = e.ref.replace(/^achievement:/, '');
      return `Achievement: ${achievements.find((a) => a.key === key)?.name ?? key}`;
    }
  }
}

/** Pip's line after opening a profile, or null when there's nothing to say. */
export function discoverLine(r: DiscoverResult, achievements: Achievement[] = []): string | null {
  const parts: string[] = [];
  if (r.granted) parts.push(`You found someone new! +${r.amount} PIPs.`);
  else if (r.new) parts.push('You found someone new! Discovery PIPs are maxed for today, but it still counts.');
  for (const key of r.unlocked) {
    const a = achievements.find((x) => x.key === key);
    parts.push(a ? `ACHIEVEMENT: ${a.name}! +${a.reward} PIPs.` : 'ACHIEVEMENT unlocked!');
  }
  return parts.length ? parts.join(' ') : null;
}

export function formatPips(n: number): string {
  return n.toLocaleString('en-US');
}
