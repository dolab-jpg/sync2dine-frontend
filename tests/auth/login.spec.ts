import { test, expect } from '@playwright/test';

const email = process.env.E2E_USER_EMAIL || 'john@bathroompro.com';
const password = process.env.E2E_USER_PASSWORD || 'TradeProSeed1!';
const username = process.env.E2E_USER_USERNAME || 'john.smith';

test.describe('auth login', () => {
  test('shows credential login and no demo when demo off', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Sign in to Builder Diddies/i })).toBeVisible();
    await expect(page.getByLabel(/Email or username/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Sign in$/i })).toBeVisible();
    await expect(page.getByText(/Developer demo/i)).toHaveCount(0);
  });

  test('blank credentials stay on login', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /^Sign in$/i }).click();
    await expect(page.getByRole('alert')).toContainText(/required/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test('email login with seeded account', async ({ page }) => {
    test.skip(!process.env.VITE_SUPABASE_URL && !process.env.E2E_USER_EMAIL, 'Needs Supabase / E2E credentials');
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/Email or username/i).fill(email);
    await page.locator('#login-password').fill(password);
    await page.getByRole('button', { name: /^Sign in$/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  });

  test('username resolves for login field label', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/Email or username/i).fill(username);
    await expect(page.getByLabel(/Email or username/i)).toHaveValue(username);
  });
});
