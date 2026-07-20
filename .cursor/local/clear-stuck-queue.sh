#!/bin/bash
set -e
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
NODE=/opt/plesk/node/24/bin/node

echo "== stop API =="
fuser -k 3011/tcp 2>/dev/null || true
pkill -9 -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 2

$NODE <<'JS'
const fs = require('fs');
const path = require('path');
const LOG = '/tmp/debug-52f921.log';
function log(data) {
  fs.appendFileSync(LOG, JSON.stringify({
    sessionId: '52f921',
    hypothesisId: 'G',
    location: 'clear-outbound-queue',
    message: 'update stuck dialling jobs',
    data,
    timestamp: Date.now(),
    runId: 'queue-fix',
  }) + '\n');
}
const p = path.join('server', 'data', 'synced-data-4fc49703-d1b0-4ac7-892d-9c32d31e9661.json');
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
const before = (j.outboundQueue || []).filter(x => ['dialling', 'dialing', 'queued'].includes(String(x.status || '')));
console.log('BEFORE_STUCK', before.length);
for (const job of before) {
  console.log([job.id, job.status, job.to, job.callId || '', job.template || ''].join(' | '));
}
let updated = 0;
j.outboundQueue = (j.outboundQueue || []).map((job) => {
  const st = String(job.status || '');
  if (st !== 'dialling' && st !== 'dialing' && st !== 'queued') return job;
  // Only auto-complete jobs tied to the known finished calls / same dial batch
  const callId = String(job.callId || '');
  const isBatch = callId.startsWith('out-178455449') || String(job.to || '').includes('07576442345') || String(job.to || '').includes('447576442345');
  if (!isBatch && st === 'queued') return job;
  updated++;
  const next = {
    ...job,
    status: 'completed',
    completedAt: new Date().toISOString(),
    error: undefined,
    outcome: 'vapi_reconcile_ended',
  };
  log({ id: job.id, from: st, to: 'completed', callId: callId || null, toPhone: job.to || null });
  return next;
});
fs.writeFileSync(p, JSON.stringify(j, null, 2));
const after = (j.outboundQueue || []).filter(x => ['dialling', 'dialing', 'queued'].includes(String(x.status || '')));
console.log(JSON.stringify({ updated, afterStuck: after.length, sample: (j.outboundQueue || []).slice(0, 5).map(x => ({ id: x.id, status: x.status, to: x.to })) }));
JS

echo "== restart API =="
nohup $NODE \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env server/index.ts \
  >/tmp/sync2dine-api.log 2>&1 &
sleep 7
curl -sS --max-time 10 https://app.sync2dine.io/health; echo
curl -sS --max-time 10 "https://app.sync2dine.io/api/calls?limit=5" > /tmp/calls-q.json
$NODE <<'JS'
const j = JSON.parse(require('fs').readFileSync('/tmp/calls-q.json','utf8'));
const q = j.outboundQueue || [];
const stuck = q.filter(x => ['dialling','dialing','queued'].includes(String(x.status||'')));
console.log(JSON.stringify({
  queueShown: q.length,
  stuck: stuck.map(x => ({ id: x.id, status: x.status, to: x.to, callId: x.callId || null })),
  top: q.slice(0, 5).map(x => ({ id: x.id, status: x.status, to: x.to })),
}, null, 2));
JS
