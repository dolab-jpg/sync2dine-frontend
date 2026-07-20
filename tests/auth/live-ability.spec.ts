/**
 * Live human-ability checks against app.sync2dine.io
 * PLAYWRIGHT_BASE_URL=https://app.sync2dine.io npx playwright test tests/auth/live-ability.spec.ts --project=auth
 */
import { test, expect } from '@playwright/test';

const DEBUG_INGEST = 'http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5';
const PASS = process.env.S2D_PASS || 'Sync2DineDemo1!';

async function dbg(hypothesisId: string, location: string, message: string, data: Record<string, unknown>) {
  // #region agent log
  await fetch(DEBUG_INGEST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b8f319' },
    body: JSON.stringify({
      sessionId: 'b8f319',
      runId: 'human-test-2',
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

async function signIn(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder(/you@company.com/i).fill(email);
  await page.getByPlaceholder(/enter password/i).fill(PASS);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60_000 });
  // Let role home redirect settle
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
}

test.describe('live human ability', () => {
  test('maya: orders + calls surfaces (shell-aware)', async ({ page }) => {
    test.setTimeout(150_000);
    await signIn(page, process.env.S2D_EMAIL || 'maya@demo.sync2dine.io');
    await dbg('H4', 'live-ability:mayaLogin', 'maya logged in', { url: page.url() });

    // Probe kitchen path — restaurant shell keeps it; sales shell redirects to /
    await page.goto('/orders/kitchen', { waitUntil: 'load' });
    await page.waitForTimeout(800);
    const kitchenUrl = page.url();
    const salesShell = !kitchenUrl.includes('/orders/kitchen');
    await dbg('H6', 'live-ability:mayaShell', 'experience shell', {
      kitchenUrl,
      salesShell,
      note: salesShell
        ? 'Maya landed on sales shell — restaurant kitchen routes unavailable'
        : 'Maya on restaurant shell',
    });

    // After Maya fix: must be restaurant shell with kitchen routes
    expect(salesShell).toBeFalsy();

    for (const path of ['/orders/kitchen', '/orders/delivery', '/calls', '/call-register']) {
      await page.goto(path, { waitUntil: 'load' });
      await page.waitForTimeout(800);
      const bodyText = await page.locator('body').innerText().catch(() => '');
      const onLogin = /sign in to sync2dine/i.test(bodyText.slice(0, 300));
      await dbg('H3', 'live-ability:mayaRoute', 'route', {
        path,
        url: page.url(),
        onLogin,
        snippet: bodyText.slice(0, 200),
      });
      expect(onLogin).toBeFalsy();
      expect(page.url()).toContain(path);
    }

    await page.goto('/orders/kitchen', { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    const board = await page.locator('body').innerText();
    const seesHumanTest = /Human Test Guest|Chicken biryani|Meal Deal/i.test(board);
    const seesKitchenNav = /Kitchen|Delivery|Live/i.test(board);
    await dbg('H6', 'live-ability:orderBoard', 'kitchen board after fix', {
      seesHumanTest,
      seesKitchenNav,
      salesShell,
      snippet: board.slice(0, 400),
    });
    expect(seesKitchenNav).toBeTruthy();
  });

  test('owner: Sally offer UI + save + API', async ({ page }) => {
    test.setTimeout(150_000);
    await signIn(page, process.env.S2D_OWNER_EMAIL || 'owner@sync2dine.io');
    await dbg('H4', 'live-ability:ownerLogin', 'owner logged in', { url: page.url() });

    // Prefer nav click (human path); fallback to direct URL after settle
    const navLink = page.getByRole('link', { name: /sally offer/i });
    if (await navLink.count()) {
      await navLink.first().click();
      await page.waitForTimeout(1000);
    } else {
      await page.goto('/platform/sally-offer', { waitUntil: 'load' });
    }
    await expect(page).toHaveURL(/\/platform\/sally-offer/, { timeout: 20_000 });

    const heading = page.getByRole('heading', { name: /sally offer/i });
    await expect(heading).toBeVisible({ timeout: 20_000 });
    await dbg('H1', 'live-ability:ownerSally', 'sally UI visible', { url: page.url() });

    const monthly = page.locator('#monthly');
    await expect(monthly).toBeVisible();
    const before = await monthly.inputValue();
    await monthly.fill('351');
    await page.getByRole('button', { name: /save offer/i }).click();
    await page.waitForTimeout(1500);
    const toastOrValue = await monthly.inputValue();
    await dbg('H2', 'live-ability:saveOffer', 'saved offer', { before, after: toastOrValue });

    const api = await page.request.get('/api/platform/sally-offer');
    const apiJson = await api.json().catch(() => ({}));
    await dbg('H2', 'live-ability:apiAfterSave', 'API after save', {
      status: api.status(),
      monthly: (apiJson as { offer?: { monthlyPriceGbp?: number } }).offer?.monthlyPriceGbp,
    });
    expect(api.status()).toBe(200);
    expect(Number((apiJson as { offer?: { monthlyPriceGbp?: number } }).offer?.monthlyPriceGbp)).toBe(351);

    // restore default
    await monthly.fill('350');
    await page.getByRole('button', { name: /save offer/i }).click();
    await page.waitForTimeout(800);
  });
});
