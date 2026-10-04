import type { PlacedSticker } from '../../lib/stickers';

const U = 4; // pixel unit in CSS px

/** A die-cut sticker slapped across the badge edge (brief §13). Text is repeated for screen readers on the card. */
export function Sticker({ sticker }: { sticker: PlacedSticker }) {
  const { spot } = sticker;
  const px = (v: number | undefined) => (v === undefined ? undefined : `${v * U}px`);
  return (
    <span
      className="sticker"
      data-tone={sticker.tone}
      aria-hidden="true"
      style={{ top: px(spot.top), bottom: px(spot.bottom), left: px(spot.left), right: px(spot.right), transform: `rotate(${spot.rotate}deg)` }}
    >
      {sticker.label}
    </span>
  );
}
