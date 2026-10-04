import { useCallback, useEffect, useState } from 'react';
import { cardService } from '../services/cardService';
import type { PublicCard } from '../types/card';

export type CardsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; cards: PublicCard[] };

/** Loads the public collection; `retry` re-runs it after an error. */
export function useCards(): CardsState & { retry: () => void } {
  const [state, setState] = useState<CardsState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    cardService
      .listPublished()
      .then((cards) => live && setState({ status: 'ready', cards }))
      .catch((e: unknown) => live && setState({ status: 'error', message: e instanceof Error ? e.message : String(e) }));
    return () => {
      live = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((a) => a + 1);
  }, []);

  return { ...state, retry };
}
