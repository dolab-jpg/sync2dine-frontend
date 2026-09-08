/**
 * Live screenshot proof for /recruitment at desktop and mobile widths.
 * Usage: node scripts/local/shot-recruitment-live.mjs
 */
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.BASE_URL || 'https://app.sync2dine.io';
const OUT = 'C:/Users/dolab/Downloads/sync2dine-frontend/.cursor/local/shots';
mkdirSync(OUT, { recursive: true });

const SESSION = {
  id: 'c202f879-838a-4c4b-9174-5334c7a6ddf4',
  name: 'Platform Owner',
  email: 'owner@sync2dine.io',
  role: 'platform_owner',
};

const browser = await chromium.launch();
for (const [label, opts] of [
  ['desktop', { viewport: { width: 1600, height: 1000 } }],
  ['mobile', devices['iPhone 13']],
]) {
  const context = await browser.newContext(opts);
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((session) => {
    localStorage.setItem('tradepro_session_user', JSON.stringify(session));
  }, SESSION);
  await page.goto(`${BASE}/recruitment`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(7000);
  await page.getByRole('tab', { name: /candidates/i }).first().click().catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/live-recruitment-${label}.png`, fullPage: false });
  console.log(label, 'dropzone:', await page.getByText(/Drop CVs to screen/i).count(), 'cards:', await page.getByRole('button', { name: /view profile/i }).count());
  await context.close();
}
await browser.close();
console.log('shots in', OUT);
