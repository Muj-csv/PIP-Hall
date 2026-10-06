import { createContext, useContext } from 'react';
import type { HallTitle } from '../lib/titles';
import type { Appearance, Pin } from '../types/mart';

interface AppearanceValue {
  of: (profileId: string) => Appearance | null;
  /** Admin-made badges pinned on this member's card (D-087), newest first, at most three. */
  pinsOf: (profileId: string) => Pin[];
  /** Titles earned, the one worn and its plate (D-101); null before they load or when off. */
  titleOf: (profileId: string) => HallTitle | null;
  /** Reload after the member equips something. */
  refresh: () => void;
}

export const AppearanceContext = createContext<AppearanceValue>({ of: () => null, pinsOf: () => [], titleOf: () => null, refresh: () => undefined });

export const useAppearance = () => useContext(AppearanceContext);
