// V2-12 (D-109, D-120, D-127): the showcase. An admin opens the kiosk from Admin → Events; it tours
// the event's room by itself (plaque, ribbon, judges' note, a big QR), pauses when touched and plays
// on after a minute, and shows the hall's badges in its Hall mode. Its check-in QR stamps a guest's
// device Passport and a member's account (counted in the event's numbers). Placards print four to a
// page; a placard's QR opens the exhibit on a phone ("You found this exhibit!") with the next one in
// the room; posters are drawn in the browser. Supabase data source, mocked, PIPs on.
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, statSync } from 'node:fs';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, type MockDb, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';

const EVIDENCE = 'docs/build/evidence/showcase';
mkdirSync(EVIDENCE, { recursive: true });
const ME = { id: '00000000-0000-4000-8000-0000000000a1', email: 'me@example.org', name: 'Test Member', role: 'member' as const };
const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', email: 'admin@example.org', name: 'Test Admin', role: 'admin' as const };
const TWO = '00000000-0000-4000-8000-000000000202';
const THREE = '00000000-0000-4000-8000-000000000203';
const KITE = '11111111-0000-4000-8000-000000000001';
const ORBIT = '11111111-0000-4000-8000-000000000003';
const CODE = 'abcdef123456';

const day = (days: number) => new Date(Date.now() + 8 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

function card(id: string, username: string, no: number, projects: Row[]): Row {
  const base = samples[0]!;
  const p0 = base.card.projects[0]!;
  return {
    ...base,
    profile_id: id,
    username,
    member_no: no,
    is_featured: false,
    card: { ...base.card, skills: ['Design'], department: null, username, full_name: `Player ${username}`, is_featured: false, projects: projects.map((p) => ({ ...p0, collaborators: [], ...p })) },
  };
}

/** A hackathon on now, its results announced: Kite won 1st place, Orbit a track award. */
function hall(): MockDb {
  const db = emptyDb();
  db.published.push(
    card(ME.id, 'me-player', 1, [{ id: KITE, title: 'Kite', description: 'A kite that tweets the wind.' }]),
    card(TWO, 'player-2', 2, [{ id: ORBIT, title: 'Orbit', description: 'Satellites you can hear.' }]),
    card(THREE, 'player-3', 3, []),
  );
  db.notifications = [];
  db.recentEvents = [];
  db.seasons = [
    {
      key: 'spring-hack',
      name: 'Spring Hackathon',
      blurb: 'Build something useful in a weekend.',
      starts_on: day(-1),
      ends_on: day(1),
      mission: null,
      frame: null,
      counts: { joined: 0, projects: 0, exhibits: 0, teamups: 0 },
      kind: 'hackathon',
      tracks: ['Health', 'Education'],
      submissions_close: inHours(-20),
      results_at: inHours(-2),
      announced_at: inHours(-1),
      checkin_code: CODE,
    },
  ];
  db.submissions = [
    { season_key: 'spring-hack', project_id: KITE, member_id: ME.id, track: 'Health', submitted_at: inHours(-30) },
    { season_key: 'spring-hack', project_id: ORBIT, member_id: TWO, track: 'Education', submitted_at: inHours(-25) },
  ];
  db.awards = [
    { id: 1, season_key: 'spring-hack', project_id: KITE, place: 1, name: null, track: null, note: 'A clear idea, shipped beautifully.' },
    { id: 2, season_key: 'spring-hack', project_id: ORBIT, place: null, name: 'Best UI', track: 'Education', note: '' },
  ];
  return db;
}

const boot = (page: Page) =>
  page.addInitScript(() => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
  });

test('an admin gets the kiosk link for an event, with a check-in code they can renew', async ({ page }) => {
  const db = hall();
  delete db.seasons![0]!.checkin_code;
  await boot(page);
  await mockSupabase(page, { user: ADMIN, db });
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'Events' }).click();
  await page.getByRole('button', { name: 'Showcase of Spring Hackathon' }).click();
  const panel = page.getByRole('region', { name: 'Showcase · Spring Hackathon' });
  const link = panel.getByLabel('Kiosk link');
  await expect(link).toHaveValue(/^https:\/\/pip-hall\.example\/booth\?event=spring-hack&c=[0-9a-f]{12}$/);
  const first = await link.inputValue();
  expect(db.seasons![0]!.checkin_code).toBe(first.split('c=')[1]);
  await expect(panel.getByRole('link', { name: /Open the kiosk/ })).toHaveAttribute('href', `/booth?event=spring-hack&c=${db.seasons![0]!.checkin_code}`);
  await expect(panel.getByRole('link', { name: /Placards to print/ })).toHaveAttribute('href', '/print?event=spring-hack');
  await panel.screenshot({ path: `${EVIDENCE}/admin-showcase.png` });

  // Renewing asks first, then makes a new code: links handed out before stop working.
  await panel.getByRole('button', { name: 'Renew code' }).click();
  await expect(panel).toContainText('Links handed out before will stop working.');
  await panel.getByRole('button', { name: 'Renew', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('New code made.');
  await expect(link).not.toHaveValue(first);
  await expect(link).toHaveValue(new RegExp(`c=${db.seasons![0]!.checkin_code}$`));
});

