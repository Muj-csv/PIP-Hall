// V2-9 (D-115 to D-117): hackathons and building events. An admin schedules a hackathon with
// tracks and a deadline; members enter a project from the hall while submissions are open and it
// hangs in the event's Museum room; after the deadline admins record places and named awards with
// judges' notes and announce them once. Then the Winners' Hall, the badges' ribbons, the bell, the
// Proof panel and the Champion title all follow. Supabase data source, mocked, PIPs on.
import { expect, test, type Page } from '@playwright/test';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, type MockDb, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';

const ME = { id: '00000000-0000-4000-8000-0000000000a1', email: 'me@example.org', name: 'Test Member', role: 'member' as const };
const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', email: 'admin@example.org', name: 'Test Admin', role: 'admin' as const };
const TWO = '00000000-0000-4000-8000-000000000202';
const THREE = '00000000-0000-4000-8000-000000000203';
const KITE = '11111111-0000-4000-8000-000000000001';
const LAMP = '11111111-0000-4000-8000-000000000002';
const ORBIT = '11111111-0000-4000-8000-000000000003';

/** A date on the hall's calendar (Manila), `days` from today. */
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
    card: { ...base.card, skills: [], department: null, username, full_name: `Player ${username}`, is_featured: false, projects: projects.map((p) => ({ ...p0, collaborators: [], ...p })) },
  };
}

/** A hall with a hackathon on: ME has two projects (Kite is made with player-3), player-2 has one. */
function hall(phase: 'open' | 'judging'): MockDb {
  const db = emptyDb();
  db.published.push(
    card(ME.id, 'me-player', 1, [
      { id: KITE, title: 'Kite', collaborators: [{ username: 'player-3', full_name: 'Player player-3', member_no: 3 }] },
      { id: LAMP, title: 'Lamp' },
    ]),
    card(TWO, 'player-2', 2, [{ id: ORBIT, title: 'Orbit' }]),
    card(THREE, 'player-3', 3, []),
  );
  db.notifications = [];
  db.recentEvents = [];
  db.identity = true;
  db.earned = { [ME.id]: ['card_holder'], [TWO]: ['card_holder'], [THREE]: ['card_holder'] };
  db.seasons = [
    {
      key: 'spring-hack',
      name: 'Spring Hackathon',
      blurb: 'Build something useful in a weekend.',
      starts_on: day(-1),
      ends_on: day(3),
      mission: null,
      frame: null,
      counts: { joined: 0, projects: 0, exhibits: 0, teamups: 0 },
      kind: 'hackathon',
      tracks: ['Health', 'Education'],
      submissions_close: phase === 'open' ? inHours(49) : inHours(-1),
      results_at: phase === 'open' ? inHours(60) : inHours(5),
      announced_at: null,
    },
  ];
  db.submissions =
    phase === 'judging'
      ? [
          { season_key: 'spring-hack', project_id: KITE, member_id: ME.id, track: 'Health', submitted_at: inHours(-30) },
          { season_key: 'spring-hack', project_id: ORBIT, member_id: TWO, track: 'Education', submitted_at: inHours(-20) },
        ]
      : [];
  db.awards = [];
  return db;
}

const boot = (page: Page) =>
  page.addInitScript(() => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
  });

