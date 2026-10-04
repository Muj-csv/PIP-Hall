// A badge hanging on its lanyard against the sky, outside the hall (member page, admin review).

import { useState, type ReactNode } from 'react';
import type { PublicCard } from '../../types/card';
import { Lanyard } from './Lanyard';
import { MemberCard } from './MemberCard';

export function BadgeStage({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure className="m-0 grid justify-items-center gap-space-2">
      <div className="preview-stage w-full">
        <Lanyard />
        <div className="flipper">{children}</div>
      </div>
      <figcaption className="font-display text-caption tracking-[0.06em]">{label.toUpperCase()}</figcaption>
    </figure>
  );
}

/** One badge that flips between its faces, with a button that says which face it will show. */
export function FlipBadge({ card, label, onShowQr }: { card: PublicCard; label?: string; onShowQr: () => void }) {
  const [flipped, setFlipped] = useState(false);
  const face = flipped ? 'Quest Log' : 'Front';
  return (
    <div className="grid gap-space-2">
      <BadgeStage label={label ? `${label} · ${face}` : face}>
        <MemberCard card={card} flipped={flipped} focusable onActivate={() => setFlipped((f) => !f)} onShowQr={onShowQr} />
      </BadgeStage>
      <button type="button" className="pixel-btn justify-self-center" aria-pressed={flipped} onClick={() => setFlipped((f) => !f)}>
        {flipped ? 'Show front' : 'Show Quest Log'}
        {label && <span className="sr-only"> of the {label.toLowerCase()} card</span>}
      </button>
    </div>
  );
}
