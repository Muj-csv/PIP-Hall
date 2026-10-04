// The URL a card's QR code encodes (FR-12). Uses VITE_PUBLIC_ORIGIN so a QR printed from a
// preview deploy still points at production.

export function publicOrigin(): string {
  const env = import.meta.env.VITE_PUBLIC_ORIGIN;
  if (typeof env === 'string' && env.trim()) return env.trim().replace(/\/+$/, '');
  return typeof window !== 'undefined' ? window.location.origin : '';
}

export function memberPath(username: string): string {
  return `/member/${encodeURIComponent(username)}`;
}

export function memberUrl(username: string): string {
  return publicOrigin() + memberPath(username);
}

/** Printed under the QR like a card ID: PIP·001·SAM. */
export function serialFor(no: number, username: string): string {
  return `PIP·${String(no).padStart(3, '0')}·${username.slice(0, 3).toUpperCase()}`;
}
