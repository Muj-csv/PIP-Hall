// Card editor → Museum (D-069): members with Museum access choose which approved projects hang in
// the Museum. Each switch saves at once and never sends the card back to review.

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { museumErrorMessage, museumService } from '../../services/museumService';
import type { DraftProject } from '../../types/draft';
import type { MyMuseum } from '../../types/museum';
import { Panel } from '../shell/MenuPage';

export function MuseumPanel({ projects }: { projects: DraftProject[] }) {
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
  const live = projects.filter((p) => p.id && state.live.includes(p.id));

  const toggle = async (p: DraftProject, on: boolean) => {
    const flip = (v: boolean) => setState((s) => (s ? { ...s, entries: v ? [...s.entries.filter((x) => x !== p.id), p.id!] : s.entries.filter((x) => x !== p.id) } : s));
    flip(on); // show it at once; undo if the database refuses
    setBusy(p.id!);
    setNotice(null);
    try {
      await museumService.set(p.id!, on);
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
        . Changes show right away and don’t need review.
      </p>
      {live.length === 0 ? (
        <p className="m-0 field-hint">Projects appear here once they’re on your approved card.</p>
      ) : (
        <ul className="grid gap-space-2 m-0 p-0 list-none">
          {live.map((p) => (
            <li key={p.key}>
              <label className="toggle">
                <input type="checkbox" checked={state.entries.includes(p.id!)} disabled={busy === p.id} onChange={(e) => void toggle(p, e.target.checked)} />
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
