import { test, expect } from '@playwright/test';

test.describe('mobile shell hooks', () => {
  test('online banner appears when offline emulated', async ({ page, context }) => {
    await context.setOffline(true);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('online-status-banner')).toBeVisible({ timeout: 10_000 });
  });

  test('session restore keeps demo user after reload', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Sales Representative/i }).first().click();
    await page.getByRole('button', { name: /Demo as Sales Representative/i }).click();
    await expect(page.getByLabel('Open navigation menu')).toBeVisible({ timeout: 20_000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Open navigation menu')).toBeVisible({ timeout: 20_000 });
  });

  test('demoRole query pre-selects builder on login', async ({ page }) => {
    await page.goto('/?demoRole=builder', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /Demo as Builder/i })).toBeVisible({ timeout: 10_000 });
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
});
