// GET /api/badge?u=ada — a member's approved badge as a 1080×1350 PNG to save and post (D-095).
// Only published cards; a member with no approved card gets 404.

import { memberCard, originOf, storageImage } from './_lib/data.js';
import { badgePng, PNG_BADGE, photoBox, toPng } from './_lib/render.js';

export async function GET(request: Request): Promise<Response> {
  const username = new URL(request.url).searchParams.get('u') ?? '';
  const row = await memberCard(username);
  if (!row) return new Response('No approved card with that username.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const photo = await storageImage('avatars', row.card.avatar_path, (b) => toPng(b, photoBox(PNG_BADGE).w, photoBox(PNG_BADGE).h));
  const body = await badgePng(row, photo, `${originOf(request)}/member/${row.username}`);
  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="pip-hall-${row.username}.png"`,
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
