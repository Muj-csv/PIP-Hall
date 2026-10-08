// Admin → Archive (V2-10, D-118): compile past projects and hackathon outputs. Each has a year, the
// event it came from (one of the hall's events, or a typed name for older ones), its track and
// award, links, a picture, and its makers: members of the hall (linked to their badge), typed
// names (shown only when the makers agreed to be named), or unnamed slots, so the team size stays
// true. Drafts stay private until "On show" is ticked. Members' claims wait here for an answer.
// The database checks every field again.

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSession } from '../../app/sessionContext';
import { archiveOrigin } from '../../lib/archive';
import { awardLabel, kindOf } from '../../lib/events';
import { parseTracks } from '../../lib/events';
import { useCards } from '../../lib/useCards';
import { archiveErrorMessage, archiveService, type AdminArchive, type AdminClaim } from '../../services/archiveService';
import { seasonService } from '../../services/seasonService';
import { publicImageUrl } from '../../services/storageService';
import { DialogueBox } from '../dialogue/DialogueBox';
import { CoverField } from '../editor/CoverField';
import { SelectField, TextArea, TextField, Toggle } from '../editor/fields';

type Award = '' | '1' | '2' | '3' | 'named';
interface MakerRow {
  key: number;
  member: string;
  name: string;
}
interface Form {
  id: string | null;
  title: string;
  description: string;
  year: string;
  event: string;
  eventName: string;
  track: string;
  award: Award;
  awardName: string;
  inTrack: boolean;
  note: string;
  team: string;
  tech: string;
  site: string;
  code: string;
  video: string;
  cover: string | null;
  newCover: Blob | null;
  namesOk: boolean;
  published: boolean;
  makers: MakerRow[];
}
const TYPED = '__typed';
let nextKey = 1;
const row = (member = '', name = ''): MakerRow => ({ key: nextKey++, member, name });
const EMPTY = (): Form => ({
  id: null, title: '', description: '', year: String(new Date().getFullYear() - 1), event: '', eventName: '', track: '', award: '', awardName: '',
  inTrack: false, note: '', team: '', tech: '', site: '', code: '', video: '', cover: null, newCover: null, namesOk: false, published: false, makers: [row()],
});
const AWARDS: readonly { value: Award; label: string }[] = [
  { value: '', label: 'No award' },
  { value: '1', label: '1st place' },
  { value: '2', label: '2nd place' },
  { value: '3', label: '3rd place' },
  { value: 'named', label: 'A named award' },
];

