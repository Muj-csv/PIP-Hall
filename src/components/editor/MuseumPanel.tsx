// Card editor → Museum (D-069, D-071): members with Museum access choose which approved projects
// hang in the Museum. The list is the approved card, not the draft: draft edits don't change the
// Museum until the card is approved again. Each switch saves at once and never resets review.

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { consoleFor } from '../../lib/museum';
import { CONSOLE_KINDS, CONSOLE_NAMES, consoleArt, type ConsoleKind } from '../../lib/sprites';
import { museumErrorMessage, museumService } from '../../services/museumService';
import type { MyMuseum } from '../../types/museum';
import { SpriteCanvas } from '../pixel/SpriteCanvas';
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

  const pickConsole = async (p: { id: string; title: string }, kind: ConsoleKind | null) => {
    const before = state.consoles ?? {};
    const set = (c: Record<string, ConsoleKind>) => setState((s) => (s ? { ...s, consoles: c } : s));
    const next = { ...before };
    if (kind) next[p.id] = kind;
    else delete next[p.id];
    set(next); // show it at once; undo if the database refuses
    setBusy(p.id);
    setNotice(null);
    try {
      await museumService.setConsole(p.id, kind);
      setNotice({ text: `${p.title} now hangs in ${kind ? `a PIXENDO ${CONSOLE_NAMES[kind]}` : 'a console picked for it'}.` });
    } catch (e) {
      set(before);
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
            <li key={p.id} className="grid gap-space-2">
              <label className="toggle">
                <input type="checkbox" checked={state.entries.includes(p.id)} disabled={busy === p.id} onChange={(e) => void toggle(p, e.target.checked)} />
                <span>
                  Show <b>{p.title}</b> in the Museum
                </span>
              </label>
              {state.entries.includes(p.id) && (
                <ConsolePicker
                  projectId={p.id}
                  title={p.title}
                  chosen={state.consoles?.[p.id] ?? null}
                  disabled={busy === p.id}
                  onPick={(k) => void pickConsole(p, k)}
                />
              )}
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

/** Pick the console an exhibit hangs in (D-091), with a live preview of it. */
function ConsolePicker({
  projectId,
  title,
  chosen,
  disabled,
  onPick,
}: {
  projectId: string;
  title: string;
  chosen: ConsoleKind | null;
  disabled: boolean;
  onPick: (kind: ConsoleKind | null) => void;
}) {
  const auto = consoleFor(projectId);
  const shown = chosen ?? auto;
  const art = consoleArt(shown);
  const id = `console-${projectId}`;
  return (
    <div className="console-picker">
      <SpriteCanvas sprite={art.sprite} palette={art.palette} className="console-preview" label={`Preview: PIXENDO ${CONSOLE_NAMES[shown]}`} />
      <div className="field min-w-0 flex-1">
        <label htmlFor={id} className="field-label">
          Console for {title}
        </label>
        <select id={id} className="pixel-input" value={chosen ?? ''} disabled={disabled} onChange={(e) => onPick((e.target.value || null) as ConsoleKind | null)}>
          <option value="">Automatic ({CONSOLE_NAMES[auto]})</option>
          {CONSOLE_KINDS.map((k) => (
            <option key={k} value={k}>
              {CONSOLE_NAMES[k]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
