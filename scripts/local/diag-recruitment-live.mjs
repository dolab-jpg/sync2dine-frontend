import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'https://app.sync2dine.io';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 300)));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 220));
});
page.on('response', (r) => {
  if (r.status() >= 400 && r.url().includes('/api/')) console.log('HTTP', r.status(), r.url().slice(0, 120));
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
for (let i = 0; i < 6; i += 1) {
  await page.waitForTimeout 
    ? await page.waitForTimeout(3000)
    : null;
  const info = await page.evaluate(() => ({
    url: location.pathname,
    rootLen: document.querySelector('#root')?.innerHTML.length ?? 0,
    text: (document.body.innerText || '').slice(0, 200),
  }));
  console.log(i, JSON.stringify(info));
}
await browser.close();
