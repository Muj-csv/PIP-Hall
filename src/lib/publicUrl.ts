// The URL a card's QR code encodes (FR-12). Uses VITE_PUBLIC_ORIGIN so a QR printed from a
// preview deploy still points at production.

export function publicOrigin(): string {
  const env = import.meta.env.VITE_PUBLIC_ORIGIN;
  if (typeof env === 'string' && env.trim()) return env.trim().replace(/\/+$/, '');
  return typeof window !== 'undefined' ? window.location.origin : '';
}

/** The hall itself, for the Share the hall QR (D-088). */
export function hallUrl(): string {
  return `${publicOrigin()}/`;
}

export function memberPath(username: string): string {
  return `/member/${encodeURIComponent(username)}`;
}

export function memberUrl(username: string): string {
  return publicOrigin() + memberPath(username);
}

/** What a badge's QR encodes: the member page, marked as a scan so it can greet the finder (V2-1). */
export function memberQrUrl(username: string): string {
  return `${memberUrl(username)}?via=qr`;
}

/** The approved badge as a PNG to save (D-095, a Vercel function; only where the hall has a backend). */
export function badgePngUrl(username: string): string | null {
  return import.meta.env.VITE_DATA_SOURCE === 'supabase' ? `/api/badge?u=${encodeURIComponent(username)}` : null;
}

/** Printed under the QR like a card ID: PIP·001·SAM. */
export function serialFor(no: number, username: string): string {
  return `PIP·${String(no).padStart(3, '0')}·${username.slice(0, 3).toUpperCase()}`;
}

/** A Museum exhibit's own page (D-073), shareable like a member page. */
export function exhibitPath(projectId: string): string {
  return `/museum/${encodeURIComponent(projectId)}`;
}

export function exhibitUrl(projectId: string): string {
  return publicOrigin() + exhibitPath(projectId);
}
