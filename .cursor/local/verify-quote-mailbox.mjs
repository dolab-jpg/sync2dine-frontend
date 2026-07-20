import { readFileSync } from 'fs';

function loadEnv(path) {
  const out = {};
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      if (!line || line.trim().startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i < 0) continue;
      let v = line.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      out[line.slice(0, i).trim()] = v;
    }
  } catch { /* optional */ }
  return out;
}

const env = {
  ...loadEnv('c:/Users/dolab/Downloads/sync2dine-backend/.env'),
  ...loadEnv('c:/Users/dolab/Downloads/sync2dine-frontend/.env.production.local'),
};
const BASE = 'https://app.sync2dine.io';
const ORG = 'c2887ddb-0cba-4df1-9086-e7399c92d159';
const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const anon = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;

const login = await (await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@sync2dine.io', password: 'Sync2DineDemo1!' }),
})).json();

const token = login.access_token;
const userId = login.user.id;
const conns = await (await fetch(`${BASE}/api/mailbox/connections`, {
  headers: { Authorization: `Bearer ${token}`, 'X-Org-Id': ORG, 'X-User-Id': userId },
})).json();
console.log('mailbox', (conns.connections || []).map((c) => ({
  email: c.emailAddress,
  status: c.status,
  provider: c.provider,
})));

const quoteUrl =
  'https://app.sync2dine.io/api/public/quotes/1784507037426/checkout?t=eyJ2IjoxLCJxdW90ZUlkIjoiMTc4NDUwNzAzNzQyNiIsIm9yZ0lkIjoiYzI4ODdkZGItMGNiYS00ZGYxLTkwODYtZTczOTljOTJkMTU5IiwiZXhwIjoxNzg3MDk5MDM3fQ.AEk1i3HePuY_P8XCcXxGNIYYr2E51ddYvALCy1RvYSk';
const pub = await fetch(quoteUrl, { redirect: 'manual' });
console.log('public_checkout_recheck', pub.status, (pub.headers.get('location') || '').includes('checkout.stripe.com'));

if (service) {
  const qRes = await fetch(
    `${supabaseUrl}/rest/v1/quotes?id=eq.1784507037426&select=id,org_id,status,total,updated_at`,
    { headers: { apikey: service, Authorization: `Bearer ${service}` } },
  );
  console.log('supabase_quote', await qRes.json());
  const cRes = await fetch(
    `${supabaseUrl}/rest/v1/customers?org_id=eq.${ORG}&select=id,name,email&limit=5`,
    { headers: { apikey: service, Authorization: `Bearer ${service}` } },
  );
  const customers = await cRes.json();
  console.log('customers_sample', Array.isArray(customers) ? customers.slice(0, 5) : customers);
}