test('a member enters a project in a track while submissions are open; it hangs in the event room', async ({ page }) => {
  const db = hall('open');
  await boot(page);
  await mockSupabase(page, { user: ME, db });
  await page.goto('/');

  const banner = page.getByRole('complementary', { name: 'Event' });
  await expect(banner).toContainText('Hackathon: Spring Hackathon');
  await expect(banner).toContainText('Submissions close in 2 days');

  const panel = page.locator('#event');
  await expect(panel).toContainText('Tracks: Health · Education');
  await expect(panel).toContainText('So far: 0 entries');
  const form = panel.getByRole('form', { name: 'Enter a project in Spring Hackathon' });
  await form.getByLabel('Your project').selectOption({ label: 'Kite' });
  await form.getByLabel('Track').selectOption('Education');
  await form.getByRole('button', { name: 'Enter it' }).click();
  await expect(panel.getByRole('status')).toContainText('“Kite” is entered!');
  await expect(panel).toContainText('Your entry: “Kite” · Education track.');
  await expect(panel).toContainText('So far: 1 entry');
  expect(db.submissions).toMatchObject([{ season_key: 'spring-hack', project_id: KITE, member_id: ME.id, track: 'Education' }]);

  // One per event: move it to another track instead.
  await panel.getByLabel('Move to track').selectOption('Health');
  await panel.getByRole('button', { name: 'Move' }).click();
  await expect(panel.getByRole('status')).toHaveText('Moved to the Health track.');
  await expect(panel).toContainText('Your entry: “Kite” · Health track.');
  await panel.scrollIntoViewIfNeeded();
  await panel.screenshot({ path: 'docs/build/evidence/hackathons/hall-entry.png' });

  // The event room is open from the first day, with the entries by track.
  await panel.getByRole('link', { name: 'See the entries in the Museum' }).click();
  await expect(page).toHaveURL(/\/museum\?event=spring-hack$/);
  // The walk opens in the event's room; the List view keeps the room.
  await expect(page.locator('.walk-hud')).toContainText('Spring Hackathon');
  await page.getByRole('navigation', { name: 'How to see the Museum' }).getByRole('link', { name: /List view/ }).click();
  await expect(page).toHaveURL(/\/museum\?event=spring-hack&view=list$/);
  const doors = page.getByRole('navigation', { name: 'Rooms' });
  await expect(doors.getByRole('link', { name: /Spring Hackathon/ })).toHaveAttribute('aria-current', 'page');
  await expect(doors.getByRole('link', { name: /Spring Hackathon/ })).toContainText('1 entry');
  const room = page.locator('.event-room');
  await expect(room.getByRole('status')).toContainText('Submissions close in 2 days');
  const health = room.getByRole('list', { name: 'Entries in the Health track' });
  await expect(health.getByRole('heading', { name: 'Kite' })).toBeVisible();
  await expect(room.getByRole('list', { name: 'Entries in the Education track' })).toHaveCount(0);
  await page.screenshot({ path: 'docs/build/evidence/hackathons/event-room.png', fullPage: true });

  // The entry opens like any exhibit, and says which event it is in.
  await health.getByRole('link', { name: 'Kite' }).click();
  await expect(page).toHaveURL(new RegExp(`/museum/${KITE}$`));
  await expect(page.locator('.exhibit-plaque')).toContainText('Entered in Spring Hackathon · Health track');

  // Withdrawing frees the slot until submissions close.
  await page.goto('/#event');
  await panel.getByRole('button', { name: 'Withdraw' }).click();
  await expect(panel.getByRole('status')).toContainText('Your entry is withdrawn.');
  await expect(panel.getByRole('form', { name: 'Enter a project in Spring Hackathon' })).toBeVisible();
  expect(db.submissions).toEqual([]);
});

