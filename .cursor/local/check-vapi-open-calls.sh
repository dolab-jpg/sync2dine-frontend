#!/bin/bash
set -e
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
set -a
# shellcheck disable=SC1091
source .env
set +a
NODE=/opt/plesk/node/24/bin/node
KEY="${VAPI_PRIVATE_KEY:-$VAPI_API_KEY}"
BASE=https://api.vapi.ai
if [ "${VAPI_REGION}" = "eu" ]; then BASE=https://api.eu.vapi.ai; fi

echo "=== VAPI RECENT CALLS ==="
curl -sS --max-time 25 -H "Authorization: Bearer ${KEY}" "${BASE}/call?limit=25" > /tmp/vapi-calls.json
$NODE <<'JS'
const fs = require('fs');
const raw = fs.readFileSync('/tmp/vapi-calls.json','utf8');
let j;
try { j = JSON.parse(raw); } catch (e) { console.log('parse fail', e.message, raw.slice(0,300)); process.exit(0); }
const rows = Array.isArray(j) ? j : (j.data || j.calls || []);
console.log('count', rows.length);
let inProgress = 0;
let totalCost = 0;
for (const c of rows.slice(0, 25)) {
  const st = c.status || '?';
  if (st === 'in-progress' || st === 'ringing' || st === 'queued') inProgress++;
  const cost = typeof c.cost === 'number' ? c.cost : 0;
  totalCost += cost;
  console.log([
    c.id,
    st,
    c.type || '',
    c.startedAt || c.createdAt || '',
    c.endedAt || '',
    'cost=' + (c.cost != null ? c.cost : '?'),
    'endedReason=' + (c.endedReason || ''),
    (c.customer && c.customer.number) || ''
  ].join(' | '));
}
console.log('IN_PROGRESS_COUNT', inProgress);
console.log('SUM_COST_SHOWN', totalCost);
JS

echo
echo "=== APP CALLS ==="
curl -sS --max-time 15 "https://app.sync2dine.io/api/calls?limit=20" > /tmp/app-calls.json
$NODE <<'JS'
const fs = require('fs');
const raw = fs.readFileSync('/tmp/app-calls.json','utf8');
let j;
try { j = JSON.parse(raw); } catch (e) { console.log(raw.slice(0,400)); process.exit(0); }
const rows = j.calls || j.data || (Array.isArray(j) ? j : []);
for (const c of (rows || []).slice(0, 20)) {
  const meta = c.metadata || {};
  console.log([
    c.id,
    c.status,
    c.direction,
    c.startedAt || '',
    c.endedAt || '',
    meta.vapiCallId || c.providerCallId || '',
    c.outcome || '',
    (c.contactName || '')
  ].join(' | '));
}
const open = (rows || []).filter(c => ['ringing','in_progress','dialling','queued'].includes(String(c.status||'')));
console.log('APP_OPEN_COUNT', open.length);
JS

echo
echo "=== AGENT STATUS ==="
curl -sS --max-time 10 "https://app.sync2dine.io/api/agent/status"; echo
