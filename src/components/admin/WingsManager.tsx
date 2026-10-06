// Admin → Wings (V2-6, D-102): the curators' side of the Museum. Each wing has a name, a short
// curator's note, and (for tag wings) the languages and tools that put an exhibit in it. Which
// exhibits hang in a wing is always worked out from the exhibits; admins never place them by hand.

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { affiliationKey, wingErrorMessage, wingService, type AdminWing } from '../../services/museumService';
import { DialogueBox } from '../dialogue/DialogueBox';
import { TextArea, TextField, Toggle } from '../editor/fields';

const splitTags = (s: string) => s.split(',').map((t) => t.trim()).filter(Boolean);

export function WingsManager({ onDone }: { onDone: (message: string) => void }) {
  const [list, setList] = useState<AdminWing[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');

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

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const key = affiliationKey(name);
    const ok = await run(
      () => wingService.save({ key, name: name.trim(), note: '', tags: splitTags(tags), sort: 100, active: true }),
      `${name.trim()} is open. Write its curator's note below.`,
    );
    if (ok) {
      setName('');
      setTags('');
    }
  };

  return (
    <section className="grid gap-space-3" aria-labelledby="wings-title">
      <h2 id="wings-title" className="panel-title">
        Museum wings
      </h2>
      <p className="m-0 field-hint">Wings fill themselves from the exhibits: a tag wing holds every exhibit whose language or tools name one of its tags. Empty wings stay hidden. No wing is ever behind PIPs.</p>
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
            </li>
          ))}
        </ul>
      )}
      <form className="menu-panel" onSubmit={(e) => void add(e)} aria-labelledby="new-wing">
        <h3 id="new-wing" className="panel-title">
          Open a new wing
        </h3>
        <TextField field="wing-name" label="Name" max={30} value={name} onChange={setName} placeholder="e.g. Mobile Wing" />
        <TextField field="wing-tags" label="Tags (comma-separated)" hint="Languages or tools, e.g. Kotlin, Swift, Flutter. Up to 12." value={tags} onChange={setTags} />
        <button type="submit" className="pixel-btn justify-self-start" data-variant="primary" disabled={busy || name.trim().length < 2 || splitTags(tags).length === 0}>
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
  const [confirm, setConfirm] = useState(false);
  const changed = name !== wing.name || note !== wing.note || tags !== wing.tags.join(', ') || open !== wing.active;
  const rule = wing.kind === 'featured' ? 'Holds exhibits by featured members.' : wing.kind === 'collab' ? 'Holds team projects.' : null;
  return (
    <div className="menu-panel" aria-label={wing.name}>
      <TextField field={`wing-${wing.key}-name`} label="Name" max={30} value={name} onChange={setName} />
      {rule ? <p className="m-0 field-hint">{rule}</p> : <TextField field={`wing-${wing.key}-tags`} label="Tags (comma-separated)" value={tags} onChange={setTags} />}
      <TextArea field={`wing-${wing.key}-note`} label="Curator’s note" max={280} hint="A sentence or two visitors read at the door. Leave empty for none." value={note} onChange={setNote} />
      <Toggle field={`wing-${wing.key}-open`} label="Open to visitors" checked={open} onChange={setOpen} />
      <div className="flex flex-wrap gap-space-2">
        <button
          type="button"
          className="pixel-btn"
          data-variant="primary"
          disabled={busy || !changed}
          onClick={() => onSave({ ...wing, name: name.trim(), note: note.trim(), tags: splitTags(tags), active: open }, `${name.trim()} saved.`)}
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