export function ArchiveManager({ onDone }: { onDone: (message: string) => void }) {
  const { session } = useSession();
  const adminId = session.status === 'signed-in' ? session.user.id : '';
  const cards = useCards();
  const [list, setList] = useState<AdminArchive[] | null>(null);
  const [events, setEvents] = useState<{ value: string; label: string }[]>([]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const reload = useCallback(() => {
    setFailed(false);
    setAttempt((a) => a + 1);
  }, []);
  useEffect(() => {
    let on = true;
    archiveService
      .adminList()
      .then((l) => on && setList(l))
      .catch(() => on && setFailed(true));
    seasonService
      .list()
      .then((all) => on && setEvents(all.filter((e) => e.state === 'over' || e.phase === 'results').map((e) => ({ value: e.key, label: `${e.name}${kindOf(e) !== 'event' ? '' : ' (event)'}` }))))
      .catch(() => undefined); // without them, older events are typed by name
    return () => {
      on = false;
    };
  }, [attempt]);

  const members = useMemo(
    () => (cards.status === 'ready' ? [...cards.cards].sort((a, b) => a.card.full_name.localeCompare(b.card.full_name)).map((c) => ({ value: c.profile_id, label: `${c.card.full_name} (@${c.username})` })) : []),
    [cards],
  );
  const preview = useMemo(() => (form.newCover ? URL.createObjectURL(form.newCover) : null), [form.newCover]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const edit = (a: AdminArchive) => {
    setError(undefined);
    setForm({
      id: a.id,
      title: a.title,
      description: a.description,
      year: String(a.year),
      event: a.season_key ?? (a.event_name ? TYPED : ''),
      eventName: a.event_name ?? '',
      track: a.track ?? '',
      award: a.award_place ? (String(a.award_place) as Award) : a.award_name ? 'named' : '',
      awardName: a.award_name ?? '',
      inTrack: a.award_in_track,
      note: a.award_note,
      team: a.team_name ?? '',
      tech: a.tech.join(', '),
      site: a.project_url ?? '',
      code: a.github_url ?? '',
      video: a.video_url ?? '',
      cover: a.cover_path,
      newCover: null,
      namesOk: a.names_ok,
      published: a.published,
      makers: a.makers.length ? a.makers.map((m) => row(m.member_id ?? '', m.name ?? '')) : [row()],
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const cover = form.newCover ? await archiveService.uploadPicture(adminId, form.newCover) : form.cover;
      const named = form.award === 'named';
      await archiveService.save(form.id, {
        title: form.title.trim(),
        description: form.description.trim(),
        year: Number(form.year),
        season_key: form.event && form.event !== TYPED ? form.event : null,
        event_name: form.event === TYPED ? form.eventName.trim() || null : null,
        track: form.track.trim() || null,
        award_place: form.award && !named ? Number(form.award) : null,
        award_name: named ? form.awardName.trim() || null : null,
        award_in_track: Boolean(form.award) && form.inTrack,
        award_note: form.award ? form.note.trim() : '',
        team_name: form.team.trim() || null,
        tech: parseTracks(form.tech),
        project_url: form.site.trim() || null,
        github_url: form.code.trim() || null,
        video_url: form.video.trim() || null,
        cover_path: cover,
        names_ok: form.namesOk,
        published: form.published,
        makers: form.makers.filter((m) => m.member || m.name.trim() || form.makers.length > 1).map((m) => ({ member_id: m.member || null, name: m.name.trim() || null })),
      });
      onDone(`${form.title.trim()} is ${form.published ? 'on show in the Museum' : 'saved as a draft'}.`);
      setForm(EMPTY());
      reload();
    } catch (err) {
      setError(archiveErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: AdminArchive) => {
    if (!window.confirm(`Remove “${a.title}” from the archive? This can’t be undone.`)) return;
    setBusy(true);
    try {
      await archiveService.remove(a.id);
      onDone(`${a.title} is out of the archive.`);
      reload();
    } catch (err) {
      setError(archiveErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const setMaker = (key: number, patch: Partial<MakerRow>) => set('makers', form.makers.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  const claims = (list ?? []).flatMap((a) => a.claims.map((c) => ({ claim: c, exhibit: a })));

  return (
    <section className="grid gap-space-3" aria-labelledby="archive-admin-title">
      <h2 id="archive-admin-title" className="panel-title">
        Archive
      </h2>
      <p className="m-0 field-hint">
        Compile past projects and hackathon outputs for the Museum. Link makers who have a card in the hall; type the names of others, and tick “agreed to be named” only when they did. Unnamed makers still count, so a team shows as “a team of 4”.
      </p>
      {error && (
        <p className="notice notice-bad m-0" role="status">
          <span aria-hidden="true">! </span>
          {error}
        </p>
      )}
      {failed && (
        <DialogueBox text="Can’t load the archive. If the archive update hasn’t been run yet, see the deploy guide." emote="attention">
          <button type="button" className="hw-btn" data-variant="small" onClick={reload}>
            RETRY
          </button>
        </DialogueBox>
      )}

      {claims.length > 0 && (
        <section className="menu-panel grid gap-space-2" aria-labelledby="claims-title">
          <h3 id="claims-title" className="panel-title">
            Claims waiting · {claims.length}
          </h3>
          <ul className="mart-list" aria-label="Claims">
            {claims.map(({ claim, exhibit }) => (
              <ClaimRow key={claim.id} claim={claim} exhibit={exhibit} onAnswered={(m) => (onDone(m), reload())} onError={setError} />
            ))}
          </ul>
        </section>
      )}

      {list && list.length === 0 && <DialogueBox text="The archive is empty. Add the first past project below." />}
      {list && list.length > 0 && (
        <ul className="mart-list" aria-label="Archive exhibits">
          {list.map((a) => (
            <li key={a.id}>
              <div className="mart-row">
                <div className="grid gap-[2px]">
                  <b>{a.title}</b>
                  <span className="text-caption text-text-secondary">
                    {archiveOrigin({ event: a.event, year: a.year, track: a.track })}
                    {(a.award_place || a.award_name) && ` · ${awardLabel({ place: a.award_place, name: a.award_name, track: null })}`}
                    {` · ${a.makers.length} ${a.makers.length === 1 ? 'maker' : 'makers'}`}
                  </span>
                  <span className="mart-status">{a.published ? '▣ On show' : '○ Draft'}</span>
                </div>
                <div className="flex flex-wrap gap-space-2">
                  <button type="button" className="pixel-btn" onClick={() => edit(a)}>
                    Edit<span className="sr-only"> {a.title}</span>
                  </button>
                  <button type="button" className="pixel-btn" disabled={busy} onClick={() => void remove(a)}>
                    Remove<span className="sr-only"> {a.title}</span>
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form className="menu-panel" aria-labelledby="archive-form" onSubmit={(e) => void submit(e)}>
        <h3 id="archive-form" className="panel-title">
          {form.id ? `Edit ${form.title || 'exhibit'}` : 'Add a past project'}
        </h3>
        <TextField field="arc-title" label="Title" max={80} value={form.title} onChange={(v) => set('title', v)} />
        <TextArea field="arc-description" label="What it is (optional)" max={500} value={form.description} onChange={(v) => set('description', v)} />
        <TextField field="arc-year" label="Year" type="number" value={form.year} onChange={(v) => set('year', v)} />
        <SelectField
          field="arc-event"
          label="Event"
          value={form.event}
          options={[{ value: '', label: 'No event (a class or personal project)' }, ...events, { value: TYPED, label: 'An older event (type its name)' }]}
          onChange={(v) => set('event', v)}
        />
        {form.event === TYPED && <TextField field="arc-event-name" label="Event name" max={60} value={form.eventName} onChange={(v) => set('eventName', v)} placeholder="e.g. Spring Hackathon" />}
        <TextField field="arc-track" label="Track (optional)" max={30} value={form.track} onChange={(v) => set('track', v)} />
        <SelectField field="arc-award" label="Award" value={form.award} options={AWARDS} onChange={(v) => set('award', v)} />
        {form.award === 'named' && <TextField field="arc-award-name" label="Award name" max={40} value={form.awardName} onChange={(v) => set('awardName', v)} placeholder="e.g. Best UI" />}
        {form.award && form.track.trim() && <Toggle field="arc-in-track" label="The award was for its track" checked={form.inTrack} onChange={(v) => set('inTrack', v)} />}
        {form.award && <TextArea field="arc-note" label="Judges’ note (optional)" max={200} value={form.note} onChange={(v) => set('note', v)} />}
        <TextField field="arc-team" label="Team name (optional)" max={40} value={form.team} onChange={(v) => set('team', v)} />
        <TextField field="arc-tech" label="Built with (separated by commas)" max={250} value={form.tech} onChange={(v) => set('tech', v)} placeholder="e.g. Python, Arduino" />
        <TextField field="arc-site" label="Site (optional)" type="url" value={form.site} onChange={(v) => set('site', v)} placeholder="https://" />
        <TextField field="arc-code" label="Code (optional)" type="url" value={form.code} onChange={(v) => set('code', v)} placeholder="https://" />
        <TextField field="arc-video" label="Video (optional)" type="url" value={form.video} onChange={(v) => set('video', v)} placeholder="https://" />
        <CoverField
          title={form.title}
          previewUrl={preview ?? publicImageUrl('project-covers', form.cover)}
          onPicked={(b) => set('newCover', b)}
          onRemove={() => setForm((f) => ({ ...f, newCover: null, cover: null }))}
          hint="A screenshot or photo of the project, shown on its console’s screen in the Museum."
        />

        <fieldset className="grid gap-space-2 m-0 p-0 border-0">
          <legend className="field-label">Makers</legend>
          {form.makers.map((m, i) => (
            <div key={m.key} className="flex flex-wrap items-end gap-space-2" role="group" aria-label={`Maker ${i + 1}`}>
              <SelectField field={`arc-maker-${m.key}`} label="Member" value={m.member} options={[{ value: '', label: 'Not a member (type a name, or leave it blank)' }, ...members]} onChange={(v) => setMaker(m.key, { member: v })} />
              {!m.member && <TextField field={`arc-maker-name-${m.key}`} label="Name (optional)" max={60} value={m.name} onChange={(v) => setMaker(m.key, { name: v })} />}
              <button type="button" className="pixel-btn" onClick={() => set('makers', form.makers.filter((x) => x.key !== m.key))}>
                Remove<span className="sr-only"> maker {i + 1}</span>
              </button>
            </div>
          ))}
          <div>
            <button type="button" className="pixel-btn" disabled={form.makers.length >= 12} onClick={() => set('makers', [...form.makers, row()])}>
              + Add a maker
            </button>
          </div>
          <Toggle field="arc-names-ok" label="These makers agreed to be named" hint="Without it, typed names stay private: the exhibit shows its team name or “a team of N”." checked={form.namesOk} onChange={(v) => set('namesOk', v)} />
        </fieldset>
        <Toggle field="arc-published" label="On show in the Museum" hint="Leave it off to keep a draft while you compile." checked={form.published} onChange={(v) => set('published', v)} />
        <div className="flex flex-wrap gap-space-2">
          <button type="submit" className="pixel-btn" data-variant="primary" disabled={busy || !form.title.trim() || !/^\d{4}$/.test(form.year)}>
            {form.id ? 'Save' : 'Add to the archive'}
          </button>
          {form.id && (
            <button type="button" className="pixel-btn" onClick={() => setForm(EMPTY())}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

/** One claim: link the member to the slot they were (or as a new maker), or decline with a note. */
function ClaimRow({ claim, exhibit, onAnswered, onError }: { claim: AdminClaim; exhibit: AdminArchive; onAnswered: (message: string) => void; onError: (m: string) => void }) {
  const slots = exhibit.makers.filter((m) => !m.member_id && m.id);
  const [slot, setSlot] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const answer = async (accept: boolean) => {
    setBusy(true);
    try {
      await archiveService.answer(claim.id, accept, accept && slot ? Number(slot) : null, accept ? '' : note.trim());
      onAnswered(accept ? `${claim.full_name} is credited on ${exhibit.title}.` : `The claim on ${exhibit.title} is declined.`);
    } catch (e) {
      onError(archiveErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="grid gap-space-2">
      <span>
        <b>{claim.full_name}</b> <span className="text-caption">@{claim.username}</span> claims <b>“{exhibit.title}”</b>{' '}
        <span className="text-caption text-text-secondary">({archiveOrigin({ event: exhibit.event, year: exhibit.year, track: null })})</span>
      </span>
      {claim.note && <q className="text-caption">{claim.note}</q>}
      <SelectField
        field={`claim-slot-${claim.id}`}
        label="Link them as"
        value={slot}
        options={[{ value: '', label: 'A new maker' }, ...slots.map((m, i) => ({ value: String(m.id), label: m.name ? `${m.name} (typed name)` : `Unnamed maker ${i + 1}` }))]}
        onChange={setSlot}
      />
      <TextField field={`claim-note-${claim.id}`} label="Note if you decline (they’ll see it)" max={200} value={note} onChange={setNote} />
      <div className="flex flex-wrap gap-space-2">
        <button type="button" className="pixel-btn" data-variant="primary" disabled={busy} onClick={() => void answer(true)}>
          Confirm<span className="sr-only"> {claim.full_name} on {exhibit.title}</span>
        </button>
        <button type="button" className="pixel-btn" disabled={busy} onClick={() => void answer(false)}>
          Decline<span className="sr-only"> {claim.full_name} on {exhibit.title}</span>
        </button>
      </div>
    </li>
  );
}
