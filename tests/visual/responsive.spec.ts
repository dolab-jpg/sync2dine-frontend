import { test, expect } from '@playwright/test';

async function assertNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  expect(overflow, 'page should not scroll horizontally').toBeLessThanOrEqual(1);
}

async function isLoggedIn(page: import('@playwright/test').Page, viewport?: { width: number; height: number } | null) {
  const isMobile = !viewport || viewport.width < 768;
  if (isMobile) {
    return page.getByLabel('Open navigation menu').isVisible().catch(() => false);
  }
  return page.locator('aside[aria-label="Navigation"]').isVisible().catch(() => false);
}

async function demoLoginAsStaff(
  page: import('@playwright/test').Page,
  viewport?: { width: number; height: number } | null,
  role: 'staff' | 'super_admin' = 'staff',
) {
  if (await isLoggedIn(page, viewport)) return;

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const demoLabel =
    role === 'super_admin' ? /Demo as Super Admin/i : /Demo as Sales Representative/i;
  const rolePick =
    role === 'super_admin' ? /Super Admin/i : /Sales Representative/i;
  const demoBtn = page.getByRole('button', { name: demoLabel });

  if (await demoBtn.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: rolePick }).first().click();
    await demoBtn.click();
  } else {
    // Real auth (no VITE_DEMO_LOGIN) — use seeded E2E user
    const email =
      role === 'super_admin'
        ? process.env.E2E_ADMIN_EMAIL || 'john@bathroompro.com'
        : process.env.E2E_USER_EMAIL || 'mike@bathroompro.com';
    await page.getByLabel(/Email or username/i).fill(email);
    await page.locator('#login-password').fill(process.env.E2E_USER_PASSWORD || 'TradeProSeed1!');
    await page.getByRole('button', { name: /^Sign in$/i }).click();
  }
  await page.waitForTimeout(400);

  const isMobile = !viewport || viewport.width < 768;
  if (isMobile) {
    await expect(page.getByLabel('Open navigation menu')).toBeVisible({ timeout: 20_000 });
  } else {
    await expect(page.locator('aside[aria-label="Navigation"]')).toBeVisible({ timeout: 20_000 });
  }
}

/** Direct navigation after login — avoids brittle hamburger click paths. */
async function openStaffRoute(
  page: import('@playwright/test').Page,
  viewport: { width: number; height: number } | null | undefined,
  path: string,
) {
  const needsSuperAdmin = path === '/integrations' || path === '/accounts';
  await demoLoginAsStaff(page, viewport, needsSuperAdmin ? 'super_admin' : 'staff');
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(await isLoggedIn(page, viewport)).toBe(true);

  const isMobile = !viewport || viewport.width < 768;
  if (path === '/' && isMobile) {
    // Staff phone redirects `/` → `/cynthia`
    await expect(page).toHaveURL(/\/cynthia/, { timeout: 15_000 });
    await expect(page.getByTestId('cynthia-home')).toBeVisible({ timeout: 15_000 });
    return;
  }
  if (path === '/') {
    await expect(page.getByText(/Welcome back,/i)).toBeVisible({ timeout: 15_000 });
    return;
  }
  if (path === '/cynthia') {
    await expect(page.getByTestId('cynthia-home')).toBeVisible({ timeout: 15_000 });
    return;
  }
  await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
}

test.describe('Responsive smoke — public routes', () => {
  test('login page fits viewport', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /Sign In|Demo as/i }).first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test('platform clients CRM fits viewport', async ({ page }) => {
    await page.goto('/platform/clients', { waitUntil: 'domcontentloaded' });
    await assertNoHorizontalOverflow(page);
  });
});

test.describe('Responsive smoke — staff routes (demo login)', () => {
  const staffRoutes = [
    { path: '/', name: 'dashboard' },
    { path: '/crm', name: 'crm' },
    { path: '/projects', name: 'projects' },
    { path: '/accounts', name: 'accounts' },
    { path: '/integrations', name: 'integrations' },
    { path: '/quotes', name: 'quotes' },
  ];

  for (const route of staffRoutes) {
    test(`${route.name} (${route.path}) — no horizontal overflow`, async ({ page, viewport }) => {
      await openStaffRoute(page, viewport, route.path);
      await page.waitForTimeout(400);
      await assertNoHorizontalOverflow(page);
    });
  }

  test('mobile nav hamburger visible below md', async ({ page, viewport }) => {
    test.skip(!viewport || viewport.width >= 768, 'phone-only');
    await demoLoginAsStaff(page, viewport);
    await expect(page.getByLabel('Open navigation menu')).toBeVisible();
  });

  test('projects payments tab controls are tappable', async ({ page, viewport }) => {
    test.skip(!viewport || viewport.width > 480, 'narrow phone focus');
    await openStaffRoute(page, viewport, '/projects');
    const paymentsTab = page.getByRole('tab', { name: /Payments/i });
    if (await paymentsTab.isVisible().catch(() => false)) {
      await paymentsTab.click();
    }
    await assertNoHorizontalOverflow(page);
  });
});

test.describe('Responsive smoke — restaurant routes', () => {
  const restaurantRoutes = [
    { path: '/menu', name: 'menu' },
    { path: '/orders/kitchen', name: 'kitchen' },
    { path: '/orders/delivery', name: 'delivery' },
    { path: '/bookings', name: 'bookings' },
    { path: '/settings', name: 'settings' },
    { path: '/integrations', name: 'integrations-public' },
  ];

  for (const route of restaurantRoutes) {
    test(`${route.name} (${route.path}) — no horizontal overflow`, async ({ page, viewport }) => {
      // Public integrations needs no login
      if (route.path === '/integrations') {
        await page.goto('/integrations', { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('integrations-public-page').or(page.getByTestId('integrations-page')).or(page.getByTestId('integrations-logo-strip'))).toBeVisible({ timeout: 15_000 });
        await assertNoHorizontalOverflow(page);
        return;
      }
      await demoLoginAsStaff(page, viewport);
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(400);
      await assertNoHorizontalOverflow(page);
    });
  }

  test('login integrations strip fits viewport', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('integrations-logo-strip')).toBeVisible({ timeout: 15_000 });
    await assertNoHorizontalOverflow(page);
  });
});

test.describe('Responsive snapshots — key screens', () => {
  const snapshotProjects = new Set(['phone', 'tablet', 'desktop']);

  test('login page snapshot', async ({ page }, testInfo) => {
    test.skip(!snapshotProjects.has(testInfo.project.name));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveScreenshot(`${testInfo.project.name}-login.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.03,
    });
  });

  for (const route of [
    { path: '/', file: 'dashboard' },
    { path: '/projects', file: 'projects' },
    { path: '/integrations', file: 'integrations' },
  ]) {
    test(`${route.file} snapshot`, async ({ page, viewport }, testInfo) => {
      test.skip(!snapshotProjects.has(testInfo.project.name));
      await openStaffRoute(page, viewport, route.path);
      await expect(page).toHaveScreenshot(`${testInfo.project.name}-${route.file}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.03,
      });
    });
  }
});
