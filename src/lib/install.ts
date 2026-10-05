// Install support (FR-14). Chrome/Android fire `beforeinstallprompt` once, early, so it is caught
// at module load and kept; iOS has no prompt, so the UI shows Share → Add to Home Screen steps.

import { useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallMode = 'installed' | 'prompt' | 'ios' | 'unsupported';

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // we show our own button instead of the mini-infobar
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    emit();
  });
}

/** iPhone, iPad (including iPadOS that reports itself as a Mac) and iPod. */
export function isIOS(ua: string, maxTouchPoints: number): boolean {
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && maxTouchPoints > 1);
}

function standalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function installMode(): InstallMode {
  if (installed || standalone()) return 'installed';
  if (deferred) return 'prompt';
  if (isIOS(navigator.userAgent, navigator.maxTouchPoints)) return 'ios';
  return 'unsupported';
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const q = window.matchMedia('(display-mode: standalone)');
  q.addEventListener('change', cb);
  return () => {
    listeners.delete(cb);
    q.removeEventListener('change', cb);
  };
}

export function useInstallMode(): InstallMode {
  return useSyncExternalStore(subscribe, installMode, () => 'unsupported');
}

/** Shows the browser's install dialog. Resolves true if the visitor accepted. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  await e.prompt();
  const { outcome } = await e.userChoice;
  deferred = null; // a prompt event can be used once
  emit();
  return outcome === 'accepted';
}
