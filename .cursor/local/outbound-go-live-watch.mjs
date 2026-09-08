import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/dolab/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core');

const out = resolve('.cursor/local/nav-audit');
mkdirSync(out, { recursive: true });

const envPath = resolve('.env.production.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
const url = env.VITE_SUPABASE_URL;
const anon = env.VITE_SUPABASE_ANON_KEY;
const password = JSON.parse(readFileSync(resolve('.cursor/local/login-diag-real.json'), 'utf8')).password;

const authRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: {
    apikey: anon,
    Authorization: `Bearer ${anon}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email: 'owner@sync2dine.io', password }),
});
const auth = await authRes.json();
if (!auth.access_token) throw new Error('login failed');

const browser = await chromium.launch({
  executablePath:
    'C:/Users/dolab/AppData/Local/ms-playwright/chromium-1187/chrome-win/chrome.exe',
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
await page.goto('https://app.sync2dine.io/login', { waitUntil: 'domcontentloaded' });
await page.evaluate(
  ({ session, supabaseUrl }) => {
    const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
    localStorage.setItem(storageKey, JSON.stringify(session));
    localStorage.setItem(
      'tradepro_session_user',
      JSON.stringify({
        id: session.user?.id,
        name: 'Platform Owner',
        email: session.user?.email,
        role: session.user?.user_metadata?.role || 'platform_owner',
      }),
    );
    localStorage.setItem(
      'authUser',
      JSON.stringify({
        id: session.user?.id,
        name: 'Platform Owner',
        email: session.user?.email,
        role: session.user?.user_metadata?.role || 'platform_owner',
      }),
    );
  },
  { session: auth, supabaseUrl: url },
);

await page.goto('https://app.sync2dine.io/calls', { waitUntil: 'networkidle' });
await page.waitForTimeout(4500);
await page.screenshot({ path: resolve(out, 'calls-live-dialling.png'), fullPage: false });

const outboundTab = page.getByRole('tab', { name: /outbound/i }).first();
if (await outboundTab.count()) {
  await outboundTab.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: resolve(out, 'calls-outbound-queue.png'), fullPage: false });
}

await page.goto('https://app.sync2dine.io/crm', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const queueTab = page.getByRole('tab', { name: /call queue|queue/i }).first();
if (await queueTab.count()) await queueTab.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: resolve(out, 'crm-call-queue-after-dial.png'), fullPage: false });

const text = await page.locator('body').innerText();
const snippet = text
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => /on call|idle|dial|queue|running|called|needs retry|not called/i.test(l))
  .slice(0, 40);
console.log(JSON.stringify({ snippet }, null, 2));
await browser.close();
