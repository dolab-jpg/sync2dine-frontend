import { test, expect } from '@playwright/test';

test.describe('signup org', () => {
  test('new company form validates and shows dual modes', async ({ page }) => {
    await page.goto('/signup', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Create your company account/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /New company/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Join with invite/i })).toBeVisible();
    await page.getByRole('button', { name: /Create company account/i }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });
});
