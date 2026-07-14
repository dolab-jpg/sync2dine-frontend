import { test, expect } from '@playwright/test';

test.describe('lockdown', () => {
  test('logged out platform clients redirects to login', async ({ page }) => {
    await page.goto('/platform/clients', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/);
  });

  test('blank sign-in does not enter app', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /^Sign in$/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/Developer demo/i)).toHaveCount(0);
  });
});
