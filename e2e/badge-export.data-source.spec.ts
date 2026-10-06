// V2-1 (D-095): with the hall's backend, a profile offers the approved badge as a PNG download
// from /api/badge (mocked here; the function itself is unit-tested in api/share.test.ts).
import { expect, test } from '@playwright/test';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { TINY_PNG } from './mockDb';
import { mockSupabase } from './mockSupabase';

test('Save badge downloads the approved badge PNG', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
  });
  await mockSupabase(page, { publishedCards: samples });
  await page.route('**/api/badge?u=*', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG }));
  await page.goto('/member/sample-player-4');
  const save = page.locator('.profile-screen').getByRole('link', { name: 'Save badge (PNG)' });
  await expect(save).toHaveAttribute('href', '/api/badge?u=sample-player-4');
  const [download] = await Promise.all([page.waitForEvent('download'), save.click()]);
  expect(download.suggestedFilename()).toBe('pip-hall-sample-player-4.png');
});
