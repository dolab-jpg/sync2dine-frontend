#!/bin/bash
set -euo pipefail
ROOT=/var/www/vhosts/sync2dine.io/sync2dine-backend
APP=/var/www/vhosts/sync2dine.io/app.sync2dine.io
export ROOT APP
cd "$ROOT"
/opt/plesk/node/24/bin/node --input-type=module <<'EOF'
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { execSync } from 'child_process';

const LOG = '/tmp/debug-d0f60a.log';
const lines = [];
function log(hypothesisId, location, message, data) {
  lines.push(JSON.stringify({
    sessionId: 'd0f60a',
    runId: 'plan-audit',
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  }));
}
async function http(path) {
  const r = await fetch('https://app.sync2dine.io' + path, { signal: AbortSignal.timeout(12000) });
  const text = await r.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 200); }
  return { http: r.status, body };
}

const ROOT = process.env.ROOT;
const APP = process.env.APP;

// A Judie rename
const phoneBrain = readFileSync(ROOT + '/server/phone-brain.ts', 'utf8');
const judiePrompt = (phoneBrain.match(/You are Judie/g) || []).length;
const lizzieYouAre = execSync(
  `grep -RIn --include='*.ts' 'You are Lizzie' ${ROOT}/server 2>/dev/null | grep -vE 'vps.ts|local-full' | wc -l || true`,
  { encoding: 'utf8' },
).trim();
let spaJudie = 0, spaLizzie = 0;
try {
  const assets = readdirSync(APP + '/assets').filter((f) => f.startsWith('index-') && f.endsWith('.js'));
  for (const f of assets) {
    const js = readFileSync(APP + '/assets/' + f, 'utf8');
    spaJudie += (js.match(/Judie/g) || []).length;
    spaLizzie += (js.match(/Lizzie/g) || []).length;
  }
} catch {}
log('A', 'judie-rename', 'Judie rename audit', {
  judiePromptHits: judiePrompt,
  lizzieYouAreHits: Number(lizzieYouAre || 0),
  spaJudie,
  spaLizzie,
});

// B Sales Brain
const dualWriteFile = existsSync(ROOT + '/server/sales-brain/supabase-sync.ts');
const sb = await http('/api/sales-brain/status');
log('B', 'sales-brain/status', 'Sales Brain API', { dualWriteFile, ...sb });

// C WhatsApp
const wa = await http('/api/whatsapp-web/status');
log('C', 'whatsapp-web/status', 'WhatsApp status', wa);

// D Sally staff mode
const vapi = readFileSync(ROOT + '/server/vapi-assistant.ts', 'utf8');
const sallyFile = readFileSync(ROOT + '/server/sally-sales-phone.ts', 'utf8');
const sallyBranch = vapi.includes('isSallySalesCall') && vapi.includes('getSallyPhoneSessionChatTools');
const sallyUsesStaffTools = /staffMode/.test(vapi) && /getPhoneSessionChatTools\(identity/.test(vapi);
log('D', 'sally-staff-mode', 'Sally staff mode presence', {
  sallyBranch,
  sallyUsesStaffTools,
  hasStaffModeInPrompt: /staffMode/.test(sallyFile),
  hasVerifyPinInSallyTools: /verifyStaffPhonePin/.test(sallyFile),
});

// E Sally KB
log('E', 'sally-knowledge', 'Sally KB module', {
  productKbDir: existsSync(ROOT + '/server/sally-product-kb'),
  brainsDir: existsSync(ROOT + '/server/brains'),
  migrations: readdirSync(ROOT + '/supabase/migrations').filter((f) => f.includes('sally_knowledge')).length,
  injectHits: (sallyFile.match(/getSallyKnowledgePromptBlockCached|sally-product-kb/g) || []).length,
});

// F brains
log('F', 'brains', 'Brain packages', { exists: existsSync(ROOT + '/server/brains') });

// G public
const health = await http('/health');
const pricing = await fetch('https://app.sync2dine.io/pricing', { signal: AbortSignal.timeout(12000) });
const sbPage = await fetch('https://app.sync2dine.io/platform/sales-brain', { signal: AbortSignal.timeout(12000) });
log('G', 'public-surfaces', 'HTTP codes', {
  health: health.http,
  pricing: pricing.status,
  salesBrainPage: sbPage.status,
});

// Cloud counts
try {
  const env = Object.fromEntries(
    readFileSync('.env', 'utf8')
      .split('\n')
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
      }),
  );
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const counts = {};
  for (const t of [
    'sales_call_insights',
    'sales_brain_jobs',
    'sally_knowledge_chunks',
    'sally_knowledge_sources',
    'sally_knowledge_ingest_jobs',
  ]) {
    const { count, error } = await client.from(t).select('*', { count: 'exact', head: true });
    counts[t] = error ? { error: error.message } : { count };
  }
  log('B', 'supabase-counts', 'cloud table counts', counts);
} catch (e) {
  log('B', 'supabase-counts', 'cloud probe failed', { error: String(e).slice(0, 200) });
}

writeFileSync(LOG, lines.join('\n') + '\n');
console.log(lines.join('\n'));
EOF
