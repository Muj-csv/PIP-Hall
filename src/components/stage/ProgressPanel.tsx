// Your progress, in your own Passport only (V2-13, D-112): the Missions you've completed and the
// achievements you've unlocked, with the ones still to come and how to get them. Nobody else sees
// it, and the public profile never counts activity (rule 5). Guests see the Missions finished on
// this device; achievements belong to members.

import { useEffect, useState } from 'react';
import { pipsEnabled } from '../../lib/features';
import { missionService, type MissionProgress } from '../../services/missionService';
import { pipService } from '../../services/pipService';
import type { Achievement } from '../../types/pips';

interface Props {
  /** The member's profile id when their Passport is in their account; null for a guest. */
  member: string | null;
}

type Account = { missions: MissionProgress['missions']; all: Achievement[]; unlocked: string[] };

export function ProgressPanel({ member }: Props) {
  const [account, setAccount] = useState<Account | 'loading' | 'error' | null>(member && pipsEnabled ? 'loading' : null);
  const [device] = useState(() => missionService.device.load().length);

  useEffect(() => {
    if (!member || !pipsEnabled) return;
    let on = true;
    Promise.all([missionService.progress(), pipService.catalog(), pipService.unlockedBy(member)])
      .then(([p, all, unlocked]) => on && setAccount({ missions: p.missions, all, unlocked }))
      .catch(() => on && setAccount('error'));
    return () => {
      on = false;
    };
  }, [member]);

  const n = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`;
  return (
    <section className="menu-panel" aria-labelledby="pp-progress">
      <h3 id="pp-progress" className="panel-title">
        Your progress
      </h3>
      <p className="m-0 field-hint">Only you see this. Your profile shows what you’ve done, never how much.</p>
      {account === 'loading' && <p className="m-0">Counting…</p>}
      {account === 'error' && <p className="m-0">Can’t reach the hall right now, so your progress isn’t shown.</p>}
      {account === null && (
        <p className="m-0">
          {device > 0 ? `${n(device, 'Mission', 'Missions')} finished on this device.` : 'No Missions finished on this device yet.'} With a card in the hall, Missions pay PIPs and
          your progress follows you.
        </p>
      )}
      {account && typeof account === 'object' && (
        <>
          <p className="m-0">
            <b>{n(account.missions.total, 'Mission', 'Missions')} completed</b>
            {account.missions.total > 0 && (
              <span className="text-text-secondary">
                {' '}
                · {[n(account.missions.daily, 'daily', 'daily'), n(account.missions.weekly, 'weekly', 'weekly'), ...(account.missions.season ? [n(account.missions.season, 'event', 'event')] : [])].join(' · ')}
              </span>
            )}
          </p>
          <p className="m-0">
            <b>
              {account.unlocked.length} of {account.all.length} achievements
            </b>
          </p>
          <ul className="progress-list" aria-label="Achievements">
            {account.all.map((a) => {
              const got = account.unlocked.includes(a.key);
              return (
                <li key={a.key} data-got={got || undefined}>
                  <span className="progress-mark" aria-hidden="true">
                    {got ? '★' : '☆'}
                  </span>
                  <span>
                    <b>{a.name}</b>
                    <span className="sr-only">{got ? ', unlocked' : ', not yet'}</span>
                    <span className="block text-caption text-text-secondary">{a.description}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
