import { useSyncExternalStore } from 'react';

const QUERY = '(min-width: 768px)';

function subscribe(onChange: () => void) {
  const q = window.matchMedia(QUERY);
  q.addEventListener('change', onChange);
  return () => q.removeEventListener('change', onChange);
}

/** True from tablet width up, where both faces of a badge fit side by side. */
export function useWide(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => true);
}
