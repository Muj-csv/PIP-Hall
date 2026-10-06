// V2-3 for guests (fixture data): today's Missions are picked from the real hall, "Go" turns them
// into a search or a walk, and a Mission is stamped on this device once the Passport shows it.
import { expect, test } from '@playwright/test';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { pickMissions } from '../src/lib/missions';
import type { PublicCard } from '../src/types/card';
import type { Exhibit } from '../src/types/museum';

const cards = (samples as unknown as PublicCard[]).map((c) => ({ ...c, no: c.member_no }));
const exhibits = cards.flatMap((c) => c.card.projects.map((p, i) => ({ project_id: `${c.username}-${i}`, username: c.username, full_name: c.card.full_name, avatar_path: null, member_no: c.member_no, project: p }))) as Exhibit[];
/** The first day in October 2026 whose Missions include "meet 3 people" (noon in Manila). */
const peopleDay = Array.from({ length: 28 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`).find((d) => pickMissions(d, 'w', cards, exhibits).daily.some((m) => m.kind === 'people'))!;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
  });
});

test('three Missions a day, each one doable in this hall', async ({ page }) => {
  await page.goto('/');
  const today = page.getByRole('list', { name: 'Today’s Missions' }).locator('li');
  await expect(today).toHaveCount(3);
  await expect(page.getByRole('list', { name: 'This week’s Mission' })).toContainText('Visit 5 exhibits in the Museum');
  await expect(page.locator('.missions-panel')).toContainText('stamped on this device');
});

test('meeting three people completes that Mission on this device', async ({ page }) => {
  await page.clock.setFixedTime(new Date(`${peopleDay}T04:00:00Z`));
  await page.goto('/');
  const people = page.locator('.mission', { hasText: /Meet 3 people/ });
  await expect(people).toHaveAttribute('data-state', 'open');
  for (const u of ['sample-player-1', 'sample-player-2', 'sample-player-3']) {
    await page.goto(`/member/${u}`);
    await expect(page.locator('.profile-screen')).toBeVisible();
  }
  await page.goto('/');
  await expect(people).toHaveAttribute('data-state', 'done');
  await page.reload();
  await expect(people).toHaveAttribute('data-state', 'done');
});

test('Go turns a Mission into a search or a walk', async ({ page }) => {
  await page.goto('/');
  const first = page.locator('.mission').first();
  const title = (await first.locator('.mission-text').textContent()) ?? '';
  const go = first.getByRole('button', { name: /^Go/ }).or(first.getByRole('link', { name: /^Go/ }));
  await go.click();
  if (/Museum/.test(title)) await expect(page).toHaveURL(/\/museum$/);
  else if (/knows|from|builds with/.test(title)) await expect(page).toHaveURL(/[?&](skill|dept|q)=/);
  else await expect(page.locator('.screen .dialogue').first()).toContainText(/Random player/);
});
