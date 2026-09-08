import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), 'nav-audit');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (err) => console.log('PAGEERROR', err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('CONSOLE', msg.text());
});

await page.goto('https://app.sync2dine.io/login', { waitUntil: 'networkidle' });
await page.screenshot({ path: resolve(outDir, 'hotfix-login.png'), fullPage: true });
const loginRoot = await page.evaluate(() => document.querySelector('#root')?.innerHTML.length ?? 0);
console.log('login_root_len', loginRoot);

await page.evaluate(() => {
  localStorage.setItem(
    'tradepro_session_user',
    JSON.stringify({
      id: '00000000-0000-0000-0000-000000000099',
      name: 'Hotfix proof',
      email: 'hotfix@example.com',
      role: 'platform_owner',
    }),
  );
  localStorage.setItem('aiPanelOpen', 'true');
});
await page.goto('https://app.sync2dine.io/platform/clients', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const authed = await page.evaluate(() => ({
  href: location.href,
  rootLen: document.querySelector('#root')?.innerHTML.length ?? 0,
  hasLoader: Boolean(document.body.innerText.includes('Loading your workspace')),
  hasBlank: (document.querySelector('#root')?.innerHTML.length ?? 0) < 40,
}));
console.log('authed', JSON.stringify(authed));
await page.screenshot({ path: resolve(outDir, 'hotfix-authed-shell.png'), fullPage: true });
await browser.close();
