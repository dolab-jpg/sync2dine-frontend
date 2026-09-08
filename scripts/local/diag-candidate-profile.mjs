/**
 * Open the Candidates tab and a CV-created profile, printing any React error with its stack.
 * Usage: BASE_URL=http://localhost:5174 node scripts/local/diag-candidate-profile.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.BASE_URL || 'http://localhost:5174';
const OUT = 'C:/Users/dolab/Downloads/sync2dine-frontend/.cursor/local/shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message, '\n', (e.stack || '').split('\n').slice(0, 6).join('\n')));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !/validateDOMNesting|forwardRef|Failed to load resource/.test(t)) {
    console.log('CONSOLE:', t.slice(0, 400));
  }
});

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem(
    'tradepro_session_user',
    JSON.stringify({
      id: 'c202f879-838a-4c4b-9174-5334c7a6ddf4',
      name: 'Platform Owner',
      email: 'owner@sync2dine.io',
      role: 'platform_owner',
    }),
  );
});
await page.goto(`${BASE}/recruitment`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);

await page.getByRole('tab', { name: /candidates/i }).first().click().catch(() => {});
await page.waitForTimeout(2500);
console.log('candidate cards:', await page.getByRole('button', { name: /view profile/i }).count());
await page.screenshot({ path: `${OUT}/diag-candidates-tab.png` });

const search = page.locator('input[placeholder*="earch"]').first();
if (await search.count()) {
  await search.fill('Test Candidate');
  await page.waitForTimeout(2000);
}
console.log('after search cards:', await page.getByRole('button', { name: /view profile/i }).count());
const view = page.getByRole('button', { name: /view profile/i }).first();
if (await view.count()) {
  await view.click();
  await page.waitForTimeout(2500);
  const showCv = page.getByText(/Show CV text Sally used/i).first();
  if (await showCv.count()) await showCv.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/diag-candidate-profile.png`, fullPage: true });
  console.log('cv filename shown:', await page.getByText(/\.txt|\.pdf|\.docx/i).count());
  console.log('notes panel:', await page.getByText(/CV and screening notes/i).count());
} else {
  console.log('no profile button; body starts:', (await page.innerText('body')).slice(0, 200).replace(/\n/g, ' | '));
}
await browser.close();
