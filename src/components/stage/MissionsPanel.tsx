// Today's Missions above the device (V2-3, D-099). Each one points somewhere in the hall ("Go" runs
// the search, walks Pip to someone, or opens the Museum) so searching becomes the game. Progress
// comes from the Passport. Members claim PIPs (the database checks again); guests' finished
// Missions are stamped on this device.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useSession } from '../../app/sessionContext';
import { pipsEnabled } from '../../lib/features';
import { MISSION_PIPS, missionMet, missionPeriod, pickMissions, REROLL, type Mission } from '../../lib/missions';
import { usePassport } from '../../lib/usePassport';
import { missionErrorMessage, missionService, type MyMissions } from '../../services/missionService';
import { museumService } from '../../services/museumService';
import type { PublicCard } from '../../types/card';
import type { Exhibit } from '../../types/museum';

interface Props {
  cards: readonly PublicCard[];
  onSearch: (patch: { skill?: string; department?: string; q?: string }) => void;
  onRandom: () => void;
  /** The balance after a Mission paid, for the HUD. */
  onPips: (balance: number) => void;
}

const canUseAccount = pipsEnabled && import.meta.env.VITE_DATA_SOURCE === 'supabase';

export function MissionsPanel({ cards, onSearch, onRandom, onPips }: Props) {
  const { session } = useSession();
  const me = session.status === 'signed-in' ? session.user.id : null;
  const passport = usePassport();
  const [exhibits, setExhibits] = useState<Exhibit[] | null>(null);
  const [account, setAccount] = useState<MyMissions | null>(null);
  const [stored] = useState<string[]>(() => missionService.device.load());
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);
  const [now] = useState(() => new Date());

  useEffect(() => {
    let on = true;
    museumService
      .exhibits()
      .then((e) => on && setExhibits(e))
      .catch(() => on && setExhibits([])); // exhibit Missions just aren't offered
    return () => {
      on = false;
    };
  }, []);

  useEffect(() => {
    if (!canUseAccount || !me) return;
    let on = true;
    missionService
      .mine()
      .then((m) => on && setAccount(m.eligible ? m : null))
      .catch(() => undefined); // guest Missions still work
    return () => {
      on = false;
      setAccount(null);
    };
  }, [me]);

  const member = Boolean(account) && passport.mode === 'account';
  const day = account?.day ?? missionPeriod('daily', now).label;
  const week = account?.week ?? missionPeriod('weekly', now).label;
  const { daily, weekly } = useMemo(() => pickMissions(day, week, cards, exhibits ?? [], member ? me : null, member ? (account?.rerolls ?? 0) : 0), [day, week, cards, exhibits, member, me, account?.rerolls]);
  const all = weekly ? [...daily, weekly] : daily;
  const since = { daily: missionPeriod('daily', now).starts, weekly: missionPeriod('weekly', now).starts };
  // This panel holds the daily and weekly Missions; an event's Mission lives in the event panel.
  const period = (m: Mission) => (m.scope === 'weekly' ? 'weekly' : 'daily');
  const met = (m: Mission) => missionMet(m, passport.data, cards, since[period(m)]);
  // Guests: a Mission is done the moment the Passport shows it, and stays stamped on this device.
  const guestDone = member ? [] : all.filter((m) => stored.includes(m.key) || met(m)).map((m) => m.key);
  const guestKey = guestDone.join();
  useEffect(() => {
    if (!guestKey) return;
    const keep = missionService.device.load();
    const add = guestKey.split(',').filter((k) => !keep.includes(k));
    if (add.length) missionService.device.save([...keep, ...add]);
  }, [guestKey]);
  const done = new Set(member ? account!.done : guestDone);

  if (exhibits === null || all.length === 0) return null; // nothing the hall can offer yet

  const claim = async (m: Mission) => {
    setBusy(m.key);
    setNotice(null);
    try {
      const r = await missionService.complete(m);
      setAccount((a) => (a ? { ...a, done: [...a.done, r.key] } : a));
      onPips(r.balance);
      setNotice({ text: `Mission complete! +${r.amount} PIPs.` });
    } catch (e) {
      if (/ALREADY_DONE/.test((e as { message?: string })?.message ?? '')) setAccount((a) => (a ? { ...a, done: [...a.done, m.key] } : a));
      setNotice({ text: missionErrorMessage(e), bad: true });
    } finally {
      setBusy(null);
    }
  };

  const reroll = async () => {
    setBusy('reroll');
    setNotice(null);
    try {
      const r = await missionService.reroll();
      setAccount((a) => (a ? { ...a, rerolls: r.rerolls } : a));
      onPips(r.balance);
      setNotice({ text: `New Missions for today! −${REROLL.price} PIPs.` });
    } catch (e) {
      setNotice({ text: missionErrorMessage(e), bad: true });
    } finally {
      setBusy(null);
    }
  };
  const canReroll = member && (account?.rerolls ?? 0) < REROLL.perDay && daily.some((m) => !done.has(m.key));

  const row = (m: Mission) => {
    const finished = done.has(m.key);
    const ready = !finished && met(m);
    return (
      <li key={m.key} className="mission" data-state={finished ? 'done' : ready ? 'ready' : 'open'}>
        <span className="mission-mark" aria-hidden="true">
          {finished ? '✓' : ready ? '!' : '○'}
        </span>
        <span className="mission-text">
          {m.title}
          <span className="sr-only">{finished ? ' (done)' : ready ? ' (ready to claim)' : ''}</span>
          <span className="text-caption text-text-secondary">
            {' '}
            · {member ? `+${MISSION_PIPS[period(m)]} PIPs` : 'stamp'}
          </span>
        </span>
        {ready && member ? (
          <button type="button" className="pixel-btn" data-variant="primary" disabled={busy === m.key} onClick={() => void claim(m)}>
            Claim<span className="sr-only"> {m.title}</span>
          </button>
        ) : (
          !finished &&
          ('to' in m.action ? (
            <Link to={m.action.to} className="pixel-btn">
              Go<span className="sr-only">: {m.title}</span>
            </Link>
          ) : (
            <button
              type="button"
              className="pixel-btn"
              onClick={() => {
                const a = m.action;
                if ('search' in a) onSearch(a.search);
                else onRandom();
              }}
            >
              Go<span className="sr-only">: {m.title}</span>
            </button>
          ))
        )}
      </li>
    );
  };

  return (
    <section className="menu-panel missions-panel" aria-labelledby="missions-title">
      <h2 id="missions-title" className="panel-title">
        Missions <span className="text-caption text-text-secondary">· new ones every day at midnight (Manila)</span>
      </h2>
      <p className="m-0 font-display tracking-[0.04em]" aria-hidden="true">
        TODAY
      </p>
      <ul className="mission-list" aria-label="Today’s Missions">
        {daily.map(row)}
      </ul>
      {canReroll && (
        <button type="button" className="pixel-btn justify-self-start" disabled={busy === 'reroll'} onClick={() => void reroll()}>
          New set for today · {REROLL.price} PIPs
        </button>
      )}
      {weekly && (
        <>
          <p className="m-0 font-display tracking-[0.04em]" aria-hidden="true">
            THIS WEEK
          </p>
          <ul className="mission-list" aria-label="This week’s Mission">
            {row(weekly)}
          </ul>
        </>
      )}
      {notice && (
        <p className={notice.bad ? 'notice notice-bad m-0' : 'notice m-0'} role="status">
          {notice.bad && <span aria-hidden="true">! </span>}
          {notice.text}
        </p>
      )}
      {!member && (
        <p className="m-0 field-hint">
          Finished Missions are stamped on this device. Members with an approved card earn PIPs for them too.
        </p>
      )}
    </section>
  );
}
