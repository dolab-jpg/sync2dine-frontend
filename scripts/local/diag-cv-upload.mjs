/**
 * Watch what happens when a CV is dropped on /recruitment: requests, console, toasts.
 * Usage: BASE_URL=http://localhost:5174 node scripts/local/diag-cv-upload.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const BASE = process.env.BASE_URL || 'http://localhost:5174';
const OUT = 'C:/Users/dolab/Downloads/sync2dine-frontend/.cursor/local/shots';
mkdirSync(OUT, { recursive: true });

const CV_PATH = `${OUT}/Test-Candidate-Local-CV.txt`;
writeFileSync(
  CV_PATH,
  [
    'Local Test Candidate',
    'Woking, UK | 07700 900456 | local.test@example.com',
    'Sales executive, ACME Ltd 2023-2026 — sold EPOS to independent restaurants, 118% of target.',
  ].join('\n'),
);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => {
  if (m.type() === 'error' && !/validateDOMNesting|forwardRef/.test(m.text())) {
    console.log('CONSOLE:', m.text().slice(0, 160));
  }
});
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 160)));
page.on('request', (r) => {
  if (r.url().includes('/api/recruitment')) console.log('REQ', r.method(), r.url());
});
page.on('requestfailed', (r) => {
  if (r.url().includes('/api/recruitment')) console.log('REQFAIL', r.url(), r.failure()?.errorText);
});
page.on('response', (r) => {
  if (r.url().includes('/api/recruitment')) console.log('RES', r.status(), r.url());
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

await page.setInputFiles('input[type="file"][accept*=".pdf"]', CV_PATH);
await page.waitForTimeout(8000);
await page.screenshot({ path: `${OUT}/diag-after-upload.png` });
console.log('body mentions upload toast:', /CV added|need a phone|Failed to upload/.test(await page.innerText('body')));
await browser.close();
