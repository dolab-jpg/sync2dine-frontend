/**
 * Platform-owner navigation audit (local dev :5174).
 * Injects a platform_owner session (no password needed � sessionStore is localStorage)
 * and proves every left-menu destination renders the IT/sales shell, never the
 * restaurant tablet � including while acting-as a client. Then exercises the
 * explicit tablet preview + exit.
 *
 * Run: node .cursor/local/audit-platform-nav.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.AUDIT_BASE_URL ?? 'http://localhost:5174';
const SHOTS = path.resolve('.cursor/local/nav-audit');
mkdirSync(SHOTS, { recursive: true });

const OWNER = { id: 'audit-owner', name: 'Platform Owner', email: 'owner@sync2dine.io', role: 'platform_owner' };
const DEMO_KITCHEN = 'c2887ddb-0cba-4df1-9086-e7399c92d159';

const SALES_PATHS = [
  ['dashboard', '/'],
  ['crm', '/crm'],
  ['customers', '/customers'],
  ['communications', '/communications'],
  ['inbox', '/inbox'],
  ['calls', '/calls'],
  ['call-register', '/call-register'],
  ['platform-clients', '/platform/clients'],
  ['platform-ops', '/platform/ops'],
  ['platform-sally-offer', '/platform/sally-offer'],
  ['platform-sally-knowledge', '/platform/sally-knowledge'],
  ['platform-sales-brain', '/platform/sales-brain'],
  ['integrations', '/integrations'],
  ['accounts', '/accounts'],
  ['sales', '/sales'],
  ['team', '/team'],
  ['recruitment', '/recruitment'],
  ['ai-audit', '/ai-audit'],
  ['settings', '/settings'],
];

const results = [];
let failures = 0;

function record(scenario, name, url, finalUrl, ok, note) {
  results.push({ scenario, name, url, finalUrl, ok, note });
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${scenario}] ${name}  ${url} -> ${finalUrl}${note ? `  (${note})` : ''}`);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });
}

async function expectSalesShell(page, scenario, name, url) {
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' });
  const aside = page.locator('aside[aria-label="Navigation"]');
  const staffTablet = page.locator('text=Staff tablet');
  const restaurantNav = page.locator('nav[aria-label="Restaurant navigation"]');
  try {
    await aside.waitFor({ state: 'visible', timeout: 15_000 });
    const tabletCount = await staffTablet.count();
    const restNavVisible = await restaurantNav.first().isVisible().catch(() => false);
    const navText = await aside.innerText();
    const hasOrders = /\bOrders\b/.test(navText);
    const ok = tabletCount === 0 && !restNavVisible && !hasOrders;
    record(scenario, name, url, page.url(), ok,
      ok ? '' : `tablet=${tabletCount} restNav=${restNavVisible} ordersLink=${hasOrders}`);
    await shot(page, `${scenario}-${name}`);
  } catch (err) {
    record(scenario, name, url, page.url(), false, `no AppShell: ${String(err).slice(0, 120)}`);
    await shot(page, `${scenario}-${name}`);
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

// Scenario A � platform owner on home org (no acting-as)
await context.addInitScript((user) => {
  localStorage.setItem('tradepro_session_user', JSON.stringify(user));
  localStorage.removeItem('activeOrgId');
  sessionStorage.removeItem('s2d_tablet_preview');
}, OWNER);
const pageA = await context.newPage();
for (const [name, url] of SALES_PATHS) {
  await expectSalesShell(pageA, 'A-home', name, url);
}
// Sidebar must not contain the restaurant Orders link
await pageA.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
const navText = await pageA.locator('aside[aria-label="Navigation"]').innerText();
record('A-home', 'sidebar-no-orders', '/', pageA.url(), !/\bOrders\b/.test(navText),
  /\bOrders\b/.test(navText) ? 'Orders still in sidebar' : 'Orders removed');
await pageA.close();

// Scenario B � acting-as Demo Kitchen (data scope only; UI must stay IT/sales)
const pageB = await context.newPage();
await pageB.addInitScript(([user, org]) => {
  localStorage.setItem('tradepro_session_user', JSON.stringify(user));
  localStorage.setItem('activeOrgId', org);
  sessionStorage.removeItem('s2d_tablet_preview');
}, [OWNER, DEMO_KITCHEN]);
for (const [name, url] of SALES_PATHS) {
  await expectSalesShell(pageB, 'B-actingas', name, url);
}
// Acting-as banner should be visible in the IT shell
await pageB.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await pageB.locator('aside[aria-label="Navigation"]').waitFor({ state: 'visible', timeout: 15_000 });
const banner = await pageB.locator('text=Acting as').count();
record('B-actingas', 'acting-as-banner', '/', pageB.url(), banner > 0, banner > 0 ? 'banner shown' : 'banner MISSING');
await shot(pageB, 'B-actingas-banner');
await pageB.close();

// Scenario C � explicit tablet preview: restaurant shell + Exit preview, then exit
const pageC = await context.newPage();
await pageC.addInitScript(([user, org]) => {
  localStorage.setItem('tradepro_session_user', JSON.stringify(user));
  localStorage.setItem('activeOrgId', org);
  sessionStorage.setItem('s2d_tablet_preview', '1');
}, [OWNER, DEMO_KITCHEN]);
await pageC.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
try {
  await pageC.locator('text=Staff tablet').waitFor({ state: 'visible', timeout: 15_000 });
  const exitBtn = pageC.locator('button', { hasText: 'Exit preview' });
  const exitVisible = await exitBtn.isVisible().catch(() => false);
  record('C-preview', 'tablet-preview', '/', pageC.url(), exitVisible, exitVisible ? 'restaurant shell + Exit preview' : 'Exit preview MISSING');
  await shot(pageC, 'C-tablet-preview');
  if (exitVisible) {
    await exitBtn.click();
    await pageC.waitForURL('**/platform/clients**', { timeout: 15_000 });
    await pageC.locator('aside[aria-label="Navigation"]').waitFor({ state: 'visible', timeout: 15_000 });
    record('C-preview', 'exit-preview', '/', pageC.url(), true, 'returned to Platform Clients in IT shell');
    await shot(pageC, 'C-exit-preview');
  }
} catch (err) {
  record('C-preview', 'tablet-preview', '/', pageC.url(), false, String(err).slice(0, 120));
  await shot(pageC, 'C-tablet-preview');
}
await pageC.close();

await browser.close();

console.log(`\n==== ${results.length - failures}/${results.length} PASS, ${failures} FAIL ====`);
process.exit(failures ? 1 : 0);
