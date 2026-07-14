import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5174';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    browserName: 'chromium',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    navigationTimeout: 60_000,
  },
  projects: [
    { name: 'auth', testMatch: /auth\/.*\.spec\.ts/, use: { viewport: { width: 1280, height: 800 } } },
    { name: 'phone', testMatch: /visual\/.*\.spec\.ts/, use: { viewport: { width: 390, height: 844 } } },
    { name: 'phone-small', testMatch: /visual\/.*\.spec\.ts/, use: { viewport: { width: 375, height: 667 } } },
    { name: 'tablet', testMatch: /visual\/.*\.spec\.ts/, use: { viewport: { width: 768, height: 1024 } } },
    { name: 'tablet-landscape', testMatch: /visual\/.*\.spec\.ts/, use: { viewport: { width: 1024, height: 768 } } },
    { name: 'desktop', testMatch: /visual\/.*\.spec\.ts/, use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:5174',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
