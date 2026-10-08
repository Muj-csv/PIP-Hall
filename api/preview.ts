// GET /api/preview?path=/member/ada — the page a chat app's link-preview crawler reads (D-095).
// vercel.json sends only crawlers here; everyone else gets the app. Published data only.

import { creditLine } from '../src/lib/collab.js';
import { exhibit, memberCard, originOf } from './_lib/data.js';
import { guard } from './_lib/guard.js';
import { clip, previewHtml, type Meta } from './_lib/meta.js';

const TAGLINE = 'Where every person has a place.';

export async function metaFor(path: string, origin: string): Promise<Meta> {
  const hall: Meta = {
    title: 'PIP-Hall',
    description: `${TAGLINE} Meet the members of the hall: flip a badge to see what they build.`,
    url: `${origin}/`,
    image: `${origin}/api/og`,
    imageAlt: 'PIP-Hall: a pixel level with Pip, the host, under a row of blocks.',
  };
  const member = /^\/member\/([^/?#]+)\/?$/.exec(path);
  if (member) {
    const row = await memberCard(decodeURIComponent(member[1]!));
    if (!row) return hall;
    const c = row.card;
    const about = [c.role || c.tagline, c.skills.slice(0, 4).join(' · ')].filter(Boolean).join(' — ');
    return {
      title: `${c.full_name} · PIP-Hall`,
      description: clip(about || `${c.full_name} is in the hall. ${TAGLINE}`, 180),
      url: `${origin}/member/${row.username}`,
      image: `${origin}/api/og?member=${encodeURIComponent(row.username)}`,
      imageAlt: `${c.full_name}'s PIP-Hall badge`,
    };
  }
  const museum = /^\/museum\/([^/?#]+)\/?$/.exec(path);
  if (museum) {
    const e = await exhibit(decodeURIComponent(museum[1]!));
    if (!e) return { ...hall, title: 'Museum · PIP-Hall', url: `${origin}/museum` };
    const makers = (e.project.collaborators ?? []).map((m) => m.full_name);
    const by = `Made by ${e.full_name}${makers.length ? ` with ${creditLine(makers)}` : ''}.`;
    return {
      title: `${e.project.title} · PIP-Hall Museum`,
      description: clip([e.project.description, by].filter(Boolean).join(' '), 180),
      url: `${origin}/museum/${e.project_id}`,
      image: `${origin}/api/og?exhibit=${e.project_id}`,
      imageAlt: `${e.project.title} on a PIXENDO console in the PIP-Hall Museum`,
    };
  }
  if (path === '/museum' || path === '/museum/') return { ...hall, title: 'Museum · PIP-Hall', description: `Members' projects on original PIXENDO consoles. ${TAGLINE}`, url: `${origin}/museum` };
  return hall;
}

export const GET = guard(async (request: Request): Promise<Response> => {
  const path = new URL(request.url).searchParams.get('path') ?? '/';
  const html = previewHtml(await metaFor(path, originOf(request)));
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400' },
  });
});