test('the kiosk tours the event’s room by itself, pauses when touched, and plays on after a minute', async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await boot(page);
  await mockSupabase(page, { db: hall() });
  await page.goto(`/booth?event=spring-hack&c=${CODE}`);

  // No top bar and no sign-in on a public screen.
  await expect(page.getByRole('link', { name: /Sign in/i })).toHaveCount(0);
  await expect(page.locator('header nav')).toHaveCount(0);
  const kiosk = page.getByRole('main', { name: 'PIP-Hall showcase' });
  await expect(kiosk.locator('.booth-brand')).toHaveText('PIP-HALL · Spring Hackathon');
  const slide = kiosk.locator('.booth-slide');
  await expect(slide.locator('.booth-kicker')).toHaveText('Spring Hackathon · 1 of 2');
  await expect(slide.getByRole('heading', { level: 1 })).toHaveText('Kite');
  await expect(slide.getByRole('list', { name: 'Awards' })).toContainText('1st place · Spring Hackathon');
  await expect(slide).toContainText('A clear idea, shipped beautifully.');
  await expect(slide.getByRole('img', { name: 'QR code for Kite' })).toBeVisible();
  // While the event is on, the kiosk's check-in QR.
  const checkin = kiosk.getByRole('complementary', { name: 'CHECK IN' });
  await expect(checkin).toContainText('visited the showcase at Spring Hackathon');
  await expect(checkin.getByRole('img', { name: 'QR code to check in at Spring Hackathon' })).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/kiosk-tour.png` });

  // About 12 seconds each.
  await page.clock.runFor(12_500);
  await expect(slide.locator('.booth-kicker')).toHaveText('Spring Hackathon · 2 of 2');
  await expect(slide.getByRole('heading', { level: 1 })).toHaveText('Orbit');
  await expect(slide.getByRole('list', { name: 'Awards' })).toContainText('Best UI · Education track · Spring Hackathon');

  // A touch pauses it; it stays put, then plays on a minute later.
  await slide.click();
  await expect(kiosk.getByRole('button', { name: '▶ Play' })).toBeVisible();
  await expect(kiosk.locator('.booth-hint')).toHaveText('Paused. It plays on by itself after a minute.');
  await page.clock.runFor(30_000);
  await expect(slide.getByRole('heading', { level: 1 })).toHaveText('Orbit');
  await kiosk.getByRole('button', { name: 'Back' }).click(); // browsing by hand keeps it paused
  await expect(slide.getByRole('heading', { level: 1 })).toHaveText('Kite');
  await page.clock.runFor(61_000);
  await expect(kiosk.getByRole('button', { name: '❚❚ Pause' })).toBeVisible();
  await expect(kiosk.locator('.booth-hint')).toHaveText('Touch the screen to pause.');

  // The Hall: the hall's attract mode, one badge at a time with its QR; back to the tour untouched.
  await kiosk.getByRole('button', { name: 'Hall' }).click();
  await expect(kiosk.getByRole('button', { name: 'Hall' })).toHaveAttribute('aria-pressed', 'true');
  await expect(slide.locator('.booth-kicker')).toHaveText('In the hall · 1 of 3');
  await expect(slide.getByRole('heading', { level: 1 })).toHaveText('Player me-player');
  await expect(slide.getByRole('img', { name: 'QR code for Player me-player’s page' })).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/kiosk-hall.png` });
  await page.clock.runFor(61_000);
  await expect(kiosk.getByRole('button', { name: 'Museum tour' })).toHaveAttribute('aria-pressed', 'true');
});

test('without a good code the kiosk tours on, with no check-in QR', async ({ page }) => {
  await boot(page);
  await mockSupabase(page, { db: hall() });
  await page.goto('/booth?event=spring-hack&c=000000000000');
  const kiosk = page.getByRole('main', { name: 'PIP-Hall showcase' });
  await expect(kiosk.getByRole('heading', { level: 1 })).toHaveText('Kite');
  await expect(kiosk.getByRole('complementary', { name: 'CHECK IN' })).toHaveCount(0);
});

