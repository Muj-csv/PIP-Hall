// Status emote bubbles (brief §10). Shape carries the meaning, never colour alone, and the
// text label is always there for screen readers.

export type EmoteKind = 'pending' | 'attention' | 'approved' | 'featured';

const EMOTES: Record<EmoteKind, { glyph: string; label: string }> = {
  pending: { glyph: '…', label: 'Pending' },
  attention: { glyph: '!', label: 'Needs attention' },
  approved: { glyph: '♥', label: 'Approved' },
  featured: { glyph: '★', label: 'Featured' },
};

export function Emote({ kind }: { kind: EmoteKind }) {
  const e = EMOTES[kind];
  return (
    <span className="emote" data-kind={kind} role="img" aria-label={e.label}>
      {e.glyph}
    </span>
  );
}
