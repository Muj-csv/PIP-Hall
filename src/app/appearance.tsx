// What every badge wears (E2): loaded once from card_appearances() when PIPs are on, so the hall,
// profiles and the editor preview all show members' frames, plus the admin-made badges pinned on
// them (card_pins(), D-087) and their titles (hall_titles(), D-101). Off, or on failure: plain badges.
// Ribbons from hall events (hall_awards(), D-116) aren't part of the PIP economy: always loaded.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { HallAward } from '../lib/events';
import { pipsEnabled } from '../lib/features';
import type { HallTitle } from '../lib/titles';
import { eventService } from '../services/eventService';
import { martService } from '../services/martService';
import type { Appearance, Pin } from '../types/mart';
import { AppearanceContext } from './appearanceContext';

const NO_AWARDS: HallAward[] = [];

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<ReadonlyMap<string, Appearance>>(() => new Map());
  const [pins, setPins] = useState<ReadonlyMap<string, Pin[]>>(() => new Map());
  const [titles, setTitles] = useState<ReadonlyMap<string, HallTitle>>(() => new Map());
  const [awards, setAwards] = useState<ReadonlyMap<string, HallAward[]>>(() => new Map());
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let on = true;
    eventService
      .hallAwards()
      .then((a) => on && setAwards(a))
      .catch(() => undefined); // a ribbon is decoration too
    return () => {
      on = false;
    };
  }, [attempt]);

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
    martService
      .titles()
      .then((t) => on && setTitles(t))
      .catch(() => undefined); // nor for titles (or before the identity update is run)
    return () => {
      on = false;
    };
  }, [attempt]);

  const refresh = useCallback(() => setAttempt((a) => a + 1), []);
  const value = useMemo(
    () => ({
      of: (profileId: string) => map.get(profileId) ?? null,
      pinsOf: (profileId: string) => pins.get(profileId) ?? [],
      titleOf: (profileId: string) => titles.get(profileId) ?? null,
      awardsOf: (profileId: string) => awards.get(profileId) ?? NO_AWARDS,
      refresh,
    }),
    [map, pins, titles, awards, refresh],
  );
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}
