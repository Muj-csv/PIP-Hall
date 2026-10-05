// What every badge wears (E2): loaded once from card_appearances() when PIPs are on, so the hall,
// profiles and the editor preview all show members' frames. Off, or on failure: plain badges.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { pipsEnabled } from '../lib/features';
import { martService } from '../services/martService';
import type { Appearance } from '../types/mart';
import { AppearanceContext } from './appearanceContext';

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<ReadonlyMap<string, Appearance>>(() => new Map());
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!pipsEnabled) return;
    let on = true;
    martService
      .appearances()
      .then((m) => on && setMap(m))
      .catch(() => undefined); // a frame is decoration: never block the hall for it
    return () => {
      on = false;
    };
  }, [attempt]);

  const refresh = useCallback(() => setAttempt((a) => a + 1), []);
  const value = useMemo(() => ({ of: (profileId: string) => map.get(profileId) ?? null, refresh }), [map, refresh]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}
