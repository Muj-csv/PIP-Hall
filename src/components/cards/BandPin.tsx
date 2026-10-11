// One thing on a badge's band (V2-22, D-134), drawn the way the hall draws it: an officer pin, a
// ribbon, an admin-made badge's gem, or an affiliation's pin, which is the logo an admin uploaded.

import { ribbonOf } from '../../lib/events';
import { GEM_SPRITES, GEM_TONE_PALETTES, OFFICER_PIN, OFFICER_PIN_PALETTE, RIBBON_PALETTES, RIBBON_PIN_SPRITES } from '../../lib/sprites';
import { publicImageUrl } from '../../services/storageService';
import type { BandItem } from '../../types/mart';
import { SpriteCanvas } from '../pixel/SpriteCanvas';

export function BandPin({ item }: { item: BandItem }) {
  switch (item.kind) {
    case 'officer':
      return <SpriteCanvas sprite={OFFICER_PIN} palette={OFFICER_PIN_PALETTE} className="pin-ribbon" />;
    case 'award': {
      const kind = ribbonOf(item);
      return <SpriteCanvas sprite={RIBBON_PIN_SPRITES[kind]} palette={RIBBON_PALETTES[kind]} className="pin-ribbon" />;
    }
    case 'pin': {
      const src = publicImageUrl('affiliation-logos', item.logo);
      return src ? <img className="pin-logo" src={src} alt="" draggable={false} /> : null;
    }
    case 'badge':
      return <SpriteCanvas sprite={GEM_SPRITES[item.gem] ?? GEM_SPRITES.star!} palette={GEM_TONE_PALETTES[item.tone] ?? GEM_TONE_PALETTES.gold!} className="pin-gem" />;
  }
}
