// V2-10 (D-118): the archive. An admin compiles a past project in Admin → Archive (event, year,
// award, makers: a member linked to their badge, a typed name, an unnamed maker; no consent to
// name them yet). Visitors find it in The Archive by year, in the Winners' Hall, in its wing and
// on its own page. A member claims another one; an admin confirms, linking them to the slot they
// were; the member hears it, and their profile, badge and titles follow. Supabase data, mocked.
import { expect, test, type Page } from '@playwright/test';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, SEED_WINGS, TINY_PNG, type MockDb, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';

const ME = { id: '00000000-0000-4000-8000-0000000000a1', email: 'me@example.org', name: 'Test Member', role: 'member' as const };
const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', email: 'admin@example.org', name: 'Test Admin', role: 'admin' as const };
const TWO = '00000000-0000-4000-8000-000000000202';
const LAMP = '22222222-0000-4000-8000-000000000001';

function card(id: string, username: string, no: number): Row {
  const base = samples[0]!;
  return { ...base, profile_id: id, username, member_no: no, is_featured: false, card: { ...base.card, skills: [], department: null, username, full_name: `Player ${username}`, is_featured: false, projects: [] } };
}

function hall(): MockDb {
  const db = emptyDb();
  db.published.push(card(ME.id, 'me-player', 1), card(TWO, 'player-2', 2));
  db.wings = SEED_WINGS.map((w) => ({ ...w }));
  db.notifications = [];
  db.recentEvents = [];
  db.identity = true;
  db.earned = { [ME.id]: ['card_holder'], [TWO]: ['card_holder'] };
  db.archive = [];
  db.archiveClaims = [];
  return db;
}

/** A past project already on show: two typed makers who agreed to be named, a named award. */
const lamp = (): Row => ({
  id: LAMP, title: 'Lamp', description: 'A desk lamp that dims with the sun.', year: 2023, season_key: null, event_name: 'Build Week', track: null,
  award_place: null, award_name: 'Best Hardware', award_in_track: false, award_note: 'Small and warm.', team_name: null, tech: ['C++'],
  project_url: null, github_url: null, video_url: null, cover_path: null, names_ok: true, published: true, first_published_at: '2026-10-01T00:00:00Z',
  makers: [{ id: 1001, member_id: null, name: 'Rosa Diaz' }, { id: 1002, member_id: null, name: 'Sam Lee' }],
});

const boot = (page: Page) =>
  page.addInitScript(() => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
  });

