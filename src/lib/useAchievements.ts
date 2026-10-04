import { useEffect, useState } from 'react';
import { pipService } from '../services/pipService';
import type { Achievement } from '../types/pips';
import { pipsEnabled } from './features';

/** A member's unlocked achievements (public, D-063). Empty while loading, when off, or on error. */
export function useAchievements(memberId: string): Achievement[] {
  const [state, setState] = useState<{ for: string; list: Achievement[] }>({ for: '', list: [] });
  useEffect(() => {
    if (!pipsEnabled) return;
    let on = true;
    Promise.all([pipService.catalog(), pipService.unlockedBy(memberId)])
      .then(([all, keys]) => on && setState({ for: memberId, list: all.filter((a) => keys.includes(a.key)) }))
      .catch(() => undefined);
    return () => {
      on = false;
    };
  }, [memberId]);
  return state.for === memberId ? state.list : [];
}
