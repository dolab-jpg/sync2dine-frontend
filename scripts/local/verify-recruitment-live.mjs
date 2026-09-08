/**
 * Live verification for the recruitment CV intake:
 * log in, upload a test CV via the dropzone, open the candidate profile, screenshot both.
 * Usage: node scripts/local/verify-recruitment-live.mjs <email> <password>
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const BASE = process.env.BASE_URL || 'https://app.sync2dine.io';
const [email, password] = process.argv.slice(2);
const OUT = 'C:/Users/dolab/Downloads/sync2dine-frontend/.cursor/local/shots';
mkdirSync(OUT, { recursive: true });

const CV_PATH = `${OUT}/Test-Candidate-Live-CV.txt`;
writeFileSync(
  CV_PATH,
  [
    'Live Test Candidate',
    'Woking, UK | 07700 900456 | live.test@example.com',
    'Sales executive, ACME Ltd 2023-2026 — sold EPOS to independent restaurants, 118% of target.',
    'Before that: door-to-door energy sales, 2021-2023.',
  ].join('\n'),
);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text().slice(0, 200));
});

if (email && password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  console.log('logging in as', email);
  await page.locator('input[type="email"], input[name="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole('button', { name: /sign in|log in|login/i }).first().click();
  await page.waitForTimeout(6000);
  await page.goto(`${BASE}/recruitment`, { waitUntil: 'domcontentloaded' });
} else {
  // Restore the real platform_owner session (same account used for earlier live UI proofs).
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
}
await page.waitForTimeout(8000);

await page.screenshot({ path: `${OUT}/01-recruitment-header.png`, fullPage: false });
console.log('url:', page.url());
console.log('dropzone visible:', await page.getByText(/Drop CVs to screen/i).count());

const uploadResponse = page.waitForResponse(
  (r) => r.url().includes('/api/recruitment/cvs') && r.request().method() === 'POST',
  { timeout: 60000 },
).catch(() => null);

await page.setInputFiles('input[type="file"][accept*=".pdf"]', CV_PATH);
const res = await uploadResponse;
if (res) console.log('upload status:', res.status(), JSON.stringify(await res.json().catch(() => ({}))).slice(0, 400));
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/02-after-upload.png`, fullPage: false });

// Open the candidate list and the new candidate's profile
await page.getByRole('tab', { name: /candidates/i }).first().click().catch(() => {});
await page.waitForTimeout(2000);
const search = page.locator('input[placeholder*="earch"]').first();
if (await search.count()) {
  await search.fill('Live Test Candidate');
  await page.waitForTimeout(1500);
}
await page.screenshot({ path: `${OUT}/03-candidate-list.png`, fullPage: false });

const viewProfile = page.getByRole('button', { name: /view profile/i }).first();
if (await viewProfile.count()) {
  await viewProfile.click();
  await page.waitForTimeout(2500);
  const showCv = page.getByText(/Show CV text Sally used/i).first();
  if (await showCv.count()) await showCv.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/04-candidate-profile.png`, fullPage: true });
  console.log('profile shows CV filename:', await page.getByText(/Test-Candidate-Live-CV\.txt/).count());
  console.log('profile shows notes panel:', await page.getByText(/CV and screening notes/i).count());
} else {
  console.log('no View Profile button found');
}

await browser.close();
console.log('screenshots in', OUT);