test('visitors are invited to make a card; a member without an approved card is told when they can enter', async ({ page }) => {
  const db = hall('open');
  await boot(page);
  await mockSupabase(page, { db });
  await page.goto('/');
  await expect(page.locator('#event')).toContainText('Members with a card in the hall can enter a project.');
  await expect(page.locator('#event').getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
});

test('admins record places and awards after the deadline and announce once; the Museum, badges, bell and titles follow', async ({ page, browser }) => {
  const db = hall('judging');
  await boot(page);
  await mockSupabase(page, { user: ADMIN, db });
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'Events' }).click();
  const row = page.getByRole('list', { name: 'Scheduled events' }).locator('.mart-row');
  await expect(row).toContainText('Hackathon');
  await expect(row).toContainText('2 entries');
  await expect(row).toContainText('Judging');
  await row.getByRole('button', { name: /^Results/ }).click();

  const results = page.locator('section[aria-labelledby="results-title"]');
  await expect(results.getByRole('list', { name: 'Entries' }).getByRole('listitem')).toHaveCount(2);
  const award = results.getByRole('form', { name: 'Record an award' });
  await award.getByLabel('Award', { exact: true }).selectOption('1');
  await award.getByLabel('Winning project').selectOption({ label: 'Kite (Player me-player)' });
  await award.getByLabel('Judges’ note (optional)').fill('A clear idea, beautifully shipped.');
  await award.getByRole('button', { name: 'Record award' }).click();
  await expect(results.getByRole('status').last()).toHaveText('1st place recorded.');
  await award.getByLabel('Award', { exact: true }).selectOption('named');
  await award.getByLabel('Award name').fill('Best UI');
  await award.getByLabel('For').selectOption('Education');
  await expect(award.getByLabel('Winning project').locator('option')).toHaveText(['Orbit (Player player-2)']);
  await award.getByRole('button', { name: 'Record award' }).click();
  await expect(results.getByRole('status').last()).toHaveText('Best UI · Education track recorded.');
  // Each place has one winner.
  await award.getByLabel('Award', { exact: true }).selectOption('1');
  await award.getByLabel('For').selectOption('');
  await award.getByLabel('Winning project').selectOption({ label: 'Orbit (Player player-2)' });
  await award.getByRole('button', { name: 'Record award' }).click();
  await expect(results.getByRole('status').last()).toContainText('That award already has a winner');
  await expect(results.getByRole('list', { name: 'Awards' }).getByRole('listitem')).toHaveCount(2);

  await results.getByRole('button', { name: 'Announce results' }).click();
  await expect(results).toContainText('It can’t be undone. Announce now?');
  await results.screenshot({ path: 'docs/build/evidence/hackathons/admin-results.png' });
  await results.getByRole('button', { name: 'Yes, announce the results' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'The results of Spring Hackathon are announced. 3 makers hear it in their bell.' })).toBeVisible();
  await expect(results).toContainText('♛ Announced');
  await expect(results.getByRole('button', { name: /^Remove/ })).toHaveCount(0);
  expect(db.seasons![0]!.announced_at).toBeTruthy();

  // The Museum's Winners' Hall stands first, with ribbons in words and the judges' notes.
  await page.goto('/museum?view=list');
  const winners = page.getByRole('region', { name: /Winners’ Hall/ });
  await expect(winners.getByRole('heading', { name: /Spring Hackathon/ })).toBeVisible();
  const first = winners.locator('.award-plate[data-place="1"]');
  await expect(first).toContainText('1st place');
  await expect(first).toContainText('A clear idea, beautifully shipped.');
  await expect(winners.locator('.award-plate').filter({ hasText: 'Best UI · Education track' })).toBeVisible();
  await expect(winners.getByRole('heading', { name: 'Kite' })).toBeVisible();
  await winners.screenshot({ path: 'docs/build/evidence/hackathons/winners-hall.png' });
  await page.setViewportSize({ width: 412, height: 915 });
  await winners.screenshot({ path: 'docs/build/evidence/hackathons/winners-hall-phone.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });

  // The banner says the results are in and leads to the winners.
  const banner = page.getByRole('complementary', { name: 'Event' });
  await expect(banner).toContainText('Results are in!');
  await banner.getByRole('link', { name: 'See the winners' }).click();
  await expect(page).toHaveURL(/\/museum\?event=spring-hack$/);
  await page.getByRole('navigation', { name: 'How to see the Museum' }).getByRole('link', { name: /List view/ }).click();
  await expect(page.locator('.event-room').getByRole('region', { name: /Winners/ }).locator('.award-plate')).toHaveCount(2);

  // A winning maker: the bell, the ribbon on the badge, the Proof panel, the Champion title.
  const member = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  await boot(member);
  await mockSupabase(member, { user: ME, db });
  await member.goto('/member/me-player');
  const bell = member.getByRole('button', { name: /Notifications/ });
  await expect(bell).toHaveAccessibleName('Notifications 1 new');
  await bell.click();
  const item = member.getByRole('region', { name: 'Notifications' }).getByRole('listitem').first();
  await expect(item).toContainText('“Kite” won 1st place at Spring Hackathon!');
  await expect(item.getByRole('link')).toHaveAttribute('href', `/museum/${KITE}`);
  await bell.click();
  const profile = member.locator('.profile-screen');
  await expect(profile.getByRole('list', { name: 'Badges' }).first()).toContainText('1st place at Spring Hackathon');
  await expect(profile.locator('.proof-list')).toContainText('1st place at Spring Hackathon with “Kite”.');
  await expect(profile.locator('.proof-list')).toContainText('Champion: Made a project that won a place or an award at an event.');
  await profile.locator('.badge').first().screenshot({ path: 'docs/build/evidence/hackathons/badge-ribbon.png' });
  // The credited teammate wears it too.
  await member.goto('/member/player-3');
  await expect(member.locator('.profile-screen').getByRole('list', { name: 'Badges' }).first()).toContainText('1st place at Spring Hackathon');
  await member.close();
});
