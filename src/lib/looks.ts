// The affiliation looks (V2-22, D-135): what each frame design is called, and how a member's free
// affiliation frame is named in the Mart and in My Card → Customize.

import type { AffiliationFrame, Perk } from '../types/mart';

export const FRAME_NAME: Record<AffiliationFrame, string> = { member: 'Member', diamond: 'Diamond', cateye: 'Cat-eye' };

/** "Code Guild · Diamond frame" (the Member design keeps its printed label, "CODE GUILD MEMBER frame"). */
export function perkFrameName(p: Perk): string {
  const design = p.design ?? 'member';
  return design === 'member' ? `${p.label} frame` : `${p.name} · ${FRAME_NAME[design]} frame`;
}
