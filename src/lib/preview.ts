// What a Museum console's screen shows (D-092): the member's uploaded screenshot, else GitHub's
// social preview of the project's public repo, else the drawn pixel cover. Pure: the caller passes
// the uploaded image's public URL, since only services know how to build it.

import type { PublicProject } from '../types/card';

export type Preview = { kind: 'upload' | 'github'; src: string } | { kind: 'pixel' };

const REPO = /^https:\/\/github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9_.-]{1,100}?)(?:\.git)?\/?$/;

/** owner/repo from a GitHub repo link, or null when it isn't one. */
export function githubRepoOf(url: string | null | undefined): { owner: string; repo: string } | null {
  const m = REPO.exec(url?.trim() ?? '');
  if (!m || m[2] === '.' || m[2] === '..') return null;
  return { owner: m[1]!, repo: m[2]! };
}

/** GitHub's generated social image for a public repo (free, no key). */
export function githubPreviewUrl(owner: string, repo: string): string {
  return `https://opengraph.githubassets.com/1/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

export function previewFor(project: Pick<PublicProject, 'github_url'>, uploadedUrl: string | null): Preview {
  if (uploadedUrl) return { kind: 'upload', src: uploadedUrl };
  const repo = githubRepoOf(project.github_url);
  if (repo) return { kind: 'github', src: githubPreviewUrl(repo.owner, repo.repo) };
  return { kind: 'pixel' };
}
