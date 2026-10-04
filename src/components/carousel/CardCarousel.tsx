// Renders the badges that hang in view: the current one and two on each side (NFR-02). Their
// positions, scale and swing are written straight to the DOM by the level's animation loop.

import { visibleIndices } from '../../lib/carousel';
import type { PublicCard } from '../../types/card';
import { Lanyard } from '../cards/Lanyard';
import { MemberCard } from '../cards/MemberCard';

interface Props {
  cards: PublicCard[];
  index: number;
  near: number;
  isFlipped: (username: string) => boolean;
  slotRef: (i: number) => (el: HTMLDivElement | null) => void;
  onActivate: (i: number) => void;
  onOpen: () => void;
  onShowQr: (card: PublicCard) => void;
}

export function CardCarousel({ cards, index, near, isFlipped, slotRef, onActivate, onOpen, onShowQr }: Props) {
  const shown = [...new Set([...visibleIndices(index, cards.length), ...visibleIndices(near, cards.length)])];
  return (
    <div className="cards-layer">
      {shown.map((i) => {
        const card = cards[i]!;
        const current = i === index;
        return (
          <div
            key={card.username}
            ref={slotRef(i)}
            className="slot"
            role="group"
            aria-roledescription="slide"
            aria-label={`Player ${i + 1} of ${cards.length}: ${card.card.full_name}`}
            aria-hidden={current ? undefined : true}
          >
            <Lanyard />
            <div className="flipper">
              <MemberCard
                card={card}
                flipped={isFlipped(card.username)}
                focusable={current}
                onActivate={() => onActivate(i)}
                onOpen={onOpen}
                onShowQr={() => onShowQr(card)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Loading state: three blank badges hanging in place. */
export function SkeletonBadges() {
  return (
    <div className="cards-layer flex justify-center gap-space-4" style={{ top: 'calc(var(--p) * 20)' }} aria-hidden="true">
      {[0.84, 1, 0.84].map((scale, i) => (
        <div key={i} style={{ transform: `scale(${scale})`, transformOrigin: '50% 0', opacity: scale < 1 ? 0.88 : 1 }}>
          <Lanyard />
          <div className="badge" data-skeleton="true">
            <div className="holder">
              <span className="hole" />
              <div className="insert" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
