// The Journal (V2-24, D-137), the Museum's default view, and the curated Museum it shows (D-130): a
// flip-book journal, each room a chapter, its exhibits the pages; the page in front opens as a spread.
// On show: what an admin featured, what won at an announced event, and the archive; an entry that
// didn't win stays on its maker's card. Supabase data source, mocked.
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, type MockDb, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';

const EVIDENCE = 'docs/build/evidence/journal';
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

const TITLES = ['Orbit', 'Tide', 'Atlas', 'Ember', 'Prism', 'Quill', 'Vault', 'Nimbus', 'Signal', 'Pixel Pond', 'Lantern', 'Harbor'];
/** A fuller Museum: `n` featured projects, two to a member. */
function busy(n = 10): MockDb {
  const db = emptyDb();
  const ids = Array.from({ length: n }, (_, i) => `44444444-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
  for (let m = 0; m * 2 < n; m++) {
    const id = `00000000-0000-4000-8000-${String(900 + m).padStart(12, '0')}`;
    const mine = ids.slice(m * 2, m * 2 + 2).map((pid, k) => ({ id: pid, title: TITLES[(m * 2 + k) % TITLES.length]! + (m * 2 + k >= TITLES.length ? ` ${m}` : ''), description: 'A project from the hall.' }));
    db.published.push(card(id, `player-${m + 1}`, m + 1, mine));
    for (const p of mine) (db.museumFeatures ??= []).push({ project_id: p.id, member_id: id });
  }
  return db;
}

const boot = async (page: Page, { still = false } = {}) => {
  if (still) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
  });
};
const book = (p: Page) => p.locator('#journal');
const front = (p: Page) => book(p).getByRole('option', { selected: true });
const chapter = (p: Page) => p.locator('.journal-chapter-name');
const atRest = (p: Page) => expect(book(p)).toHaveAttribute('data-still', '');
const status = (p: Page) => p.locator('.museum-journal [role="status"]');

/** Goes on through every chapter, back to where it began; the chapters' names in order. */
async function chapters(page: Page): Promise<string[]> {
  const names: string[] = [];
  for (let i = 0; i < 12; i++) {
    const name = (await chapter(page).textContent())!;
    if (names[0] === name) break;
    names.push(name);
    await page.getByRole('button', { name: /^Next chapter/ }).click();
  }
  return names;
}

test('chapters in the admins’ order; only featured, winning and archive projects are in the journal', async ({ page }) => {
  await boot(page);
  await mockSupabase(page, { db: hall() });
  await page.goto('/museum');
  await expect(page.getByRole('navigation', { name: 'How to see the Museum' }).getByRole('link', { name: /The Journal/ })).toHaveAttribute('aria-current', 'page');
  // Chapter 1: the Winners' Hall, its winner in front.
  await expect(book(page)).toHaveAccessibleName(/^Winners’ Hall, chapter 1 of/);
  await expect(chapter(page)).toHaveText('Winners’ Hall');
  await expect(page.locator('.journal-sub')).toHaveText(/^Chapter 1 of \d+ · 1 page$/);
  await expect(book(page).getByRole('option')).toHaveCount(1);
  await expect(front(page)).toHaveAccessibleName(/^Raft, page 1 of 1, 1st place · Spring Hackathon/);
  await expect(front(page).locator('.journal-ribbon')).toHaveText('1ST');
  await expect(status(page)).toHaveText('Page 1 of 1 in chapter 1, Winners’ Hall: Raft, by Player player-2, 1st place · Spring Hackathon.');

  // The next chapter: the event holds its winner only (the entry that didn't win isn't in it).
  await page.getByRole('button', { name: 'Next chapter: Spring Hackathon' }).click();
  await expect(chapter(page)).toHaveText('Spring Hackathon');
  await expect(page).toHaveURL(/\/museum\?event=spring-hack$/);
  await expect(book(page).getByRole('option')).toHaveCount(1);
  await expect(front(page)).toHaveAccessibleName(/^Raft/);

  // Every chapter, round to the first again.
  await page.getByRole('button', { name: /^Previous chapter/ }).click();
  const names = await chapters(page);
  expect(names[0]).toBe('Winners’ Hall');
  expect(names).toEqual(expect.arrayContaining(['Winners’ Hall', 'Spring Hackathon', 'Featured Wing', 'All exhibits', 'The Archive']));
  await page.goto('/museum?room=all');
  await expect(book(page).getByRole('option')).toHaveCount(2);
  await expect(front(page)).toHaveAccessibleName(/^Comet/);
  await page.goto('/museum?room=archive');
  await expect(front(page)).toHaveAccessibleName(/^Kite/);
  await expect(front(page)).toContainText('by Rosa Diaz');

  // Nowhere in the Museum: the list view says the same.
  await page.goto('/museum?view=list');
  await expect(page.getByRole('heading', { name: 'Raft' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Comet' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lamp' })).toHaveCount(0);
});

test('turning pages: keys, a clicker, the device, a drag, a flick and a tap all settle on a page', async ({ page }) => {
  await boot(page);
  await mockSupabase(page, { db: busy(10) });
  await page.goto('/museum?room=all');
  await expect(book(page).getByRole('option').first()).toBeVisible();
  await atRest(page);
  await expect(front(page)).toHaveAccessibleName(/, page 1 of 10/);
  // At rest, the page in front lies flat and square.
  await expect(book(page).locator('[data-front]')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');

  // The arrow keys, a clicker's Page Down and Page Up, and the device's MOVE.
  await book(page).focus();
  await page.keyboard.press('ArrowRight');
  await expect(front(page)).toHaveAccessibleName(/, page 2 of 10/);
  await page.keyboard.press('PageDown');
  await expect(front(page)).toHaveAccessibleName(/, page 3 of 10/);
  await page.keyboard.press('PageUp');
  await expect(front(page)).toHaveAccessibleName(/, page 2 of 10/);
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(front(page)).toHaveAccessibleName(/, page 3 of 10/);
  await page.getByRole('button', { name: 'Turn back a page' }).click();
  await expect(front(page)).toHaveAccessibleName(/, page 2 of 10/);
  await book(page).focus();
  await page.keyboard.press('End');
  await expect(front(page)).toHaveAccessibleName(/, page 10 of 10/);
  await page.keyboard.press('Home');
  await expect(front(page)).toHaveAccessibleName(/, page 1 of 10/);
  await atRest(page);
  await page.waitForTimeout(300);
  await page.locator('.device-outer').screenshot({ path: `${EVIDENCE}/journal-desktop.png` });

  // A slow drag of two pages' width turns two pages, and the book rests open square.
  const box = (await book(page).boundingBox())!;
  const width = parseFloat(await book(page).evaluate((el) => getComputedStyle(el).getPropertyValue('--front')));
  const per = Math.max(48, Math.round(width * 0.5));
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 2 * per, y, { steps: 12 });
  await page.waitForTimeout(250);
  await page.mouse.move(box.x + box.width / 2 - 2 * per - 1, y); // at rest before letting go: no flick
  await page.mouse.up();
  await expect(front(page)).toHaveAccessibleName(/, page 3 of 10/);
  await atRest(page);
  await expect(book(page).locator('[data-front]')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');

  // A flick riffles on: a quick swipe of one page's width carries further than one page. Sent from
  // inside the page, a frame apart, so it is quick however busy the test runner is.
  await book(page).evaluate(async (stage, { x, y, per }) => {
    const at = (type: string, cx: number) => new PointerEvent(type, { bubbles: true, isPrimary: true, pointerId: 1, button: 0, clientX: cx, clientY: y });
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    stage.dispatchEvent(at('pointerdown', x));
    for (let k = 1; k <= 3; k++) {
      await frame();
      window.dispatchEvent(at('pointermove', x - (per * k) / 3));
    }
    window.dispatchEvent(at('pointerup', x - per));
  }, { x: box.x + box.width / 2, y, per });
  const pageNo = async () => Number((await front(page).getAttribute('aria-label'))!.match(/page (\d+) of/)![1]);
  await expect.poll(pageNo).toBeGreaterThan(4);
  await atRest(page);

  // A tap on the page just behind, in the left stack, turns back to it.
  const n = await pageNo();
  const left = book(page).locator(`#journal-${n - 2}`);
  const lb = (await left.boundingBox())!;
  await page.mouse.click(lb.x + lb.width * 0.5, lb.y + lb.height * 0.5);
  await expect(front(page)).toHaveAccessibleName(new RegExp(`, page ${n - 1} of 10`));
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('next and back run on through the chapters, so a clicker walks the whole Museum', async ({ page }) => {
  await boot(page);
  await mockSupabase(page, { db: hall() });
  await page.goto('/museum');
  await expect(chapter(page)).toHaveText('Winners’ Hall');
  await book(page).focus();
  await page.keyboard.press('PageDown'); // the Winners' Hall has one page: on into the next chapter
  await expect(chapter(page)).toHaveText('Spring Hackathon');
  await expect(book(page)).toBeFocused();
  await page.keyboard.press('PageUp');
  await expect(chapter(page)).toHaveText('Winners’ Hall');
  await page.keyboard.press('ArrowDown'); // up and down jump a chapter
  await expect(chapter(page)).toHaveText('Spring Hackathon');
  await page.getByRole('button', { name: 'CHAPTER', exact: true }).click(); // the device's own button
  await expect(chapter(page)).not.toHaveText('Spring Hackathon');
  // Present takes the journal to the showcase screen.
  await expect(page.getByRole('link', { name: /Present the journal/ })).toHaveAttribute('href', /^\/booth/);
});

test('the page in front opens as a spread; the address keeps it; the Passport stamps it', async ({ page }) => {
  await boot(page);
  await mockSupabase(page, { db: hall() });
  await page.goto('/museum');
  await expect(front(page)).toHaveAccessibleName(/^Raft/);
  await book(page).focus();
  await page.keyboard.press('Enter');
  const spread = page.getByRole('dialog', { name: 'Raft' });
  await expect(spread).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/museum\\?room=winners&at=${RAFT}&open=1$`));
  await expect(spread).toContainText('Page 1 of 1 · Chapter 1, Winners’ Hall');
  await expect(spread).toContainText('1st place · Spring Hackathon');
  await expect(spread.getByRole('link', { name: 'Player player-2' })).toHaveAttribute('href', '/member/player-2');
  await expect(spread.getByRole('img', { name: 'QR code for Raft' })).toBeVisible();
  await expect(spread.getByRole('link', { name: /^Visit the exhibit/ })).toHaveAttribute('href', `/museum/${RAFT}`);
  await expect(spread.getByRole('button', { name: /^Close/ })).toBeFocused();
  // Tab stays in the spread.
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
  }
  // Its cartridge plays on the left page (V2-23).
  await spread.getByRole('button', { name: 'Play Raft' }).click();
  await expect(spread.locator('.cart-player')).toHaveAttribute('data-stage', 'title');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${EVIDENCE}/spread-desktop.png` });
  // Opening it stamped the Passport, as the exhibit's page does.
  const stamped = await page.evaluate(() => JSON.parse(localStorage.getItem('piphall-passport-v1') ?? '{}').exhibits?.map((s: { id: string }) => s.id) ?? []);
  expect(stamped).toContain(RAFT);

  // Esc closes it; Back is where it was.
  await page.keyboard.press('Escape');
  await expect(spread).toHaveCount(0);
  await expect(page).toHaveURL(/\/museum$/);
  await expect(book(page)).toBeFocused();
  // Back closes it too.
  await page.getByRole('button', { name: /^OPEN Raft/ }).click();
  await expect(spread).toBeVisible();
  await page.goBack();
  await expect(spread).toHaveCount(0);

  // A shared link reopens it; Close keeps the place.
  await page.goto(`/museum?room=winners&at=${RAFT}&open=1`);
  await expect(spread).toBeVisible();
  await spread.getByRole('button', { name: /^Close/ }).click();
  await expect(spread).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/museum\\?room=winners&at=${RAFT}$`));

  // The archive's page says where it came from.
  await page.goto(`/museum?room=archive&at=${KITE}&open=1`);
  await expect(page.getByRole('dialog', { name: 'Kite' })).toContainText('From the Archive');
});

test('the book opens as you arrive, the stacks fanning out; with reduced motion it is simply open', async ({ page, browser }) => {
  await boot(page);
  await mockSupabase(page, { db: busy(10) });
  await page.goto('/museum?room=all');
  await expect(book(page)).toHaveAttribute('data-opening', '');
  await expect(book(page)).not.toHaveAttribute('data-opening', { timeout: 3000 });
  await atRest(page);
  // Open: the pages to come stand in a stack on the right, turned almost edge-on.
  const second = await book(page).locator('#journal-1').evaluate((el) => el.style.transform);
  expect(second).toMatch(/rotateY\(70deg\)/);

  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const still = await ctx.newPage();
  await boot(still);
  await mockSupabase(still, { db: busy(10) });
  await still.goto('/museum?room=all');
  await expect(front(still)).toHaveAccessibleName(/, page 1 of 10/);
  await expect(book(still)).not.toHaveAttribute('data-opening');
  await expect(book(still).locator('.journal-cover')).toHaveCount(0); // no cover to swing open
  await book(still).focus();
  await still.keyboard.press('ArrowRight');
  await expect(front(still)).toHaveAccessibleName(/, page 2 of 10/);
  await expect(book(still).locator('[data-front]')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)'); // a cut, no turn
  await ctx.close();
});

/** FILM=<dir> keeps every frame the browser shows (its own screencast: a screenshot is too slow to
 *  catch a stepped swing), to cut the motion's filmstrip from. */
async function film(page: Page) {
  const dir = process.env.FILM;
  if (!dir) return async () => {};
  mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  let n = 0;
  cdp.on('Page.screencastFrame', (f) => {
    writeFileSync(`${dir}/${String(n++).padStart(4, '0')}.png`, Buffer.from(f.data, 'base64'));
    void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'png' });
  return async () => {
    await cdp.send('Page.stopScreencast');
  };
}

test('motion: the cover swings open, a turning page lifts, a page lands, the spread grows out of it and back', async ({ page }) => {
  await boot(page);
  await mockSupabase(page, { db: busy(10) });
  const cut = await film(page);
  await page.goto('/museum?room=all');
  // The chapter's cover is drawn closed over the book, swings open on its spine, and is gone; then the
  // stacks fan out from behind it.
  const cover = book(page).locator('.journal-cover');
  await expect(cover).toHaveAttribute('data-done', '', { timeout: 3000 });
  await expect(cover).toBeHidden();
  await atRest(page);

  // A turning page lifts off the book as it goes over (it rises), and the page that lands in front
  // drops into place.
  const watch = page.evaluate(
    () =>
      new Promise<{ rise: number; landed: boolean }>((done) => {
        const t0 = performance.now();
        const seen = { rise: 0, landed: false };
        const tick = () => {
          for (const el of document.querySelectorAll<HTMLElement>('#journal .journal-page')) {
            const y = /translate3d\([^,]+,\s*(-?[\d.]+)px/.exec(el.style.transform);
            if (y) seen.rise = Math.min(seen.rise, Number(y[1]));
          }
          seen.landed ||= (document.querySelector('#journal [data-front] .journal-paper')?.getAnimations().length ?? 0) > 0;
          if (performance.now() - t0 < 1500) requestAnimationFrame(tick);
          else done(seen);
        };
        requestAnimationFrame(tick);
      }),
  );
  await book(page).focus();
  await page.keyboard.press('ArrowRight');
  const seen = await watch;
  expect(seen.rise).toBeLessThan(-2);
  expect(seen.landed).toBe(true);
  await atRest(page);

  // The spread comes out of the page in front: it is first drawn over that page, smaller than itself.
  const grown = page.evaluate(
    () =>
      new Promise<string>((done) => {
        const mo = new MutationObserver(() => {
          const el = document.querySelector('.spread-book');
          if (!el) return;
          mo.disconnect();
          done(getComputedStyle(el).transform);
        });
        mo.observe(document.body, { childList: true, subtree: true });
      }),
  );
  await page.keyboard.press('Enter');
  const [scaleX] = (await grown).match(/-?[\d.]+/g)!.map(Number);
  expect(scaleX).toBeLessThan(0.8);
  const spread = page.getByRole('dialog');
  await expect(spread).toBeVisible();
  await page.waitForTimeout(900);
  // Close: it folds and shrinks back into the page, then goes; focus is back on the book.
  await spread.getByRole('button', { name: /^Close/ }).click();
  await expect(page.locator('.spread-backdrop')).toHaveAttribute('data-closing', '');
  await expect(spread).toHaveCount(0);
  await expect(book(page)).toBeFocused();
  await page.waitForTimeout(300);
  await cut();
});

test('the walk and the list are one link away; the old circles address lands in the journal', async ({ page }) => {
  await boot(page);
  await mockSupabase(page, { db: hall() });
  await page.goto('/museum?room=archive&view=circles');
  await expect(chapter(page)).toHaveText('The Archive');
  const views = page.getByRole('navigation', { name: 'How to see the Museum' });
  await views.getByRole('link', { name: /Walk the Museum/ }).click();
  await expect(page).toHaveURL(/\/museum\?room=archive&view=walk$/);
  await expect(page.locator('.walk-title')).toContainText('The Archive');
  await views.getByRole('link', { name: /List view/ }).click();
  await expect(page).toHaveURL(/\/museum\?room=archive&view=list$/);
  await views.getByRole('link', { name: /The Journal/ }).click();
  await expect(page).toHaveURL(/\/museum\?room=archive$/);
  await expect(chapter(page)).toHaveText('The Archive');
});

test('presenting at the booth: a clicker turns the pages, Enter opens the page, nothing is stamped', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await boot(page);
  await page.clock.install();
  await mockSupabase(page, { db: busy(10) });
  await page.goto('/booth');
  const kiosk = page.getByRole('main', { name: 'PIP-Hall showcase' });
  const slide = kiosk.locator('.booth-slide');
  await expect(slide.locator('.journal-stage')).toBeVisible();
  await expect(slide.locator('.booth-chapter')).toContainText('Page 1 of 10');
  // The tour turns the pages by itself...
  await page.clock.runFor(12_500);
  await expect(slide.locator('.booth-chapter')).toContainText('Page 2 of 10');
  // ...and a presenter's clicker takes over, wherever the focus is.
  await page.keyboard.press('PageDown');
  await expect(slide.locator('.booth-chapter')).toContainText('Page 3 of 10');
  await expect(kiosk.getByRole('button', { name: '▶ Play' })).toBeVisible(); // paused for the presenter
  await page.keyboard.press('PageUp');
  await expect(slide.locator('.booth-chapter')).toContainText('Page 2 of 10');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${EVIDENCE}/booth-presenter.png` });
  // Enter opens the page in front as a spread; Esc puts it back.
  await page.keyboard.press('Enter');
  const spread = page.getByRole('dialog');
  await expect(spread).toBeVisible();
  await expect(spread).toContainText('page 2 of 10');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${EVIDENCE}/booth-spread.png` });
  await page.keyboard.press('PageDown'); // the open page keeps the keys
  await expect(spread).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(spread).toHaveCount(0);
  // The kiosk is nobody's: its Passport stays empty.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('piphall-passport-v1') ?? '{"exhibits":[]}').exhibits.length)).toBe(0);
  // Open the page, by touch.
  await kiosk.getByRole('button', { name: /^Open the page/ }).click();
  await expect(spread).toBeVisible();
});

test('evidence: phone and NIGHT', async ({ browser }) => {
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const p = await phone.newPage();
  await boot(p);
  await mockSupabase(p, { db: busy(10) });
  await p.goto('/museum?room=all');
  await book(p).focus();
  await p.keyboard.press('ArrowRight');
  await p.keyboard.press('ArrowRight');
  await expect(front(p)).toHaveAccessibleName(/, page 3 of 10/);
  expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await p.locator('.device-outer').screenshot({ path: `${EVIDENCE}/journal-phone.png` });
  await p.keyboard.press('Enter');
  await expect(p.getByRole('dialog')).toBeVisible();
  await p.screenshot({ path: `${EVIDENCE}/spread-phone.png` });
  await phone.close();

  const night = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const n = await night.newPage();
  await boot(n);
  await mockSupabase(n, { db: busy(10) });
  await n.goto('/museum?room=all');
  const world = n.locator('header').getByRole('button', { name: /^World:/ });
  for (let i = 0; i < 3 && !(await world.textContent())?.includes('NIGHT'); i++) await world.click();
  await expect(n.locator('html')).toHaveAttribute('data-theme', 'dark');
  await book(n).focus();
  await n.keyboard.press('ArrowRight');
  await n.keyboard.press('ArrowRight');
  await n.waitForTimeout(300);
  await n.locator('.device-outer').screenshot({ path: `${EVIDENCE}/journal-night.png` });
  await night.close();
});

// The frame budget (D-137): 30 exhibits on a phone's CPU (4× slower), turning page after page.
// Run with PERF=1; it writes what it measured to the evidence.
test('60 fps with 30 pages on a throttled CPU', async ({ page }) => {
  test.skip(!process.env.PERF, 'a measurement, run with PERF=1');
  await boot(page);
  await mockSupabase(page, { db: busy(30) });
  // PERF_ORIGIN measures a production build (vite preview); the dev server's React is far slower.
  await page.goto(`${process.env.PERF_ORIGIN ?? ''}/museum?room=all`);
  await expect(book(page).getByRole('option').first()).toBeVisible();
  if (process.env.PERF_CSS) await page.addStyleTag({ content: process.env.PERF_CSS });
  await page.waitForTimeout(1500);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await book(page).focus();
  const { frames, longTasks } = await page.evaluate(
    () =>
      new Promise<{ frames: number[]; longTasks: number[] }>((done) => {
        const longTasks: number[] = [];
        // Main-thread tasks over 50 ms (the compositor's work is not in them).
        new PerformanceObserver((l) => l.getEntries().forEach((e) => longTasks.push(Math.round(e.duration)))).observe({ type: 'longtask' });
        const times: number[] = [];
        let last = 0;
        const tick = (t: number) => {
          if (last) times.push(t - last);
          last = t;
          if (times.length < 240) requestAnimationFrame(tick);
          else done({ frames: times, longTasks });
        };
        requestAnimationFrame(tick);
        // Keep it turning the whole time: a page every 180 ms.
        let n = 0;
        const turn = () => {
          document.getElementById('journal')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
          if (++n < 22) setTimeout(turn, 180);
        };
        turn();
      }),
  );
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const sorted = [...frames].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
  const result = {
    build: process.env.PERF_ORIGIN ? 'production' : 'dev server',
    pages: 30,
    cpuThrottle: 4,
    frames: frames.length,
    medianFrameMs: +median.toFixed(2),
    p95FrameMs: +p95.toFixed(2),
    fpsAtMedian: +(1000 / median).toFixed(1),
    mainThreadLongTasks: longTasks.length,
    mainThreadLongTaskMs: longTasks.reduce((a, b) => a + b, 0),
  };
  writeFileSync(`${EVIDENCE}/perf.json`, `${JSON.stringify(result, null, 2)}\n`);
  expect(median).toBeLessThan(17.5);
});
