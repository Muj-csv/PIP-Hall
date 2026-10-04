// GitHub: connect as a second identity (D-003) and list the member's public repos (D-016).
// The handle is copied server-side by sync_github_identity(), never typed into a form. Repos are
// read in the member's browser with no token (public data, 60 requests/hour per IP) and saved as
// copies in `projects`, so visitors never wait on GitHub.

import { LIMITS, PATTERNS } from '../lib/validate';
import type { DraftProject } from '../types/draft';
import { callbackUrl } from './authService';
import { requireSupabase } from './supabase';

export interface GithubRepo {
  id: number;
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  updatedAt: string;
  htmlUrl: string;
  homepage: string | null;
  fork: boolean;
  archived: boolean;
}

export class GithubRateLimited extends Error {
  constructor(public readonly resetAt: Date | null) {
    super('GitHub’s hourly limit for this network is used up.');
    this.name = 'GithubRateLimited';
  }
}

export class GithubUserNotFound extends Error {
  constructor(handle: string) {
    super(`GitHub has no user called @${handle}.`);
    this.name = 'GithubUserNotFound';
  }
}

interface RawRepo {
  id: number;
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  pushed_at: string | null;
  updated_at: string;
  html_url: string;
  homepage: string | null;
  fork: boolean;
  archived: boolean;
}

export function toRepo(r: RawRepo): GithubRepo {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    language: r.language,
    stars: r.stargazers_count,
    updatedAt: r.pushed_at ?? r.updated_at,
    htmlUrl: r.html_url,
    homepage: r.homepage,
    fork: r.fork,
    archived: r.archived,
  };
}

/** A picked repo as a project row. Titles and descriptions are trimmed to the card's limits. */
export function repoToProject(repo: GithubRepo, key: string): DraftProject {
  const homepage = repo.homepage?.trim() ?? '';
  return {
    key,
    source: 'github',
    github_repo_id: repo.id,
    title: repo.name.slice(0, LIMITS.project_title),
    description: repo.description ? repo.description.slice(0, LIMITS.project_description) : null,
    cover_path: null,
    project_url: PATTERNS.url.test(homepage) ? homepage : null,
    github_url: PATTERNS.githubRepo.test(repo.htmlUrl) ? repo.htmlUrl : null,
    language: repo.language ? repo.language.slice(0, LIMITS.project_language) : null,
    stars: repo.stars,
    tech_stack: [],
    project_date: null,
  };
}

/** "Refresh from GitHub": updates the facts GitHub owns, keeps the member's own title and description. */
export function refreshProject(p: DraftProject, repo: GithubRepo): DraftProject {
  return {
    ...p,
    language: repo.language ? repo.language.slice(0, LIMITS.project_language) : null,
    stars: repo.stars,
    github_url: PATTERNS.githubRepo.test(repo.htmlUrl) ? repo.htmlUrl : p.github_url,
  };
}

export const githubService = {
  /** Full-page redirect to GitHub; requires "manual linking" enabled in Supabase Auth. */
  async connect(next = '/edit'): Promise<void> {
    const sb = requireSupabase();
    const { error } = await sb.auth.linkIdentity({ provider: 'github', options: { redirectTo: callbackUrl(next) } });
    if (error) throw error;
  },

  /** Copies the verified handle onto the caller's profile (if it exists) and returns it. */
  async sync(): Promise<string | null> {
    const sb = requireSupabase();
    const { data, error } = await sb.rpc('sync_github_identity');
    if (error) throw error;
    return typeof data === 'string' && data ? data : null;
  },

  /** Public repos the member owns, most recently pushed first. */
  async listRepos(handle: string): Promise<GithubRepo[]> {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(handle)}/repos?type=owner&sort=pushed&per_page=100`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if ((res.status === 403 || res.status === 429) && res.headers.get('x-ratelimit-remaining') === '0') {
      const reset = Number(res.headers.get('x-ratelimit-reset'));
      throw new GithubRateLimited(Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000) : null);
    }
    if (res.status === 404) throw new GithubUserNotFound(handle);
    if (!res.ok) throw new Error(`GitHub answered ${res.status}. Try again in a moment.`);
    return ((await res.json()) as RawRepo[]).map(toRepo);
  },
};