test('an admin compiles a past project; it hangs in The Archive, the Winners’ Hall and its wing', async ({ page }) => {
  const db = hall();
  await boot(page);
  await mockSupabase(page, { user: ADMIN, db });
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'Archive' }).click();
  await expect(page.locator('.dialogue').filter({ hasText: 'The archive is empty' })).toBeVisible();

  const form = page.getByRole('form', { name: 'Add a past project' });
  await form.getByLabel('Title').fill('Kite');
  await form.getByLabel('What it is (optional)').fill('A kite that tweets the wind.');
  await form.getByLabel('Year').fill('2024');
  await form.getByLabel('Event', { exact: true }).selectOption({ label: 'An older event (type its name)' });
  await form.getByLabel('Event name').fill('Spring Hackathon');
  await form.getByLabel('Track (optional)').fill('Health');
  await form.getByLabel('Award', { exact: true }).selectOption('1');
  await form.getByLabel('Judges’ note (optional)').fill('Brilliant and simple.');
  await form.getByLabel('Team name (optional)').fill('Team Kite');
  await form.getByLabel('Built with (separated by commas)').fill('Python, Arduino');
  await form.getByLabel('Video (optional)').fill('https://video.example.org/kite');
  await form.locator('.cover-field input[type=file]').setInputFiles({ name: 'kite.png', mimeType: 'image/png', buffer: TINY_PNG });
  await expect(form.getByRole('img', { name: 'Screen picture for Kite' })).toBeVisible();
  await form.getByRole('group', { name: 'Maker 1' }).getByLabel('Member').selectOption({ label: 'Player me-player (@me-player)' });
  await form.getByRole('button', { name: '+ Add a maker' }).click();
  await form.getByRole('group', { name: 'Maker 2' }).getByLabel('Name (optional)').fill('Rosa Diaz');
  await form.getByRole('button', { name: '+ Add a maker' }).click();
  await expect(form.getByLabel('These makers agreed to be named')).not.toBeChecked();
  await form.getByLabel('On show in the Museum').check();
  await form.getByRole('button', { name: 'Add to the archive' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Kite is on show in the Museum.' })).toBeVisible();
  const row = page.getByRole('list', { name: 'Archive exhibits' }).locator('.mart-row');
  await expect(row).toContainText('Spring Hackathon 2024 · Health track · 1st place · 3 makers');
  await expect(row).toContainText('▣ On show');
  const saved = db.archive![0]!;
  expect(saved).toMatchObject({ title: 'Kite', year: 2024, event_name: 'Spring Hackathon', track: 'Health', award_place: 1, team_name: 'Team Kite', tech: ['Python', 'Arduino'], names_ok: false, published: true });
  expect(saved.makers).toMatchObject([{ member_id: ME.id, name: null }, { member_id: null, name: 'Rosa Diaz' }, { member_id: null, name: null }]);
  expect(String(saved.cover_path)).toMatch(new RegExp(`^${ADMIN.id}/[0-9a-f-]{36}\\.webp$`));
  expect(db.coverUploads).toContain(saved.cover_path);
  await page.locator('section[aria-labelledby="archive-admin-title"]').screenshot({ path: 'docs/build/evidence/archive/admin-archive.png' });

  // Visitors: The Archive by year; the typed name stays private without consent.
  const visitor = await page.context().browser()!.newPage({ viewport: { width: 1440, height: 1000 } });
  await boot(visitor);
  await mockSupabase(visitor, { db });
  await visitor.goto('/museum');
  const doors = visitor.getByRole('navigation', { name: 'Rooms' });
  await expect(doors.getByRole('link', { name: /The Archive/ })).toContainText('1 exhibit');
  await expect(doors.getByRole('link', { name: /Data Wing/ })).toBeVisible(); // built with Python
  const winners = visitor.getByRole('region', { name: /Winners’ Hall/ });
  await expect(winners.getByRole('heading', { name: /Spring Hackathon 2024/ })).toContainText('From the Archive');
  await expect(winners.locator('.award-plate[data-place="1"]')).toContainText('Brilliant and simple.');
  await doors.getByRole('link', { name: /The Archive/ }).click();
  await expect(visitor).toHaveURL(/\/museum\?room=archive$/);
  const year = visitor.getByRole('list', { name: 'From 2024' });
  const plaque = year.locator('.exhibit-plaque');
  await expect(plaque).toContainText('by Player me-player and 2 more · Team Kite');
  await expect(plaque).not.toContainText('Rosa Diaz');
  await expect(plaque).toContainText('From the Archive · Spring Hackathon 2024 · Health track');
  await visitor.screenshot({ path: 'docs/build/evidence/archive/archive-room.png', fullPage: true });

  // Its page: where it came from, who made it, the video, and how to claim it.
  await year.getByRole('link', { name: 'Kite' }).click();
  await expect(visitor.locator('#exhibit-maker')).toContainText('Made by Player me-player and 2 more · Team Kite');
  await expect(visitor.getByRole('link', { name: /Watch the video/ })).toHaveAttribute('href', 'https://video.example.org/kite');
  const claim = visitor.getByRole('region', { name: 'Is this yours?' });
  await expect(claim.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  await visitor.close();

  // With the makers' consent, the typed name shows.
  await row.getByRole('button', { name: /^Edit/ }).click();
  const editing = page.getByRole('form', { name: 'Edit Kite' });
  await expect(editing.getByLabel('Title')).toHaveValue('Kite');
  await editing.getByLabel('These makers agreed to be named').check();
  await editing.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Kite is on show in the Museum.' })).toBeVisible();
  expect(db.archive![0]!.names_ok).toBe(true);
});

test('a member claims a past project; an admin links them to the slot they were; their badge follows', async ({ page, browser }) => {
  const db = hall();
  db.archive!.push(lamp());
  await boot(page);
  await mockSupabase(page, { user: ME, db });
  await page.goto(`/museum/${LAMP}`);
  await expect(page.locator('#exhibit-maker')).toContainText('Made by Rosa Diaz and Sam Lee');
  const claim = page.getByRole('region', { name: 'Is this yours?' });
  await claim.getByRole('button', { name: 'Claim it' }).click();
  await claim.getByLabel('What did you do on it? (optional, for the admins)').fill('I wired the light sensor.');
  await claim.getByRole('button', { name: 'Send claim' }).click();
  await expect(claim.getByRole('status')).toHaveText('Claim sent. An admin will check it and link it to your badge.');
  await expect(claim).toContainText('Your claim is with the admins.');
  expect(db.archiveClaims).toMatchObject([{ exhibit_id: LAMP, member_id: ME.id, note: 'I wired the light sensor.', status: 'pending' }]);

  const admin = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await boot(admin);
  await mockSupabase(admin, { user: ADMIN, db });
  await admin.goto('/admin');
  await admin.getByRole('tab', { name: 'Archive' }).click();
  const claims = admin.getByRole('region', { name: /Claims waiting · 1/ });
  await expect(claims).toContainText('Player me-player @me-player claims “Lamp” (Build Week 2023)');
  await expect(claims).toContainText('I wired the light sensor.');
  await claims.getByLabel('Link them as').selectOption({ label: 'Sam Lee (typed name)' });
  await claims.screenshot({ path: 'docs/build/evidence/archive/admin-claim.png' });
  await claims.getByRole('button', { name: /^Confirm/ }).click();
  await expect(admin.getByRole('status').filter({ hasText: 'Player me-player is credited on Lamp.' })).toBeVisible();
  await expect(admin.getByRole('region', { name: /Claims waiting/ })).toHaveCount(0);
  expect(db.archive![0]!.makers).toMatchObject([{ name: 'Rosa Diaz', member_id: null }, { name: 'Sam Lee', member_id: ME.id }]);
  await admin.close();

  // The member hears it; their profile lists it with its proof; their badge wears its ribbon.
  await page.goto('/member/me-player');
  const bell = page.getByRole('button', { name: /Notifications/ });
  await bell.click();
  await expect(page.getByRole('region', { name: 'Notifications' }).getByRole('listitem').first()).toContainText('You’re credited on “Lamp” in the Museum’s Archive.');
  await bell.click();
  const profile = page.locator('.profile-screen');
  const archive = profile.getByRole('region', { name: /In the Museum’s Archive/ });
  await expect(archive).toContainText('Lamp · Build Week 2023 · ♛ Best Hardware');
  await expect(profile.locator('.proof-list')).toContainText('Archive: credited on “Lamp” (Build Week 2023).');
  await expect(profile.locator('.proof-list')).toContainText('Best Hardware at Build Week 2023 with “Lamp”.');
  await expect(profile.locator('.proof-list')).toContainText('Champion:');
  await expect(profile.getByRole('list', { name: 'Badges' }).first()).toContainText('Best Hardware at Build Week 2023');
  await archive.screenshot({ path: 'docs/build/evidence/archive/profile-archive.png' });

  // On the exhibit, they're credited by their badge, and can take their name off again.
  await page.goto(`/museum/${LAMP}`);
  await expect(page.locator('#exhibit-maker').getByRole('link', { name: 'Player me-player' })).toHaveAttribute('href', '/member/me-player');
  await expect(page.locator('#exhibit-maker')).toContainText('Made by Rosa Diaz and Player me-player');
  await expect(claim).toContainText('You’re credited on this exhibit');
  await page.screenshot({ path: 'docs/build/evidence/archive/exhibit-claimed.png', fullPage: true });
  await claim.getByRole('button', { name: 'Take my name off' }).click();
  await expect(claim.getByRole('status')).toContainText('Your name is off it.');
  expect(db.archive![0]!.makers).toMatchObject([{ name: 'Rosa Diaz' }, { name: 'Sam Lee', member_id: null }]);
});
