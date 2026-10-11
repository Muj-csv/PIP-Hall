// V2-23 (D-136): exhibits you can play. An exhibit's own page has its cartridge beside a console
// that is off; Play slots it in, the console boots, and the title screen's PRESS START opens the live
// project. The maker's three lines become the making-of comic (reviewed with the card), the kiosk and
// the placards read them, and the makers hang together on the team wall, each a Walk there.
// Supabase data source, mocked.
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, type MockDb, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';

const EVIDENCE = 'docs/build/evidence/playable';
mkdirSync(EVIDENCE, { recursive: true });

const ME = { id: '00000000-0000-4000-8000-0000000000a1', email: 'me@example.org', name: 'Ada Lovelace', role: 'member' as const };
const BEE = '00000000-0000-4000-8000-0000000000b2';
const P1 = '00000000-0000-4000-8000-00000000f001';
const P2 = '00000000-0000-4000-8000-00000000f002';

const LINES = {
  story_problem: 'Surfers guessed the tide from old paper charts.',
  story_built: 'A phone app that reads live ocean data and draws the next six hours.',
  story_result: 'The surf club checks it every morning before lessons.',
};
const STORY = { problem: LINES.story_problem, built: LINES.story_built, result: LINES.story_result };
const BEE_CREDIT = { username: 'bee', full_name: 'Bee Hopper', member_no: 2 };

const day = (days: number) => new Date(Date.now() + 8 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

/**
 * Ada in the hall with Tide Tables (made with Bee, a live link, its three lines written and
 * approved) and Pixel Diary (no link, no lines), both hanging in the Museum. Bee has a card too.
 */
function hall({ story = true } = {}): MockDb {
  const db = emptyDb();
  const base = samples[0]!;
  const lines = story ? LINES : {};
  const projects = [
    { ...base.card.projects[0]!, id: P1, title: 'Tide Tables', description: 'Ocean data for surfers', project_url: 'https://tide.example.org/', github_url: 'https://github.com/ada/tide' },
    { ...base.card.projects[1]!, id: P2, title: 'Pixel Diary', project_url: null, github_url: null },
  ];
  db.profiles.push({ id: ME.id, username: 'ada', full_name: 'Ada Lovelace', tagline: null, bio: null, role: null, org_position: null, department: null, avatar_path: null, github_username: null, linkedin_url: null, portfolio_url: null, public_email: null, show_email: false, email_updates: false, skills: [], status: 'approved', review_note: null, is_featured: false, username_locked: true, member_no: 1 });
  for (const [i, p] of projects.entries()) {
    const row: Row = { ...p };
    delete row.collaborators; // credits live in their own table, not on the project row
    db.projects.push({ ...row, ...(i === 0 ? lines : {}), profile_id: ME.id, sort_order: i, source: 'manual', github_repo_id: null });
  }
  const published = [
    { ...projects[0]!, collaborators: [BEE_CREDIT], story: story ? STORY : null },
    { ...projects[1]!, collaborators: [], story: null },
  ];
  db.published.push(
    { ...base, profile_id: ME.id, username: 'ada', member_no: 1, is_featured: false, card: { ...base.card, username: 'ada', full_name: 'Ada Lovelace', is_featured: false, projects: published } } as Row,
    { ...base, profile_id: BEE, username: 'bee', member_no: 2, is_featured: false, card: { ...base.card, username: 'bee', full_name: 'Bee Hopper', is_featured: false, projects: [] } } as Row,
  );
  db.affiliations = [{ key: 'cs-student', name: 'CS Student', grants_museum: true, frame_key: null, sort: 1 }];
  db.memberAffiliations = [{ member_id: ME.id, key: 'cs-student' }];
  db.museumFeatures = [
    { project_id: P1, member_id: ME.id },
    { project_id: P2, member_id: ME.id },
  ];
  return db;
}

/** Tide Tables shown at a hackathon (an award with no judges' note), for the kiosk and placards. */
function atAnEvent(db: MockDb): MockDb {
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
      tracks: ['Health'],
      submissions_close: inHours(-20),
      results_at: inHours(-2),
      announced_at: inHours(-1),
    },
  ];
  db.submissions = [{ season_key: 'spring-hack', project_id: P1, member_id: ME.id, track: 'Health', submitted_at: inHours(-30) }];
  db.awards = [{ id: 1, season_key: 'spring-hack', project_id: P1, place: null, name: 'Best UI', track: 'Health', note: '' }];
  return db;
}

const boot = async (page: Page, { still = false } = {}) => {
  if (still) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
  });
};
const player = (page: Page) => page.locator('.cart-player');

