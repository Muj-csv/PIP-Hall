// PIP MART v1 (docs/plan/PIP-PROGRESSION-E2.md), with admin-made borders (D-087).

import type { FrameStyle, Gem, GemTone } from '../lib/rewards';
import type { HallAward } from '../lib/events';
import type { PlateStyle } from '../lib/titles';

export interface MartItem {
  key: string;
  /** A badge frame, or a title plate (V2-5, D-101). */
  kind: 'frame' | 'plate';
  name: string;
  description: string;
  price: number;
  owned: boolean;
  /** False for reward-only borders: given with a badge, never sold. */
  for_sale?: boolean;
  /** A border designed in /admin (null or absent for the frames drawn in code), or a plate's look. */
  style?: FrameStyle | PlateStyle | null;
  /** An event's limited frame: the event's last day (YYYY-MM-DD) while it's on sale (D-103). */
  limited_until?: string | null;
}

/** Admin → Rewards: every border, with whether it is still offered. */
export interface AdminMartItem {
  key: string;
  name: string;
  description: string;
  price: number;
  for_sale: boolean;
  active: boolean;
  style: FrameStyle | null;
}

/** An admin-made badge pinned on a member's card. */
export interface Pin {
  key: string;
  name: string;
  gem: Gem;
  tone: GemTone;
}

/** An affiliation's frame design (V2-22, D-135): Member (metal), Diamond (blue) or Cat-eye (red). */
export type AffiliationFrame = 'member' | 'diamond' | 'cateye';

/** An affiliation that gives its members a free frame printed with its name (D-070). */
export interface Perk {
  key: string;
  name: string;
  /** Printed on the frame: NAME MEMBER on the Member design, the name as typed on the others. */
  label: string;
  /** The design an admin picked (V2-22); absent before that update, when every perk frame was Member. */
  design?: AffiliationFrame;
  /** The affiliation's logo, a Storage path (affiliation-logos bucket), carried in the frame's corner. */
  logo?: string | null;
}

/** One thing a member can wear on their badge's band (V2-22, D-134), with what's needed to draw it. */
export type BandItem =
  | { ref: string; kind: 'officer'; key: string; team: string; position: string | null }
  | ({ ref: string; kind: 'award' } & HallAward)
  | { ref: string; kind: 'pin'; key: string; name: string; logo: string }
  | { ref: string; kind: 'badge'; key: string; name: string; gem: Gem; tone: GemTone };

export interface MyMart {
  eligible: boolean;
  balance: number;
  items: MartItem[];
  perks: Perk[];
  equipped: { frame: string | null; affiliation: string | null; title?: string | null; plate?: string | null };
  /** The band the member chose, in order (null: the hall picks), and everything they could put on it (V2-22). */
  band?: string[] | null;
  band_items?: BandItem[];
}

/** What a badge wears: a frame key and, for perk frames, its printed label. */
export interface Appearance {
  frame: string;
  label: string | null;
  /** A designed border's look (D-087). */
  style?: FrameStyle | null;
  /** An affiliation frame's logo (V2-22): a Storage path in the affiliation-logos bucket. */
  logo?: string | null;
}
