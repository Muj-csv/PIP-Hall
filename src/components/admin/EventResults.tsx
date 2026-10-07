// Admin → Events → Results (V2-9, D-116): the entries of a hackathon or building event, the places
// and named awards the judges chose (each with a short note), and the announcement. Awards can be
// recorded once submissions close; announcing tells the hall and every winning maker, once, and
// after that only a judges' note can be corrected. The database checks every step again.

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { awardLabel, awardOrder, manilaTime } from '../../lib/events';
import { eventErrorMessage, eventService, type AdminResults } from '../../services/eventService';
import type { AdminSeason } from '../../services/seasonService';
import { DialogueBox } from '../dialogue/DialogueBox';
import { SelectField, TextArea, TextField } from '../editor/fields';

type Which = '1' | '2' | '3' | 'named';
const WHICH: readonly { value: Which; label: string }[] = [
  { value: '1', label: '1st place' },
  { value: '2', label: '2nd place' },
  { value: '3', label: '3rd place' },
  { value: 'named', label: 'A named award' },
];
interface Form {
  which: Which;
  name: string;
  track: string;
  project: string;
  note: string;
}
const EMPTY: Form = { which: '1', name: '', track: '', project: '', note: '' };

export function EventResults({ event, onAnnounced }: { event: AdminSeason; onAnnounced: (message: string) => void }) {
  const [data, setData] = useState<AdminResults | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState<{ id: number; note: string } | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const reload = useCallback(() => {
    setFailed(false);
    setAttempt((a) => a + 1);
  }, []);
  useEffect(() => {
    let on = true;
    eventService
      .results(event.key)
      .then((r) => on && setData(r))
      .catch(() => on && setFailed(true));
    return () => {
      on = false;
    };
  }, [event.key, attempt]);

  const run = async (what: () => Promise<void>, done: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await what();
      setNotice({ text: done });
      reload();
      return true;
    } catch (e) {
      setNotice({ text: eventErrorMessage(e), bad: true });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const tracks = event.tracks ?? [];
  const announced = Boolean(data?.announced_at);
  const judging = event.phase === 'judging' && !announced;
  const titleOf = (id: string) => {
    const e = data?.entries.find((x) => x.project_id === id);
    return e ? `“${e.title ?? 'Untitled'}” by ${e.full_name}` : 'a project no longer entered';
  };
  // Track awards go to entries in that track; only projects still on a card can be shown.
  const eligible = (data?.entries ?? []).filter((e) => e.on_card && (!form.track || e.track === form.track));
  const project = eligible.some((e) => e.project_id === form.project) ? form.project : (eligible[0]?.project_id ?? '');

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const named = form.which === 'named';
    const ok = await run(
      () => eventService.saveAward(event.key, { projectId: project, place: named ? null : Number(form.which), name: named ? form.name.trim() : null, track: form.track || null, note: form.note.trim() }),
      `${awardLabel({ place: named ? null : (Number(form.which) as 1 | 2 | 3), name: form.name.trim(), track: form.track || null })} recorded.`,
    );
    if (ok) setForm((f) => ({ ...EMPTY, track: f.track }));
  };

  const announce = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const r = await eventService.announce(event.key);
      setConfirming(false);
      onAnnounced(`The results of ${event.name} are announced. ${r.makers} ${r.makers === 1 ? 'maker hears' : 'makers hear'} it in their bell.`);
      reload();
    } catch (e) {
      setNotice({ text: eventErrorMessage(e), bad: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="menu-panel grid gap-space-3" aria-labelledby="results-title">
      <h3 id="results-title" className="panel-title">
        Results: {event.name}
      </h3>
      {failed && (
        <DialogueBox text="Can’t load this event’s entries. If the hackathons update hasn’t been run yet, see the deploy guide." emote="attention">
          <button type="button" className="hw-btn" data-variant="small" onClick={reload}>
            RETRY
          </button>
        </DialogueBox>
      )}
      {!data && !failed && <p className="m-0 field-hint">Loading the entries…</p>}
      {data && (
        <>
          <p className="m-0" role="status">
            {announced
              ? `♛ Announced ${manilaTime(data.announced_at)} (Manila). The winners are fixed; judges’ notes can still be corrected.`
              : event.phase === 'open'
                ? `Submissions are open until ${manilaTime(event.submissions_close)} (Manila). Awards can be recorded after that.`
                : `Submissions are closed. Record the winners, check them, then announce.`}
          </p>
          <h4 className="m-0 font-display font-normal">
            {data.entries.length} {data.entries.length === 1 ? 'entry' : 'entries'}
          </h4>
          {data.entries.length === 0 ? (
            <DialogueBox text="No entries yet. Members enter from the event panel in the hall while submissions are open." />
          ) : (
            <ul className="mart-list" aria-label="Entries">
              {data.entries.map((e) => (
                <li key={e.project_id}>
                  <b>{e.title ?? 'Untitled'}</b> <span className="text-caption">by {e.full_name}</span>
                  {e.track && <span className="text-caption text-text-secondary"> · {e.track}</span>}
                  {!e.on_card && <span className="text-caption text-text-secondary"> · no longer on their card (can’t be shown or win)</span>}
                </li>
              ))}
            </ul>
          )}

          <h4 className="m-0 font-display font-normal">Awards</h4>
          {data.awards.length === 0 ? (
            <p className="m-0 field-hint">No awards recorded yet.</p>
          ) : (
            <ul className="mart-list" aria-label="Awards">
              {[...data.awards]
                .sort((a, b) => awardOrder(a, b, tracks))
                .map((a) => (
                  <li key={a.id} className="grid gap-space-1">
                    <span>
                      <b>{awardLabel(a)}</b>: {titleOf(a.project_id)}
                    </span>
                    {editing?.id === a.id ? (
                      <div className="grid gap-space-2">
                        <TextArea field={`note-${a.id}`} label="Judges’ note" max={200} value={editing.note} onChange={(v) => setEditing({ id: a.id, note: v })} />
                        <div className="flex flex-wrap gap-space-2">
                          <button
                            type="button"
                            className="pixel-btn"
                            data-variant="primary"
                            disabled={busy}
                            onClick={() => void run(() => eventService.awardNote(a.id, editing.note.trim()), 'Note saved.').then((ok) => ok && setEditing(null))}
                          >
                            Save note
                          </button>
                          <button type="button" className="pixel-btn" onClick={() => setEditing(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {a.note && <q className="text-caption">{a.note}</q>}
                        <div className="flex flex-wrap gap-space-2">
                          <button type="button" className="pixel-btn" onClick={() => setEditing({ id: a.id, note: a.note })}>
                            Edit note<span className="sr-only"> for {awardLabel(a)}</span>
                          </button>
                          {!announced && (
                            <button type="button" className="pixel-btn" disabled={busy} onClick={() => void run(() => eventService.removeAward(a.id), `${awardLabel(a)} removed.`)}>
                              Remove<span className="sr-only"> {awardLabel(a)}</span>
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </li>
                ))}
            </ul>
          )}

          {judging && data.entries.some((e) => e.on_card) && (
            <form className="grid gap-space-2" aria-labelledby="award-form" onSubmit={(e) => void add(e)}>
              <h4 id="award-form" className="m-0 font-display font-normal">
                Record an award
              </h4>
              <SelectField field="award-which" label="Award" value={form.which} options={WHICH} onChange={(v) => set('which', v)} />
              {form.which === 'named' && <TextField field="award-name" label="Award name" max={40} value={form.name} onChange={(v) => set('name', v)} placeholder="e.g. Best UI" />}
              {tracks.length > 0 && (
                <SelectField field="award-track" label="For" value={form.track} options={[{ value: '', label: 'The whole event' }, ...tracks.map((t) => ({ value: t, label: `The ${t} track` }))]} onChange={(v) => set('track', v)} />
              )}
              {eligible.length > 0 ? (
                <SelectField
                  field="award-project"
                  label="Winning project"
                  value={project}
                  options={eligible.map((e) => ({ value: e.project_id, label: `${e.title ?? 'Untitled'} (${e.full_name})` }))}
                  onChange={(v) => set('project', v)}
                />
              ) : (
                <p className="m-0 field-hint">No entries in that track.</p>
              )}
              <TextArea field="award-note" label="Judges’ note (optional)" max={200} hint="Shown on the winner’s plaque in the Museum." value={form.note} onChange={(v) => set('note', v)} />
              <div>
                <button type="submit" className="pixel-btn" data-variant="primary" disabled={busy || !project || (form.which === 'named' && form.name.trim().length < 2)}>
                  Record award
                </button>
              </div>
            </form>
          )}

          {judging && data.awards.length > 0 && (
            <div className="grid gap-space-2">
              {confirming ? (
                <>
                  <p className="m-0 notice" role="status">
                    Announcing tells the hall, puts the winners in the Museum’s Winners’ Hall and on their badges, and tells every winning maker. It can’t be undone. Announce now?
                  </p>
                  <div className="flex flex-wrap gap-space-2">
                    <button type="button" className="pixel-btn" data-variant="primary" disabled={busy} onClick={() => void announce()}>
                      Yes, announce the results
                    </button>
                    <button type="button" className="pixel-btn" onClick={() => setConfirming(false)}>
                      Not yet
                    </button>
                  </div>
                </>
              ) : (
                <div>
                  <button type="button" className="pixel-btn" data-variant="primary" onClick={() => setConfirming(true)}>
                    <span aria-hidden="true">♛ </span>Announce results
                  </button>
                </div>
              )}
            </div>
          )}
          {notice && (
            <p className={notice.bad ? 'notice notice-bad m-0' : 'notice m-0'} role="status">
              {notice.bad && <span aria-hidden="true">! </span>}
              {notice.text}
            </p>
          )}
        </>
      )}
    </section>
  );
}
