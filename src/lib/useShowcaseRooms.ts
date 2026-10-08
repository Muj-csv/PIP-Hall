// The Museum's rooms in the showcase's fixed order (V2-12), for the kiosk, the placards and the
// phone companion. Loads what the Museum page loads; event rooms, wings and the archive are extra,
// so if one can't be read the rest still opens (as on the Museum page).

import { useEffect, useMemo, useState } from 'react';
import { useAppearance } from '../app/appearanceContext';
import { archiveService } from '../services/archiveService';
import { eventService } from '../services/eventService';
import { museumService } from '../services/museumService';
import type { MuseumEvent } from './events';
import type { PlannedRoom } from './museumWalk';
import { officerUsernames } from './officers';
import { showcaseRooms, type MuseumData } from './showcase';
import { DEFAULT_WINGS } from './wings';

export type RoomsLoad = { status: 'loading' } | { status: 'error' } | { status: 'ready'; rooms: PlannedRoom[]; events: MuseumEvent[]; data: MuseumData };

/** Loads every exhibit, wing, event room and the archive (again when `attempt` changes). */
export function loadMuseumData(): Promise<MuseumData> {
  return Promise.all([
    museumService.exhibits(),
    museumService.wings().catch(() => [...DEFAULT_WINGS]),
    eventService.museumEvents().catch(() => []),
    archiveService.list().catch(() => []),
  ]).then(([exhibits, wings, events, archive]) => ({ exhibits, wings, events, archive }));
}

export function useShowcaseRooms(attempt = 0): RoomsLoad {
  const [got, setGot] = useState<{ attempt: number; data: MuseumData | 'error' } | null>(null);
  useEffect(() => {
    let on = true;
    loadMuseumData()
      .then((data) => on && setGot({ attempt, data }))
      .catch(() => on && setGot({ attempt, data: 'error' }));
    return () => {
      on = false;
    };
  }, [attempt]);
  const { officers } = useAppearance();
  const names = useMemo(() => officerUsernames(officers), [officers]);
  return useMemo<RoomsLoad>(() => {
    if (!got || got.attempt !== attempt) return { status: 'loading' };
    if (got.data === 'error') return { status: 'error' };
    return { status: 'ready', rooms: showcaseRooms(got.data, { officers: names }), events: [...got.data.events], data: got.data };
  }, [got, attempt, names]);
}
