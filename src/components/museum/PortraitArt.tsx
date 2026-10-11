// A featured member's portrait in the Museum (V2-20, D-133): their real badge, on its front, drawn at
// a scale where its 4px art pixels land on whole pixels (D-132), so it stays sharp. Decorative: the
// plaque beside it names them and links to their profile, so the badge itself takes no focus.

import { BADGE_SCALES } from '../../lib/circles';
import type { PublicCard } from '../../types/card';
import { MemberCard } from '../cards/MemberCard';

/** The badge without its strap: 56 × 88u at 4px a unit. */
const W = 224;
const H = 352;

export function PortraitArt({ card, scale }: { card: PublicCard; scale: (typeof BADGE_SCALES)[number] }) {
  return (
    <span className="portrait-art" style={{ width: W * scale, height: H * scale }} aria-hidden="true" inert>
      <span className="portrait-hang" style={{ transform: `scale(${scale})` }}>
        <span className="flipper">
          <MemberCard card={card} flipped={false} focusable={false} onShowQr={() => undefined} />
        </span>
      </span>
    </span>
  );
}
