import { useEffect, useState } from 'react';
import { affiliationService } from '../services/museumService';
import type { Affiliation } from '../types/museum';

/** A member's affiliations (public chips, D-068). Empty while loading or on error. */
export function useAffiliations(memberId: string): Affiliation[] {
  const [state, setState] = useState<{ for: string; list: Affiliation[] }>({ for: '', list: [] });
  useEffect(() => {
    let on = true;
    Promise.all([affiliationService.list(), affiliationService.keysOf(memberId)])
      .then(([all, keys]) => on && setState({ for: memberId, list: all.filter((a) => keys.includes(a.key)) }))
      .catch(() => undefined);
    return () => {
      on = false;
    };
  }, [memberId]);
  return state.for === memberId ? state.list : [];
}
