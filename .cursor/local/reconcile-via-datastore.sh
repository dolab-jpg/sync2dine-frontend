#!/bin/bash
set -e
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
NODE=/opt/plesk/node/24/bin/node
KEY="${VAPI_PRIVATE_KEY:-}"
set -a; source .env; set +a
KEY="${VAPI_PRIVATE_KEY:-$VAPI_API_KEY}"
BASE=https://api.vapi.ai
[ "${VAPI_REGION}" = "eu" ] && BASE=https://api.eu.vapi.ai
curl -sS --max-time 25 -H "Authorization: Bearer ${KEY}" "${BASE}/call?limit=40" > /tmp/vapi-calls.json

$NODE \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env \
  <<'JS'
import { readFileSync, appendFileSync } from 'fs';
import { getDataStore, saveCall, syncData, setRequestOrgId } from './server/data-store.ts';
import { getHomeOrgId } from './server/home-org.ts';

const org = getHomeOrgId();
setRequestOrgId(org);
const vapi = JSON.parse(readFileSync('/tmp/vapi-calls.json', 'utf8'));
const rows = Array.isArray(vapi) ? vapi : (vapi.data || []);
const byId = new Map(rows.map((c) => [c.id, c]));

const store = getDataStore();
let closed = 0;
for (const c of store.calls) {
  const st = String(c.status || '');
  if (st !== 'ringing' && st !== 'in_progress') continue;
  const pid = String(c.providerCallId || (c.metadata as any)?.vapiCallId || '');
  const vc = pid ? byId.get(pid) : null;
  if (!vc || String(vc.status) !== 'ended') continue;
  saveCall({
    id: String(c.id),
    status: 'completed',
    endedAt: vc.endedAt || new Date().toISOString(),
    outcome: vc.endedReason || 'vapi_reconcile_ended',
    metadata: {
      ...((c.metadata as object) || {}),
      vapiReconciled: true,
      vapiEndedReason: vc.endedReason,
      vapiCost: vc.cost,
    },
  });
  closed++;
  appendFileSync('/tmp/debug-52f921.log', JSON.stringify({
    sessionId: '52f921', hypothesisId: 'A', location: 'reconcile-via-datastore',
    message: 'closed via saveCall', data: { id: c.id, pid, reason: vc.endedReason, cost: vc.cost },
    timestamp: Date.now(), runId: 'pre-fix-recon',
  }) + '\n');
}
syncData(store);
console.log(JSON.stringify({ org, closed, openLeft: getDataStore().calls.filter(c => ['ringing','in_progress'].includes(String(c.status||''))).length }));
JS

curl -sS --max-time 10 https://app.sync2dine.io/api/agent/status > /tmp/agent-after2.json
$NODE -e "const j=JSON.parse(require('fs').readFileSync('/tmp/agent-after2.json','utf8')); console.log(JSON.stringify({active:j.activeCall&&j.activeCall.id||null,count:(j.activeCalls||[]).length,total:j.capacity&&j.capacity.totalActive}))"
