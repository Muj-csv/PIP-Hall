import { describe, expect, it } from 'vitest';
import { errorsByTab, tabFrom, tabOfField } from './editorTabs';

describe('My Card tabs', () => {
  it('puts the Quest Log’s fields in Projects and the rest in Info', () => {
    expect(tabOfField('repos')).toBe('projects');
    expect(tabOfField('projects')).toBe('projects');
    expect(tabOfField('projects.gh-1.title')).toBe('projects');
    for (const f of ['username', 'full_name', 'bio', 'role', 'photo', 'skills', 'linkedin_url']) expect(tabOfField(f)).toBe('info');
  });

  it('counts the fields that need a look in each tab', () => {
    expect(errorsByTab({ full_name: 'x', bio: 'x', 'projects.a.title': 'x' })).toEqual({ info: 2, projects: 1, customize: 0, account: 0 });
    expect(errorsByTab({})).toEqual({ info: 0, projects: 0, customize: 0, account: 0 });
  });

  it('reads the tab from the address, and falls back to Info', () => {
    expect(tabFrom('customize')).toBe('customize');
    expect(tabFrom('account')).toBe('account');
    expect(tabFrom(null)).toBe('info');
    expect(tabFrom('admin')).toBe('info');
  });
});
