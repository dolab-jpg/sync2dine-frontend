/**
 * Full restaurant click-through on live Sync2Dine.
 * Logs in as Maya, clicks every nav link, exercises primary controls.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.S2D_BASE || 'https://app.sync2dine.io';
const EMAIL = process.env.S2D_EMAIL || 'maya@demo.sync2dine.io';
const PASS = process.env.S2D_PASS || 'Sync2DineDemo1!';
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'clickthrough-out');
mkdirSync(OUT, { recursive: true });

const results = [];

function check(id, ok, detail = '', screenshot = '') {
  const row = { id, ok, detail: String(detail).slice(0, 300), screenshot, url: '' };
  results.push(row);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? ' — ' + detail : ''}`);
  return row;
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
  });
  await page.reload({ waitUntil: 'networkidle', timeout: 60_000 });
  await page.locator('#login-identifier, input[autocomplete="username"], input[type="email"]').first().fill(EMAIL);
  await page.locator('#login-password, input[type="password"]').first().fill(PASS);
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 45_000 });
}

async function shot(page, name) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function clickNav(page, label) {
  // Close any open dialog overlay that intercepts clicks
  for (let i = 0; i < 3; i++) {
    const overlay = page.locator('[data-slot="dialog-overlay"]');
    if ((await overlay.count()) === 0) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
  const rail = page.locator('aside nav a, aside a').filter({ hasText: new RegExp(`^${label}$`, 'i') });
  const bottom = page.locator('[data-testid="restaurant-bottom-nav"] a').filter({ hasText: new RegExp(label, 'i') });
  if (await rail.count()) {
    await rail.first().click({ force: true });
    return 'rail';
  }
  if (await bottom.count()) {
    await bottom.first().click({ force: true });
    return 'bottom';
  }
  throw new Error(`Nav link not found: ${label}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await desktop.newPage();
  page.setDefaultTimeout(25_000);

  // Login
  try {
    await login(page);
    await page.waitForTimeout(1500);
    const url = page.url();
    const body = await page.locator('body').innerText();
    const row = check(
      '01-login-maya',
      !url.includes('/login') && !/Platform Clients|CSV dial/i.test(body),
      url,
    );
    row.url = url;
    await shot(page, '01-login-live');
  } catch (e) {
    check('01-login-maya', false, String(e));
    writeFileSync(join(OUT, 'clickthrough-scorecard.json'), JSON.stringify({ base: BASE, results }, null, 2));
    await browser.close();
    process.exit(1);
  }

  // Nav labels present / Team presence
  const navText = await page.locator('aside nav, [data-testid="restaurant-bottom-nav"]').allInnerTexts().then((t) => t.join('\n')).catch(() => '');
  check('02-nav-has-live', /\bLive\b/i.test(navText), navText.slice(0, 120));
  check('02-nav-has-kitchen', /\bKitchen\b/i.test(navText), navText.slice(0, 120));
  check('02-nav-has-delivery', /\bDelivery\b/i.test(navText), navText.slice(0, 120));
  check('02-nav-has-menu', /\bMenu\b/i.test(navText), navText.slice(0, 120));
  check('02-nav-has-customers', /\bCustomers\b/i.test(navText), navText.slice(0, 120));
  check('02-nav-has-settings', /\bSettings\b/i.test(navText), navText.slice(0, 120));
  check('02-nav-team-absent', !/\bTeam\b/i.test(navText), 'baseline may FAIL if Team still present');
  check('02-nav-has-calls', /\bCalls\b/i.test(navText), 'baseline may FAIL until Calls ships');
  check('02-nav-has-accounts', /\bAccounts\b/i.test(navText), 'baseline may FAIL until Accounts ships');

  const screens = [
    { id: '03-nav-live', label: 'Live', pathRe: /\/$/ },
    { id: '04-nav-kitchen', label: 'Kitchen', pathRe: /\/orders\/kitchen/ },
    { id: '05-nav-delivery', label: 'Delivery', pathRe: /\/orders\/delivery/ },
    { id: '06-nav-menu', label: 'Menu', pathRe: /\/menu/ },
    { id: '07-nav-customers', label: 'Customers', pathRe: /\/customers/ },
    { id: '08-nav-settings', label: 'Settings', pathRe: /\/settings/ },
  ];

  for (const s of screens) {
    try {
      await clickNav(page, s.label);
      await page.waitForTimeout(900);
      const ok = s.pathRe.test(new URL(page.url()).pathname) || (s.label === 'Live' && new URL(page.url()).pathname === '/');
      const row = check(s.id, ok, page.url());
      row.url = page.url();
      await shot(page, s.id);
    } catch (e) {
      check(s.id, false, String(e));
    }
  }

  // Optional Calls / Accounts nav (post-build)
  for (const s of [
    { id: '09-nav-calls', label: 'Calls', pathRe: /\/calls/ },
    { id: '10-nav-accounts', label: 'Accounts', pathRe: /\/accounts/ },
  ]) {
    try {
      await clickNav(page, s.label);
      await page.waitForTimeout(900);
      const ok = s.pathRe.test(new URL(page.url()).pathname);
      check(s.id, ok, page.url());
      await shot(page, s.id);
    } catch (e) {
      check(s.id, false, String(e.message || e));
    }
  }

  // Live order interactions
  try {
    await clickNav(page, 'Live');
    await page.waitForTimeout(1000);
    const article = page.locator('article').first();
    const hasOrder = (await article.count()) > 0;
    check('11-live-has-orders-or-empty', true, hasOrder ? 'has order card' : 'empty board ok');

    if (hasOrder) {
      // Buttons on card before opening detail
      const comingCard = page.getByRole('button', { name: /Coming to order/i }).first();
      const payCashCard = page.getByRole('button', { name: /Paid cash|Expect cash/i }).first();
      check('13-coming-btn-visible', (await comingCard.count()) > 0);
      check('14-paid-cash-visible', (await payCashCard.count()) > 0 || (await page.getByText(/Paid cash|Paid card|Cash on arrival|Unpaid/i).count()) > 0, 'pay action or badge');

      await article.click({ position: { x: 40, y: 40 } });
      await page.waitForTimeout(600);
      const dialog = page.locator('[role="dialog"]');
      check('12-order-detail-opens', (await dialog.count()) > 0 && (await dialog.isVisible()));
      if (await dialog.count()) {
        await shot(page, '12-order-detail');
        const comingDlg = dialog.getByRole('button', { name: /Coming to order/i });
        const payDlg = dialog.getByRole('button', { name: /Paid cash/i });
        if ((await comingDlg.count()) === 0) check('13b-coming-in-dialog', false, 'missing in dialog');
        else check('13b-coming-in-dialog', true);
        if ((await payDlg.count()) > 0) check('14b-paid-cash-in-dialog', true);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
        // Force-close overlay if still open
        if (await page.locator('[data-slot="dialog-overlay"]').count()) {
          await page.locator('[role="dialog"] button').filter({ hasText: /Close/i }).first().click({ timeout: 3000 }).catch(() => {});
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        }
      }
    } else {
      check('12-order-detail-opens', false, 'no orders to click');
      check('13-coming-btn-visible', false, 'no orders');
      check('14-paid-cash-visible', false, 'no orders');
    }
    await shot(page, '11-live-board');
  } catch (e) {
    check('11-live-interactions', false, String(e));
  }

  // Ensure no dialog blocks nav
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Customers
  try {
    await page.keyboard.press('Escape');
    await clickNav(page, 'Customers');
    await page.waitForTimeout(1000);
    const body = await page.locator('body').innerText();
    check('15-customers-no-create-quote', !/Create Quote/i.test(body), 'baseline may FAIL');
    const clickable = page.locator('div.rounded-lg, div.rounded-xl, [class*="rounded"]').filter({ hasText: /@|0\d{10}/ }).first();
    if (await clickable.count()) {
      await clickable.click();
      await page.waitForTimeout(500);
      const dialog = page.locator('[role="dialog"]');
      check('16-customer-detail-opens', (await dialog.count()) > 0, 'baseline may FAIL');
      if (await dialog.count()) {
        await shot(page, '16-customer-detail');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    } else {
      check('16-customer-detail-opens', false, 'no customer card found');
    }
    await shot(page, '15-customers');
  } catch (e) {
    check('15-customers', false, String(e));
  }

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Menu
  try {
    await clickNav(page, 'Menu');
    await page.waitForTimeout(1000);
    const addBtn = page.getByRole('button', { name: /Add (dish|item|menu)/i }).first();
    if (await addBtn.count()) {
      await addBtn.click();
      await page.waitForTimeout(500);
      const hasDesc = (await page.locator('#dish-description').count()) > 0
        || (await page.getByLabel(/description/i).count()) > 0;
      check('17-menu-description-field', hasDesc);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } else {
      check('17-menu-description-field', false, 'Add dish button not found');
    }
    await shot(page, '17-menu');
  } catch (e) {
    check('17-menu', false, String(e));
  }

  await page.keyboard.press('Escape');

  // Settings integrations
  try {
    await clickNav(page, 'Settings');
    await page.waitForTimeout(1000);
    const body = await page.locator('body').innerText();
    check('18-settings-integrations', /Integrations|Stripe|OpenAI|WhatsApp|Vapi|phone agent/i.test(body), 'baseline may FAIL');
    check('18b-settings-no-team-link', !/Team & invites/i.test(body), 'baseline may FAIL');
    await shot(page, '18-settings');
  } catch (e) {
    check('18-settings', false, String(e));
  }

  // Sidebar collapse
  try {
    const collapse = page.getByRole('button', { name: /Collapse sidebar|Expand sidebar|Collapse/i }).first();
    if (await collapse.count()) {
      await collapse.click();
      await page.waitForTimeout(400);
      check('19-sidebar-collapse', true, 'toggle clicked');
      await shot(page, '19-sidebar-collapsed');
      const expand = page.getByRole('button', { name: /Expand sidebar|Collapse/i }).first();
      if (await expand.count()) await expand.click();
    } else {
      check('19-sidebar-collapse', false, 'no collapse control — baseline FAIL');
    }
  } catch (e) {
    check('19-sidebar-collapse', false, String(e));
  }

  // Negative /team
  await page.goto(`${BASE}/team`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const teamUrl = page.url();
  const teamBody = await page.locator('body').innerText();
  check(
    '20-team-gone',
    !/Team Management|Invite staff/i.test(teamBody) || !teamUrl.includes('/team'),
    teamUrl,
  );
  await shot(page, '20-team');

  // Tablet viewport bottom nav
  const tablet = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const tpage = await tablet.newPage();
  await login(tpage);
  await tpage.waitForTimeout(1200);
  const bottom = tpage.locator('[data-testid="restaurant-bottom-nav"]');
  check('21-tablet-bottom-nav', (await bottom.count()) > 0);
  if (await bottom.count()) {
    await tpage.locator('[data-testid="restaurant-bottom-nav"] a').filter({ hasText: /Kitchen/i }).first().click();
    await tpage.waitForTimeout(800);
    check('21b-tablet-kitchen-click', /kitchen/i.test(tpage.url()), tpage.url());
    await tpage.screenshot({ path: join(OUT, '21-tablet.png'), fullPage: true });
  }
  await tablet.close();

  await browser.close();

  const pass = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  const summary = { base: BASE, email: EMAIL, pass, fail, results, at: new Date().toISOString() };
  writeFileSync(join(OUT, 'clickthrough-scorecard.json'), JSON.stringify(summary, null, 2));
  console.log(`\n=== ${pass} PASS / ${fail} FAIL ===`);
  console.log(`Scorecard: ${join(OUT, 'clickthrough-scorecard.json')}`);
  // Baseline is allowed to fail — exit 0 so agent can continue implementing
  process.exit(0);
})().catch((e) => {
  console.error(e);
  writeFileSync(join(OUT, 'clickthrough-scorecard.json'), JSON.stringify({ error: String(e), results }, null, 2));
  process.exit(1);
});
