// Exhibits you can play (V2-23, D-136): each exhibit's cartridge is drawn from its own data. The
// label's stripe takes its colour from the project's language (the same language, the same colour,
// in every room), from the badge's own tokens; a project with no language gets plain metal.

export const STRIPE_TONES = ['sky', 'hill', 'plum', 'block', 'lanyard', 'coin', 'band', 'deep-blue', 'signal-red', 'grass'] as const;
export type StripeTone = (typeof STRIPE_TONES)[number] | 'metal';

/** The stripe's tone for a language: a small, stable hash of its name. */
export function stripeTone(language: string | null | undefined): StripeTone {
  const name = (language ?? '').trim().toLowerCase();
  if (!name) return 'metal';
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return STRIPE_TONES[h % STRIPE_TONES.length]!;
}

/** Where PRESS START leads: the live project, else its code, else nowhere (said in words). */
export function startLink(p: { project_url: string | null; github_url: string | null }): { href: string; what: 'live' | 'code' } | null {
  if (p.project_url) return { href: p.project_url, what: 'live' };
  if (p.github_url) return { href: p.github_url, what: 'code' };
  return null;
}
