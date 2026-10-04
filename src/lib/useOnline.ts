import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** Real network state, for the power LED (brief §14: the LED only shows real states). */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine !== false, () => true);
}
