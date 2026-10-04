// PIP Progression E1 (docs/plan/PIP-PROGRESSION-E1.md).

export type PipReason = 'first_approval' | 'project_live' | 'discover' | 'achievement';

export interface PipSummary {
  /** Has a card in the hall, so can earn (D-059). */
  eligible: boolean;
  balance: number;
}

export interface DiscoverResult {
  granted: boolean;
  /** First time this member opened that card. */
  new?: boolean;
  amount: number;
  unlocked: string[];
  balance: number;
}

export interface LedgerEntry {
  id: number;
  amount: number;
  reason: PipReason;
  ref: string;
  created_at: string;
}

export interface Achievement {
  key: string;
  name: string;
  description: string;
  reward: number;
}
