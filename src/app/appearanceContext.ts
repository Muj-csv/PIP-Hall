import { createContext, useContext } from 'react';
import type { HallAward } from '../lib/events';
import type { Officer } from '../lib/officers';
import type { HallTitle } from '../lib/titles';
import type { Appearance, Pin } from '../types/mart';

interface AppearanceValue {
  of: (profileId: string) => Appearance | null;
  /** Admin-made badges pinned on this member's card (D-087), newest first, at most three. */
  pinsOf: (profileId: string) => Pin[];
  /** Titles earned, the one worn and its plate (D-101); null before they load or when off. */
  titleOf: (profileId: string) => HallTitle | null;
  /** Places and awards this member's projects won at hall events (D-116), newest first. */
  awardsOf: (profileId: string) => HallAward[];
  /** Every project that won a place or an award (V2-13: the winning-exhibit Mission). */
  winners: ReadonlySet<string>;
  /** Every officer on record, current terms first (D-123). */
  officers: readonly Officer[];
  /** This member's current officer seat, if any. */
  officerOf: (profileId: string) => Officer | null;
  /** Reload after the member equips something. */
  refresh: () => void;
}

export const AppearanceContext = createContext<AppearanceValue>({
  of: () => null,
  pinsOf: () => [],
  titleOf: () => null,
  awardsOf: () => [],
  winners: new Set(),
  officers: [],
  officerOf: () => null,
  refresh: () => undefined,
});

export const useAppearance = () => useContext(AppearanceContext);
