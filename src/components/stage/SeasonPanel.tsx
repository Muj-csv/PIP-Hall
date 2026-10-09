// The live event in the hall (V2-7, D-103): what it is, what really happened during it (counts
// from public hall_events), its Mission and its limited frame. Members claim the Mission's PIPs
// (the database checks it again); guests get it stamped on this device.
// Hackathons and building events (V2-9, D-115) also take entries: a member with a card in the
// hall enters one project on it (in a track, when the event has tracks) while submissions are open,
// and the panel says when they close, when results come, and leads to the event's Museum room.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useSession } from '../../app/sessionContext';
import { countdown, eventRoomPath, KIND_NAME, kindOf, manilaTime, phaseLine, takesEntries } from '../../lib/events';
import { missionMet } from '../../lib/missions';
import { countsLine, dateRange, seasonMission, seasonStart, type Season } from '../../lib/seasons';
import { usePassport } from '../../lib/usePassport';
import { eventErrorMessage, eventService } from '../../services/eventService';
import { missionService } from '../../services/missionService';
import { seasonErrorMessage, seasonService, type MySeason } from '../../services/seasonService';
import type { PublicCard } from '../../types/card';
import { SelectField } from '../editor/fields';

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
  const [account, setAccount] = useState<MySeason | null>(null);
  const [round, setRound] = useState(0);
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
  }, [round]);

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
  }, [live, me, round]);
  // After entering or withdrawing: the event's counts and my entry, fresh from the database.
  const reload = useCallback(() => {
    seasonService.refresh();
    setRound((r) => r + 1);
  }, []);

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
        {season.name} <span className="text-caption text-text-secondary">· {kindOf(season) !== 'event' && `${KIND_NAME[kindOf(season)]} · `}{dateRange(season.starts_on, season.ends_on)}</span>
      </h2>
      {season.blurb && <p className="m-0">{season.blurb}</p>}
      {season.counts && (
        <p className="m-0 font-display tracking-[0.04em]">
          <span className="sr-only">During {season.name} so far: </span>
          <span aria-hidden="true">So far: </span>
          {countsLine(season.counts, takesEntries(season))}
        </p>
      )}
      {takesEntries(season) && <EntryBlock season={season} me={me} mine={cards.find((c) => c.profile_id === me) ?? null} account={account} onChanged={reload} />}
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

/** Entering a hackathon or building event from the hall (D-115). The database checks it all again. */
function EntryBlock({ season, me, mine, account, onChanged }: { season: Season; me: string | null; mine: PublicCard | null; account: MySeason | null; onChanged: () => void }) {
  const tracks = season.tracks ?? [];
  const projects = (mine?.card.projects ?? []).filter((p): p is typeof p & { id: string } => Boolean(p.id));
  const entry = account?.submission ?? null;
  const entered = entry ? projects.find((p) => p.id === entry.project_id) : undefined;
  const [project, setProject] = useState('');
  const [track, setTrack] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);
  const pick = project || projects[0]?.id || '';
  const pickTrack = track || entry?.track || tracks[0] || '';

  const run = async (what: () => Promise<void>, done: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await what();
      setNotice({ text: done });
      onChanged();
    } catch (e) {
      setNotice({ text: eventErrorMessage(e), bad: true });
    } finally {
      setBusy(false);
    }
  };
  const trackOptions = tracks.map((t) => ({ value: t, label: t }));
  const open = season.phase === 'open';

  return (
    <div className="event-entry grid gap-space-2">
      <p className="m-0">
        <b>{phaseLine(season)}</b>
        {open && season.submissions_close && <span className="text-caption text-text-secondary"> ({manilaTime(season.submissions_close)}, Manila)</span>}
        {season.phase === 'judging' && season.results_at && <span className="text-caption text-text-secondary"> ({manilaTime(season.results_at)}, Manila)</span>}
      </p>
      {tracks.length > 0 && <p className="m-0 text-caption">Tracks: {tracks.join(' · ')}</p>}

      {open && !me && (
        <p className="m-0">
          Members with a card in the hall can enter a project.{' '}
          <Link to="/login" className="underline decoration-2">
            Sign in
          </Link>{' '}
          to make yours.
        </p>
      )}
      {open && me && !mine && (
        <p className="m-0">
          Entering opens once your card is approved.{' '}
          <Link to="/edit" className="underline decoration-2">
            Go to My card
          </Link>
        </p>
      )}
      {open && mine && projects.length === 0 && (
        <p className="m-0">
          Add the project to your card first; it can be entered once the card is approved.{' '}
          <Link to="/edit" className="underline decoration-2">
            Go to My card
          </Link>
        </p>
      )}
      {open && mine && account && !entry && projects.length > 0 && (
        <form
          className="grid gap-space-2"
          aria-label={`Enter a project in ${season.name}`}
          onSubmit={(e) => {
            e.preventDefault();
            const title = projects.find((p) => p.id === pick)?.title ?? 'Your project';
            void run(() => eventService.submit(season.key, pick, tracks.length ? pickTrack : null), `“${title}” is entered! If it wins, it hangs in the event’s room in the Museum.`);
          }}
        >
          <SelectField field="entry-project" label="Your project" value={pick} options={projects.map((p) => ({ value: p.id, label: p.title }))} onChange={setProject} />
          {tracks.length > 0 && <SelectField field="entry-track" label="Track" value={pickTrack} options={trackOptions} onChange={setTrack} />}
          <div>
            <button type="submit" className="pixel-btn" data-variant="primary" disabled={busy || !pick}>
              Enter it
            </button>
          </div>
        </form>
      )}
      {entry && (
        <div className="grid gap-space-2">
          <p className="m-0">
            <span aria-hidden="true">⚑ </span>Your entry: <b>{entered ? `“${entered.title}”` : 'your project'}</b>
            {entry.track && <> · {entry.track} track</>}
            {season.phase === 'judging' && ' · with the judges'}.
          </p>
          {open && (
            <div className="flex flex-wrap items-end gap-space-2">
              {tracks.length > 1 && (
                <>
                  <SelectField field="entry-move" label="Move to track" value={pickTrack} options={trackOptions} onChange={setTrack} />
                  <button
                    type="button"
                    className="pixel-btn"
                    disabled={busy || pickTrack === entry.track}
                    onClick={() => void run(() => eventService.submit(season.key, entry.project_id, pickTrack), `Moved to the ${pickTrack} track.`)}
                  >
                    Move
                  </button>
                </>
              )}
              <button type="button" className="pixel-btn" disabled={busy} onClick={() => void run(() => eventService.withdraw(season.key), 'Your entry is withdrawn. You can enter again until submissions close.')}>
                Withdraw
              </button>
            </div>
          )}
        </div>
      )}
      {season.phase === 'judging' && !entry && <p className="m-0 field-hint">Submissions are closed. The results come {countdown(season.results_at)}.</p>}
      {season.phase === 'results' ? (
        <p className="m-0">
          <Link to={eventRoomPath(season.key)} className="underline decoration-2">
            See the winners in the Museum
          </Link>
        </p>
      ) : (
        <p className="m-0 field-hint">The winners hang in the Museum once the results are announced.</p>
      )}
      {notice && (
        <p className={notice.bad ? 'notice notice-bad m-0' : 'notice m-0'} role="status">
          {notice.bad && <span aria-hidden="true">! </span>}
          {notice.text}
        </p>
      )}
    </div>
  );
}
