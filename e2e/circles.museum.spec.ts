// The Museum as two circles (D-129) and the curated Museum (D-130): rooms on one arc, the chosen
// room's exhibits on the other, the exhibit's console and plaque between with VISIT. On show: what
// an admin featured, what won at an announced event, and the archive; an entry that didn't win
// stays on its maker's card. Supabase data source, mocked.
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, type MockDb, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';

const EVIDENCE = 'docs/build/evidence/circles';
mkdirSync(EVIDENCE, { recursive: true });
const ONE = '00000000-0000-4000-8000-000000000301';
const TWO = '00000000-0000-4000-8000-000000000302';
const THREE = '00000000-0000-4000-8000-000000000303';
const COMET = '33333333-0000-4000-8000-000000000001';
const RAFT = '33333333-0000-4000-8000-000000000002';
const LAMP = '33333333-0000-4000-8000-000000000003';
const KITE = '33333333-0000-4000-8000-000000000004';
const day = (days: number) => new Date(Date.now() + 8 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

function card(id: string, username: string, no: number, projects: Row[]): Row {
  const base = samples[0]!;
  const p0 = base.card.projects[0]!;
  return {
    ...base,
    profile_id: id,
    username,
    member_no: no,
    is_featured: false,
    card: { ...base.card, username, full_name: `Player ${username}`, is_featured: false, projects: projects.map((p) => ({ ...p0, collaborators: [], ...p })) },
  };
}

/** Comet is featured; Raft won 1st at a past hackathon where Lamp was entered too; Kite is in the archive. */
function hall(): MockDb {
  const db = emptyDb();
  db.published.push(
    card(ONE, 'player-1', 1, [{ id: COMET, title: 'Comet', description: 'A comet tracker.' }]),
    card(TWO, 'player-2', 2, [{ id: RAFT, title: 'Raft', description: 'A raft that floats on data.' }]),
    card(THREE, 'player-3', 3, [{ id: LAMP, title: 'Lamp', description: 'A lamp that never won.' }]),
  );
  db.museumFeatures = [{ project_id: COMET, member_id: ONE }];
  db.museumEntries = [{ project_id: LAMP, member_id: THREE }]; // offered, never featured
  db.seasons = [
    {
      key: 'spring-hack', name: 'Spring Hackathon', blurb: '', starts_on: day(-10), ends_on: day(-8), mission: null, frame: null,
      counts: null, kind: 'hackathon', tracks: [], submissions_close: ago(24 * 9), results_at: ago(24 * 8), announced_at: ago(24 * 8),
    },
  ];
  db.submissions = [
    { season_key: 'spring-hack', project_id: RAFT, member_id: TWO, track: null, submitted_at: ago(24 * 9.5) },
    { season_key: 'spring-hack', project_id: LAMP, member_id: THREE, track: null, submitted_at: ago(24 * 9.4) },
  ];
  db.awards = [{ id: 1, season_key: 'spring-hack', project_id: RAFT, place: 1, name: null, track: null, note: 'It floats.' }];
  db.archive = [
    {
      id: KITE, title: 'Kite', description: 'A kite from long ago.', year: 2024, season_key: null, event_name: 'Build Week', track: null,
      award_place: null, award_name: null, award_in_track: false, award_note: '', team_name: null, tech: ['C'],
      project_url: null, github_url: null, video_url: null, cover_path: null, names_ok: true, published: true, first_published_at: '2026-10-01T00:00:00Z',
      makers: [{ id: 2001, member_id: null, name: 'Rosa Diaz' }],
    },
  ];
  return db;
}

const boot = (page: Page) =>
  page.addInitScript(() => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
  });
const rooms = (p: Page) => p.getByRole('listbox', { name: 'Rooms' });
const exhibits = (p: Page) => p.locator('#museum-exhibits');
const plaque = (p: Page) => p.locator('.quest-panel');

