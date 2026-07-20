#!/bin/bash
# Close app call rows that Vapi already marked ended (UI "still on a call" ghosts).
set -e
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
set -a; source .env; set +a
NODE=/opt/plesk/node/24/bin/node
KEY="${VAPI_PRIVATE_KEY:-$VAPI_API_KEY}"
BASE=https://api.vapi.ai
[ "${VAPI_REGION}" = "eu" ] && BASE=https://api.eu.vapi.ai

curl -sS --max-time 25 -H "Authorization: Bearer ${KEY}" "${BASE}/call?limit=40" > /tmp/vapi-calls.json

$NODE <<'JS'
const fs = require('fs');
const path = require('path');
const dataDir = path.join(process.cwd(), 'server/data');
const files = fs.readdirSync(dataDir).filter(f => f.startsWith('synced-data') && f.endsWith('.json'));
const vapi = JSON.parse(fs.readFileSync('/tmp/vapi-calls.json','utf8'));
const vapiRows = Array.isArray(vapi) ? vapi : (vapi.data || []);
const vapiById = new Map(vapiRows.map(c => [c.id, c]));
const LOG = '/tmp/debug-52f921.log';
function log(data) {
  fs.appendFileSync(LOG, JSON.stringify({ sessionId:'52f921', hypothesisId:'A', location:'reconcile-stuck', message:'close stuck', data, timestamp:Date.now(), runId:'pre-fix-recon' }) + '\n');
}
let closed = 0;
for (const f of files) {
  const p = path.join(dataDir, f);
  let j;
  try { j = JSON.parse(fs.readFileSync(p,'utf8')); } catch { continue; }
  if (!Array.isArray(j.calls)) continue;
  let changed = false;
  for (let i = 0; i < j.calls.length; i++) {
    const c = j.calls[i];
    const st = String(c.status || '');
    if (st !== 'ringing' && st !== 'in_progress') continue;
    const pid = c.providerCallId || (c.metadata && c.metadata.vapiCallId);
    const vc = pid ? vapiById.get(pid) : null;
    if (!vc) continue;
    const vs = String(vc.status || '');
    if (vs !== 'ended' && vs !== 'forwarding') continue; // only close when Vapi says ended
    j.calls[i] = {
      ...c,
      status: 'completed',
      endedAt: vc.endedAt || new Date().toISOString(),
      outcome: vc.endedReason || c.outcome || 'vapi_reconcile_ended',
      updatedAt: new Date().toISOString(),
      metadata: { ...(c.metadata || {}), vapiReconciled: true, vapiEndedReason: vc.endedReason, vapiCost: vc.cost },
    };
    changed = true;
    closed++;
    log({ file: f, callId: c.id, providerCallId: pid, vapiStatus: vs, reason: vc.endedReason, cost: vc.cost });
  }
  if (changed) fs.writeFileSync(p, JSON.stringify(j, null, 2));
}
console.log('CLOSED', closed);
JS

curl -sS --max-time 10 "https://app.sync2dine.io/api/agent/status" | $NODE -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d); console.log(JSON.stringify({activeCall:j.activeCall&&j.activeCall.id,activeCalls:(j.activeCalls||[]).map(c=>c.id),totalActive:j.capacity&&j.capacity.totalActive},null,2))})"
