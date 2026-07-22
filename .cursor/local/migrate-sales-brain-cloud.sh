#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
curl -sS https://app.sync2dine.io/api/sales-brain/status; echo
cat > /tmp/sb-dual-write.mjs <<'EOF'
import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);
const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const file = 'server/data/sales-brain.json';
const local = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { jobs: [], insights: [], recommendations: [], snippets: [] };
console.log('local counts', {
  jobs: local.jobs?.length || 0,
  insights: local.insights?.length || 0,
  recs: local.recommendations?.length || 0,
  snips: local.snippets?.length || 0,
});
for (const insight of (local.insights || []).slice(-50)) {
  const org_id = insight.orgId;
  const row = {
    org_id,
    call_id: insight.callId,
    agent_persona: insight.agentPersona || null,
    aim: insight.aim || null,
    duration_sec: insight.durationSec ?? null,
    outcome: insight.outcome || null,
    objections: insight.objections || [],
    competitors: insight.competitors || [],
    what_worked: insight.whatWorked || null,
    what_failed: insight.whatFailed || null,
    next_step: insight.nextStep || null,
    raw_json: insight,
    created_at: insight.createdAt || new Date().toISOString(),
  };
  const { error } = await sb.from('sales_call_insights').upsert(row, { onConflict: 'org_id,call_id' });
  if (error) console.warn('insight', insight.callId, error.message);
}
for (const job of (local.jobs || []).slice(-50)) {
  const { error } = await sb.from('sales_brain_jobs').upsert({
    org_id: job.orgId,
    call_id: job.callId,
    status: job.status,
    attempts: job.attempts || 0,
    error: job.error || null,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
  }, { onConflict: 'org_id,call_id' });
  if (error) console.warn('job', job.callId, error.message);
}
const { count: ic } = await sb.from('sales_call_insights').select('*', { count: 'exact', head: true });
const { count: jc } = await sb.from('sales_brain_jobs').select('*', { count: 'exact', head: true });
const { count: sc } = await sb.from('sally_knowledge_chunks').select('*', { count: 'exact', head: true });
console.log('cloud counts', { insights: ic, jobs: jc, sally_chunks: sc });
EOF
/opt/plesk/node/24/bin/node /tmp/sb-dual-write.mjs
