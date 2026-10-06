// Who made a project (D-089, D-090): the owner first, then the collaborators who accepted, as of the
// owner's last approval. Worked out from the public cards, so visitors need no extra request.

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
