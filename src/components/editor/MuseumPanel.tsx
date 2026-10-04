// Card editor → Museum (D-069, D-071): members with Museum access choose which approved projects
// hang in the Museum. The list is the approved card, not the draft: draft edits don't change the
// Museum until the card is approved again. Each switch saves at once and never resets review.

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { museumErrorMessage, museumService } from '../../services/museumService';
import type { MyMuseum } from '../../types/museum';
import { Panel } from '../shell/MenuPage';

export function MuseumPanel() {
  const [state, setState] = useState<MyMuseum | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);

  useEffect(() => {
    let on = true;
    museumService
      .mine()
      .then((m) => on && setState(m))
      .catch(() => undefined); // the panel simply stays hidden
    return () => {
      on = false;
    };
  }, []);

  if (!state?.access) return null;
  const live = state.projects;

  const toggle = async (p: { id: string; title: string }, on: boolean) => {
    const flip = (v: boolean) => setState((s) => (s ? { ...s, entries: v ? [...s.entries.filter((x) => x !== p.id), p.id] : s.entries.filter((x) => x !== p.id) } : s));
    flip(on); // show it at once; undo if the database refuses
    setBusy(p.id);
    setNotice(null);
    try {
      await museumService.set(p.id, on);
      setNotice({ text: on ? `${p.title} is in the Museum.` : `${p.title} left the Museum.` });
    } catch (e) {
      flip(!on);
      setNotice({ text: museumErrorMessage(e), bad: true });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel label="Museum">
      <h2 className="panel-title">Museum</h2>
      <p className="m-0">
        Pick which of your projects hang in the{' '}
        <Link to="/museum" className="underline decoration-2">
          Museum
        </Link>
        . Changes show right away and don’t need review. The Museum shows your projects as they were
        approved; edits and new projects join after your card is approved again.
      </p>
      {live.length === 0 ? (
        <p className="m-0 field-hint">Your approved card has no projects yet. Add one and submit your card: once it’s approved, it shows up here.</p>
      ) : (
        <ul className="grid gap-space-2 m-0 p-0 list-none">
          {live.map((p) => (
            <li key={p.id}>
              <label className="toggle">
                <input type="checkbox" checked={state.entries.includes(p.id)} disabled={busy === p.id} onChange={(e) => void toggle(p, e.target.checked)} />
                <span>
                  Show <b>{p.title}</b> in the Museum
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {notice && (
        <p className={notice.bad ? 'notice notice-bad m-0' : 'notice m-0'} role="status">
          {notice.bad && <span aria-hidden="true">! </span>}
          {notice.text}
        </p>
      )}
    </Panel>
  );
}
