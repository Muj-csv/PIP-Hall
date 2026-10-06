// PIP MART v1 (docs/plan/PIP-PROGRESSION-E2.md), with admin-made borders (D-087).

import type { FrameStyle, Gem, GemTone } from '../lib/rewards';

export interface MartItem {
  key: string;
  kind: 'frame';
  name: string;
  description: string;
  price: number;
  owned: boolean;
  /** False for reward-only borders: given with a badge, never sold. */
  for_sale?: boolean;
  /** A border designed in /admin; null or absent for the frames drawn in code. */
  style?: FrameStyle | null;
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

/** An affiliation that gives its members a free frame printed with its name (D-070). */
export interface Perk {
  key: string;
  name: string;
  /** e.g. "ACM MEMBER": printed on the frame. */
  label: string;
}

export interface MyMart {
  eligible: boolean;
  balance: number;
  items: MartItem[];
  perks: Perk[];
  equipped: { frame: string | null; affiliation: string | null };
}

/** What a badge wears: a frame key and, for perk frames, its printed label. */
export interface Appearance {
  frame: string;
  label: string | null;
  /** A designed border's look (D-087). */
  style?: FrameStyle | null;
}
