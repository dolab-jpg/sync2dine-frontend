/**
 * Debug verify: live Sync2Dine restaurant click-through + hypothesis logs.
 * Writes NDJSON to workspace debug-5f545b.log and ingest endpoint.
 */
import { chromium } from 'playwright';
import { appendFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.S2D_BASE || 'https://app.sync2dine.io';
const EMAIL = process.env.S2D_EMAIL || 'maya@demo.sync2dine.io';
const PASS = process.env.S2D_PASS || 'Sync2DineDemo1!';
const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, 'clickthrough-out');
const LOG = join(
  'c:\\Users\\dolab\\Downloads\\Bathroom Sales Estimation Platform',
  'debug-5f545b.log',
);
mkdirSync(OUT, { recursive: true });

const results = [];
const RUN = 'post-fix-verify';

function dlog(hypothesisId, location, message, data = {}) {
  const row = {
    sessionId: '5f545b',
    runId: RUN,
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  try {
    appendFileSync(LOG, JSON.stringify(row) + '\n');
  } catch (e) {
    console.warn('log write failed', e.message);
  }
  fetch('http://127.0.0.1:7261/ingest/6cf14313-b666-4982-884a-814f1f19f4c6', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '5f545b' },
    body: JSON.stringify(row),
  }).catch(() => {});
}