test('a member writes the making-of comic in My Card; it goes to review with the card', async ({ page }) => {
  const db = hall({ story: false });
  await boot(page, { still: true });
  await mockSupabase(page, { user: ME, db, githubRepos: [] });
  await page.goto('/edit?tab=projects');
  const first = page.getByRole('list', { name: 'Projects on your card' }).getByRole('listitem').first();
  await first.getByText('Making-of comic (optional)').click();
  await first.getByLabel('1 · The problem').fill(LINES.story_problem);
  await first.getByLabel('3 · What happened').fill(`  ${LINES.story_result}  `);
  // Each line is short: the counter says when one runs over 90.
  await first.getByLabel('2 · What we built').fill('x'.repeat(91));
  await expect(first.locator('.story-fields .field-count').nth(1)).toHaveText('91/90');
  await first.getByLabel('2 · What we built').fill(LINES.story_built);
  await first.locator('.story-fields').screenshot({ path: `${EVIDENCE}/editor-lines.png` });
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await expect.poll(() => db.projects[0]!.story_problem).toBe(LINES.story_problem);
  expect(db.projects[0]!.story_built).toBe(LINES.story_built);
  expect(db.projects[1]!.story_problem ?? null).toBeNull(); // only the project that has lines
  expect(db.profiles[0]!.status).toBe('draft'); // like any words on the card, they wait for review
  await page.getByRole('button', { name: 'Submit changes' }).click();
  await expect.poll(() => db.profiles[0]!.status).toBe('pending_review');
});

