// Admin → Affiliations (D-067): the labels admins give members, e.g. an organization or
// "CS Student". One can grant Museum access. Names are data, so the code stays brand-neutral.

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { affiliationKey, affiliationService, museumErrorMessage } from '../../services/museumService';
import type { Affiliation } from '../../types/museum';
import { DialogueBox } from '../dialogue/DialogueBox';
import { TextField, Toggle } from '../editor/fields';

export function AffiliationsManager({ onDone }: { onDone: (message: string) => void }) {
  const [list, setList] = useState<Affiliation[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState('');
  const [museum, setMuseum] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);

  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => {
    setFailed(false);
    setAttempt((a) => a + 1);
  }, []);
  useEffect(() => {
    let on = true;
    affiliationService
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
      setError(museumErrorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const key = affiliationKey(name);
    if (!name.trim() || key.length < 2) {
      setError('Give it a name with at least two letters or numbers.');
      return;
    }
    if (await run(() => affiliationService.save(key, name.trim(), museum), `Added ${name.trim()}.`)) {
      setName('');
      setMuseum(false);
    }
  };

  if (failed)
    return (
      <DialogueBox text="Can’t load affiliations right now." emote="attention">
        <button type="button" className="hw-btn" data-variant="small" onClick={reload}>
          RETRY
        </button>
      </DialogueBox>
    );
  if (!list) return <DialogueBox text="Loading affiliations…" emote="pending" />;

  return (
    <div className="grid gap-space-4">
      <section className="menu-panel" aria-labelledby="aff-list">
        <h2 id="aff-list" className="panel-title">
          Affiliations
        </h2>
        <p className="m-0 text-caption text-text-secondary">Give them to members from the Published tab. Members can’t give themselves one.</p>
        {list.length === 0 ? (
          <DialogueBox text="No affiliations yet. Add one below, such as your organization or “CS Student”." />
        ) : (
          <ul className="grid gap-space-2 m-0 p-0 list-none">
            {list.map((a) => (
              <li key={a.key} className="flex flex-wrap items-center gap-space-3">
                <b>◆ {a.name}</b>
                <span className="text-caption text-text-secondary">{a.grants_museum ? 'Museum access' : 'Label only'}</span>
                <button
                  type="button"
                  className="pixel-btn"
                  disabled={busy}
                  onClick={() => void run(() => affiliationService.save(a.key, a.name, !a.grants_museum), a.grants_museum ? `${a.name} no longer gives Museum access.` : `${a.name} now gives Museum access.`)}
                >
                  {a.grants_museum ? 'Remove Museum access' : 'Give Museum access'}
                </button>
                {confirm === a.key ? (
                  <>
                    <button type="button" className="pixel-btn" data-variant="primary" disabled={busy} onClick={() => void run(() => affiliationService.remove(a.key), `Deleted ${a.name}.`).then(() => setConfirm(null))}>
                      Yes, delete {a.name}
                    </button>
                    <button type="button" className="pixel-btn" onClick={() => setConfirm(null)}>
                      Keep it
                    </button>
                  </>
                ) : (
                  <button type="button" className="pixel-btn" onClick={() => setConfirm(a.key)}>
                    Delete…
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <form className="menu-panel" onSubmit={add} noValidate aria-labelledby="aff-new">
        <h2 id="aff-new" className="panel-title">
          New affiliation
        </h2>
        <TextField field="affiliation-name" label="Name" value={name} onChange={setName} max={40} error={error} hint="Shown on members’ profiles, e.g. “CS Student”." />
        <Toggle field="affiliation-museum" label="Gives Museum access" checked={museum} onChange={setMuseum} hint="Members with it can put their projects in the Museum." />
        <button type="submit" className="pixel-btn justify-self-start" data-variant="primary" disabled={busy}>
          Add affiliation
        </button>
      </form>
    </div>
  );
}

/** Published tab → a member's affiliations, switched on and off by the admin (D-068). */
export function MemberAffiliations({ memberId, name, onDone }: { memberId: string; name: string; onDone: (m: string) => void }) {
  const [all, setAll] = useState<Affiliation[] | null>(null);
  const [keys, setKeys] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    Promise.all([affiliationService.list(), affiliationService.keysOf(memberId)])
      .then(([a, k]) => {
        if (!on) return;
        setAll(a);
        setKeys(k);
      })
      .catch(() => on && setError('Can’t load affiliations right now.'));
    return () => {
      on = false;
    };
  }, [memberId]);

  if (error) return <p className="m-0 field-hint">{error}</p>;
  if (!all || all.length === 0) return null;
  return (
    <fieldset className="grid gap-space-2 border-0 p-0 m-0">
      <legend className="font-display tracking-[0.04em]">Affiliations</legend>
      {all.map((a) => (
        <label key={a.key} className="toggle">
          <input
            type="checkbox"
            checked={keys.includes(a.key)}
            onChange={async (e) => {
              const on = e.target.checked;
              const flip = (v: boolean) => setKeys((k) => (v ? [...k.filter((x) => x !== a.key), a.key] : k.filter((x) => x !== a.key)));
              flip(on); // show it at once; undo if the database refuses
              try {
                await affiliationService.setForMember(memberId, a.key, on);
                onDone(on ? `${name} is now ${a.name}.` : `${name} is no longer ${a.name}.`);
              } catch (err) {
                flip(!on);
                setError(museumErrorMessage(err));
              }
            }}
          />
          <span>
            {a.name}
            {a.grants_museum ? ' (Museum access)' : ''}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