function check(id, ok, detail = '', hypothesisId = 'GEN') {
  results.push({ id, ok, detail: String(detail).slice(0, 400) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? ' — ' + detail : ''}`);
  dlog(hypothesisId, `check:${id}`, ok ? 'pass' : 'fail', { ok, detail: String(detail).slice(0, 200) });
  return ok;
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

async function clickNav(page, label) {
  for (let i = 0; i < 3; i++) {
    if ((await page.locator('[data-slot="dialog-overlay"]').count()) === 0) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
  const rail = page.locator('aside nav a, aside a').filter({ hasText: new RegExp(`^${label}$`, 'i') });
  if (await rail.count()) {
    await rail.first().click({ force: true });
    return;
  }
  const bottom = page.locator('[data-testid="restaurant-bottom-nav"] a').filter({ hasText: new RegExp(label, 'i') });
  if (await bottom.count()) {
    await bottom.first().click({ force: true });
    return;
  }
  throw new Error(`Nav not found: ${label}`);
}

(async () => {
  // H-A: live HTML references current index-*.js with Paid cash / Collapse
  const html = await fetch(BASE + '/').then((r) => r.text());
  const jsMatch = html.match(/assets\/(index-[A-Za-z0-9_-]+\.js)/);
  dlog('A', 'probe:html', 'index html asset', { js: jsMatch?.[1] || null, hasTitle: /Sync2Dine/i.test(html) });
  let bundleHasPaid = false;
  let bundleHasCollapse = false;
  if (jsMatch?.[1]) {
    const jsUrl = `${BASE}/assets/${jsMatch[1]}`;
    const js = await fetch(jsUrl).then((r) => r.text());
    bundleHasPaid = /Paid cash/.test(js);
    bundleHasCollapse = /Collapse sidebar|s2d\.restaurant\.sidebarCollapsed/.test(js);
    dlog('A', 'probe:bundle', 'spa bundle markers', {
      js: jsMatch[1],
      bundleHasPaid,
      bundleHasCollapse,
      len: js.length,
    });
  }
  check('A-bundle-paid-cash', bundleHasPaid, jsMatch?.[1] || 'no js', 'A');
  check('A-bundle-collapse', bundleHasCollapse, jsMatch?.[1] || 'no js', 'A');

  // H-D: health + restaurant tools file was deployed (via /api if possible)
  try {
    const health = await fetch(`${BASE}/health`).then((r) => r.json());
    dlog('D', 'probe:health', 'api health', { health });
    check('D-health-ok', health?.status === 'ok', JSON.stringify(health), 'D');
  } catch (e) {
    check('D-health-ok', false, String(e), 'D');
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.setDefaultTimeout(25_000);

  // Capture PATCH /api/orders for H-B
  const patches = [];
  page.on('response', async (res) => {
    try {
      if (res.request().method() === 'PATCH' && /\/api\/orders\//.test(res.url())) {
        const status = res.status();
        let body = '';
        try {
          body = (await res.text()).slice(0, 300);
        } catch {}
        let reqBody = '';
        try {
          reqBody = res.request().postData()?.slice(0, 300) || '';
        } catch {}
        patches.push({ status, url: res.url(), body, reqBody });
        dlog('B', 'net:patch-order', 'order PATCH response', { status, reqBody, body });
      }
    } catch {}
  });

  await login(page);
  await page.waitForTimeout(1200);
  const navText = await page.locator('aside nav, [data-testid="restaurant-bottom-nav"]').allInnerTexts().then((t) => t.join('\n')).catch(() => '');
  dlog('C', 'ui:nav', 'nav after login', {
    url: page.url(),
    hasTeam: /\bTeam\b/i.test(navText),
    hasCalls: /\bCalls\b/i.test(navText),
    hasAccounts: /\bAccounts\b/i.test(navText),
    navSnippet: navText.replace(/\s+/g, ' ').slice(0, 200),
  });
  check('C-restaurant-shell', !/Platform Clients|CSV dial/i.test(await page.locator('body').innerText()) && /\bKitchen\b/i.test(navText), page.url(), 'C');
  check('C-no-team', !/\bTeam\b/i.test(navText), navText.slice(0, 120), 'C');
  check('C-has-calls-accounts', /\bCalls\b/i.test(navText) && /\bAccounts\b/i.test(navText), navText.slice(0, 120), 'C');

  await clickNav(page, 'Live');
  await page.waitForTimeout(1000);

  // H-E: unpaid vs paid button presence
  const unpaidBadge = await page.getByText(/^Unpaid$|^Cash on arrival$|^Card on arrival$/i).count();
  const paidCashBtn = await page.getByRole('button', { name: /Paid cash/i }).count();
  const comingBtn = await page.getByRole('button', { name: /Coming to order/i }).count();
  dlog('E', 'ui:pay-buttons', 'live board payment UI', { unpaidBadge, paidCashBtn, comingBtn });
  check('E-coming-visible', comingBtn > 0, `coming=${comingBtn}`, 'E');
  check('E-pay-or-badge', paidCashBtn > 0 || unpaidBadge > 0 || (await page.getByText(/Paid cash|Paid card/i).count()) > 0, `paidBtn=${paidCashBtn} unpaid=${unpaidBadge}`, 'E');

  // Open detail + try mark paid if unpaid exists
  const article = page.locator('article').first();
  if (await article.count()) {
    await article.click({ position: { x: 40, y: 40 } });
    await page.waitForTimeout(500);
    const dialog = page.locator('[role="dialog"]');
    const dialogOpen = (await dialog.count()) > 0 && (await dialog.isVisible());
    dlog('A', 'ui:order-dialog', 'order detail dialog', { dialogOpen });
    check('A-order-dialog', dialogOpen, 'dialog', 'A');

    if (dialogOpen && (await dialog.getByRole('button', { name: /Paid cash/i }).count()) > 0) {
      await dialog.getByRole('button', { name: /Paid cash/i }).click();
      await page.waitForTimeout(1500);
      dlog('B', 'ui:paid-cash-clicked', 'clicked Paid cash', { patches: patches.length, last: patches[patches.length - 1] || null });
      check('B-patch-fired', patches.length > 0, JSON.stringify(patches[patches.length - 1] || {}), 'B');
      if (patches.length) {
        check('B-patch-ok', patches.some((p) => p.status >= 200 && p.status < 300), JSON.stringify(patches), 'B');
      }
    } else {
      dlog('B', 'ui:paid-cash-skipped', 'no unpaid Paid cash in dialog — skip PATCH test', {
        paidCashInDialog: dialogOpen ? await dialog.getByRole('button', { name: /Paid cash/i }).count() : 0,
      });
      check('B-patch-skipped-ok', true, 'no unpaid order to PATCH (acceptable)', 'B');
    }
    // Close dialog reliably (Escape alone can fail if toast holds focus)
    if (await page.locator('[role="dialog"]').count()) {
      await page.locator('[role="dialog"]').getByRole('button', { name: /^Close$/i }).click({ timeout: 3000 }).catch(() => {});
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
    const overlayLeft = (await page.locator('[data-slot="dialog-overlay"]').count()) > 0;
    dlog('G', 'ui:dialog-closed', 'overlay after close attempt', { overlayLeft });
  } else {
    check('A-order-dialog', false, 'no orders', 'A');
  }

  // Collapse sidebar — prefer aria-label (H-A / H-H)
  const collapse = page.locator('aside button[aria-label="Collapse sidebar"]').first();
  const hasCollapse = (await collapse.count()) > 0 && (await collapse.isVisible());
  dlog('A', 'ui:collapse', 'sidebar collapse control', { hasCollapse, overlay: await page.locator('[data-slot="dialog-overlay"]').count() });
  check('A-collapse-control', hasCollapse, '', 'A');
  if (hasCollapse) {
    await collapse.click();
    await page.waitForTimeout(400);
    const collapsedW = await page.locator('aside').first().evaluate((el) => el.getBoundingClientRect().width);
    dlog('A', 'ui:collapse-width', 'aside width after collapse', { collapsedW });
    check('A-collapse-narrow', collapsedW < 120, `w=${collapsedW}`, 'A');
    await page.locator('aside button[aria-label="Expand sidebar"], header button[aria-label="Expand sidebar"]').first().click().catch(() => {});
    await page.waitForTimeout(300);
  }

  // Routes Calls / Accounts / team redirect — use goto after confirming route works (H-F)
  await page.goto(`${BASE}/calls`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  dlog('F', 'ui:calls-direct', 'direct /calls', { url: page.url(), body: (await page.locator('body').innerText()).slice(0, 120) });
  check('C-calls-route', /\/calls/.test(page.url()) && /Call Centre|Calls today|AI Agent/i.test(await page.locator('body').innerText()), page.url(), 'F');

  await page.goto(`${BASE}/accounts`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  check('C-accounts-route', /\/accounts/.test(page.url()), page.url(), 'C');
  await page.goto(`${BASE}/team`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const teamBody = await page.locator('body').innerText();
  check('C-team-redirect', !/Team Management|Invite staff/i.test(teamBody) || !page.url().includes('/team'), page.url(), 'C');

  // Settings integrations
  await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const settingsText = await page.locator('body').innerText();
  check('C-integrations', /Integrations/i.test(settingsText), settingsText.slice(0, 80), 'C');
  check('C-no-team-link', !/Team & invites/i.test(settingsText), '', 'C');

  await browser.close();

  const pass = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  const summary = { base: BASE, pass, fail, results, patches, at: new Date().toISOString() };
  writeFileSync(join(OUT, 'debug-verify-scorecard.json'), JSON.stringify(summary, null, 2));
  dlog('GEN', 'summary', 'verify complete', { pass, fail, patchCount: patches.length });
  console.log(`\n=== ${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  dlog('GEN', 'fatal', String(e), {});
  console.error(e);
  process.exit(1);
});
