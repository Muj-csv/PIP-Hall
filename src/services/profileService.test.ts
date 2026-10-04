import { describe, expect, it } from 'vitest';
import type { DraftProject } from '../types/draft';
import { planProjects, saveErrorMessage } from './profileService';

const p = (id: string | undefined, title: string, over: Partial<DraftProject> = {}): DraftProject => ({
  id,
  key: id ?? `new-${title}`,
  source: 'manual',
  github_repo_id: null,
  title,
  description: null,
  cover_path: null,
  project_url: null,
  github_url: null,
  language: null,
  stars: null,
  tech_stack: [],
  project_date: null,
  ...over,
});

describe('planProjects', () => {
  const saved = [p('a', 'A'), p('b', 'B'), p('c', 'C')];

  it('touches nothing when nothing changed (a project write would reset review)', () => {
    expect(planProjects(saved, saved)).toEqual({ remove: [], update: [], insert: [] });
  });
  it('removes dropped projects and inserts new ones', () => {
    const plan = planProjects(saved, [p('a', 'A'), p('c', 'C'), p(undefined, 'D')]);
    expect(plan.remove).toEqual(['b']);
    expect(plan.insert.map((r) => [r.title, r.sort_order])).toEqual([['D', 2]]);
    expect(plan.update.map((u) => [u.id, u.row.sort_order])).toEqual([['c', 1]]); // moved up one place
  });
  it('updates only the edited row', () => {
    const plan = planProjects(saved, [p('a', 'A'), p('b', 'B renamed'), p('c', 'C')]);
    expect(plan.update.map((u) => u.id)).toEqual(['b']);
  });
  it('records a reorder as new sort orders', () => {
    const plan = planProjects(saved, [p('c', 'C'), p('a', 'A'), p('b', 'B')]);
    expect(plan.update.map((u) => [u.id, u.row.sort_order])).toEqual([['c', 0], ['a', 1], ['b', 2]]);
  });
  it('stores blanks as null and drops the repo id from manual projects', () => {
    const plan = planProjects([], [p(undefined, '  Spaced  ', { description: '   ', github_repo_id: 9 })]);
    expect(plan.insert[0]).toMatchObject({ title: 'Spaced', description: null, github_repo_id: null });
  });
});

describe('saveErrorMessage', () => {
  it('explains a taken username', () => {
    expect(saveErrorMessage({ code: '23505', message: 'duplicate key value violates unique constraint "profiles_username_key"' })).toMatch(/taken/);
  });
  it('explains the database guards', () => {
    expect(saveErrorMessage({ code: 'P0001', message: 'USERNAME_LOCKED' })).toMatch(/locked/);
    expect(saveErrorMessage({ code: 'P0001', message: 'PROJECT_LIMIT' })).toMatch(/6 projects/);
  });
  it('keeps the member’s work when the network drops', () => {
    expect(saveErrorMessage(new TypeError('Failed to fetch'))).toMatch(/still here/);
  });
});
