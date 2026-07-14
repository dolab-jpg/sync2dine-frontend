import { test, expect } from '@playwright/test';

test.describe('oauth', () => {
  test('OAuth buttons present on login', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue with GitHub/i })).toBeVisible();
  });
});
