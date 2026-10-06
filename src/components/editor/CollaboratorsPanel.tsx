// Card editor → Collaborators (D-089). Tag members of the hall on your saved projects, and answer
// tags others put on theirs. Every change saves at once and never sends the card back to review;
// accepted collaborators reach the public card with its next approval (ADR-002).

import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { useCards } from '../../lib/useCards';
import { collabErrorMessage, collabNotSetUp, collabService } from '../../services/collabService';
import type { MyCollabs } from '../../types/collab';
import type { DraftProject } from '../../types/draft';
import { Panel } from '../shell/MenuPage';

const STATUS: Record<string, string> = { pending: '… waiting', accepted: '✓ accepted', declined: '✕ declined' };

export function CollaboratorsPanel({ projects, myId }: { projects: DraftProject[]; myId: string }) {
  const [state, setState] = useState<MyCollabs | null>(null);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    let on = true;
    collabService
      .mine()
      .then((m) => on && setState(m))
      .catch((e: unknown) => on && collabNotSetUp(e) && setHidden(true)); // no update yet: no panel
    return () => {
      on = false;
    };
  }, [attempt]);

  // Arriving from the bell (/edit#collaborators): bring the panel into view once it has loaded.
  const loaded = state !== null;
  useEffect(() => {
    if (loaded && window.location.hash === '#collaborators') document.getElementById('collaborators')?.scrollIntoView({ block: 'start' });
  }, [loaded]);

  const run = async (id: string, move: () => Promise<unknown>, done: string) => {
    setBusy(id);
    setNotice(null);
    try {
      await move();
      setNotice({ text: done });
      reload();
      return true;
    } catch (e) {
      setNotice({ text: collabErrorMessage(e), bad: true });
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (hidden) return null;
  const saved = projects.filter((p): p is DraftProject & { id: string } => Boolean(p.id));
  const pending = state?.incoming.filter((r) => r.status === 'pending') ?? [];

  return (
    <Panel label="Collaborators" id="collaborators">
      <h2 className="panel-title">
        Collaborators{pending.length > 0 ? ` · ${pending.length} new` : ''}
      </h2>
      {notice && (
        <p className={notice.bad ? 'notice notice-bad m-0' : 'notice m-0'} role="status">
          {notice.bad && <span aria-hidden="true">! </span>}
          {notice.text}
        </p>
      )}
      {!state ? (
        <p className="m-0 field-hint">Loading collaborators…</p>
      ) : (
        <>
          {state.incoming.length > 0 && (
            <section className="grid gap-space-2" aria-labelledby="collab-in">
              <h3 id="collab-in" className="m-0 font-display text-[17px] font-normal tracking-[0.04em]">
                Tagged by others
              </h3>
              <ul className="collab-list" aria-label="Projects you were tagged on">
                {state.incoming.map((r) => (
                  <li key={r.project_id}>
                    <span>
                      <b>{r.title}</b> <span className="text-text-secondary">by {r.owner_name} (@{r.owner_username})</span>
                      <span className="collab-status"> {STATUS[r.status]}</span>
                    </span>
                    <span className="flex flex-wrap gap-space-2">
                      {r.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            className="pixel-btn"
                            data-variant="primary"
                            disabled={busy === r.project_id}
                            onClick={() => void run(r.project_id, () => collabService.respond(r.project_id, true), `You’re on ${r.title}. It shows on ${r.owner_name}’s card after their next approval.`)}
                          >
                            Accept<span className="sr-only"> {r.title}</span>
                          </button>
                          <button
                            type="button"
                            className="pixel-btn"
                            disabled={busy === r.project_id}
                            onClick={() => void run(r.project_id, () => collabService.respond(r.project_id, false), `Declined ${r.title}. You won’t be asked about it again.`)}
                          >
                            Decline<span className="sr-only"> {r.title}</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="pixel-btn"
                          disabled={busy === r.project_id}
                          onClick={() => void run(r.project_id, () => collabService.leave(r.project_id), `You left ${r.title}.`)}
                        >
                          Leave<span className="sr-only"> {r.title}</span>
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="grid gap-space-2" aria-labelledby="collab-out">
            <h3 id="collab-out" className="m-0 font-display text-[17px] font-normal tracking-[0.04em]">
              Tag on your projects
            </h3>
            <p className="m-0 field-hint">
              Made it with someone in the hall? Tag them. They accept first, and they show on your public card after its next approval.
            </p>
            {saved.length === 0 ? (
              <p className="m-0 field-hint">Save your card with at least one project first.</p>
            ) : (
              <ul className="collab-projects" aria-label="Your projects">
                {saved.map((p) => (
                  <ProjectTags key={p.id} project={p} myId={myId} tags={state.outgoing.filter((t) => t.project_id === p.id)} busy={busy} onRun={run} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </Panel>
  );
}

function ProjectTags({
  project,
  myId,
  tags,
  busy,
  onRun,
}: {
  project: DraftProject & { id: string };
  myId: string;
  tags: MyCollabs['outgoing'];
  busy: string | null;
  onRun: (id: string, move: () => Promise<unknown>, done: string) => Promise<boolean>;
}) {
  const [who, setWho] = useState('');
  const listId = useId();
  const inputId = useId();
  const cards = useCards();
  // Everyone in the hall except me and anyone already tagged here.
  const options = useMemo(() => {
    if (cards.status !== 'ready') return [];
    const taken = new Set(tags.map((t) => t.member_id));
    return cards.cards.filter((c) => c.profile_id !== myId && !taken.has(c.profile_id));
  }, [cards, tags, myId]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const username = who.trim().replace(/^@/, '').split(/\s/)[0] ?? '';
    if (!username) return;
    if (await onRun(project.id, () => collabService.tag(project.id, username), `Asked @${username} to join ${project.title}.`)) setWho('');
  };

  return (
    <li className="collab-project">
      <b>{project.title || 'Untitled project'}</b>
      {tags.length > 0 && (
        <ul className="collab-list" aria-label={`Collaborators on ${project.title}`}>
          {tags.map((t) => (
            <li key={t.member_id}>
              <span>
                {t.full_name ?? 'A member'} {t.username && <span className="text-text-secondary">@{t.username}</span>}
                <span className="collab-status"> {STATUS[t.status]}</span>
              </span>
              {t.status !== 'declined' && (
                <button
                  type="button"
                  className="pixel-btn"
                  disabled={busy === project.id}
                  onClick={() => void onRun(project.id, () => collabService.untag(project.id, t.member_id), `Removed ${t.full_name ?? 'them'} from ${project.title}.`)}
                >
                  Remove<span className="sr-only"> {t.full_name} from {project.title}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {tags.length < 8 && (
        <form className="flex flex-wrap items-end gap-space-2" onSubmit={add} aria-label={`Tag someone on ${project.title}`}>
          <div className="field min-w-0 flex-1 basis-[200px]">
            <label htmlFor={inputId} className="field-label">
              Member’s @username
            </label>
            <input id={inputId} className="pixel-input" list={listId} value={who} onChange={(e) => setWho(e.target.value)} placeholder="@username" autoComplete="off" />
            <datalist id={listId}>
              {options.map((c) => (
                <option key={c.profile_id} value={c.username}>
                  {c.card.full_name}
                </option>
              ))}
            </datalist>
          </div>
          <button type="submit" className="pixel-btn" disabled={busy === project.id || !who.trim()}>
            Tag
          </button>
        </form>
      )}
    </li>
  );
}
