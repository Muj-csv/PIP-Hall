import { defineConfig, devices } from '@playwright/test';

// PW_CHROMIUM_PATH lets sandboxes with a preinstalled Chromium skip `playwright install`.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 }, launchOptions: { executablePath } } },
    { name: 'phone', use: { ...devices['Pixel 7'], launchOptions: { executablePath } } },
  ],
  webServer: {
    command: 'npm run dev -- --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    env: { VITE_DATA_SOURCE: 'fixture' },
  },
});
