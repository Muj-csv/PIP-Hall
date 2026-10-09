// Phase 2 acceptance: with VITE_DATA_SOURCE=supabase the hall reads published_cards only
// (ADR-002), shows the empty state for an empty table, and the error state with a retry.
import { expect, test } from '@playwright/test';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { mockSupabase } from './mockSupabase';

test('an empty published_cards table shows the empty-state dialogue', async ({ page }) => {
  const log = await mockSupabase(page, { publishedCards: [] });
  await page.addInitScript(() => sessionStorage.setItem('piphall-booted', '1'));
  await page.goto('/');
  await expect(page.locator('.dialogue .sr-only')).toHaveText('No players in the hall yet. Make your card and be the first!');
  await expect(page.locator('.slot')).toHaveCount(0);
  const read = log.requests.find((r) => r.startsWith('GET /rest/v1/published_cards'));
  expect(read).toContain('select=profile_id%2Cusername%2Ccard%2Cis_featured%2Cpublished_at%2Cmember_no');
  expect(read).toContain('order=member_no');
  expect(log.requests.some((r) => /\/rest\/v1\/(profiles|projects)/.test(r))).toBe(false);
});

test('published cards from Supabase hang in the hall, numbered by member_no', async ({ page }) => {
  await mockSupabase(page, { publishedCards: samples.slice(0, 2) });
  await page.addInitScript(() => sessionStorage.setItem('piphall-booted', '1'));
  await page.goto('/');
  await expect(page.locator('.hud span').last()).toHaveText('1/2');
  await expect(page.locator('.slot:not([aria-hidden]) .band-no').first()).toHaveText('No.001');
});

test('a failed read shows the error dialogue, and Retry recovers', async ({ page }) => {
  await mockSupabase(page, { publishedStatus: 500 });
  await page.addInitScript(() => sessionStorage.setItem('piphall-booted', '1'));
  await page.goto('/');
  await expect(page.locator('.dialogue .sr-only')).toContainText('Can’t reach the hall right now');
  await page.unroute('https://pip-e2e.supabase.co/**');
  await mockSupabase(page, { publishedCards: samples.slice(0, 1) });
  await page.getByRole('button', { name: 'RETRY' }).click();
  await expect(page.locator('.hud span').last()).toHaveText('1/1');
});
