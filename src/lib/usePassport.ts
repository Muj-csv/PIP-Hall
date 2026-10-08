// One Passport for the whole app (V2-2): the hall stamps people, the exhibit page stamps exhibits,
// the check-in page stamps showcases (V2-12), the Passport screen reads them all. A small module store (no state library, CLAUDE.md) shared through
// useSyncExternalStore.
//
// Mode: an approved member with PIPs on keeps it in their account (people are stamped by the
// discovery the hall already reports; exhibits by stamp_exhibit). Everyone else keeps it on this
// device, and an approved member can bring a device Passport over as history (D-097).

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useSession } from '../app/sessionContext';
import { passportService } from '../services/passportService';
import { showcaseService } from '../services/showcaseService';
import { pipsEnabled } from './features';
import { EMPTY_PASSPORT, missingFrom, stamp, stampCheckin, type PassportData } from './passport';

interface State {
  /** Whose Passport is loaded ('' for a guest). */
  owner: string;
  mode: 'device' | 'account';
  /** The account's stamps, in account mode. */
  account: PassportData;
  device: PassportData;
  ready: boolean;
}

const canUseAccount = pipsEnabled && import.meta.env.VITE_DATA_SOURCE === 'supabase';
let state: State = { owner: '', mode: 'device', account: EMPTY_PASSPORT, device: EMPTY_PASSPORT, ready: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  for (const l of listeners) l();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
let loading: string | null = null;

function load(owner: string) {
  if (loading === owner || (state.ready && state.owner === owner)) return;
  loading = owner;
  const device = passportService.device.load();
  set({ owner, mode: 'device', account: EMPTY_PASSPORT, device, ready: !owner || !canUseAccount });
  if (!owner || !canUseAccount) {
    loading = null;
    return;
  }
  passportService
    .mine()
    .then((r) => {
      if (state.owner !== owner) return;
      set(r.eligible ? { mode: 'account', account: r.data, ready: true } : { ready: true });
    })
    .catch(() => state.owner === owner && set({ ready: true })) // the device Passport still works
    .finally(() => {
      if (loading === owner) loading = null;
    });
}

export interface Passport {
  mode: 'device' | 'account';
  data: PassportData;
  ready: boolean;
  /** Stamps on this device that an approved member could bring into their account. */
  importable: PassportData;
  stampPerson: (profileId: string) => void;
  stampExhibit: (projectId: string) => void;
  /** The showcase at an event (V2-12): in the account (the database checks the code again) or on
   *  this device. Throws if the database refuses it. True if it's a new stamp. */
  checkIn: (key: string, name: string, code: string) => Promise<boolean>;
  importDevice: () => Promise<number>;
}

export function usePassport(): Passport {
  const { session } = useSession();
  const owner = session.status === 'signed-in' ? session.user.id : session.status === 'loading' ? null : '';
  useEffect(() => {
    if (owner !== null) load(owner);
  }, [owner]);
  const s = useSyncExternalStore(subscribe, () => state, () => state);

  const stampPerson = useCallback((profileId: string) => {
    if (profileId === state.owner) return;
    if (state.mode === 'account') set({ account: stamp(state.account, 'people', profileId) }); // the hall's discovery records it
    else {
      const device = stamp(state.device, 'people', profileId);
      if (device !== state.device) {
        passportService.device.save(device);
        set({ device });
      }
    }
  }, []);

  const stampExhibit = useCallback((projectId: string) => {
    if (state.mode === 'account') {
      const account = stamp(state.account, 'exhibits', projectId);
      if (account === state.account) return;
      set({ account });
      void passportService.stampExhibit(projectId).catch(() => undefined); // shows again next load if it failed
    } else {
      const device = stamp(state.device, 'exhibits', projectId);
      if (device === state.device) return;
      passportService.device.save(device);
      set({ device });
    }
  }, []);

  const checkIn = useCallback(async (key: string, name: string, code: string) => {
    if (state.mode === 'account') {
      const fresh = await showcaseService.checkIn(key, code);
      const had = state.account.checkins.some((s) => s.id === key);
      // Fresh over an imported stamp: it counts now (D-127).
      const account = had
        ? { ...state.account, checkins: state.account.checkins.map((s) => (s.id === key && fresh ? { id: s.id, at: new Date().toISOString(), name: s.name } : s)) }
        : stampCheckin(state.account, key, name);
      set({ account });
      return fresh;
    }
    const device = stampCheckin(state.device, key, name);
    if (device === state.device) return false;
    passportService.device.save(device);
    set({ device });
    return true;
  }, []);

  const importDevice = useCallback(async () => {
    if (state.mode !== 'account') return 0;
    const extra = missingFrom(state.device, state.account);
    const r = await passportService.importDevice(extra);
    const fresh = await passportService.mine();
    passportService.device.save(EMPTY_PASSPORT); // it lives in the account now
    set({ account: fresh.data, device: EMPTY_PASSPORT });
    return r.people + r.exhibits + r.checkins;
  }, []);

  return {
    mode: s.mode,
    data: s.mode === 'account' ? s.account : s.device,
    ready: s.ready,
    importable: s.mode === 'account' ? missingFrom(s.device, s.account) : EMPTY_PASSPORT,
    stampPerson,
    stampExhibit,
    checkIn,
    importDevice,
  };
}
