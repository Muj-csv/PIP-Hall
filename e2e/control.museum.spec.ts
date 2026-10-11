// The Museum curated end to end (V2-20, D-133): nothing hangs by itself. Winners hang when an admin
// hangs them, featured members hang as portraits with a curator's note, and the rooms follow the
// admins' order, signs and closed doors; a wing can hold hand-picked exhibits. Supabase data source,
// mocked.
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, SEED_WINGS, type MockDb, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';

const EVIDENCE = 'docs/build/evidence/museum-control';
mkdirSync(EVIDENCE, { recursive: true });
const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', email: 'admin@example.org', name: 'Test Admin', role: 'admin' as const };
const ONE = '00000000-0000-4000-8000-000000000401';
const TWO = '00000000-0000-4000-8000-000000000402';
const THREE = '00000000-0000-4000-8000-000000000403';
const COMET = '44444444-0000-4000-8000-000000000001';
const RAFT = '44444444-0000-4000-8000-000000000002';
const LAMP = '44444444-0000-4000-8000-000000000003';
const day = (days: number) => new Date(Date.now() + 8 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

function card(id: string, username: string, no: number, featured: boolean, projects: Row[]): Row {
  const base = samples[0]!;
  const p0 = base.card.projects[0]!;
  return {
    ...base,
    profile_id: id,
    username,
    member_no: no,
    is_featured: featured,
    card: { ...base.card, username, full_name: `Player ${username}`, role: `Role of ${username}`, is_featured: featured, projects: projects.map((p) => ({ ...p0, collaborators: [], ...p })) },
  };
}

/** Comet is featured; Raft won 1st at a past hackathon but nobody hung it; player-3 is a featured member. */
function hall(): MockDb {
  const db = emptyDb();
  db.published.push(
    card(ONE, 'player-1', 1, false, [{ id: COMET, title: 'Comet', description: 'A comet tracker.', language: 'TypeScript' }]),
    card(TWO, 'player-2', 2, false, [{ id: RAFT, title: 'Raft', description: 'A raft that floats on data.' }]),
    card(THREE, 'player-3', 3, true, [{ id: LAMP, title: 'Lamp', description: 'A lamp.' }]),
  );
  db.wings = SEED_WINGS.map((w) => ({ ...w }));
  db.museumFeatures = [{ project_id: COMET, member_id: ONE }];
  db.hungWinners = []; // announced after the update: nothing hangs until an admin hangs it
  db.portraitNotes = [{ member_id: THREE, note: 'Built the first kiosk.' }];
  db.seasons = [
    {
      key: 'spring-hack', name: 'Spring Hackathon', blurb: '', starts_on: day(-10), ends_on: day(-8), mission: null, frame: null,
      counts: null, kind: 'hackathon', tracks: [], submissions_close: ago(24 * 9), results_at: ago(24 * 8), announced_at: ago(24 * 8),
    },
  ];
  db.submissions = [{ season_key: 'spring-hack', project_id: RAFT, member_id: TWO, track: null, submitted_at: ago(24 * 9.5) }];
  db.awards = [{ id: 1, season_key: 'spring-hack', project_id: RAFT, place: 1, name: null, track: null, note: 'It floats.' }];
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

test('visitors see what the admins hung, in their rooms, in their order', async ({ page }) => {
  const db = hall();
  db.museumRooms = [
    { key: 'members', sign: 'Hall of Fame', hidden: false },
    { key: 'wing:collab', sign: null, hidden: true },
  ];
  await boot(page);
  await mockSupabase(page, { db });
  await page.goto('/museum');
  await expect(rooms(page).getByRole('option').first()).toBeVisible();
  // The members' room first, under its sign; the winner nobody hung is nowhere.
  await expect(rooms(page).getByRole('option', { selected: true })).toHaveAccessibleName(/^Hall of Fame, room 1 of/);
  await expect(exhibits(page)).toHaveAccessibleName('Exhibits in Hall of Fame');
  await expect(exhibits(page).getByRole('option')).toHaveCount(1);
  await expect(exhibits(page).getByRole('option')).toHaveAccessibleName('Player player-3, member 1 of 1');
  await expect(plaque(page).getByRole('heading')).toHaveText('Player player-3');
  await expect(plaque(page)).toContainText('FEATURED MEMBER 1/1');
  await expect(plaque(page)).toContainText('Built the first kiosk.');
  await expect(page.locator('.museum-circles .circles-portrait .badge')).toHaveCount(1); // their real badge
  await page.waitForTimeout(800);
  await page.locator('.device-outer').screenshot({ path: `${EVIDENCE}/members-room.png` });
  const names = await rooms(page).getByRole('option').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')!.split(',')[0]));
  expect(names).not.toContain('Winners’ Hall');
  expect(names).not.toContain('Collab Wing');
  expect(names).not.toContain('Spring Hackathon');

  // OPEN PROFILE goes to the member's page.
  await plaque(page).getByRole('button', { name: /OPEN PROFILE/ }).click();
  await expect(page).toHaveURL(/\/member\/player-3$/);

  // The list view: the same doors, the room with its note, and a closed room says so.
  await page.goto('/museum?view=list');
  const doors = page.getByRole('navigation', { name: 'Rooms' }).getByRole('link');
  await expect(doors.first()).toHaveText('All exhibits');
  await expect(doors.nth(1)).toContainText('Hall of Fame');
  await expect(page.getByRole('navigation', { name: 'Rooms' })).not.toContainText('Collab Wing');
  await expect(page.getByRole('heading', { name: 'Raft' })).toHaveCount(0);
  await doors.nth(1).click();
  await expect(page.getByRole('heading', { level: 2, name: /Hall of Fame/ })).toBeVisible();
  await expect(page.locator('.members-room')).toContainText('Built the first kiosk.');
  await expect(page.locator('.members-room').getByRole('link', { name: 'Player player-3' })).toHaveAttribute('href', '/member/player-3');
  await page.locator('.members-room').screenshot({ path: `${EVIDENCE}/members-list.png` });
  await page.goto('/museum?wing=collab&view=list');
  await expect(page.locator('.dialogue .sr-only').first()).toContainText('That room is closed right now.');

  // A featured member's profile says where they hang.
  await page.goto('/member/player-3');
  await expect(page.getByRole('link', { name: 'In the Museum’s Featured Members room' })).toHaveAttribute('href', '/museum?room=members');
});

test('a winner hangs once an admin hangs it; the Winners tab hangs and takes down', async ({ page }) => {
  const db = hall();
  await boot(page);
  await mockSupabase(page, { user: ADMIN, db });
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'Museum' }).click();
  const museum = page.getByRole('tablist', { name: 'The Museum' });
  await expect(museum.getByRole('tab', { name: 'Suggestions' })).toHaveAttribute('aria-selected', 'true');
  await museum.getByRole('tab', { name: 'Winners' }).click();
  const hang = page.getByRole('checkbox', { name: 'Hang Raft' });
  await expect(hang).not.toBeChecked();
  await expect(page.getByText('0 of 1 winner hangs in the Museum')).toBeVisible();
  await page.locator('#museum-panel').screenshot({ path: `${EVIDENCE}/admin-winners.png` });
  await hang.check();
  await expect(page.getByRole('status').filter({ hasText: 'Raft hangs in the Museum.' })).toBeVisible();
  expect(db.hungWinners).toEqual([{ season_key: 'spring-hack', project_id: RAFT }]);
  await expect(page.getByText('1 of 1 winner hangs in the Museum')).toBeVisible();

  await page.goto('/museum?view=list');
  await expect(page.getByRole('heading', { name: 'Raft' }).first()).toBeVisible();

  await page.goto('/admin');
  await page.getByRole('tab', { name: 'Museum' }).click();
  await museum.getByRole('tab', { name: 'Winners' }).click();
  await page.getByRole('button', { name: /^Take all down/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Spring Hackathon’s winners left the Museum.' })).toBeVisible();
  expect(db.hungWinners).toEqual([]);
  await page.getByRole('button', { name: /^Hang all/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Every winner of Spring Hackathon hangs in the Museum.' })).toBeVisible();
  expect(db.hungWinners).toEqual([{ season_key: 'spring-hack', project_id: RAFT }]);
});

test('admins feature members with a note, arrange the rooms, and hand-pick a wing', async ({ page }) => {
  const db = hall();
  await boot(page);
  await mockSupabase(page, { user: ADMIN, db });
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'Museum' }).click();
  const museum = page.getByRole('tablist', { name: 'The Museum' });

  // Members: feature player-1 and write the note under their badge.
  await museum.getByRole('tab', { name: 'Members' }).click();
  await page.getByRole('checkbox', { name: 'Feature Player player-1' }).check();
  await expect(page.getByRole('status').filter({ hasText: 'Player player-1 is featured' })).toBeVisible();
  expect(db.published.find((c) => c.profile_id === ONE)?.is_featured).toBe(true);
  const note = page.getByLabel('Curator’s note under Player player-1’s badge');
  await note.fill('Tracks every comet.');
  await page.getByRole('button', { name: 'Save note for Player player-1' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'The note under Player player-1’s badge is saved.' })).toBeVisible();
  expect(db.portraitNotes).toEqual(expect.arrayContaining([{ member_id: ONE, note: 'Tracks every comet.' }]));
  await page.locator('#museum-panel').screenshot({ path: `${EVIDENCE}/admin-members.png` });

  // Rooms: Featured Members first under a sign, the Featured Wing closed.
  await museum.getByRole('tab', { name: 'Rooms' }).click();
  const list = page.getByRole('list', { name: 'Rooms in walking order' });
  await expect(list.getByRole('listitem').first()).toBeVisible();
  const members = list.getByRole('listitem').filter({ hasText: 'Featured Members' });
  for (let i = 0; i < 6 && (await list.getByRole('listitem').first().textContent())?.includes('Featured Members') === false; i++) await members.getByRole('button', { name: /^▲ Up/ }).click();
  await expect(list.getByRole('listitem').first()).toContainText('Featured Members');
  await members.getByLabel('Sign on the door').fill('Hall of Fame');
  await list.getByRole('listitem').filter({ hasText: 'Featured Wing' }).getByLabel('Closed to visitors').check();
  await page.locator('#museum-panel').screenshot({ path: `${EVIDENCE}/admin-rooms.png` });
  await page.getByRole('button', { name: 'Save the rooms' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'The Museum’s rooms are arranged.' })).toBeVisible();
  expect(db.museumRooms![0]).toEqual({ key: 'members', sign: 'Hall of Fame', hidden: false });
  expect(db.museumRooms).toEqual(expect.arrayContaining([{ key: 'wing:featured', sign: null, hidden: true }]));

  // Wings: a wing with no tools, holding a hand-picked exhibit.
  await page.getByRole('tab', { name: 'Wings', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).last().fill('Curators’ Picks');
  await page.getByRole('button', { name: 'Open wing' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Curators’ Picks is open.' })).toBeVisible();
  const picks = page.locator('details.wing-picks').filter({ hasText: 'Hand-picked exhibits in Curators’ Picks' });
  await picks.locator('summary').click();
  await picks.getByRole('checkbox', { name: /Comet/ }).check();
  await picks.getByRole('button', { name: /^Save the picks/ }).click();
  await expect(page.getByRole('status').filter({ hasText: '1 hand-picked exhibit hangs in Curators’ Picks.' })).toBeVisible();
  expect(db.wingPicks).toEqual([{ wing: 'curators-picks', project_id: COMET }]);

  // The visitors' Museum follows.
  await page.goto('/museum?view=list');
  const doors = page.getByRole('navigation', { name: 'Rooms' });
  await expect(doors.getByRole('link').nth(1)).toContainText('Hall of Fame');
  await expect(doors).not.toContainText('Featured Wing');
  await doors.getByRole('link', { name: /Curators’ Picks/ }).click();
  await expect(page.getByRole('heading', { name: 'Comet' }).first()).toBeVisible();
  await expect(page.getByText('Exhibits the curators picked for this wing.')).toBeVisible();
});
