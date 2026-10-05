// Earned ranks on the badge (D-080): worked out from the approved card, never bought or random.
// Each rank has its own gem shape and a word, so it never depends on colour alone.

export type RankKey = 'member' | 'builder' | 'legend';

export interface Rank {
  key: RankKey;
  label: string;
  /** What it takes, for tooltips and the profile. */
  rule: string;
}

export const BUILDER_AT = 3;
export const LEGEND_AT = 6; // a full Quest Log

export const RANKS: Readonly<Record<RankKey, Rank>> = {
  member: { key: 'member', label: 'Member', rule: 'In the hall' },
  builder: { key: 'builder', label: 'Builder', rule: `${BUILDER_AT} or more projects` },
  legend: { key: 'legend', label: 'Legend', rule: `A full Quest Log: ${LEGEND_AT} projects` },
};

export function rankOf(projectCount: number): Rank {
  if (projectCount >= LEGEND_AT) return RANKS.legend;
  if (projectCount >= BUILDER_AT) return RANKS.builder;
  return RANKS.member;
}
