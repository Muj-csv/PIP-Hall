import { SPR, CLIP_PALETTE } from '../../lib/sprites';
import { SpriteCanvas } from '../pixel/SpriteCanvas';

/** Woven strap and two-tone clip the badge hangs from. Decorative. */
export function Lanyard() {
  return (
    <>
      <span className="strap" aria-hidden="true" />
      <span className="clip" aria-hidden="true">
        <SpriteCanvas sprite={SPR.clip} palette={CLIP_PALETTE} />
      </span>
    </>
  );
}
