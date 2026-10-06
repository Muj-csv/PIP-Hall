import { createContext, useContext } from 'react';
import type { Appearance, Pin } from '../types/mart';

interface AppearanceValue {
  of: (profileId: string) => Appearance | null;
  /** Admin-made badges pinned on this member's card (D-087), newest first, at most three. */
  pinsOf: (profileId: string) => Pin[];
  /** Reload after the member equips something. */
  refresh: () => void;
}

export const AppearanceContext = createContext<AppearanceValue>({ of: () => null, pinsOf: () => [], refresh: () => undefined });

export const useAppearance = () => useContext(AppearanceContext);
