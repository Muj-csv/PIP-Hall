// Admin → Wings (V2-6, D-102): the curators' side of the Museum. Each wing has a name, a short
// curator's note, and (for tag wings) the languages and tools that put an exhibit in it. Since D-133
// admins can also hang exhibits in a wing by hand: a wing with no tools holds only those.
// In the walkable Museum (V2-11, D-125) each wing is a room: its style is picked here.

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { affiliationKey, museumErrorMessage, museumService, wingErrorMessage, wingService, type AdminWing } from '../../services/museumService';
import { archiveAsExhibit } from '../../lib/archive';
import { picksByWing } from '../../lib/curation';
import { loadMuseumData } from '../../lib/useShowcaseRooms';
import type { MuseumData } from '../../lib/showcase';
import { DialogueBox } from '../dialogue/DialogueBox';
import { ROOM_STYLES, wingStyle, type RoomStyle } from '../../lib/wings';
import { SelectField, TextArea, TextField, Toggle } from '../editor/fields';

const splitTags = (s: string) => s.split(',').map((t) => t.trim()).filter(Boolean);
const STYLE_HINT = 'How the room looks in the walkable Museum: its walls, floor and props. Looks only.';

export function WingsManager({ onDone }: { onDone: (message: string) => void }) {
  const [list, setList] = useState<AdminWing[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [style, setStyle] = useState<RoomStyle>('arcade');
  // What is on show, for hand-picking (D-133): featured projects, hung winners, the archive.
  const [museum, setMuseum] = useState<MuseumData | null>(null);

  const reload = useCallback(() => {
    setFailed(false);
    setAttempt((a) => a + 1);
  }, []);
  useEffect(() => {
    let on = true;
    wingService
      .list()
      .then((l) => on && setList(l))
      .catch(() => on && setFailed(true));
    loadMuseumData()
      .then((d) => on && setMuseum(d))
      .catch(() => on && setMuseum(null));
    return () => {
      on = false;
    };
  }, [attempt]);

  const run = async (move: () => Promise<void>, message: string) => {
    setBusy(true);
    setError(undefined);
    try {
      await move();
      onDone(message);
      reload();
      return true;
    } catch (e) {
      setError(wingErrorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onShow = useMemo(() => {
    if (!museum) return [];
    const seen = new Set<string>();
    return [...museum.exhibits, ...museum.events.flatMap((e) => e.entries), ...museum.archive.map(archiveAsExhibit)]
      .filter((x) => !seen.has(x.project_id) && (seen.add(x.project_id), true))
      .map((x) => ({ id: x.project_id, title: x.project.title, by: x.archive ? null : x.full_name }));
  }, [museum]);
  const picks = useMemo(() => (museum?.curation ? picksByWing(museum.curation) : new Map<string, string[]>()), [museum]);

  const savePicks = async (w: AdminWing, ids: string[]) => {
    setBusy(true);
    setError(undefined);
    try {
      await museumService.setWingPicks(w.key, ids);
      onDone(ids.length ? `${ids.length} hand-picked ${ids.length === 1 ? 'exhibit hangs' : 'exhibits hang'} in ${w.name}.` : `${w.name} has no hand-picked exhibits now.`);
      reload();
    } catch (e) {
      setError(museumErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const key = affiliationKey(name);
    const ok = await run(
      () => wingService.save({ key, name: name.trim(), note: '', tags: splitTags(tags), sort: 100, active: true, ...(style !== 'arcade' ? { style } : {}) }),
      `${name.trim()} is open. Write its curator's note below.`,
    );
    if (ok) {
      setName('');
      setTags('');
      setStyle('arcade');
    }
  };

  return (
    <section className="grid gap-space-3" aria-labelledby="wings-title">
      <h2 id="wings-title" className="panel-title">
        Museum wings
      </h2>
      <p className="m-0 field-hint">
        A tag wing holds every exhibit on show whose language or tools name one of its tags, plus any exhibits you hang in it by hand. A wing with no tags holds only those. Empty wings stay hidden. No wing is ever behind PIPs.
      </p>
      {error && (
        <p className="notice notice-bad m-0" role="status">
          <span aria-hidden="true">! </span>
          {error}
        </p>
      )}
      {failed && (
        <DialogueBox text="Can’t load the wings. If the wings update hasn’t been run yet, see the deploy guide." emote="attention">
          <button type="button" className="hw-btn" data-variant="small" onClick={reload}>
            RETRY
          </button>
        </DialogueBox>
      )}
      {!list && !failed && <DialogueBox text="Walking the wings…" emote="pending" />}
      {list && (
        <ul className="grid gap-space-3 m-0 p-0 list-none">
          {list.map((w) => (
            <li key={w.key}>
              <WingEditor wing={w} busy={busy} onSave={(next, msg) => void run(() => wingService.save(next), msg)} onRemove={() => void run(() => wingService.remove(w.key), `${w.name} is gone.`)} />
              {museum && <WingPicks key={(picks.get(w.key) ?? []).join()} wing={w} options={onShow} picked={picks.get(w.key) ?? []} busy={busy} onSave={(ids) => void savePicks(w, ids)} />}
            </li>
          ))}
        </ul>
      )}
      <form className="menu-panel" onSubmit={(e) => void add(e)} aria-labelledby="new-wing">
        <h3 id="new-wing" className="panel-title">
          Open a new wing
        </h3>
        <TextField field="wing-name" label="Name" max={30} value={name} onChange={setName} placeholder="e.g. Mobile Wing" />
        <TextField field="wing-tags" label="Tags (comma-separated)" hint="Languages or tools, e.g. Kotlin, Swift, Flutter. Up to 12. Leave empty for a wing you fill by hand." value={tags} onChange={setTags} />
        <SelectField field="wing-style" label="Room style" hint={STYLE_HINT} value={style} options={ROOM_STYLES} onChange={setStyle} />
        <button type="submit" className="pixel-btn justify-self-start" data-variant="primary" disabled={busy || name.trim().length < 2}>
          Open wing
        </button>
      </form>
    </section>
  );
}

function WingEditor({ wing, busy, onSave, onRemove }: { wing: AdminWing; busy: boolean; onSave: (w: AdminWing, msg: string) => void; onRemove: () => void }) {
  const [name, setName] = useState(wing.name);
  const [note, setNote] = useState(wing.note);
  const [tags, setTags] = useState(wing.tags.join(', '));
  const [open, setOpen] = useState(wing.active);
  const [style, setStyle] = useState<RoomStyle>(wingStyle(wing));
  const [confirm, setConfirm] = useState(false);
  const styleChanged = style !== wingStyle(wing);
  const changed = name !== wing.name || note !== wing.note || tags !== wing.tags.join(', ') || open !== wing.active || styleChanged;
  const rule =
    wing.kind === 'featured' ? 'Holds exhibits by featured members.' : wing.kind === 'collab' ? 'Holds team projects.' : wing.kind === 'officers' ? 'Holds exhibits by the current officers.' : null;
  return (
    <div className="menu-panel" aria-label={wing.name}>
      <TextField field={`wing-${wing.key}-name`} label="Name" max={30} value={name} onChange={setName} />
      {rule ? <p className="m-0 field-hint">{rule}</p> : <TextField field={`wing-${wing.key}-tags`} label="Tags (comma-separated)" value={tags} onChange={setTags} />}
      <TextArea field={`wing-${wing.key}-note`} label="Curator’s note" max={280} hint="A sentence or two visitors read at the door. Leave empty for none." value={note} onChange={setNote} />
      <SelectField field={`wing-${wing.key}-style`} label="Room style" hint={STYLE_HINT} value={style} options={ROOM_STYLES} onChange={setStyle} />
      <Toggle field={`wing-${wing.key}-open`} label="Open to visitors" checked={open} onChange={setOpen} />
      <div className="flex flex-wrap gap-space-2">
        <button
          type="button"
          className="pixel-btn"
          data-variant="primary"
          disabled={busy || !changed}
          onClick={() => onSave({ ...wing, name: name.trim(), note: note.trim(), tags: splitTags(tags), active: open, style: styleChanged ? style : undefined }, `${name.trim()} saved.`)}
        >
          Save<span className="sr-only"> {wing.name}</span>
        </button>
        {wing.kind === 'tags' &&
          (confirm ? (
            <>
              <button type="button" className="pixel-btn" disabled={busy} onClick={onRemove}>
                Yes, remove {wing.name}
              </button>
              <button type="button" className="pixel-btn" onClick={() => setConfirm(false)}>
                Keep it
              </button>
            </>
          ) : (
            <button type="button" className="pixel-btn" onClick={() => setConfirm(true)}>
              Remove<span className="sr-only"> {wing.name}</span>
            </button>
          ))}
      </div>
    </div>
  );
}

/** The exhibits an admin hangs in a wing by hand (D-133), in the order they were ticked. */
function WingPicks({ wing, options, picked, busy, onSave }: { wing: AdminWing; options: { id: string; title: string; by: string | null }[]; picked: string[]; busy: boolean; onSave: (ids: string[]) => void }) {
  const [ids, setIds] = useState(picked.filter((id) => options.some((o) => o.id === id)));
  const [q, setQ] = useState('');
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = options.filter((o) => ids.includes(o.id) || words.every((w) => `${o.title} ${o.by ?? ''}`.toLowerCase().includes(w)));
  const changed = ids.join() !== picked.filter((id) => options.some((o) => o.id === id)).join();
  return (
    <details className="menu-panel wing-picks">
      <summary className="font-display">
        Hand-picked exhibits in {wing.name} <span className="text-caption">· {ids.length}</span>
      </summary>
      {options.length === 0 ? (
        <p className="m-0 field-hint">Nothing is on show yet. Feature a project, hang a winner or publish the archive first.</p>
      ) : (
        <div className="grid gap-space-2">
          <TextField field={`wing-${wing.key}-find`} label="Find an exhibit" value={q} onChange={setQ} />
          <ul className="feature-list" aria-label={`Exhibits to hang in ${wing.name}`}>
            {shown.map((o) => (
              <li key={o.id} data-featured={ids.includes(o.id) || undefined}>
                <label className="toggle">
                  <input type="checkbox" checked={ids.includes(o.id)} disabled={busy || (!ids.includes(o.id) && ids.length >= 60)} onChange={(e) => setIds((l) => (e.target.checked ? [...l, o.id] : l.filter((x) => x !== o.id)))} />
                  <span>
                    <b>{o.title}</b>
                    {o.by && <span className="text-caption"> · by {o.by}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button type="button" className="pixel-btn justify-self-start" data-variant="primary" disabled={busy || !changed} onClick={() => onSave(ids)}>
            Save the picks<span className="sr-only"> for {wing.name}</span>
          </button>
        </div>
      )}
    </details>
  );
}