test('a guest scans the check-in QR: a device stamp, once per event, and the code leaves the address', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await boot(page);
  const db = hall();
  await mockSupabase(page, { db });
  await page.goto(`/checkin/spring-hack?c=${CODE.toUpperCase()}`);
  await expect(page.getByRole('img', { name: 'Passport stamp: visited the showcase at Spring Hackathon' })).toBeVisible();
  await expect(page.locator('.dialogue .sr-only').first()).toContainText('Stamped! Visited the showcase at Spring Hackathon. It’s saved in the Passport on this device.');
  await expect(page).toHaveURL(/\/checkin\/spring-hack$/);
  await expect(page.getByRole('navigation', { name: 'What next' }).getByRole('link', { name: 'Make your card' })).toBeVisible();
  await expect(page.locator('.dialogue-say[data-done="true"]')).toBeVisible(); // the line has finished typing
  await page.waitForTimeout(500); // and the stamp has landed
  await page.screenshot({ path: `${EVIDENCE}/checkin-guest.png`, fullPage: true });
  expect(db.eventCheckins ?? []).toHaveLength(0); // guests: on the device only
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('piphall-passport-v1') ?? '{}'));
  expect(stored.checkins).toMatchObject([{ id: 'spring-hack', name: 'Spring Hackathon' }]);

  // Scanning again: already stamped.
  await page.goto(`/checkin/spring-hack?c=${CODE}`);
  await expect(page.locator('.dialogue .sr-only').first()).toContainText('You already have this stamp');

  // In the Passport, on its Showcases page.
  await page.getByRole('link', { name: 'Open your Passport' }).click();
  const shows = page.getByRole('list', { name: 'Showcases you checked in at' });
  await expect(shows).toContainText('Visited the showcase at Spring Hackathon');
  await page.locator('#pp-showcases').scrollIntoViewIfNeeded();
  await page.locator('.passport-screen').screenshot({ path: `${EVIDENCE}/passport-showcases.png` });
});

test('an old or missing code, and an event that isn’t on, give no stamp', async ({ page }) => {
  await boot(page);
  const db = hall();
  db.seasons!.push({ ...db.seasons![0]!, key: 'later-week', name: 'Later Week', kind: 'event', starts_on: day(20), ends_on: day(21), checkin_code: 'feedfeedfeed' });
  await mockSupabase(page, { db });
  await page.goto('/checkin/spring-hack?c=000000000000');
  await expect(page.locator('.dialogue .sr-only').first()).toContainText('This check-in link for the showcase at Spring Hackathon has expired.');
  await page.goto('/checkin/spring-hack');
  await expect(page.locator('.dialogue .sr-only').first()).toContainText('Scan the check-in QR on the screen at the showcase at Spring Hackathon');
  await page.goto('/checkin/later-week?c=feedfeedfeed');
  await expect(page.locator('.dialogue .sr-only').first()).toContainText('isn’t right now');
  await page.goto('/checkin/nope?c=feedfeedfeed');
  await expect(page.locator('.dialogue .sr-only').first()).toContainText('There’s no event with this check-in.');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('piphall-passport-v1') ?? '{}'));
  expect(stored.checkins ?? []).toHaveLength(0);
});

test('a member checks in to their account, counted in the event’s numbers; no PIPs', async ({ page }) => {
  await boot(page);
  const db = hall();
  await mockSupabase(page, { user: ME, db });
  const ledger = (db.ledger ?? []).length;
  await page.goto(`/checkin/spring-hack?c=${CODE}`);
  await expect(page.locator('.dialogue .sr-only').first()).toContainText('Stamped! Visited the showcase at Spring Hackathon. It’s in your Passport.');
  await expect(page.getByRole('navigation', { name: 'What next' }).getByRole('link', { name: 'Make your card' })).toHaveCount(0);
  expect(db.eventCheckins).toMatchObject([{ member_id: ME.id, season_key: 'spring-hack', source: 'verified' }]);
  expect((db.ledger ?? []).length).toBe(ledger);
  await page.goto('/');
  await page.getByRole('tab', { name: /Event/ }).click();
  await expect(page.locator('#event')).toContainText('1 checked in at the showcase');
});

