import { test, expect } from '@playwright/test';

test.describe('oauth', () => {
  test('production login has no OAuth or demo accounts', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Sign in to Sync2Dine/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Continue with GitHub/i })).toHaveCount(0);
    await expect(page.getByText(/Demo accounts/i)).toHaveCount(0);
    await expect(page.getByText('owner@sync2dine.io')).toHaveCount(0);
    await expect(page.getByText('maya@demo.sync2dine.io')).toHaveCount(0);
    await expect(page.getByLabel(/Remember me/i)).toBeVisible();
  });
});
