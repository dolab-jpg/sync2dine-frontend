import { test, expect } from '@playwright/test';

async function demoLoginStaff(page: import('@playwright/test').Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  const demoBtn = page.getByRole('button', { name: /Demo as Sales Representative/i });
  if (await demoBtn.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /Sales Representative/i }).first().click();
    await demoBtn.click();
  } else {
    await page.getByLabel(/Email or username/i).fill(process.env.E2E_USER_EMAIL || 'mike@bathroompro.com');
    await page.locator('#login-password').fill(process.env.E2E_USER_PASSWORD || 'TradeProSeed1!');
    await page.getByRole('button', { name: /^Sign in$/i }).click();
  }
  await expect(page.getByLabel('Open navigation menu')).toBeVisible({ timeout: 20_000 });
}

test.describe('mobile shell hooks', () => {
  test('online banner appears when offline emulated', async ({ page, context }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.getByTestId('online-status-banner')).toBeVisible({ timeout: 10_000 });
  });

  test('session restore keeps user after reload', async ({ page }) => {
    await demoLoginStaff(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Open navigation menu')).toBeVisible({ timeout: 20_000 });
  });

  test('demoRole query pre-selects builder on login when demo enabled', async ({ page }) => {
    await page.goto('/login?demoRole=builder', { waitUntil: 'domcontentloaded' });
    const demoBtn = page.getByRole('button', { name: /Demo as Builder/i });
    test.skip(!(await demoBtn.isVisible().catch(() => false)), 'VITE_DEMO_LOGIN is false');
    await expect(demoBtn).toBeVisible({ timeout: 10_000 });
  });

  test('native bridge mock injects photo into page', async ({ page }) => {
    await page.addInitScript(() => {
      window.TradeProNative = {
        __ready: true,
        isAvailable: () => true,
        takePhoto: async () => ({ ok: true, dataUrl: 'data:image/jpeg;base64,Zm9v' }),
        pickPhoto: async () => ({ ok: true, dataUrl: 'data:image/jpeg;base64,Zm9v' }),
        startVoiceRecording: async () => ({ ok: true, recording: true }),
        stopVoiceRecording: async () => ({ ok: true, dataUrl: 'data:audio/mp4;base64,Zm9v' }),
        requestNotifications: async () => ({ ok: true, dryRun: true }),
        navigate: async () => ({ ok: true }),
      };
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const available = await page.evaluate(() => window.TradeProNative?.isAvailable?.());
    expect(available).toBe(true);
  });

  test('phone staff lands on Cynthia with bottom nav', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone' && testInfo.project.name !== 'phone-small', 'phone viewport only');
    await demoLoginStaff(page);
    await expect(page).toHaveURL(/\/cynthia/, { timeout: 20_000 });
    await expect(page.getByTestId('cynthia-home')).toBeVisible();
    await expect(page.getByTestId('staff-bottom-nav')).toBeVisible();
    await expect(page.getByPlaceholder(/Message/i)).toBeVisible();
    await expect(page.getByText('TradePro AI')).toHaveCount(0);
    const overflow = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth - el.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('bottom nav More opens sheet on phone', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone' && testInfo.project.name !== 'phone-small', 'phone viewport only');
    await demoLoginStaff(page);
    await page.getByRole('button', { name: /Open more navigation/i }).click();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Logout' })).toBeVisible({
      timeout: 10_000,
    });
  });
});
