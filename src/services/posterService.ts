// The showcase's posters (V2-12, D-120), drawn in the browser like the badge (D-104): one for an
// exhibit, one for an event's winners, each with its QR, for walls and social posts. Loaded only
// when someone presses a poster button. Every word comes from the Museum's own data (rule 7).

import { awardLabel, ribbonOf, winnersOf, type MuseumEvent } from '../lib/events';
import { plaqueBy, plaqueOrigin, type PlaqueAward } from '../lib/museumWalk';
import { exhibitUrl, publicOrigin } from '../lib/publicUrl';
import { eventCase } from '../lib/showcase';
import { POSTER_SIZE, posterScreen } from '../lib/shareArt';
import type { Exhibit } from '../types/museum';
import { coverDataUrl, download, renderPng } from './artRenderer';
import { publicImageUrl } from './storageService';

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'poster';

/** An exhibit's poster: its console, title, makers, what it won (with the judges' note) and its QR. */
export async function exhibitPosterBlob(e: Exhibit, awards: readonly PlaqueAward[]): Promise<Blob> {
  const { w, h } = posterScreen(e);
  const picture = await coverDataUrl(publicImageUrl('project-covers', e.project.cover_path), w, h);
  const info = {
    by: plaqueBy(e),
    origin: plaqueOrigin(e),
    awards: awards.map((a) => ({ ribbon: ribbonOf(a.award), label: awardLabel(a.award), event: a.event, note: a.award.note?.trim() || null })),
  };
  // Scanning a poster greets the finder and stamps the Passport, like a placard.
  return renderPng((art) => art.exhibitPoster(e, picture, info, `${exhibitUrl(e.project_id)}?via=placard`), POSTER_SIZE);
}

export async function saveExhibitPoster(e: Exhibit, awards: readonly PlaqueAward[]): Promise<void> {
  download(await exhibitPosterBlob(e, awards), `pip-hall-${slug(e.project.title)}-poster.png`);
}

/** An event's winners poster: every announced place and award, best first, with the room's QR. */
export async function winnersPosterBlob(event: MuseumEvent): Promise<Blob> {
  const winners = winnersOf(event).map(({ award, entry }) => ({ ribbon: ribbonOf(award), label: awardLabel(award), title: entry.project.title, by: plaqueBy(entry) }));
  const room = `${publicOrigin()}/museum?${new URLSearchParams({ event: event.key })}`;
  return renderPng((art) => art.winnersPoster({ name: event.name, sub: eventCase(event).sub }, winners, room), POSTER_SIZE);
}

export async function saveWinnersPoster(event: MuseumEvent): Promise<void> {
  download(await winnersPosterBlob(event), `pip-hall-${slug(event.name)}-winners.png`);
}
