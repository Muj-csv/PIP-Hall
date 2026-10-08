// Admin → Events (V2-7, D-103): schedule an event (e.g. Build Week) with dates, a banner line, an
// optional event Mission and an optional limited frame. Events never overlap; an event that has
// started can be changed but stays in the hall's record. The database checks everything again.
// Hackathons and building events (V2-9, D-115) add tracks, a submissions deadline and a results
// time, and a Results panel where admins record places and awards and announce them (D-116).
// The showcase (V2-12, D-120): each event's Showcase panel has the kiosk's link (with its check-in
// code) and the way to its placards and winners poster.

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { EVENT_KINDS, fromManilaInput, KIND_NAME, kindOf, MAX_TRACKS, parseTracks, toManilaInput, type EventKind } from '../../lib/events';
import { dateRange } from '../../lib/seasons';
import { martService } from '../../services/martService';
import { affiliationKey } from '../../services/museumService';
import { seasonErrorMessage, seasonService, type AdminSeason } from '../../services/seasonService';
import { DialogueBox } from '../dialogue/DialogueBox';
import { SelectField, TextArea, TextField } from '../editor/fields';
import { EventResults } from './EventResults';
import { ShowcasePanel } from './ShowcasePanel';

type Kind = '' | 'people' | 'exhibits' | 'departments' | 'skill' | 'department' | 'tech' | 'team';
const KINDS: readonly { value: Kind; label: string }[] = [
  { value: '', label: 'No event Mission' },
  { value: 'people', label: 'Meet N people' },
  { value: 'exhibits', label: 'Visit N exhibits' },
  { value: 'departments', label: 'Meet people from N departments' },
  { value: 'skill', label: 'Find someone who knows a skill' },
  { value: 'department', label: 'Meet someone from a department' },
  { value: 'tech', label: 'Find someone who builds with a tool' },
  { value: 'team', label: 'Find someone who builds in a team' },
];
const NEEDS_PARAM: readonly Kind[] = ['skill', 'department', 'tech'];
const NEEDS_N: readonly Kind[] = ['people', 'exhibits', 'departments'];

interface Form {
  key: string | null;
  name: string;
  blurb: string;
  startsOn: string;
  endsOn: string;
  kind: Kind;
  param: string;
  n: string;
  reward: string;
  frame: string;
  event: EventKind;
  tracks: string;
  close: string;
  results: string;
}
const EMPTY: Form = { key: null, name: '', blurb: '', startsOn: '', endsOn: '', kind: '', param: '', n: '3', reward: '30', frame: '', event: 'event', tracks: '', close: '', results: '' };
const STATE: Record<AdminSeason['state'], string> = { live: '★ On now', upcoming: '◇ Coming up', over: '✓ Over' };
const PHASE: Record<string, string> = { open: 'Submissions open', judging: 'Judging', results: '♛ Results announced' };

