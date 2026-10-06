// What a chat app sees when someone shares a PIP-Hall link (D-095). Only link-preview crawlers get
// here (vercel.json routes them by user agent); people get the normal app.

/** Link-preview crawlers. Search engines are not here: they render the app like a person. */
export const PREVIEW_CRAWLERS = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'Slackbot',
  'Discordbot',
  'LinkedInBot',
  'WhatsApp',
  'TelegramBot',
  'SkypeUriPreview',
  'Pinterestbot',
  'redditbot',
  'Embedly',
  'vkShare',
  'Iframely',
  'Mastodon',
] as const;

/** The `has` header pattern vercel.json uses (kept in sync by a test). */
export const CRAWLER_PATTERN = `.*(${PREVIEW_CRAWLERS.join('|')}).*`;

export interface Meta {
  title: string;
  description: string;
  /** Absolute URL of the page being shared. */
  url: string;
  /** Absolute URL of the 1200×630 preview image. */
  image: string;
  imageAlt: string;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Trims to n characters on a word boundary, with an ellipsis. */
export function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), n * 0.6)).trimEnd()}…`;
}

export function previewHtml(m: Meta): string {
  const t = esc(m.title);
  const d = esc(m.description);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${t}</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${esc(m.url)}">
<meta property="og:site_name" content="PIP-Hall">
<meta property="og:type" content="website">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${esc(m.url)}">
<meta property="og:image" content="${esc(m.image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(m.imageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${esc(m.image)}">
</head>
<body><p><a href="${esc(m.url)}">${t}</a></p><p>${d}</p></body>
</html>`;
}
