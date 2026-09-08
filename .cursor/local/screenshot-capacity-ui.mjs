import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve('.cursor/local/nav-audit');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto('https://app.sync2dine.io/login', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem(
    'tradepro_session_user',
    JSON.stringify({
      id: '00000000-0000-0000-0000-000000000099',
      name: 'Platform Owner',
      email: 'owner@sync2dine.io',
      role: 'platform_owner',
    }),
  );
  localStorage.setItem(
    'authUser',
    JSON.stringify({
      id: '00000000-0000-0000-0000-000000000099',
      name: 'Platform Owner',
      email: 'owner@sync2dine.io',
      role: 'platform_owner',
    }),
  );
});

await page.goto('https://app.sync2dine.io/calls', { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);

const text = await page.locator('body').innerText();
const hasAnswering = /Answering|Paused/.test(text);
const hasDialQueue = /Dial queue/.test(text);
const hasCapacity = /Inbound\s+\d+\/\d+/.test(text);
const hasEdit = /\bEdit\b/.test(text);
console.log(JSON.stringify({ hasAnswering, hasDialQueue, hasCapacity, hasEdit, href: page.url() }));

await page.screenshot({ path: resolve(out, 'calls-capacity-ui.png'), fullPage: false });
await browser.close();
