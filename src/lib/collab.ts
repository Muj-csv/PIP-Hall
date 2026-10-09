// Who made a project (D-089, D-090): the owner first, then the collaborators who accepted, as of the
// owner's last approval. Worked out from the public cards, so visitors need no extra request.

import type { Exhibit } from '../types/museum';
import type { PublicCard, PublicProject } from '../types/card';

/** The owner's card, then each credited collaborator's card that is still in the hall. */
export function makersOf(ownerUsername: string, project: Pick<PublicProject, 'collaborators'>, cards: readonly PublicCard[]): PublicCard[] {
  const byName = new Map(cards.map((c) => [c.username, c]));
  const owner = byName.get(ownerUsername);
  const others = (project.collaborators ?? []).map((c) => byName.get(c.username)).filter((c): c is PublicCard => Boolean(c) && c!.username !== ownerUsername);
  return owner ? [owner, ...others] : others;
}

/** Projects on other members' cards that credit this member, with their owner. */
export function collaborationsOf(username: string, cards: readonly PublicCard[]): { project: PublicProject; owner: PublicCard }[] {
  return cards.flatMap((owner) =>
    owner.username === username ? [] : owner.card.projects.filter((p) => p.collaborators?.some((c) => c.username === username)).map((project) => ({ project, owner })),
  );
}

/** "Ada", "Ada and Bee", "Ada, Bee and Cy". */
export function creditLine(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Who made an exhibit, as far as the hall can link them: members only (archive makers who aren't
 *  members have no badge to link to). */
function linkedMakers(e: Exhibit): { username: string; name: string }[] {
  if (e.archive) return e.archive.makers.flatMap((m) => (m.username ? [{ username: m.username, name: m.full_name ?? m.username }] : []));
  return [{ username: e.username, name: e.full_name }, ...(e.project.collaborators ?? []).map((m) => ({ username: m.username, name: m.full_name }))];
}

/** Other projects that share a maker with this one (V2-13, #11), with who connects them: members'
 *  exhibits, event entries and the archive. Most shared makers first, then by title. */
export function connectedProjects(e: Exhibit, all: readonly Exhibit[], max = 6): { exhibit: Exhibit; via: { username: string; name: string }[] }[] {
  const mine = new Map(linkedMakers(e).map((m) => [m.username, m]));
  const seen = new Set([e.project_id]);
  const out: { exhibit: Exhibit; via: { username: string; name: string }[] }[] = [];
  for (const x of all) {
    if (seen.has(x.project_id)) continue;
    seen.add(x.project_id);
    const via = [...new Map(linkedMakers(x).filter((m) => mine.has(m.username)).map((m) => [m.username, mine.get(m.username)!])).values()];
    if (via.length) out.push({ exhibit: x, via });
  }
  return out.sort((a, b) => b.via.length - a.via.length || a.exhibit.project.title.localeCompare(b.exhibit.project.title)).slice(0, max);
}

