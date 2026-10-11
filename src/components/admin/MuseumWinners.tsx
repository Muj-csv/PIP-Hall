// Admin → Museum → Winners (V2-20, D-133): announcing an event's results no longer hangs its winners.
// Each winning project hangs when an admin hangs it here, one at a time or the whole event at once.
// Ribbons, the Champion title and the results news come from the results either way. Saves at once;
// the database checks is_admin() and that the project won at an announced event.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { awardLabel } from '../../lib/events';
import { exhibitPath, memberPath } from '../../lib/publicUrl';
import { museumErrorMessage, museumService } from '../../services/museumService';
import type { AdminWinner, AdminWinnerEvent } from '../../types/museum';
import { DialogueBox } from '../dialogue/DialogueBox';

export function MuseumWinners({ onDone }: { onDone: (message: string) => void }) {
  const [list, setList] = useState<AdminWinnerEvent[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    museumService
      .winners()
      .then((l) => on && setList(l))
      .catch((e) => on && setFailed(museumErrorMessage(e)));
    return () => {
      on = false;
    };
  }, [attempt]);

  const setHung = (season: string, ids: Set<string> | 'all' | 'none') =>
    setList((l) => l?.map((ev) => (ev.season_key !== season ? ev : { ...ev, winners: ev.winners.map((w) => ({ ...w, hung: ids === 'all' ? true : ids === 'none' ? false : ids.has(w.project_id) ? !w.hung : w.hung })) })) ?? l);

  const run = useCallback(async (move: () => Promise<unknown>, show: () => void, undo: () => void, message: string) => {
    show(); // at once; undone if the database refuses
    setBusy(true);
    setError(null);
    try {
      await move();
      onDone(message);
    } catch (e) {
      undo();
      setError(museumErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [onDone]);

  const one = (ev: AdminWinnerEvent, w: AdminWinner, on: boolean) => {
    const flip = () => setHung(ev.season_key, new Set([w.project_id]));
    void run(() => museumService.hangWinner(ev.season_key, w.project_id, on), flip, flip, on ? `${w.title} hangs in the Museum.` : `${w.title} left the Museum.`);
  };
  const all = (ev: AdminWinnerEvent, on: boolean) => {
    const before = new Map(ev.winners.map((w) => [w.project_id, w.hung]));
    void run(
      () => museumService.hangEvent(ev.season_key, on),
      () => setHung(ev.season_key, on ? 'all' : 'none'),
      () => setList((l) => l?.map((x) => (x.season_key !== ev.season_key ? x : { ...x, winners: x.winners.map((w) => ({ ...w, hung: before.get(w.project_id) ?? w.hung })) })) ?? l),
      on ? `Every winner of ${ev.event} hangs in the Museum.` : `${ev.event}’s winners left the Museum.`,
    );
  };

  return (
    <section className="grid gap-space-3" aria-labelledby="museum-winners-title">
      <h2 id="museum-winners-title" className="panel-title">
        Winners
      </h2>
      <p className="m-0 field-hint">
        Announcing an event’s results doesn’t hang its winners in the Museum: hang the ones you want here. Their ribbons, titles and the results news come from the results either way.
      </p>
      {error && (
        <p className="notice notice-bad m-0" role="status">
          <span aria-hidden="true">! </span>
          {error}
        </p>
      )}
      {list === null && !failed && <DialogueBox text="Reading the events’ results…" emote="pending" />}
      {failed && (
        <DialogueBox text={`Can’t read the winners. ${failed}`} emote="attention">
          <button type="button" className="hw-btn" data-variant="small" onClick={() => (setFailed(null), setAttempt((a) => a + 1))}>
            RETRY
          </button>
        </DialogueBox>
      )}
      {list && list.length === 0 && <DialogueBox text="No event has announced results yet. Winners show up here once an event’s results are announced (Events tab)." />}
      {list?.map((ev) => {
        const hung = ev.winners.filter((w) => w.hung).length;
        return (
          <section key={ev.season_key} className="menu-panel grid gap-space-2" aria-labelledby={`winners-${ev.season_key}`}>
            <h3 id={`winners-${ev.season_key}`} className="m-0 font-display font-normal">
              {ev.event}
            </h3>
            <p className="m-0 text-caption" role="status">
              {hung} of {ev.winners.length} {ev.winners.length === 1 ? 'winner hangs' : 'winners hang'} in the Museum
            </p>
            <div className="flex flex-wrap gap-space-2">
              <button type="button" className="pixel-btn" data-variant="primary" disabled={busy || hung === ev.winners.length} onClick={() => all(ev, true)}>
                Hang all<span className="sr-only"> winners of {ev.event}</span>
              </button>
              <button type="button" className="pixel-btn" disabled={busy || hung === 0} onClick={() => all(ev, false)}>
                Take all down<span className="sr-only"> for {ev.event}</span>
              </button>
            </div>
            <ul className="feature-list" aria-label={`Winners of ${ev.event}`}>
              {ev.winners.map((w) => (
                <li key={w.project_id} data-featured={w.hung || undefined}>
                  <label className="toggle">
                    <input type="checkbox" checked={w.hung} disabled={busy} onChange={(e) => one(ev, w, e.target.checked)} />
                    <span>
                      Hang <b>{w.title}</b>
                    </span>
                  </label>
                  <p className="m-0 text-caption">
                    ♛ {w.awards.map((a) => awardLabel(a)).join(' · ')}
                    {w.username && (
                      <>
                        {' '}
                        · by{' '}
                        <Link to={memberPath(w.username)} className="underline decoration-2">
                          {w.full_name ?? w.username}
                        </Link>
                      </>
                    )}
                    {w.hung && w.live && (
                      <>
                        {' '}
                        ·{' '}
                        <Link to={exhibitPath(w.project_id)} className="underline decoration-2">
                          see it
                        </Link>
                      </>
                    )}
                    {!w.live && <span className="text-text-secondary"> · not on its maker’s approved card, so it can’t show</span>}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </section>
  );
}
