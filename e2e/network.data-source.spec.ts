// V2-8 (D-105): the map of the hall and project lineage, gated on density (D-096). A sparse hall
// says how close it is; a dense one opens the map with its plain lists; admins can preview early.
import { expect, test, type Page } from '@playwright/test';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';

const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', email: 'admin@example.org', name: 'Test Admin', role: 'admin' as const };
const SKILLS = ['Python', 'Rust', 'Design', 'SQL', 'Go'];

/** 30 members, each with a project; the first 10 credited with the next member (10 team-ups). */
function denseHall(): Row[] {
  const base = samples[0]!;
  const id = (i: number) => `00000000-0000-4000-8000-${String(1000 + i).padStart(12, '0')}`;
  return Array.from({ length: 30 }, (_, i) => {
    const username = `maker-${i + 1}`;
    const collaborators = i < 10 ? [{ username: `maker-${i + 2}`, full_name: `Maker ${i + 2}`, member_no: i + 2 }] : [];
    const project = { ...base.card.projects[0]!, id: `p-${i + 1}`, title: `Project ${i + 1}`, collaborators };
    return {
      ...base,
      profile_id: id(i),
      username,
      member_no: i + 1,
      is_featured: false,
      card: { ...base.card, username, full_name: `Maker ${i + 1}`, is_featured: false, skills: [SKILLS[i % SKILLS.length]!], projects: [project] },
    };
  });
}

const boot = (page: Page) =>
  page.addInitScript(() => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
  });

test('a sparse hall keeps the map closed and says how close it is', async ({ page }) => {
  await boot(page);
  await mockSupabase(page, { publishedCards: samples });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Passport/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Map/ })).toHaveCount(0);
  await page.goto('/network');
  const box = page.locator('.dialogue').filter({ hasText: 'The map opens when 30 members have projects' });
  await expect(box).toContainText('Right now:');
  await expect(page.locator('.net-svg')).toHaveCount(0);
  await expect(box.getByRole('link', { name: 'TAG A TEAMMATE' })).toHaveAttribute('href', '/edit#collaborators');
});

test('a dense hall opens the map: people, projects and shared skills, with plain lists', async ({ page }) => {
  const cards = denseHall();
  await boot(page);
  await mockSupabase(page, { publishedCards: cards });
  await page.goto('/');
  await page.getByRole('link', { name: /Map/ }).click();
  await expect(page).toHaveURL(/\/network$/);
  await expect(page.locator('#net-caption')).toContainText('30 people · 30 projects · 5 shared skills');

  // Focusing a person lights up their links and dims the rest.
  const ada = page.getByRole('link', { name: 'Maker 1, open their profile' });
  await ada.focus();
  await expect(page.locator('.net-node[data-dim]').first()).toBeAttached();
  await expect(page.locator('.net-label').filter({ hasText: 'Project 1' })).toBeVisible();
  await page.locator('.net-map').screenshot({ path: 'docs/build/evidence/network/map.png' });

  const people = page.getByRole('region', { name: 'Who made what together' });
  await expect(people.getByRole('listitem').first()).toContainText('Maker 1 made “Project 1” with Maker 2.');
  await expect(people.getByRole('listitem').nth(29)).toContainText('hasn’t been credited on a team project yet');
  const lineage = page.getByRole('region', { name: 'Project lineage' });
  await expect(lineage).toContainText('Project 1 by Maker 1 leads to “Project 2” (through Maker 2)');

  await ada.press('Enter');
  await expect(page).toHaveURL(/\/member\/maker-1$/);
});

test('admins can preview the map before the hall is dense enough', async ({ page }) => {
  await boot(page);
  const db = emptyDb();
  db.published.push(...(samples as Row[]));
  await mockSupabase(page, { user: ADMIN, db });
  await page.goto('/network');
  await expect(page.getByRole('status').filter({ hasText: 'Preview for admins' })).toBeVisible();
  await expect(page.locator('.net-svg')).toBeVisible();
});
