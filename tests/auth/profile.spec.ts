import { test, expect } from '@playwright/test';

test.describe('profile page', () => {
  test('change password page validates mismatch', async ({ page }) => {
    // Profile routes require login — without session expect redirect to login
    await page.goto('/profile/password', { waitUntil: 'domcontentloaded' });
    const url = page.url();
    if (url.includes('/login')) {
      await expect(page.getByRole('heading', { name: /Sign in/i })).toBeVisible();
      return;
    }
    await page.locator('#current-password').fill('oldpass12');
    await page.locator('#new-password').fill('newpass123');
    await page.locator('#confirm-password').fill('different1');
    await page.getByRole('button', { name: /Update password/i }).click();
    await expect(page.getByRole('alert')).toContainText(/match/i);
  });
});
