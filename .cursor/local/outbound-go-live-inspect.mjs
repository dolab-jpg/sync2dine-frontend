import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
const email = 'owner@sync2dine.io';
const password = JSON.parse(readFileSync(resolve('.cursor/local/login-diag-real.json'), 'utf8')).password;

const authRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: {
    apikey: anon,
    Authorization: `Bearer ${anon}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email, password }),
});
const auth = await authRes.json();
if (!auth.access_token) throw new Error(`login failed: ${JSON.stringify(auth).slice(0, 200)}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

await page.goto('https://app.sync2dine.io/login', { waitUntil: 'domcontentloaded' });
await page.evaluate(
  ({ session, anonKey, supabaseUrl }) => {
    const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
    localStorage.setItem(storageKey, JSON.stringify(session));
    localStorage.setItem(
      'tradepro_session_user',
      JSON.stringify({
        id: session.user?.id,
        name: session.user?.user_metadata?.name || 'Platform Owner',
        email: session.user?.email,
        role: session.user?.user_metadata?.role || 'platform_owner',
      }),
    );
    localStorage.setItem(
      'authUser',
      JSON.stringify({
        id: session.user?.id,
        name: session.user?.user_metadata?.name || 'Platform Owner',
        email: session.user?.email,
        role: session.user?.user_metadata?.role || 'platform_owner',
      }),
    );
    void anonKey;
  },
  { session: auth, anonKey: anon, supabaseUrl: url },
);

await page.goto('https://app.sync2dine.io/crm', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// Prefer Call Queue tab if present
const queueTab = page.getByRole('tab', { name: /call queue|queue/i }).first();
if (await queueTab.count()) {
  await queueTab.click();
  await page.waitForTimeout(1500);
} else {
  const btn = page.getByRole('button', { name: /call queue|queue/i }).first();
  if (await btn.count()) {
    await btn.click();
    await page.waitForTimeout(1500);
  }
}

const text = await page.locator('body').innerText();
const snippet = text
  .split(/\n/)
  .map((l) => l.trim())
  .filter((l) => /dial|queue|running|paused|stopped|not called|needs retry|called|start calling/i.test(l))
  .slice(0, 40);

await page.screenshot({ path: resolve(out, 'crm-call-queue-inspect.png'), fullPage: false });
console.log(JSON.stringify({ href: page.url(), snippet }, null, 2));
await browser.close();
