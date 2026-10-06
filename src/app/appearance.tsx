// What every badge wears (E2): loaded once from card_appearances() when PIPs are on, so the hall,
// profiles and the editor preview all show members' frames, plus the admin-made badges pinned on
// them (card_pins(), D-087). Off, or on failure: plain badges.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { pipsEnabled } from '../lib/features';
import { martService } from '../services/martService';
import type { Appearance, Pin } from '../types/mart';
import { AppearanceContext } from './appearanceContext';

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<ReadonlyMap<string, Appearance>>(() => new Map());
  const [pins, setPins] = useState<ReadonlyMap<string, Pin[]>>(() => new Map());
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!pipsEnabled) return;
    let on = true;
    martService
      .appearances()
      .then((m) => on && setMap(m))
      .catch(() => undefined); // a frame is decoration: never block the hall for it
    martService
      .pins()
      .then((p) => on && setPins(p))
      .catch(() => undefined); // nor for badges (or before the admin-rewards update is run)
    return () => {
      on = false;
    };
  }, [attempt]);

  const refresh = useCallback(() => setAttempt((a) => a + 1), []);
  const value = useMemo(
    () => ({ of: (profileId: string) => map.get(profileId) ?? null, pinsOf: (profileId: string) => pins.get(profileId) ?? [], refresh }),
    [map, pins, refresh],
  );
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}
