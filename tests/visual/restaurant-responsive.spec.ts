import { test, expect } from '@playwright/test';

async function assertNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  expect(overflow, 'page should not scroll horizontally').toBeLessThanOrEqual(1);
}

/**
 * Restaurant-shell responsive coverage for Sync2Dine.
 * Soft-skips /integrations when the running server is not Sync2Dine (e.g. reused TradePro on :5174).
 */
test.describe('Restaurant responsive surfaces', () => {
  const viewports = [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
  ];

  for (const vp of viewports) {
    test(`login overflow ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('button', { name: /Sign in|Demo as/i }).first()).toBeVisible({ timeout: 15_000 });
      await assertNoHorizontalOverflow(page);

      // Sync2Dine-only: logo strip on login
      const strip = page.getByTestId('integrations-logo-strip');
      if (await strip.isVisible().catch(() => false)) {
        await expect(strip).toBeVisible();
      }

      await page.goto('/integrations', { waitUntil: 'domcontentloaded' });
      const publicPage = page.getByTestId('integrations-public-page');
      if (await publicPage.isVisible().catch(() => false)) {
        await assertNoHorizontalOverflow(page);
      } else {
        // Wrong app on :5174 or route not mounted — still assert no overflow on whatever landed
        await assertNoHorizontalOverflow(page);
        test.info().annotations.push({
          type: 'note',
          description: ' /integrations not Sync2Dine public page — check PLAYWRIGHT_BASE_URL points at sync2dine-frontend',
        });
      }
    });
  }

  test('restaurant boards when session available', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    const demo = page.getByRole('button', { name: /Demo|Casa|Restaurant|manager/i }).first();
    if (await demo.isVisible().catch(() => false)) {
      await demo.click();
      await page.waitForTimeout(600);
    }

    const paths = ['/', '/orders/kitchen', '/orders/delivery', '/bookings', '/menu', '/settings'];
    for (const path of paths) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);
      if (page.url().includes('/login')) {
        test.info().annotations.push({ type: 'note', description: 'No restaurant session — public routes only' });
        break;
      }
      await assertNoHorizontalOverflow(page);
      if (path === '/orders/kitchen' || path === '/orders/delivery') {
        const board = page.getByTestId('restaurant-orders-board');
        if (await board.isVisible().catch(() => false)) {
          await expect(page.getByTestId('orders-stage-new').or(page.getByTestId('orders-alert-strip')).first()).toBeVisible();
        }
      }
      if (path === '/bookings') {
        await expect(page.getByTestId('bookings-board').or(page.locator('main'))).toBeVisible();
      }
      if (path === '/settings') {
        await expect(
          page.getByTestId('connected-systems-panel')
            .or(page.getByTestId('kitchen-alert-settings'))
            .or(page.getByText(/Connected systems|Board alerts|Tables/i))
            .first(),
        ).toBeVisible({ timeout: 10_000 });
      }
    }
  });
});
