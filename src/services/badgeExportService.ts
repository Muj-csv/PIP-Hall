// Save badge (PNG), drawn in the browser (D-095, fixed in D-104). The same drawing as the server's
// (lib/shareArt.ts), laid out by satori and painted on a canvas (artRenderer), so saving a badge
// doesn't depend on a server function. Loaded only when someone presses the button. The photo is
// the member's public avatar, as approved.

import { memberUrl } from '../lib/publicUrl';
import { PNG_BADGE, PNG_SIZE, photoBox } from '../lib/shareArt';
import type { PublishedCardRow } from '../types/card';
import { coverDataUrl, download, renderPng } from './artRenderer';
import { publicImageUrl } from './storageService';

/** Draws the badge PNG (1080×1350). */
export async function badgePngBlob(card: PublishedCardRow): Promise<Blob> {
  const { w, h } = photoBox(PNG_BADGE);
  const picture = await coverDataUrl(publicImageUrl('avatars', card.card.avatar_path), w, h);
  return renderPng((a) => a.badgePng(card, picture, memberUrl(card.username)), PNG_SIZE);
}

/** Draws the badge and hands it to the browser as a download. */
export async function saveBadge(card: PublishedCardRow): Promise<void> {
  download(await badgePngBlob(card), `pip-hall-${card.username}.png`);
}
