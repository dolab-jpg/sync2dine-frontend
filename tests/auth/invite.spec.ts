import { test, expect } from '@playwright/test';

test.describe('invite', () => {
  test('invalid invite shows error', async ({ page }) => {
    await page.goto('/invite/invalid', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Invite not found/i })).toBeVisible();
  });

  test('signup invite mode without token asks for paste', async ({ page }) => {
    await page.goto('/signup', { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: /Join with invite/i }).click();
    await expect(page.getByPlaceholder(/Invite token/i)).toBeVisible();
  });
});
