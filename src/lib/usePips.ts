// The signed-in member's PIPs for the hall (E1). Loads the balance and the achievement list once,
// and reports discoveries at most once per card per visit (the database pays once ever anyway).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from '../app/sessionContext';
import { pipService } from '../services/pipService';
import type { Achievement, DiscoverResult, PipSummary } from '../types/pips';
import { pipsEnabled } from './features';

export interface Pips {
  /** null until loaded, or when PIPs are off / signed out / it failed (the hall works without it). */
  summary: PipSummary | null;
  achievements: Achievement[];
  discover: (cardProfileId: string) => Promise<DiscoverResult | null>;
}

export function usePips(): Pips {
  const { session } = useSession();
  const userId = session.status === 'signed-in' ? session.user.id : null;
  const [summary, setSummary] = useState<PipSummary | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const asked = useRef(new Set<string>());
  const live = useRef<{ userId: string | null; summary: PipSummary | null }>({ userId, summary });
  useEffect(() => {
    live.current = { userId, summary };
  });

  useEffect(() => {
    asked.current.clear();
    if (!pipsEnabled || !userId) return;
    let on = true;
    Promise.all([pipService.summary(), pipService.catalog()])
      .then(([s, a]) => {
        if (!on) return;
        setSummary(s);
        setAchievements(a);
      })
      .catch(() => {
        // PIPs are extra: browsing never waits for them or breaks without them.
      });
    return () => {
      on = false;
      setSummary(null);
    };
  }, [userId]);

  const discover = useCallback(async (cardProfileId: string) => {
    const { userId: me, summary: s } = live.current;
    if (!pipsEnabled || !me || !s?.eligible || cardProfileId === me || asked.current.has(cardProfileId)) return null;
    asked.current.add(cardProfileId);
    try {
      const r = await pipService.discover(cardProfileId);
      setSummary((prev) => (prev ? { ...prev, balance: r.balance } : prev));
      return r;
    } catch {
      asked.current.delete(cardProfileId); // try again next time it's opened
      return null;
    }
  }, []);

  return { summary, achievements, discover };
}
