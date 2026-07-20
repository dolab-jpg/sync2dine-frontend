/**
 * Live payable SaaS quote smoke: checkout-link upsert + public checkout redirect + mailbox send.
 * Usage: node .cursor/local/live-quote-send-smoke.mjs
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const BASE = process.env.S2D_BASE || 'https://app.sync2dine.io';
const EMAIL = process.env.S2D_EMAIL || 'maya@demo.sync2dine.io';
const PASS = process.env.S2D_PASS || 'Sync2DineDemo1!';
const ORG = process.env.S2D_ORG_ID || 'c2887ddb-0cba-4df1-9086-e7399c92d159';
const TO = process.env.S2D_QUOTE_TO || 'dolab@dolab.me';

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

async function main() {
  const env = {
    ...loadEnv(resolve('c:/Users/dolab/Downloads/sync2dine-backend/.env')),
    ...loadEnv(resolve('c:/Users/dolab/Downloads/sync2dine-frontend/.env.production.local')),
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
  if (!loginRes.ok || !login.access_token) {
    throw new Error(`login failed ${loginRes.status}: ${JSON.stringify(login).slice(0, 200)}`);
  }
  const token = login.access_token;
  const userId = login.user?.id;
  console.log('login_ok', EMAIL, 'user', userId);

  const quoteId = String(Date.now());
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
  const quote = {
    id: quoteId,
    customerId: `cust-${quoteId}`,
    customerName: 'Dolab',
    customerEmail: TO,
    tradeName: 'Sync2Dine SaaS',
    expiresAt,
    status: 'draft',
    total: 323,
    items: [{ productId: 'combined_pro', name: 'Complete Pro', quantity: 1, price: 323, total: 323 }],
    labour: [],
    extras: [],
    lines: [{
      id: 'line-1',
      description: 'Complete Pro — Judie Pro + Atmosphere (launch weekly)',
      quantity: 1,
      rate: 323,
      total: 323,
      category: 'product',
    }],
    discount: 0,
    wizardAnswers: {
      saas: true,
      packageId: 'combined_pro',
      billingInterval: 'weekly',
      launchActive: true,
      weeklyTotal: 323,
    },
  };

  const linkRes = await fetch(`${BASE}/api/quotes/${encodeURIComponent(quoteId)}/checkout-link`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Org-Id': ORG,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ quote }),
  });
  const linkBody = await linkRes.json().catch(() => ({}));
  console.log('checkout_link', linkRes.status, {
    quoteId: linkBody.quoteId,
    checkoutUrl: linkBody.checkoutUrl,
    error: linkBody.error,
  });
  if (!linkRes.ok || !linkBody.checkoutUrl) {
    throw new Error(`checkout-link failed: ${JSON.stringify(linkBody)}`);
  }

  // Follow public checkout once — expect 303 to Stripe (do not complete payment).
  const pub = await fetch(linkBody.checkoutUrl, { redirect: 'manual' });
  const location = pub.headers.get('location') || '';
  console.log('public_checkout', pub.status, {
    locationHost: location ? new URL(location).host : null,
    isStripe: location.includes('checkout.stripe.com'),
  });
  if (pub.status !== 303 || !location.includes('checkout.stripe.com')) {
    const text = await pub.text().catch(() => '');
    throw new Error(`public checkout unexpected: ${pub.status} ${location} ${text.slice(0, 200)}`);
  }

  // Prefer connected mailbox send (info@sync2gear.com).
  const connRes = await fetch(`${BASE}/api/mailbox/connections`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Org-Id': ORG,
      'X-User-Id': userId || '',
      Accept: 'application/json',
    },
  });
  const conns = await connRes.json().catch(() => ([]));
  const list = Array.isArray(conns) ? conns : (conns.connections || []);
  console.log('mailbox_connections', connRes.status, list.map((c) => ({
    id: c.id,
    status: c.status,
    provider: c.provider,
    email: c.email || c.emailAddress || c.accountEmail,
  })));

  const connection = list.find((c) => c.status !== 'needs_reconnect' && c.status !== 'disconnected');
  if (!connection) {
    console.log('SKIP_MAILBOX_SEND no connected mailbox for this user');
    return;
  }

  const subject = `Sync2Dine Complete Pro quote #${quoteId} — £323/week launch`;
  const body = [
    `Hi Dolab,`,
    ``,
    `Your Complete Pro (Judie Pro + Atmosphere) launch quote is ready at £323/week.`,
    `Pay securely: ${linkBody.checkoutUrl}`,
    ``,
    `— Sync2Dine`,
  ].join('\n');
  const html = `<p>Hi Dolab,</p><p>Your <strong>Complete Pro</strong> launch quote is ready at <strong>£323/week</strong>.</p><p><a href="${linkBody.checkoutUrl}">Pay securely / accept quote</a></p><p>— Sync2Dine</p>`;

  const sendRes = await fetch(`${BASE}/api/mailbox/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Org-Id': ORG,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      connectionId: connection.id,
      to: TO,
      subject,
      body,
      html,
    }),
  });
  const sendBody = await sendRes.json().catch(() => ({}));
  console.log('mailbox_send', sendRes.status, {
    success: sendBody.success,
    messageId: sendBody.messageId,
    error: sendBody.error,
  });
  if (!sendRes.ok || !sendBody.success) {
    throw new Error(`mailbox send failed: ${JSON.stringify(sendBody)}`);
  }
  console.log('SMOKE_OK', { quoteId, checkoutUrl: linkBody.checkoutUrl, messageId: sendBody.messageId });
}

main().catch((err) => {
  console.error('SMOKE_FAIL', err?.message || err);
  process.exit(1);
});
