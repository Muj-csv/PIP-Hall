// The live event in the hall (V2-7, D-103): what it is, what really happened during it (counts
// from public hall_events), its Mission and its limited frame. Members claim the Mission's PIPs
// (the database checks it again); guests get it stamped on this device.

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useSession } from '../../app/sessionContext';
import { missionMet } from '../../lib/missions';
import { countsLine, dateRange, seasonMission, seasonStart, type Season } from '../../lib/seasons';
import { usePassport } from '../../lib/usePassport';
import { missionService } from '../../services/missionService';
import { seasonErrorMessage, seasonService } from '../../services/seasonService';
import type { PublicCard } from '../../types/card';

interface Props {
  cards: readonly PublicCard[];
  onSearch: (patch: { skill?: string; department?: string; q?: string }) => void;
  onRandom: () => void;
  onPips: (balance: number) => void;
}

export function SeasonPanel({ cards, onSearch, onRandom, onPips }: Props) {
  const { session } = useSession();
  const me = session.status === 'signed-in' ? session.user.id : null;
  const passport = usePassport();
  const [season, setSeason] = useState<Season | null>(null);
  const [account, setAccount] = useState<{ eligible: boolean; done: boolean } | null>(null);
  const [stored] = useState<string[]>(() => missionService.device.load());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);

  useEffect(() => {
    let on = true;
    seasonService
      .current()
      .then((s) => on && setSeason(s.live))
      .catch(() => undefined);
    return () => {
      on = false;
    };
  }, []);

  const live = season?.key ?? null;
  useEffect(() => {
    if (!live || !me) return;
    let on = true;
    seasonService
      .mine()
      .then((m) => on && setAccount(m.eligible ? m : null))
      .catch(() => undefined); // the guest version still works
    return () => {
      on = false;
      setAccount(null);
    };
  }, [live, me]);

  // Arriving from the banner (/#event): bring the panel into view once it's here.
  useEffect(() => {
    if (live && window.location.hash === '#event') document.getElementById('event')?.scrollIntoView({ block: 'start' });
  }, [live]);

  const mission = season ? seasonMission(season) : null;
  const met = Boolean(season && mission && missionMet(mission, passport.data, cards, seasonStart(season)));
  const member = Boolean(account) && passport.mode === 'account';
  const guestDone = !member && Boolean(mission) && (stored.includes(mission!.key) || met);
  const guestKey = guestDone ? mission!.key : '';
  useEffect(() => {
    if (!guestKey) return;
    const keep = missionService.device.load();
    if (!keep.includes(guestKey)) missionService.device.save([...keep, guestKey]);
  }, [guestKey]);

  if (!season) return null;
  const done = member ? account!.done : guestDone;
  const ready = !done && met;

  const claim = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const r = await seasonService.complete();
      setAccount((a) => (a ? { ...a, done: true } : a));
      onPips(r.balance);
      setNotice({ text: `Event Mission complete! +${r.amount} PIPs.` });
    } catch (e) {
      if (/ALREADY_DONE/.test((e as { message?: string })?.message ?? '')) setAccount((a) => (a ? { ...a, done: true } : a));
      setNotice({ text: seasonErrorMessage(e), bad: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="event" className="menu-panel season-panel" aria-labelledby="event-title">
      <h2 id="event-title" className="panel-title">
        <span aria-hidden="true">★ </span>
        {season.name} <span className="text-caption text-text-secondary">· {dateRange(season.starts_on, season.ends_on)}</span>
      </h2>
      {season.blurb && <p className="m-0">{season.blurb}</p>}
      {season.counts && (
        <p className="m-0 font-display tracking-[0.04em]">
          <span className="sr-only">During {season.name} so far: </span>
          <span aria-hidden="true">So far: </span>
          {countsLine(season.counts)}
        </p>
      )}
      {mission && season.mission && (
        <ul className="mission-list" aria-label="Event Mission">
          <li className="mission" data-state={done ? 'done' : ready ? 'ready' : 'open'}>
            <span className="mission-mark" aria-hidden="true">
              {done ? '✓' : ready ? '!' : '○'}
            </span>
            <span className="mission-text">
              {mission.title}
              <span className="sr-only">{done ? ' (done)' : ready ? ' (ready to claim)' : ''}</span>
              <span className="text-caption text-text-secondary"> · {member ? `+${season.mission.reward} PIPs, once` : 'stamp'}</span>
            </span>
            {ready && member ? (
              <button type="button" className="pixel-btn" data-variant="primary" disabled={busy} onClick={() => void claim()}>
                Claim<span className="sr-only"> {mission.title}</span>
              </button>
            ) : (
              !done &&
              ('to' in mission.action ? (
                <Link to={mission.action.to} className="pixel-btn">
                  Go<span className="sr-only">: {mission.title}</span>
                </Link>
              ) : (
                <button
                  type="button"
                  className="pixel-btn"
                  onClick={() => {
                    const a = mission.action;
                    if ('search' in a) onSearch(a.search);
                    else onRandom();
                  }}
                >
                  Go<span className="sr-only">: {mission.title}</span>
                </button>
              ))
            )}
          </li>
        </ul>
      )}
      {season.frame && (
        <p className="m-0">
          <span aria-hidden="true">◆ </span>
          Limited: the <b>{season.frame.name}</b> is in the{' '}
          <Link to="/mart" className="underline decoration-2">
            PIP MART
          </Link>{' '}
          until {dateRange(season.ends_on, season.ends_on)} only.
        </p>
      )}
      {notice && (
        <p className={notice.bad ? 'notice notice-bad m-0' : 'notice m-0'} role="status">
          {notice.bad && <span aria-hidden="true">! </span>}
          {notice.text}
        </p>
      )}
    </section>
  );
}
