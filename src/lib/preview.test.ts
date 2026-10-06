import { describe, expect, it } from 'vitest';
import { githubRepoOf, previewFor } from './preview';

describe('previewFor (D-092)', () => {
  it('prefers the uploaded screenshot', () => {
    expect(previewFor({ github_url: 'https://github.com/a/b' }, 'https://x.test/c.webp')).toEqual({ kind: 'upload', src: 'https://x.test/c.webp' });
  });
  it('falls back to the repo’s GitHub preview', () => {
    expect(previewFor({ github_url: 'https://github.com/octo-cat/Hello.World' }, null)).toEqual({
      kind: 'github',
      src: 'https://opengraph.githubassets.com/1/octo-cat/Hello.World',
    });
  });
  it('then to the pixel cover', () => {
    expect(previewFor({ github_url: null }, null)).toEqual({ kind: 'pixel' });
    expect(previewFor({ github_url: 'https://gitlab.com/a/b' }, null)).toEqual({ kind: 'pixel' });
  });
});

describe('githubRepoOf', () => {
  it('reads owner and repo, with or without a trailing slash or .git', () => {
    expect(githubRepoOf('https://github.com/me/app/')).toEqual({ owner: 'me', repo: 'app' });
    expect(githubRepoOf('https://github.com/me/app.git')).toEqual({ owner: 'me', repo: 'app' });
  });
  it('refuses anything that is not a plain repo link', () => {
    for (const bad of ['https://github.com/me', 'https://github.com/me/app/issues', 'http://github.com/me/app', 'https://github.com/me/..', 'https://evil.test/github.com/me/app', null])
      expect(githubRepoOf(bad)).toBeNull();
  });
});
