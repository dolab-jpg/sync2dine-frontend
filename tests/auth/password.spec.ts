import { test, expect } from '@playwright/test';

test.describe('password flows', () => {
  test('forgot password success UI', async ({ page }) => {
    await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/Email/i).fill('john@bathroompro.com');
    await page.getByRole('button', { name: /Send reset link/i }).click();
    await expect(page.getByText(/If an account exists/i)).toBeVisible({ timeout: 15_000 });
  });

  test('reset expired state', async ({ page }) => {
    await page.goto('/reset-password?expired=1', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/expired or is invalid/i)).toBeVisible();
  });
});
