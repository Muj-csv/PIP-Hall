import { describe, expect, it } from 'vitest';
import type { CardForm, DraftProject } from '../types/draft';
import { RESERVED_USERNAMES, blankToNull, cleanSkill, suggestUsername, validateCard, validateUsername } from './validate';

const form = (over: Partial<CardForm> = {}): CardForm => ({
  username: 'jum-flores',
  full_name: 'Jum Flores',
  tagline: '',
  bio: '',
  role: '',
  org_position: '',
  department: '',
  linkedin_url: '',
  portfolio_url: '',
  public_email: '',
  show_email: false,
  email_updates: false,
  skills: [],
  avatar_path: null,
  projects: [],
  ...over,
});

const project = (over: Partial<DraftProject> = {}): DraftProject => ({
  key: 'p1',
  source: 'manual',
  github_repo_id: null,
  title: 'Quest',
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

describe('validateUsername (profiles.username check)', () => {
  it('accepts 3–20 lowercase letters, numbers, - and _', () => {
    for (const ok of ['abc', 'muj-csv', 'a_b-c', '0cool', 'x'.repeat(20)]) expect(validateUsername(ok)).toBeNull();
  });
  it('rejects bad shapes', () => {
    for (const bad of ['ab', 'Upper', '-lead', '_lead', 'has space', 'x'.repeat(21), 'émile']) expect(validateUsername(bad)).not.toBeNull();
  });
  it('rejects every reserved word the database rejects', () => {
    for (const r of RESERVED_USERNAMES) if (r.length >= 3) expect(validateUsername(r)).toMatch(/reserved/);
  });
});

describe('validateCard', () => {
  it('passes a minimal card', () => {
    expect(validateCard(form())).toEqual({});
  });
  it('needs a name, at most 60 characters', () => {
    expect(validateCard(form({ full_name: '  ' })).full_name).toBeTruthy();
    expect(validateCard(form({ full_name: 'x'.repeat(61) })).full_name).toMatch(/60/);
    expect(validateCard(form({ full_name: 'x'.repeat(60) })).full_name).toBeUndefined();
  });
  it('limits tagline 80, bio 280, role/position/department 40', () => {
    const e = validateCard(form({ tagline: 'x'.repeat(81), bio: 'x'.repeat(281), role: 'x'.repeat(41), org_position: 'x'.repeat(41), department: 'x'.repeat(41) }));
    expect(Object.keys(e).sort()).toEqual(['bio', 'department', 'org_position', 'role', 'tagline']);
  });
  it('requires https and the LinkedIn domain (linkedin_url check)', () => {
    expect(validateCard(form({ linkedin_url: 'https://www.linkedin.com/in/jum' })).linkedin_url).toBeUndefined();
    expect(validateCard(form({ linkedin_url: 'https://ph.linkedin.com/in/jum' })).linkedin_url).toBeUndefined();
    expect(validateCard(form({ linkedin_url: 'http://www.linkedin.com/in/jum' })).linkedin_url).toBeTruthy();
    expect(validateCard(form({ linkedin_url: 'https://linkedin.evil.example/' })).linkedin_url).toBeTruthy();
  });
  it('requires https links for the website (portfolio_url check)', () => {
    expect(validateCard(form({ portfolio_url: 'https://jum.dev' })).portfolio_url).toBeUndefined();
    expect(validateCard(form({ portfolio_url: 'http://jum.dev' })).portfolio_url).toBeTruthy();
    expect(validateCard(form({ portfolio_url: 'javascript:alert(1)' })).portfolio_url).toBeTruthy();
  });
  it('checks the email shape, and needs one to show', () => {
    expect(validateCard(form({ public_email: 'nope' })).public_email).toBeTruthy();
    expect(validateCard(form({ show_email: true })).public_email).toMatch(/Add the email/);
    expect(validateCard(form({ show_email: true, public_email: 'me@jum.dev' })).public_email).toBeUndefined();
  });
  it('allows at most 8 skills (skills cardinality check)', () => {
    expect(validateCard(form({ skills: Array.from({ length: 8 }, (_, i) => `S${i}`) })).skills).toBeUndefined();
    expect(validateCard(form({ skills: Array.from({ length: 9 }, (_, i) => `S${i}`) })).skills).toMatch(/8/);
  });
  it('allows at most 6 projects (projects_guard PROJECT_LIMIT)', () => {
    const six = Array.from({ length: 6 }, (_, i) => project({ key: `p${i}` }));
    expect(validateCard(form({ projects: six })).projects).toBeUndefined();
    expect(validateCard(form({ projects: [...six, project({ key: 'p7' })] })).projects).toMatch(/6/);
  });
  it('checks each project and keys errors by project', () => {
    const e = validateCard(
      form({
        projects: [
          project({ key: 'a', title: '' }),
          project({ key: 'b', project_url: 'http://x.org', github_url: 'https://gitlab.com/a/b', description: 'x'.repeat(201) }),
        ],
      }),
    );
    expect(e['projects.a.title']).toBeTruthy();
    expect(e['projects.b.project_url']).toBeTruthy();
    expect(e['projects.b.github_url']).toBeTruthy();
    expect(e['projects.b.description']).toMatch(/200/);
  });
  it('skips the username once it is locked after approval', () => {
    expect(validateCard(form({ username: 'BAD' }), { usernameLocked: true }).username).toBeUndefined();
  });
});

describe('helpers', () => {
  it('blankToNull trims and nulls empties', () => {
    expect(blankToNull('  hi ')).toBe('hi');
    expect(blankToNull('   ')).toBeNull();
    expect(blankToNull(null)).toBeNull();
  });
  it('suggestUsername starts from the GitHub handle and always passes validation', () => {
    expect(suggestUsername('Muj-csv', 'x@y.z')).toBe('muj-csv');
    expect(suggestUsername(null, 'Jum.Flores@example.org')).toBe('jum-flores');
    expect(suggestUsername(null, 'ab@example.org')).toBe('abplayer');
    expect(suggestUsername('admin', null)).toBe('admin-1');
    for (const s of [suggestUsername('_._weird__', null), suggestUsername(null, '1@x.y'), suggestUsername('a'.repeat(40), null)]) {
      expect(validateUsername(s)).toBeNull();
    }
  });
  it('cleanSkill collapses spaces', () => {
    expect(cleanSkill('  Next   js ')).toBe('Next js');
  });
});
