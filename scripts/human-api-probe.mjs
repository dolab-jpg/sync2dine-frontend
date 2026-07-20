/**
 * Live API human probe — orders + platform Sally offer.
 * node scripts/human-api-probe.mjs
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const BASE = process.env.S2D_BASE || 'https://app.sync2dine.io';
const DEBUG = 'http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5';
const EMAIL = process.env.S2D_EMAIL || 'maya@demo.sync2dine.io';
const PASS = process.env.S2D_PASS || 'Sync2DineDemo1!';

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

async function dbg(hypothesisId, message, data) {
  // #region agent log
  await fetch(DEBUG, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b8f319' },
    body: JSON.stringify({
      sessionId: 'b8f319',
      runId: 'human-api-1',
      hypothesisId,
      location: 'human-api-probe.mjs',
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

async function main() {
  const env = {
    ...loadEnv(resolve('c:/Users/dolab/Downloads/sync2dine-backend/.env')),
    ...process.env,
  };
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const anon = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anon) throw new Error('missing supabase env');

  const loginRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const login = await loginRes.json();
  await dbg('H4', 'login', { ok: loginRes.ok, status: loginRes.status, email: EMAIL });
  if (!loginRes.ok || !login.access_token) throw new Error(`login failed ${loginRes.status}`);

  const token = login.access_token;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  for (const path of ['/api/orders', '/api/agent/settings', '/api/platform/sally-offer', '/api/platform/stats']) {
    const res = await fetch(`${BASE}${path}`, { headers });
    const text = await res.text();
    await dbg(path.includes('sally') ? 'H2' : 'H3', `GET ${path}`, {
      status: res.status,
      body: text.slice(0, 220),
    });
    console.log(res.status, path, text.slice(0, 160).replace(/\s+/g, ' '));
  }

  const createRes = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Human Test Guest',
      customerPhone: '+447700900123',
      channel: 'phone',
      orderType: 'collection',
      status: 'new',
      paymentStatus: 'unpaid',
      items: [{ name: 'Chicken biryani', qty: 1, price: 8.5 }],
      total: 8.5,
      notes: 'human-test insert',
    }),
  });
  const createText = await createRes.text();
  await dbg('H3', 'POST /api/orders', { status: createRes.status, body: createText.slice(0, 260) });
  console.log('CREATE', createRes.status, createText.slice(0, 220));
}

main().catch(async (err) => {
  await dbg('H4', 'fatal', { error: String(err?.message || err) });
  console.error(err);
  process.exit(1);
});