test('visitors play the cartridge: Play, boot, title screen, PRESS START, Eject', async ({ page }) => {
  await boot(page);
  await page.clock.install();
  await mockSupabase(page, { db: hall() });
  await page.goto(`/museum/${P1}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tide Tables · Museum');
  await page.clock.pauseAt(Date.now() + 5_000); // time moves only when the test says, so each step can be seen

  // The cartridge waits beside the console; the screen is off.
  await expect(player(page)).toHaveAttribute('data-stage', 'out');
  await expect(player(page).locator('.cartridge .cart-name')).toHaveText('Tide Tables');
  await expect(player(page).locator('.cartridge .cart-meta')).toHaveText('No.001 · TypeScript');
  await expect(player(page).locator('.screen-off')).toHaveText('INSERT CARTRIDGE');
  await expect(page.locator('.exhibit-frame')).not.toHaveAttribute('data-on');
  await page.locator('.exhibit-page').screenshot({ path: `${EVIDENCE}/cartridge-out.png` });

  // Play: it slides in, the console boots, then the title screen.
  await page.getByRole('button', { name: 'Play Tide Tables' }).click();
  await expect(player(page)).toHaveAttribute('data-stage', 'in');
  await expect(player(page).locator('.cartridge')).toHaveAttribute('data-inserting', 'true');
  await expect(page.getByRole('button', { name: 'Play Tide Tables' })).toBeDisabled();
  await page.clock.runFor(250);
  await expect(player(page)).toHaveAttribute('data-stage', 'boot');
  await expect(player(page).locator('.screen-boot')).toHaveText('PIXENDO');
  await page.clock.runFor(400);
  await expect(player(page)).toHaveAttribute('data-stage', 'title');
  await expect(page.locator('.exhibit-frame')).toHaveAttribute('data-on', 'true');
  const screen = page.locator('.title-screen');
  await expect(screen.locator('.ts-title')).toHaveText('Tide Tables');
  await expect(screen.locator('.ts-by')).toHaveText('A GAME BY ADA LOVELACE · BEE HOPPER');
  await expect(screen.locator('.ts-start')).toHaveText('PRESS START');
  await expect(screen.locator('.ts-credits')).toContainText('THANKS FOR PLAYING');
  await expect(screen).toHaveAttribute('aria-hidden', 'true'); // the plaque carries the words

  const start = page.getByRole('link', { name: /^PRESS START/ });
  await expect(start).toHaveAccessibleName('PRESS START to open Tide Tables (the live project, in a new tab)');
  await expect(start).toHaveAttribute('href', 'https://tide.example.org/');
  await expect(start).toHaveAttribute('target', '_blank');
  await expect(start).toBeFocused();
  await expect(player(page).getByRole('status')).toHaveText('Tide Tables is on. Press START to open it.');
  await page.locator('.exhibit-page').screenshot({ path: `${EVIDENCE}/title-screen.png` });

  // Eject: the cartridge comes out, the screen goes off, focus is back on Play.
  await page.getByRole('button', { name: 'Eject the cartridge' }).click();
  await expect(player(page)).toHaveAttribute('data-stage', 'out');
  await expect(page.getByRole('button', { name: 'Play Tide Tables' })).toBeFocused();
  await expect(player(page).locator('.screen-off')).toBeVisible();

  // The keyboard path: Enter on Play.
  await page.keyboard.press('Enter');
  await page.clock.runFor(700);
  await expect(player(page)).toHaveAttribute('data-stage', 'title');
  await expect(start).toBeFocused();
});

test('the making-of comic reads in order; the team wall walks Pip to a maker', async ({ page }) => {
  await boot(page, { still: true });
  await mockSupabase(page, { db: hall() });
  await page.goto(`/museum/${P1}`);
  const comic = page.getByRole('region', { name: 'How it was made' });
  await expect(comic.getByRole('listitem')).toHaveCount(3);
  await expect(comic.locator('.comic-text')).toHaveText([
    `The problem ${LINES.story_problem}`,
    `What we built ${LINES.story_built}`,
    `What happened ${LINES.story_result}`,
  ]);
  await expect(comic.locator('.comic-panel[data-panel="problem"] .comic-bubble')).toHaveText('?');
  await expect(comic.locator('.comic-panel[data-panel="built"] .comic-picture')).toBeVisible();
  await expect(comic.locator('.comic-panel[data-panel="result"] .comic-pip')).toBeVisible(); // no place won: Pip jumps
  await comic.scrollIntoViewIfNeeded();
  await comic.screenshot({ path: `${EVIDENCE}/comic.png` });

  // The team wall: both makers on one rail, each with Walk there.
  const wall = page.getByRole('list', { name: 'Makers' });
  await expect(wall.locator(':scope > li')).toHaveCount(2);
  await expect(page.locator('.team-wall')).toBeVisible();
  const walk = wall.getByRole('link', { name: 'Walk there to Bee Hopper in the hall' });
  await expect(walk).toHaveAttribute('href', '/?walk=bee');
  await page.locator('.made-by').scrollIntoViewIfNeeded();
  await page.locator('.made-by').screenshot({ path: `${EVIDENCE}/team-wall.png` });
  await walk.click();
  await expect(page).toHaveURL(/\/$/); // the hall tidies the address
  await expect(page.locator('.screen .dialogue .sr-only').first()).toContainText('Pip walks to Bee Hopper.');
});

test('reduced motion: Play shows the title screen at once, still; no link means nothing to start', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page, { still: true });
  await mockSupabase(page, { db: hall() });

  await page.goto(`/museum/${P1}`);
  await page.getByRole('button', { name: 'Play Tide Tables' }).click();
  await expect(player(page)).toHaveAttribute('data-stage', 'title');
  await expect(page.locator('.title-screen')).toHaveAttribute('data-still', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `${EVIDENCE}/phone-title-screen.png`, fullPage: true });

  // Pixel Diary has no link and no lines: no comic, and START says so.
  await page.goto(`/museum/${P2}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pixel Diary · Museum');
  await expect(page.getByRole('region', { name: 'How it was made' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Play Pixel Diary' }).click();
  await expect(page.locator('.title-screen .ts-start')).toHaveText('NO LINK TO START');
  await expect(page.getByRole('button', { name: 'Nothing to start yet' })).toBeDisabled();
  await expect(player(page).getByRole('status')).toHaveText('Pixel Diary is on. It has no link to open yet.');
});

test('the list view points to the cartridge; the kiosk and the placards read the three lines', async ({ page }) => {
  await boot(page, { still: true });
  await mockSupabase(page, { db: atAnEvent(hall()) });
  await page.goto('/museum?view=list');
  const tide = page.getByRole('article', { name: 'Tide Tables' }).first();
  const play = tide.getByRole('link', { name: 'Play', exact: true });
  await expect(play).toHaveAttribute('href', `/museum/${P1}`);
  await expect(play).toHaveAccessibleDescription('Tide Tables');

  await page.goto('/print?event=spring-hack');
  const placard = page.getByRole('article', { name: 'Tide Tables' });
  await expect(placard.getByRole('list', { name: 'How it was made' }).getByRole('listitem')).toHaveText([
    `The problem: ${LINES.story_problem}`,
    `What we built: ${LINES.story_built}`,
    `What happened: ${LINES.story_result}`,
  ]);
  await expect(placard.locator('.placard-desc')).toHaveCount(0); // the lines stand in for the blurb
  await placard.screenshot({ path: `${EVIDENCE}/placard.png` });

  await page.goto('/booth?event=spring-hack');
  const slide = page.getByRole('main', { name: 'PIP-Hall showcase' }).locator('.booth-slide');
  await expect(slide.getByRole('heading', { level: 1 })).toHaveText('Tide Tables');
  await expect(slide.getByRole('list', { name: 'How it was made' }).getByRole('listitem')).toHaveCount(3);
  await page.screenshot({ path: `${EVIDENCE}/kiosk.png` });
});
