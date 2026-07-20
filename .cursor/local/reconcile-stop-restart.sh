#!/bin/bash
set -e
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
NODE=/opt/plesk/node/24/bin/node
set -a; source .env; set +a
KEY="${VAPI_PRIVATE_KEY:-$VAPI_API_KEY}"
BASE=https://api.vapi.ai
[ "${VAPI_REGION}" = "eu" ] && BASE=https://api.eu.vapi.ai

echo "== stop API so it cannot overwrite =="
fuser -k 3011/tcp 2>/dev/null || true
pkill -9 -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 2

curl -sS --max-time 25 -H "Authorization: Bearer ${KEY}" "${BASE}/call?limit=40" > /tmp/vapi-calls.json

$NODE <<'JS'
const fs = require('fs');
const path = require('path');
const vapi = JSON.parse(fs.readFileSync('/tmp/vapi-calls.json','utf8'));
const rows = Array.isArray(vapi) ? vapi : (vapi.data || []);
const byId = new Map(rows.map(c => [c.id, c]));
const dir = path.join('server','data');
const target = 'synced-data-4fc49703-d1b0-4ac7-892d-9c32d31e9661.json';
const p = path.join(dir, target);
const j = JSON.parse(fs.readFileSync(p,'utf8'));
let closed = 0;
for (let i = 0; i < (j.calls||[]).length; i++) {
  const c = j.calls[i];
  const st = String(c.status||'');
  if (st !== 'ringing' && st !== 'in_progress') continue;
  const pid = c.providerCallId || (c.metadata && c.metadata.vapiCallId);
  const vc = pid ? byId.get(pid) : null;
  if (!vc || String(vc.status) !== 'ended') {
    console.log('skip', c.id, 'pid', pid, 'vapi', vc && vc.status);
    continue;
  }
  j.calls[i] = {
    ...c,
    status: 'completed',
    endedAt: vc.endedAt || new Date().toISOString(),
    outcome: vc.endedReason || 'vapi_reconcile_ended',
    updatedAt: new Date().toISOString(),
    metadata: { ...(c.metadata||{}), vapiReconciled: true, vapiEndedReason: vc.endedReason, vapiCost: vc.cost },
  };
  closed++;
  console.log('closed', c.id, vc.endedReason, vc.cost);
}
fs.writeFileSync(p, JSON.stringify(j, null, 2));
const open = j.calls.filter(c => ['ringing','in_progress'].includes(String(c.status||'')));
console.log(JSON.stringify({ closed, openLeft: open.length, openIds: open.map(c=>c.id) }));
fs.appendFileSync('/tmp/debug-52f921.log', JSON.stringify({
  sessionId:'52f921', hypothesisId:'A', location:'reconcile-stop-api',
  message:'disk close while api stopped', data:{ closed, openLeft: open.length },
  timestamp: Date.now(), runId:'pre-fix-recon'
})+'\n');
JS

echo "== restart API =="
nohup $NODE \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env server/index.ts \
  >/tmp/sync2dine-api.log 2>&1 &
sleep 7
curl -sS --max-time 10 https://app.sync2dine.io/health; echo
curl -sS --max-time 10 https://app.sync2dine.io/api/agent/status > /tmp/agent-final.json
$NODE <<'JS'
const j = JSON.parse(require('fs').readFileSync('/tmp/agent-final.json','utf8'));
console.log('AGENT', JSON.stringify({
  activeCall: j.activeCall && j.activeCall.id || null,
  activeCount: (j.activeCalls||[]).length,
  totalActive: j.capacity && j.capacity.totalActive,
  ringing: j.ringingCount,
}, null, 2));
JS
