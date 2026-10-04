// PIP MART v1 (docs/plan/PIP-PROGRESSION-E2.md).

export interface MartItem {
  key: string;
  kind: 'frame';
  name: string;
  description: string;
  price: number;
  owned: boolean;
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
}
