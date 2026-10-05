import { createContext, useContext } from 'react';
import type { Appearance } from '../types/mart';

interface AppearanceValue {
  of: (profileId: string) => Appearance | null;
  /** Reload after the member equips something. */
  refresh: () => void;
}

export const AppearanceContext = createContext<AppearanceValue>({ of: () => null, refresh: () => undefined });

export const useAppearance = () => useContext(AppearanceContext);
