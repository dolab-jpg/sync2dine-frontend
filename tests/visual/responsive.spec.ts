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
  if (role === 'super_admin') {
    await page.getByRole('button', { name: /Super Admin/i }).first().click();
    const signIn = page.getByRole('button', { name: /Demo as Super Admin/i });
    await expect(signIn).toBeVisible({ timeout: 15_000 });
    await signIn.click();
  } else {
    await page.getByRole('button', { name: /Sales Representative/i }).first().click();
    const signIn = page.getByRole('button', { name: /Demo as Sales Representative/i });
    await expect(signIn).toBeVisible({ timeout: 15_000 });
    await signIn.click();
  }
  await page.waitForTimeout(400);

  const isMobile = !viewport || viewport.width < 768;
  if (isMobile) {
    await expect(page.getByLabel('Open navigation menu')).toBeVisible({ timeout: 20_000 });
  } else {
    await expect(page.locator('aside[aria-label="Navigation"]')).toBeVisible({ timeout: 20_000 });
  }
}

async function navigateStaffRoute(
  page: import('@playwright/test').Page,
  viewport: { width: number; height: number } | null | undefined,
  path: string,
) {
  if (new URL(page.url()).pathname === path) return;

  const isMobile = !viewport || viewport.width < 768;
  if (isMobile) {
    await page.getByLabel('Open navigation menu').click();
  }

  const link = isMobile
    ? page.getByRole('dialog', { name: 'Navigation' }).locator(`a[href="${path}"]`)
    : page.locator('aside[aria-label="Navigation"]').locator(`a[href="${path}"]`);
  await expect(link).toBeVisible({ timeout: 10_000 });
  await link.click();
  await page.waitForURL((url) => url.pathname === path, { timeout: 15_000 });
}

async function openStaffRoute(
  page: import('@playwright/test').Page,
  viewport: { width: number; height: number } | null | undefined,
  path: string,
) {
  const needsSuperAdmin = path === '/integrations' || path === '/accounts';
  await demoLoginAsStaff(page, viewport, needsSuperAdmin ? 'super_admin' : 'staff');
  await navigateStaffRoute(page, viewport, path);

  await expect(await isLoggedIn(page, viewport)).toBe(true);
  if (path === '/') {
    await expect(page.getByText(/Welcome back,/i)).toBeVisible({ timeout: 15_000 });
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
      await page.waitForTimeout(400);
      await expect(page).toHaveScreenshot(`${testInfo.project.name}-${route.file}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.04,
      });
    });
  }
});
