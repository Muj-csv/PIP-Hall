import { describe, expect, it } from 'vitest';
import type { AuthUser } from '../services/authService';
import type { DraftProfile, MyCard } from '../types/draft';
import { formFrom, previewCard, statusView } from './editorModel';
import { validateCard } from './validate';

const user: AuthUser = { id: 'u1', email: 'jum@example.org', name: 'Jum Flores', githubHandle: 'Muj-csv' };
const profile = (over: Partial<DraftProfile> = {}): DraftProfile => ({
  id: 'u1',
  username: 'muj-csv',
  full_name: 'Jum Flores',
  tagline: null,
  bio: 'Builds things',
  role: null,
  org_position: null,
  department: null,
  avatar_path: null,
  github_username: 'Muj-csv',
  linkedin_url: null,
  portfolio_url: null,
  public_email: 'jum@example.org',
  show_email: false,
  email_updates: false,
  skills: ['PWA'],
  status: 'draft',
  review_note: null,
  is_featured: false,
  username_locked: false,
  member_no: null,
  ...over,
});
const mine = (over: Partial<MyCard> = {}): MyCard => ({ profile: profile(), projects: [], hasLiveCard: false, ...over });

describe('statusView', () => {
  it('says the live version is older when an approved card is being edited (Phase 3 acceptance)', () => {
    const v = statusView('draft', { hasLiveCard: true, reviewNote: null, dirty: false });
    expect(v.text).toMatch(/^Live version is older — submit changes/);
    expect(v.submit).toBe('Submit changes');
  });
  it('offers to submit a first draft', () => {
    expect(statusView('draft', { hasLiveCard: false, reviewNote: null, dirty: false }).submit).toBe('Submit for review');
  });
  it('lets a brand-new card save and submit in one go', () => {
    expect(statusView(null, { hasLiveCard: false, reviewNote: null, dirty: true }).submit).toBe('Save and submit for review');
  });
  it('shows pending with the … emote and no submit until something changes', () => {
    const v = statusView('pending_review', { hasLiveCard: false, reviewNote: null, dirty: false });
    expect(v.emote).toBe('pending');
    expect(v.submit).toBeNull();
    expect(statusView('pending_review', { hasLiveCard: false, reviewNote: null, dirty: true }).submit).toBe('Save and resubmit');
  });
  it('quotes the admin’s note on a rejected card and needs a change to resubmit', () => {
    const v = statusView('rejected', { hasLiveCard: false, reviewNote: 'Add a photo please', dirty: false });
    expect(v.text).toContain('“Add a photo please”');
    expect(v.emote).toBe('attention');
    expect(v.submit).toBeNull();
    expect(v.submitHint).toBeTruthy();
  });
  it('celebrates an approved card with ♥', () => {
    expect(statusView('approved', { hasLiveCard: true, reviewNote: null, dirty: false }).emote).toBe('approved');
  });
});

describe('formFrom', () => {
  it('starts a new card from the GitHub handle and Google name, and it validates', () => {
    const f = formFrom({ profile: null, projects: [], hasLiveCard: false }, user);
    expect(f.username).toBe('muj-csv');
    expect(f.full_name).toBe('Jum Flores');
    expect(validateCard(f)).toEqual({});
  });
  it('loads an existing draft with blanks as empty strings', () => {
    const f = formFrom(mine(), user);
    expect(f.bio).toBe('Builds things');
    expect(f.tagline).toBe('');
    expect(f.skills).toEqual(['PWA']);
  });
});

describe('previewCard', () => {
  it('shows the email only when the member chose to show it', () => {
    const f = formFrom(mine(), user);
    expect(previewCard(f, mine(), user).card.public_email).toBeNull();
    expect(previewCard({ ...f, show_email: true }, mine(), user).card.public_email).toBe('jum@example.org');
  });
  it('uses the verified GitHub handle, never a typed one', () => {
    expect(previewCard(formFrom(mine(), user), mine(), user).card.github_username).toBe('Muj-csv');
  });
  it('carries the member number once approved', () => {
    const m = mine({ profile: profile({ member_no: 7 }) });
    expect(previewCard(formFrom(m, user), m, user).no).toBe(7);
  });
});
