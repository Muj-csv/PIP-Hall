// GET /api/og[?member=ada | ?exhibit=<project id>] — the 1200×630 link-preview image (D-095).
// Anything unknown falls back to the hall's image, so a shared link always has a picture.

import { previewFor } from '../src/lib/preview.js';
import { exhibit, hallSize, memberCard, remoteImage, storageImage } from './_lib/data.js';
import { guard } from './_lib/guard.js';
import { exhibitOg, hallOg, memberOg, OG_BADGE, photoBox, toPng } from './_lib/render.js';

const png = (body: Buffer, maxAge = 3600) =>
  new Response(new Uint8Array(body), { headers: { 'Content-Type': 'image/png', 'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=604800` } });

export const GET = guard(async (request: Request): Promise<Response> => {
  const q = new URL(request.url).searchParams;
  const username = q.get('member');
  if (username) {
    const row = await memberCard(username);
    if (row) return png(await memberOg(row, await storageImage('avatars', row.card.avatar_path, (b) => toPng(b, photoBox(OG_BADGE).w, photoBox(OG_BADGE).h))));
  }
  const projectId = q.get('exhibit');
  if (projectId) {
    const e = await exhibit(projectId);
    if (e) {
      const cover = await storageImage('project-covers', e.project.cover_path, (b) => toPng(b, 640, 400));
      const p = previewFor(e.project, null);
      const picture = cover ?? (p.kind === 'github' ? await remoteImage(p.src, (b) => toPng(b, 640, 400)) : null);
      return png(await exhibitOg(e, picture));
    }
  }
  return png(await hallOg(await hallSize()), 600);
});
