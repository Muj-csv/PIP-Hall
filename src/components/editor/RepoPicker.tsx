// Pick up to 6 public repos for the card (FR-05). States: not connected, loading, list, empty,
// rate-limited (with the reset time), user not found, error.

import { useCallback, useEffect, useState } from 'react';
import { LIMITS } from '../../lib/validate';
import { GithubRateLimited, GithubUserNotFound, githubService, type GithubRepo } from '../../services/githubService';
import type { DraftProject } from '../../types/draft';

type State =
  | { kind: 'loading' }
  | { kind: 'list'; repos: GithubRepo[] }
  | { kind: 'rate-limited'; resetAt: Date | null }
  | { kind: 'error'; message: string };

interface Props {
  handle: string | null;
  projects: DraftProject[];
  onToggle: (repo: GithubRepo, pick: boolean) => void;
  onRefreshed: (repos: GithubRepo[]) => void;
  onConnect: () => void;
  connectBusy: boolean;
  connectBlocked: string | null;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

export function RepoPicker({ handle, projects, onToggle, onRefreshed, onConnect, connectBusy, connectBlocked }: Props) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!handle) return;
    let live = true;
    githubService
      .listRepos(handle)
      .then((repos) => {
        if (!live) return;
        setState({ kind: 'list', repos });
        if (attempt > 0) onRefreshed(repos); // only an explicit refresh updates saved projects
      })
      .catch((e: unknown) => {
        if (!live) return;
        if (e instanceof GithubRateLimited) setState({ kind: 'rate-limited', resetAt: e.resetAt });
        else if (e instanceof GithubUserNotFound) setState({ kind: 'error', message: e.message });
        else setState({ kind: 'error', message: 'Couldn’t reach GitHub. Check your connection and try again.' });
      });
    return () => {
      live = false;
    };
    // onRefreshed is a fresh closure each render; reloading on its identity would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, attempt]);

  const reload = useCallback(() => {
    setState({ kind: 'loading' });
    setAttempt((a) => a + 1);
  }, []);

  if (!handle) {
    return (
      <div className="grid gap-space-2" data-field="repos">
        <p className="m-0">Connect GitHub to pick repos for your card. It also puts a verified ✓ GITHUB sticker on it.</p>
        <button type="button" className="pixel-btn justify-self-start" data-variant="primary" onClick={onConnect} disabled={connectBusy || connectBlocked !== null} aria-busy={connectBusy}>
          {connectBusy ? 'Opening GitHub…' : 'Connect GitHub'}
        </button>
        {connectBlocked && <p className="field-hint m-0">{connectBlocked}</p>}
      </div>
    );
  }

  const picked = new Set(projects.filter((p) => p.source === 'github').map((p) => p.github_repo_id));
  const full = projects.length >= LIMITS.projects;

  return (
    <div className="grid gap-space-2" data-field="repos">
      <div className="flex flex-wrap items-center justify-between gap-space-2">
        <p className="m-0">
          Public repos of <span className="font-mono">@{handle}</span>
        </p>
        <button type="button" className="pixel-btn" onClick={reload} disabled={state.kind === 'loading'} aria-busy={state.kind === 'loading'}>
          {state.kind === 'loading' ? 'Loading…' : 'Refresh from GitHub'}
        </button>
      </div>

      {state.kind === 'loading' && (
        <p className="m-0" role="status">
          Asking GitHub for your repos…
        </p>
      )}
      {state.kind === 'rate-limited' && (
        <p className="field-error m-0" role="alert">
          <span aria-hidden="true">! </span>
          GitHub’s hourly limit for this network is used up
          {state.resetAt ? `. It resets at ${state.resetAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : ''}. Your
          picked projects are safe, and you can still add projects by hand below.
        </p>
      )}
      {state.kind === 'error' && (
        <p className="field-error m-0" role="alert">
          <span aria-hidden="true">! </span>
          {state.message}
        </p>
      )}
      {state.kind === 'list' && state.repos.length === 0 && (
        <p className="m-0">No public repos yet. Add your projects by hand below; private and school work fits there too.</p>
      )}
      {state.kind === 'list' && state.repos.length > 0 && (
        <fieldset className="repo-list">
          <legend className="sr-only">Pick up to {LIMITS.projects} repos</legend>
          {state.repos.map((r) => {
            const on = picked.has(r.id);
            return (
              <label key={r.id} className="repo-row" data-picked={on}>
                <input type="checkbox" checked={on} disabled={!on && full} onChange={(e) => onToggle(r, e.target.checked)} />
                <span className="grid gap-[2px] min-w-0">
                  <span className="font-mono font-semibold break-all">
                    {r.name}
                    {r.fork && <span className="repo-tag">fork</span>}
                    {r.archived && <span className="repo-tag">archived</span>}
                  </span>
                  {r.description && <span className="text-caption text-text-secondary">{r.description}</span>}
                  <span className="text-caption text-text-secondary">
                    {[r.language, `★ ${r.stars}`, `updated ${fmtDate(r.updatedAt)}`].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
      )}
      {full && state.kind === 'list' && <p className="field-hint m-0">Your card holds {LIMITS.projects} projects. Remove one to pick another.</p>}
    </div>
  );
}