test('a member brings a guest check-in from their device into the account, as history', async ({ page }) => {
  const db = hall();
  const at = inHours(-3);
  await page.addInitScript((stamp) => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
    // Checked in as a guest on this phone, before signing in.
    localStorage.setItem('piphall-passport-v1', JSON.stringify({ people: [], exhibits: [], checkins: [stamp] }));
  }, { id: 'spring-hack', name: 'Spring Hackathon', at });
  await mockSupabase(page, { user: ME, db });
  await page.goto('/passport');
  const screen = page.locator('.passport-screen');
  await expect(screen).toContainText('This device has 1 stamp your account doesn’t.');
  await screen.getByRole('button', { name: 'Bring them over' }).click();
  await expect(screen.getByRole('status')).toHaveText('Added 1 stamp from this device to your Passport, as history.');
  await expect(screen.getByRole('list', { name: 'Showcases you checked in at' })).toContainText('From this device');
  expect(db.eventCheckins).toMatchObject([{ member_id: ME.id, season_key: 'spring-hack', source: 'imported', checked_at: at }]);
  // History isn't counted; checking in with the account while the event is on is.
  await page.goto('/');
  await page.getByRole('tab', { name: /Event/ }).click();
  await expect(page.locator('#event')).not.toContainText('checked in at the showcase');
  await page.goto(`/checkin/spring-hack?c=${CODE}`);
  await expect(page.locator('.dialogue .sr-only').first()).toContainText('Stamped! Visited the showcase at Spring Hackathon.');
  expect(db.eventCheckins).toMatchObject([{ member_id: ME.id, season_key: 'spring-hack', source: 'verified' }]);
});

test('placards print four to a page, with ribbons, the judges’ note and a QR; the winners poster saves', async ({ page }) => {
  await boot(page);
  await mockSupabase(page, { db: hall() });
  await page.goto('/print?event=spring-hack');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Placards · Spring Hackathon');
  await expect(page.getByText('2 placards on 1 page')).toBeVisible();
  const sheet = page.getByRole('region', { name: 'Page 1 of 1' });
  const kite = sheet.getByRole('article', { name: 'Kite' });
  await expect(kite).toContainText('PIXENDO MUSEUM · Spring Hackathon');
  await expect(kite).toContainText('by Player me-player');
  await expect(kite.getByRole('list', { name: 'Awards' })).toContainText('1st place · Spring Hackathon');
  await expect(kite).toContainText('A clear idea, shipped beautifully.');
  await expect(kite.getByRole('img', { name: 'QR code for Kite' })).toBeVisible();
  await expect(sheet.getByRole('article', { name: 'Orbit' })).toContainText('Best UI · Education track');
  await sheet.screenshot({ path: `${EVIDENCE}/placards.png` });

  // Printed, only the sheets show.
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.print-tools')).toBeHidden();
  await expect(sheet).toBeVisible();
  await page.emulateMedia({ media: 'screen' });

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save winners poster' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('pip-hall-spring-hackathon-winners.png');
  await file.saveAs(`${EVIDENCE}/winners-poster.png`);
  expect(statSync(`${EVIDENCE}/winners-poster.png`).size).toBeGreaterThan(10_000);
});

test('a placard’s QR opens the exhibit on a phone, stamps it, and leads on round the room', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await boot(page);
  await mockSupabase(page, { db: hall() });
  await page.goto(`/museum/${KITE}?via=placard&room=event%3Aspring-hack`);
  await expect(page.locator('.dialogue .sr-only').first()).toContainText('You found this exhibit! Kite is stamped in your Passport’s Museum stamp book.');
  await expect(page).toHaveURL(new RegExp(`/museum/${KITE}\\?room=event%3Aspring-hack$`));
  const next = page.getByRole('navigation', { name: 'Next in this room' });
  await expect(next).toContainText('Next in Spring Hackathon · 2 of 2');
  await expect(page.locator('.dialogue-say[data-done="true"]')).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/phone-companion.png`, fullPage: true });

  // Its makers, and the next one in the room (no greeting there: it wasn't scanned).
  await expect(page.getByRole('heading', { name: /Made by/ })).toBeVisible();
  await next.getByRole('link', { name: /Orbit/ }).click();
  await expect(page).toHaveURL(new RegExp(`/museum/${ORBIT}\\?room=event%3Aspring-hack$`));
  await expect(page.getByText('You found this exhibit!')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Next in this room' })).toContainText('Next in Spring Hackathon · 1 of 2');

  // Both are in the Passport's Museum stamp book.
  await page.goto('/passport');
  await expect(page.getByRole('heading', { name: 'Museum stamp book' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Exhibits you’ve visited' })).toContainText('Kite');
  await expect(page.getByRole('list', { name: 'Exhibits you’ve visited' })).toContainText('Orbit');
});

test('an exhibit’s poster saves as a PNG', async ({ page }) => {
  await boot(page);
  await mockSupabase(page, { db: hall() });
  await page.goto(`/museum/${KITE}`);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save poster' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('pip-hall-kite-poster.png');
  await file.saveAs(`${EVIDENCE}/exhibit-poster.png`);
  expect(statSync(`${EVIDENCE}/exhibit-poster.png`).size).toBeGreaterThan(10_000);
});