test('rooms on one arc, the chosen room’s exhibits on the other; only featured, winning and archive projects hang', async ({ page }) => {
  await boot(page);
  await mockSupabase(page, { db: hall() });
  await page.goto('/museum');
  await expect(rooms(page).getByRole('option').first()).toBeVisible();
  // Only the rooms near the chosen one are in the page, each with its place among them all.
  const names = await rooms(page).getByRole('option').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')!.split(',')[0]));
  expect(names[0]).toBe('Winners’ Hall');
  expect(names).toEqual(expect.arrayContaining(['Winners’ Hall', 'Spring Hackathon', 'Featured Wing', 'All exhibits']));
  await expect(rooms(page).getByRole('option').first()).toHaveAttribute('aria-setsize', '6');
  await expect(exhibits(page)).toHaveAccessibleName('Exhibits in Winners’ Hall');
  await expect(exhibits(page).getByRole('option')).toHaveCount(1);
  await expect(plaque(page).getByRole('heading')).toHaveText('Raft');
  await expect(plaque(page)).toContainText('1st place · Spring Hackathon');
  await expect(page.locator('.museum-circles .exhibit-frame')).toHaveCount(1); // the exhibit on its console
  await page.waitForTimeout(800);
  await page.locator('.device-outer').screenshot({ path: `${EVIDENCE}/museum-winners.png` });

  // The event's room holds its winner only: the entry that didn't win isn't on show.
  await rooms(page).getByRole('option', { name: /^Spring Hackathon/ }).click();
  await expect(exhibits(page)).toHaveAccessibleName('Exhibits in Spring Hackathon');
  await expect(exhibits(page).getByRole('option')).toHaveText(['♛']);
  await expect(exhibits(page).getByRole('option')).toHaveAccessibleName(/^Raft, exhibit 1 of 1, 1st place/);

  // The featured project, and the archive (rooms far round the arc are off the screen: the keys turn it).
  await rooms(page).focus();
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowUp');
  await expect(rooms(page).getByRole('option', { selected: true })).toHaveAccessibleName(/^All exhibits/);
  await expect(exhibits(page).getByRole('option')).toHaveCount(2);
  await expect(plaque(page).getByRole('heading')).toHaveText('Comet');
  await rooms(page).getByRole('option', { name: /^The Archive/ }).click();
  await expect(plaque(page).getByRole('heading')).toHaveText('Kite');
  await expect(plaque(page)).toContainText('From the Archive');
  await page.waitForTimeout(800);
  await page.locator('.device-outer').screenshot({ path: `${EVIDENCE}/museum-archive.png` });

  // Nowhere in the Museum: the list view says the same.
  await page.goto('/museum?view=list');
  await expect(page.getByRole('heading', { name: 'Raft' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Comet' }).first()).toBeVisible();
  await expect(page.getByText('Lamp', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Lamp' })).toHaveCount(0);
});

test('MOVE walks the exhibits on into the next room; ROOM jumps; VISIT opens it and Back returns', async ({ page }) => {
  await boot(page);
  await mockSupabase(page, { db: hall() });
  await page.goto('/museum');
  await expect(plaque(page).getByRole('heading')).toHaveText('Raft');
  await page.getByRole('button', { name: 'Next exhibit' }).click(); // the Winners' Hall has one: on into the next room
  await expect(exhibits(page)).toHaveAccessibleName(/^Exhibits in (?!Winners)/);
  await page.getByRole('button', { name: 'Previous exhibit' }).click();
  await expect(exhibits(page)).toHaveAccessibleName('Exhibits in Winners’ Hall');
  await page.getByRole('button', { name: 'ROOM' }).click();
  await expect(rooms(page).getByRole('option', { selected: true })).toHaveAccessibleName(/^Spring Hackathon/);
  await expect(page).toHaveURL(/\/museum\?event=spring-hack$/);

  // Keyboard: ↑/↓ rooms, ←/→ exhibits, Enter visits.
  const screen = page.getByRole('region', { name: /The Museum’s rooms and their exhibits/ });
  await screen.focus();
  await page.keyboard.press('ArrowUp');
  await expect(rooms(page).getByRole('option', { selected: true })).toHaveAccessibleName(/^Winners’ Hall/);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/museum/${RAFT}$`));
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Raft');
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/museum\\?room=winners&at=${RAFT}$`));
  await expect(plaque(page).getByRole('heading')).toHaveText('Raft');
  await plaque(page).getByRole('button', { name: /VISIT/ }).click();
  await expect(page).toHaveURL(new RegExp(`/museum/${RAFT}$`));
});

test('the walk and the list are one link away', async ({ page }) => {
  await boot(page);
  await mockSupabase(page, { db: hall() });
  await page.goto('/museum?room=archive');
  await expect(rooms(page).getByRole('option', { selected: true })).toHaveAccessibleName(/^The Archive/);
  const views = page.getByRole('navigation', { name: 'How to see the Museum' });
  await expect(views.getByRole('link', { name: /Rooms and exhibits/ })).toHaveAttribute('aria-current', 'page');
  await views.getByRole('link', { name: /Walk the Museum/ }).click();
  await expect(page).toHaveURL(/\/museum\?room=archive&view=walk$/);
  await expect(page.locator('.walk-title')).toContainText('The Archive');
  await views.getByRole('link', { name: /List view/ }).click();
  await expect(page).toHaveURL(/\/museum\?room=archive&view=list$/);
});

test('phone: rooms along the top, exhibits along the bottom', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await boot(page);
  await mockSupabase(page, { db: hall() });
  await page.goto('/museum');
  await expect(page.locator('.museum-circles .circles')).toHaveAttribute('data-mode', 'stack');
  await expect(plaque(page).getByRole('heading')).toHaveText('Raft');
  await page.waitForTimeout(800);
  await page.locator('.device-outer').screenshot({ path: `${EVIDENCE}/museum-phone.png` });
  await ctx.close();
});
