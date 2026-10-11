// Admin → Museum → Projects and Suggestions (D-130, D-133): every project on an approved card, to
// feature in the Museum, and (Suggestions) only those members offered that aren't featured yet.
// Members with Museum access offer their projects from the card editor; an offer is a suggestion.
// Featuring saves at once (the database checks is_admin() and that the project is on an approved card).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { memberPath } from '../../lib/publicUrl';
import { museumErrorMessage, museumService } from '../../services/museumService';
import type { AdminMuseumProject } from '../../types/museum';
import { DialogueBox } from '../dialogue/DialogueBox';
import { TextField } from '../editor/fields';

/** Offers waiting for an answer first, then what's featured, then the rest; by member, then title. */
function order(a: AdminMuseumProject, b: AdminMuseumProject): number {
  const rank = (p: AdminMuseumProject) => (p.offered && !p.featured ? 0 : p.featured ? 1 : 2);
  return rank(a) - rank(b) || a.member_no - b.member_no || a.title.localeCompare(b.title);
}

export function MuseumFeatures({ onDone, offersOnly = false }: { onDone: (message: string) => void; offersOnly?: boolean }) {
  const [list, setList] = useState<AdminMuseumProject[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let on = true;
    museumService
      .adminProjects()
      .then((l) => on && setList(l))
      .catch((e) => on && setFailed(museumErrorMessage(e)));
    return () => {
      on = false;
    };
  }, [attempt]);

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (list ?? [])
      .filter((p) => !offersOnly || (p.offered && !p.featured))
      .filter((p) => words.every((w) => `${p.title} ${p.full_name} ${p.username}`.toLowerCase().includes(w)))
      .sort(order);
  }, [list, q, offersOnly]);
  const featured = list?.filter((p) => p.featured).length ?? 0;
  const waiting = list?.filter((p) => p.offered && !p.featured).length ?? 0;

  const toggle = useCallback(
    async (p: AdminMuseumProject, on: boolean) => {
      const set = (v: boolean) => setList((l) => l?.map((x) => (x.project_id === p.project_id ? { ...x, featured: v } : x)) ?? l);
      set(on); // show it at once; undo if the database refuses
      setBusy(p.project_id);
      setError(null);
      try {
        await museumService.feature(p.project_id, on);
        onDone(on ? `${p.title} by ${p.full_name} hangs in the Museum.` : `${p.title} left the Museum.`);
      } catch (e) {
        set(!on);
        setError(museumErrorMessage(e));
      } finally {
        setBusy(null);
      }
    },
    [onDone],
  );

  return (
    <section className="grid gap-space-3" aria-labelledby="museum-features-title">
      <h2 id="museum-features-title" className="panel-title">
        {offersOnly ? 'Suggestions from members' : 'Featured projects'}
      </h2>
      <p className="m-0 field-hint">
        {offersOnly
          ? 'Projects members with Museum access offered from My card. Nothing hangs until you feature it.'
          : 'Feature any project on an approved card: it hangs in the Museum at once, with no review. '}
        {!offersOnly && (
          <>
            Winners hang from the Winners tab, the{' '}
            <Link to="/museum?room=archive&view=list" className="underline decoration-2">
              archive
            </Link>{' '}
            from the Archive tab.
          </>
        )}
      </p>
      {error && (
        <p className="notice notice-bad m-0" role="status">
          <span aria-hidden="true">! </span>
          {error}
        </p>
      )}
      {list === null && !failed && <DialogueBox text="Reading the hall’s projects…" emote="pending" />}
      {failed && (
        <DialogueBox text={`Can’t read the hall’s projects. ${failed}`} emote="attention">
          <button
            type="button"
            className="hw-btn"
            data-variant="small"
            onClick={() => {
              setFailed(null);
              setAttempt((a) => a + 1);
            }}
          >
            RETRY
          </button>
        </DialogueBox>
      )}
      {list && list.length === 0 && <DialogueBox text="No approved card has a project yet. Projects show up here once a card with projects is approved." />}
      {list && list.length > 0 && offersOnly && waiting === 0 && <DialogueBox text="No suggestions waiting. Members with Museum access can offer a project from My card." />}
      {list && list.length > 0 && (!offersOnly || waiting > 0) && (
        <>
          <p className="m-0 font-display tracking-[0.04em]" role="status">
            {featured} featured · {waiting} {waiting === 1 ? 'offer' : 'offers'} waiting · {list.length} {list.length === 1 ? 'project' : 'projects'} in the hall
          </p>
          <TextField field="museum-search" label="Find a project or maker" value={q} onChange={setQ} />
          {shown.length === 0 ? (
            <DialogueBox text="Nothing matches that. Try fewer words." emote="attention" />
          ) : (
            <ul className="feature-list" aria-label="Projects in the hall">
              {shown.map((p) => (
                <li key={p.project_id} data-featured={p.featured || undefined}>
                  <label className="toggle">
                    <input type="checkbox" checked={p.featured} disabled={busy === p.project_id} onChange={(e) => void toggle(p, e.target.checked)} />
                    <span>
                      Feature <b>{p.title}</b>
                    </span>
                  </label>
                  <p className="m-0 text-caption">
                    by{' '}
                    <Link to={memberPath(p.username)} className="underline decoration-2">
                      {p.full_name}
                    </Link>{' '}
                    <span className="text-text-secondary">
                      · No.{String(p.member_no).padStart(3, '0')}
                      {p.offered && ' · ✉ offered by its maker'}
                      {p.won && (p.hung ? ' · ♛ won at an event (hangs as a winner)' : ' · ♛ won at an event (hang it from the Winners tab)')}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
