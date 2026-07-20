/**
 * Full live professional SaaS quote: checkout upsert + Stripe redirect + Gmail PDF.
 * node --experimental-strip-types is not needed; uses built modules via dynamic import of dist-less ts via vite-node/tsx.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

const BASE = process.env.S2D_BASE || 'https://app.sync2dine.io';
const EMAIL = process.env.S2D_EMAIL || 'owner@sync2dine.io';
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
    ...loadEnv(resolve(ROOT, '../sync2dine-backend/.env')),
    ...loadEnv(resolve(ROOT, '.env.production.local')),
    ...process.env,
  };
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const anon = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anon) throw new Error('missing supabase env');

  const { buildSaasQuoteContent } = await import(
    pathToFileURL(resolve(ROOT, 'src/app/engine/messaging/saasQuoteContent.ts')).href
  );
  const { buildSaasQuoteEmail } = await import(
    pathToFileURL(resolve(ROOT, 'src/app/engine/messaging/saasQuoteEmail.ts')).href
  );
  const { generateSaasQuotePdf } = await import(
    pathToFileURL(resolve(ROOT, 'src/app/engine/messaging/saasQuotePdf.ts')).href
  );

  const loginRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const login = await loginRes.json();
  if (!loginRes.ok || !login.access_token) throw new Error(`login failed ${loginRes.status}`);
  const token = login.access_token;
  const userId = login.user?.id;
  console.log('login_ok', EMAIL);

  const quoteId = String(Date.now());
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
  const quote = {
    id: quoteId,
    customerId: `cust-${quoteId}`,
    customerName: 'Dolab',
    customerEmail: TO,
    tradeName: 'Sync2Dine SaaS',
    expiresAt,
    createdAt: new Date().toISOString(),
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
    customer: {
      contactName: 'Dolab',
      email: TO,
      phone: '+447700900123',
      address: 'London',
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
  const linkBody = await linkRes.json();
  if (!linkRes.ok || !linkBody.checkoutUrl) throw new Error(`checkout-link ${linkRes.status} ${JSON.stringify(linkBody)}`);
  console.log('checkout_link_ok', linkBody.checkoutUrl);

  const pub = await fetch(linkBody.checkoutUrl, { redirect: 'manual' });
  const location = pub.headers.get('location') || '';
  if (pub.status !== 303 || !location.includes('checkout.stripe.com')) {
    throw new Error(`stripe redirect failed ${pub.status} ${location}`);
  }
  console.log('stripe_redirect_ok', new URL(location).host);

  const content = buildSaasQuoteContent(quote, {
    packageId: 'combined_pro',
    billingInterval: 'weekly',
    checkoutUrl: linkBody.checkoutUrl,
  });
  const email = buildSaasQuoteEmail(content);
  const attachment = await generateSaasQuotePdf(content);
  console.log('pdf_attachment', {
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    contentChars: String(attachment.content || '').length,
  });

  const connRes = await fetch(`${BASE}/api/mailbox/connections`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Org-Id': ORG,
      'X-User-Id': userId || '',
      Accept: 'application/json',
    },
  });
  const { connections = [] } = await connRes.json();
  const connection = connections.find((c) => c.status === 'connected');
  if (!connection) throw new Error('no connected mailbox');

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
      subject: email.subject,
      body: email.text,
      html: email.html,
      attachments: [{
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        content: attachment.content,
      }],
    }),
  });
  const sendBody = await sendRes.json();
  console.log('mailbox_send', sendRes.status, {
    success: sendBody.success,
    messageId: sendBody.messageId,
    error: sendBody.error,
  });
  if (!sendRes.ok || !sendBody.success) throw new Error(JSON.stringify(sendBody));
  console.log('FULL_SMOKE_OK', {
    quoteId,
    checkoutUrl: linkBody.checkoutUrl,
    messageId: sendBody.messageId,
    from: connection.emailAddress,
  });
}

main().catch((err) => {
  console.error('FULL_SMOKE_FAIL', err?.message || err);
  process.exit(1);
});
