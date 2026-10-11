// Admin → Museum → Members (V2-20, D-133): the Featured Members room. A member an admin features
// (the same switch as the Featured tab) hangs there as their badge, with an optional curator's note
// of up to 140 characters. Saves at once; the database checks is_admin() and the note's length.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { memberPath } from '../../lib/publicUrl';
import { adminErrorMessage, adminService } from '../../services/adminService';
import { museumErrorMessage, museumService } from '../../services/museumService';
import type { PublicCard } from '../../types/card';
import { DialogueBox } from '../dialogue/DialogueBox';
import { TextArea, TextField } from '../editor/fields';

export function MuseumMembers({ cards, onDone }: { cards: readonly PublicCard[]; onDone: (message: string) => void }) {
  const [notes, setNotes] = useState<Map<string, string> | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Featured as the admin just set it, until the queue reloads with it. */
  const [now, setNow] = useState<Map<string, boolean>>(new Map());
  const [q, setQ] = useState('');

  useEffect(() => {
    let on = true;
    museumService
      .curation()
      .then((c) => on && setNotes(new Map(c.portraits.map((p) => [p.member_id, p.note]))))
      .catch((e) => on && setFailed(museumErrorMessage(e)));
    return () => {
      on = false;
    };
  }, [attempt]);

  const featured = (c: PublicCard) => now.get(c.profile_id) ?? c.is_featured;
  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return [...cards]
      .filter((c) => words.every((w) => `${c.card.full_name} ${c.username}`.toLowerCase().includes(w)))
      .sort((a, b) => Number(featured(b)) - Number(featured(a)) || a.member_no - b.member_no);
    // featured reads `now`, which is in the list below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, q, now]);
  const count = cards.filter((c) => featured(c)).length;

  const feature = async (c: PublicCard, on: boolean) => {
    setNow((m) => new Map(m).set(c.profile_id, on));
    setBusy(true);
    setError(null);
    try {
      await adminService.setFeatured(c.profile_id, on);
      onDone(on ? `${c.card.full_name} is featured: their badge hangs in the Featured Members room.` : `${c.card.full_name} left the Featured Members room.`);
    } catch (e) {
      setNow((m) => new Map(m).set(c.profile_id, !on));
      setError(adminErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async (c: PublicCard, note: string) => {
    setBusy(true);
    setError(null);
    try {
      await museumService.setPortrait(c.profile_id, note);
      setNotes((m) => new Map(m ?? []).set(c.profile_id, note.trim()));
      onDone(note.trim() ? `The note under ${c.card.full_name}’s badge is saved.` : `The note under ${c.card.full_name}’s badge is gone.`);
    } catch (e) {
      setError(museumErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="grid gap-space-3" aria-labelledby="museum-members-title">
      <h2 id="museum-members-title" className="panel-title">
        Featured Members
      </h2>
      <p className="m-0 field-hint">
        Members you feature hang as their badges in the Museum’s{' '}
        <Link to="/museum?room=members&view=list" className="underline decoration-2">
          Featured Members room
        </Link>
        , with your note under each. It’s the same switch as the Featured tab: they wear the star in the hall too.
      </p>
      {error && (
        <p className="notice notice-bad m-0" role="status">
          <span aria-hidden="true">! </span>
          {error}
        </p>
      )}
      {failed && (
        <DialogueBox text={`Can’t read the curator’s notes. ${failed}`} emote="attention">
          <button type="button" className="hw-btn" data-variant="small" onClick={() => (setFailed(null), setAttempt((a) => a + 1))}>
            RETRY
          </button>
        </DialogueBox>
      )}
      {notes === null && !failed && <DialogueBox text="Reading the curator’s notes…" emote="pending" />}
      {notes && cards.length === 0 && <DialogueBox text="No card is approved yet. Members show up here once their card is in the hall." />}
      {notes && cards.length > 0 && (
        <>
          <p className="m-0 font-display tracking-[0.04em]" role="status">
            {count} featured · {cards.length} {cards.length === 1 ? 'member' : 'members'} in the hall
          </p>
          <TextField field="members-search" label="Find a member" value={q} onChange={setQ} />
          {shown.length === 0 ? (
            <DialogueBox text="Nobody matches that. Try fewer words." emote="attention" />
          ) : (
            <ul className="feature-list" aria-label="Members of the hall">
              {shown.map((c) => (
                <li key={c.profile_id} data-featured={featured(c) || undefined}>
                  <label className="toggle">
                    <input type="checkbox" checked={featured(c)} disabled={busy} onChange={(e) => void feature(c, e.target.checked)} />
                    <span>
                      Feature <b>{c.card.full_name}</b>
                    </span>
                  </label>
                  <p className="m-0 text-caption">
                    <Link to={memberPath(c.username)} className="underline decoration-2">
                      @{c.username}
                    </Link>{' '}
                    <span className="text-text-secondary">· No.{String(c.member_no).padStart(3, '0')}</span>
                  </p>
                  {featured(c) && <NoteEditor key={notes.get(c.profile_id) ?? ''} name={c.card.full_name} id={c.profile_id} saved={notes.get(c.profile_id) ?? ''} busy={busy} onSave={(n) => void saveNote(c, n)} />}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function NoteEditor({ id, name, saved, busy, onSave }: { id: string; name: string; saved: string; busy: boolean; onSave: (note: string) => void }) {
  const [note, setNote] = useState(saved);
  const long = note.trim().length > 140;
  return (
    <div className="grid gap-space-2">
      <TextArea
        field={`portrait-${id}`}
        label={`Curator’s note under ${name}’s badge`}
        max={140}
        hint="A line visitors read beside the badge. Leave empty for none."
        error={long ? 'At most 140 characters.' : undefined}
        rows={2}
        value={note}
        onChange={setNote}
      />
      <button type="button" className="pixel-btn justify-self-start" disabled={busy || long || note.trim() === saved} onClick={() => onSave(note)}>
        Save note<span className="sr-only"> for {name}</span>
      </button>
    </div>
  );
}
