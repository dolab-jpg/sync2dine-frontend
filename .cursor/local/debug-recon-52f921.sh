#!/bin/bash
# Append NDJSON debug lines for session 52f921 (VPS cannot reach Cursor ingest localhost).
set -e
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
set -a; source .env; set +a
NODE=/opt/plesk/node/24/bin/node
KEY="${VAPI_PRIVATE_KEY:-$VAPI_API_KEY}"
BASE=https://api.vapi.ai
[ "${VAPI_REGION}" = "eu" ] && BASE=https://api.eu.vapi.ai

curl -sS --max-time 25 -H "Authorization: Bearer ${KEY}" "${BASE}/call?limit=30" > /tmp/vapi-calls.json
curl -sS --max-time 15 "https://app.sync2dine.io/api/calls?limit=30" > /tmp/app-calls.json
curl -sS --max-time 10 "https://app.sync2dine.io/api/agent/status" > /tmp/agent-status.json

$NODE <<'JS'
const fs = require('fs');
const LOG = '/tmp/debug-52f921.log';
function log(hypothesisId, location, message, data) {
  const line = JSON.stringify({
    sessionId: '52f921',
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
    runId: 'pre-fix-recon',
  });
  fs.appendFileSync(LOG, line + '\n');
  console.log(line);
}

const vapi = JSON.parse(fs.readFileSync('/tmp/vapi-calls.json', 'utf8'));
const vapiRows = Array.isArray(vapi) ? vapi : (vapi.data || []);
const vapiById = new Map(vapiRows.map(c => [c.id, c]));
const openVapi = vapiRows.filter(c => ['in-progress','ringing','queued'].includes(String(c.status||'')));
log('B', 'recon:vapi', 'vapi open vs ended', {
  total: vapiRows.length,
  openCount: openVapi.length,
  openIds: openVapi.map(c => c.id),
  costs: vapiRows.map(c => ({ id: c.id, status: c.status, cost: c.cost, reason: c.endedReason, endedAt: c.endedAt || null })),
});

const app = JSON.parse(fs.readFileSync('/tmp/app-calls.json', 'utf8'));
const appRows = app.calls || app.data || (Array.isArray(app) ? app : []);
const openApp = (appRows || []).filter(c => ['ringing','in_progress'].includes(String(c.status||'')));
log('A', 'recon:app', 'app open calls', {
  openCount: openApp.length,
  open: openApp.map(c => ({
    id: c.id,
    status: c.status,
    providerCallId: c.providerCallId || (c.metadata && c.metadata.vapiCallId) || null,
    startedAt: c.startedAt,
    endedAt: c.endedAt || null,
  })),
});

const agent = JSON.parse(fs.readFileSync('/tmp/agent-status.json', 'utf8'));
log('E', 'recon:agent', 'agent status activeCall', {
  activeCallId: agent.activeCall && agent.activeCall.id,
  activeCalls: (agent.activeCalls || []).map(c => c.id),
  totalActive: agent.capacity && agent.capacity.totalActive,
  outboundActive: agent.capacity && agent.capacity.outboundActive,
});

// Map app open -> vapi status
for (const c of openApp) {
  const pid = c.providerCallId || (c.metadata && c.metadata.vapiCallId);
  const vc = pid ? vapiById.get(pid) : null;
  log('A', 'recon:mismatch', 'open app row vs vapi', {
    appId: c.id,
    appStatus: c.status,
    providerCallId: pid || null,
    vapiFound: Boolean(vc),
    vapiStatus: vc ? vc.status : null,
    vapiEndedReason: vc ? vc.endedReason : null,
    vapiEndedAt: vc ? (vc.endedAt || null) : null,
    vapiCost: vc ? vc.cost : null,
  });
}
JS
