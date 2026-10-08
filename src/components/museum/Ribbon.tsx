// A winner's ribbon (D-116): a rosette with its place's number, or a star for a named award, drawn
// from original pixel art. Decorative: the words beside it say what it is.

import { ribbonOf, type Award } from '../../lib/events';
import { RIBBON_PALETTES, RIBBON_SPRITES } from '../../lib/sprites';
import { SpriteCanvas } from '../pixel/SpriteCanvas';

export function Ribbon({ award, className = 'ribbon-icon' }: { award: Pick<Award, 'place'>; className?: string }) {
  const kind = ribbonOf(award);
  return <SpriteCanvas sprite={RIBBON_SPRITES[kind]} palette={RIBBON_PALETTES[kind]} className={className} />;
}
