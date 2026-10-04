// Guards the editor's writes against the database's column grants (supabase/migrations). A column
// the grant doesn't list makes Postgres refuse the whole write with "permission denied for table",
// which the e2e mock can't notice, so the grants are read from the migrations themselves.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CardForm, DraftProject } from '../types/draft';
import { planProjects, profileRow, projectRow } from './profileService';
import { PREF_COLUMNS } from './accountService';

const dir = join(__dirname, '../../supabase/migrations');
const sql = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(dir, f), 'utf8'))
  .join('\n');

/** Column renames applied by later migrations (D-027). */
const RENAMED: Record<string, string> = { avatar_url: 'avatar_path', cover_url: 'cover_path' };

function granted(action: 'insert' | 'update', table: string): Set<string> {
  const re = new RegExp(`grant\\s+${action}\\s*\\(([^)]*)\\)\\s*on\\s+public\\.${table}\\s+to\\s+authenticated`, 'gi');
  const cols = new Set<string>();
  for (const m of sql.matchAll(re)) for (const c of m[1]!.split(',')) cols.add(RENAMED[c.trim()] ?? c.trim());
  return cols;
}

const project = (over: Partial<DraftProject> = {}): DraftProject => ({
  id: 'p1', key: 'p1', source: 'github', github_repo_id: 7, title: 'Repo', description: 'd', cover_path: null,
  project_url: 'https://x.example', github_url: 'https://github.com/a/b', language: 'TS', stars: 3, tech_stack: ['TS'], project_date: null, ...over,
});

const form: CardForm = {
  username: 'jum', full_name: 'Jum', tagline: '', bio: '', role: '', org_position: '', department: '', linkedin_url: '', portfolio_url: '',
  public_email: '', show_email: false, email_updates: false, skills: [], avatar_path: null, projects: [],
};

describe('editor writes stay inside the column grants', () => {
  it('reads the grants from the migrations', () => {
    expect(granted('update', 'projects').size).toBeGreaterThan(5);
    expect(granted('insert', 'profiles').size).toBeGreaterThan(5);
  });

  it('project inserts send only insertable columns', () => {
    const plan = planProjects([], [project({ id: undefined })]);
    const cols = Object.keys({ ...plan.insert[0], profile_id: 'u' });
    expect(cols.filter((c) => !granted('insert', 'projects').has(c))).toEqual([]);
  });

  it('project updates send only updatable columns (not source or github_repo_id)', () => {
    const plan = planProjects([project()], [project({ title: 'Renamed', stars: 9 })]);
    expect(plan.update).toHaveLength(1);
    expect(Object.keys(plan.update[0]!.row).filter((c) => !granted('update', 'projects').has(c))).toEqual([]);
  });

  it('every editable project column is updatable', () => {
    const all = Object.keys(projectRow(project(), 0)).filter((c) => c !== 'source' && c !== 'github_repo_id');
    expect(all.filter((c) => !granted('update', 'projects').has(c))).toEqual([]);
  });

  it('profile inserts and updates send only granted columns', () => {
    const insert = Object.keys({ id: 'u', ...profileRow(form, { includeUsername: true }) });
    const update = Object.keys(profileRow(form, { includeUsername: true }));
    expect(insert.filter((c) => !granted('insert', 'profiles').has(c))).toEqual([]);
    expect(update.filter((c) => !granted('update', 'profiles').has(c))).toEqual([]);
  });

  it('Settings email choices are updatable', () => {
    expect(PREF_COLUMNS.filter((c) => !granted('update', 'profiles').has(c))).toEqual([]);
  });
});
