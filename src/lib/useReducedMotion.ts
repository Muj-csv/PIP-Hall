import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void) {
  const q = window.matchMedia(QUERY);
  q.addEventListener('change', onChange);
  return () => q.removeEventListener('change', onChange);
}

/** True when the visitor asked for less motion: no swing, jump, typing, iris or boot (brief §7). */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