export function SeasonsManager({ onDone }: { onDone: (message: string) => void }) {
  const [list, setList] = useState<AdminSeason[] | null>(null);
  const [frames, setFrames] = useState<{ value: string; label: string }[]>([]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [judging, setJudging] = useState<AdminSeason | null>(null);
  const [showing, setShowing] = useState<AdminSeason | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const reload = useCallback(() => {
    setFailed(false);
    setAttempt((a) => a + 1);
  }, []);
  useEffect(() => {
    let on = true;
    seasonService
      .list()
      .then((l) => on && setList(l))
      .catch(() => on && setFailed(true));
    martService
      .adminItems()
      .then((items) => on && setFrames(items.filter((i) => i.active).map((i) => ({ value: i.key, label: `${i.name} (${i.price} PIPs)` }))))
      .catch(() => undefined); // without the list, events simply have no frame
    return () => {
      on = false;
    };
  }, [attempt]);

  const edit = (s: AdminSeason) =>
    setForm({
      key: s.key,
      name: s.name,
      blurb: s.blurb,
      startsOn: s.starts_on,
      endsOn: s.ends_on,
      kind: (s.mission?.kind ?? '') as Kind,
      param: s.mission?.param ?? '',
      n: String(s.mission?.n ?? 3),
      reward: String(s.mission?.reward ?? 30),
      frame: s.frame?.key ?? '',
      event: kindOf(s),
      tracks: (s.tracks ?? []).join(', '),
      close: toManilaInput(s.submissions_close),
      results: toManilaInput(s.results_at),
    });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const key = form.key ?? affiliationKey(form.name);
      await seasonService.save({
        key,
        name: form.name.trim(),
        blurb: form.blurb.trim(),
        startsOn: form.startsOn,
        endsOn: form.endsOn,
        mission: form.kind
          ? { kind: form.kind, param: NEEDS_PARAM.includes(form.kind) ? form.param.trim() : null, n: NEEDS_N.includes(form.kind) ? Number(form.n) : 1, reward: Number(form.reward) }
          : null,
        frame: form.frame || null,
        kind: form.event,
        tracks: parseTracks(form.tracks),
        submissionsClose: fromManilaInput(form.close),
        resultsAt: fromManilaInput(form.results),
      });
      onDone(`${form.name.trim()} is ${form.key ? 'saved' : 'scheduled'}.`);
      setForm(EMPTY);
      reload();
    } catch (err) {
      setError(seasonErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s: AdminSeason) => {
    setBusy(true);
    setError(undefined);
    try {
      await seasonService.remove(s.key);
      onDone(`${s.name} is off the calendar.`);
      reload();
    } catch (err) {
      setError(seasonErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="grid gap-space-3" aria-labelledby="events-title">
      <h2 id="events-title" className="panel-title">
        Events
      </h2>
      <p className="m-0 field-hint">
        While an event is on, every page shows its banner and the hall shows what really happened during it. Its Mission pays once per member; its limited frame is on sale only during it. Hackathons and building events take entries until their deadline; then record the winners under Results and announce them. Dates and times are on the hall’s calendar (Manila).
      </p>
      {error && (
        <p className="notice notice-bad m-0" role="status">
          <span aria-hidden="true">! </span>
          {error}
        </p>
      )}
      {failed && (
        <DialogueBox text="Can’t load the events. If the events update hasn’t been run yet, see the deploy guide." emote="attention">
          <button type="button" className="hw-btn" data-variant="small" onClick={reload}>
            RETRY
          </button>
        </DialogueBox>
      )}
      {list && list.length === 0 && <DialogueBox text="No events yet. Schedule the first one below." />}
      {list && list.length > 0 && (
        <ul className="mart-list" aria-label="Scheduled events">
          {list.map((s) => (
            <li key={s.key}>
              <div className="mart-row">
                <div className="grid gap-[2px]">
                  <b>{s.name}</b>
                  <span className="text-caption text-text-secondary">
                    {kindOf(s) !== 'event' && `${KIND_NAME[kindOf(s)]} · `}
                    {dateRange(s.starts_on, s.ends_on)}
                    {s.mission ? ` · Mission +${s.mission.reward} PIPs` : ''}
                    {s.frame ? ` · ${s.frame.name}` : ''}
                    {kindOf(s) !== 'event' && ` · ${s.entries ?? 0} ${s.entries === 1 ? 'entry' : 'entries'}`}
                  </span>
                  <span className="mart-status">
                    {STATE[s.state]}
                    {s.phase && PHASE[s.phase] ? ` · ${PHASE[s.phase]}` : ''}
                  </span>
                </div>
                <div className="flex flex-wrap gap-space-2">
                  <button type="button" className="pixel-btn" onClick={() => edit(s)}>
                    Edit<span className="sr-only"> {s.name}</span>
                  </button>
                  {kindOf(s) !== 'event' && s.state !== 'upcoming' && (
                    <button type="button" className="pixel-btn" aria-pressed={judging?.key === s.key} onClick={() => setJudging((j) => (j?.key === s.key ? null : s))}>
                      Results<span className="sr-only"> of {s.name}</span>
                    </button>
                  )}
                  {s.state !== 'over' && (
                    <button type="button" className="pixel-btn" aria-pressed={showing?.key === s.key} onClick={() => setShowing((x) => (x?.key === s.key ? null : s))}>
                      Showcase<span className="sr-only"> of {s.name}</span>
                    </button>
                  )}
                  {s.state === 'upcoming' && (
                    <button type="button" className="pixel-btn" disabled={busy} onClick={() => void remove(s)}>
                      Remove<span className="sr-only"> {s.name}</span>
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {judging && (
        <EventResults
          key={judging.key}
          event={judging}
          onAnnounced={(message) => {
            onDone(message);
            reload();
          }}
        />
      )}
      {showing && <ShowcasePanel key={showing.key} event={showing} />}
      <form className="menu-panel" aria-labelledby="event-form" onSubmit={(e) => void submit(e)}>
        <h3 id="event-form" className="panel-title">
          {form.key ? `Edit ${form.name || 'event'}` : 'Schedule an event'}
        </h3>
        <TextField field="event-name" label="Name" max={40} value={form.name} onChange={(v) => set('name', v)} placeholder="e.g. Build Week" />
        <SelectField field="event-type" label="Kind" value={form.event} options={EVENT_KINDS} onChange={(v) => set('event', v)} />
        <TextField field="event-start" label="First day" type="date" value={form.startsOn} onChange={(v) => set('startsOn', v)} />
        <TextField field="event-end" label="Last day" type="date" value={form.endsOn} onChange={(v) => set('endsOn', v)} hint={form.event !== 'event' ? 'From kickoff to the results: the event room opens on the first day.' : undefined} />
        {form.event !== 'event' && (
          <>
            <TextField
              field="event-tracks"
              label={`Tracks (optional, up to ${MAX_TRACKS}, separated by commas)`}
              max={200}
              value={form.tracks}
              onChange={(v) => set('tracks', v)}
              placeholder="e.g. Health, Education"
            />
            <TextField field="event-close" label="Submissions close (Manila time)" type="datetime-local" value={form.close} onChange={(v) => set('close', v)} />
            <TextField field="event-results" label="Results expected (Manila time)" type="datetime-local" value={form.results} onChange={(v) => set('results', v)} />
          </>
        )}
        <TextArea field="event-blurb" label="Banner line" max={200} hint="Shown on every page while the event is on." value={form.blurb} onChange={(v) => set('blurb', v)} />
        <SelectField field="event-kind" label="Event Mission" value={form.kind} options={KINDS} onChange={(v) => set('kind', v)} />
        {NEEDS_PARAM.includes(form.kind) && <TextField field="event-param" label="Which one" max={40} value={form.param} onChange={(v) => set('param', v)} placeholder="e.g. Python" />}
        {NEEDS_N.includes(form.kind) && <TextField field="event-n" label="How many" type="number" value={form.n} onChange={(v) => set('n', v)} />}
        {form.kind && <TextField field="event-reward" label="PIPs it pays (5–200)" type="number" value={form.reward} onChange={(v) => set('reward', v)} />}
        <SelectField field="event-frame" label="Limited frame" value={form.frame} options={[{ value: '', label: 'None' }, ...frames]} onChange={(v) => set('frame', v)} />
        <div className="flex flex-wrap gap-space-2">
          <button
            type="submit"
            className="pixel-btn"
            data-variant="primary"
            disabled={busy || form.name.trim().length < 2 || !form.startsOn || !form.endsOn || (form.event !== 'event' && (!form.close || !form.results))}
          >
            {form.key ? 'Save event' : 'Schedule event'}
          </button>
          {form.key && (
            <button type="button" className="pixel-btn" onClick={() => setForm(EMPTY)}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
