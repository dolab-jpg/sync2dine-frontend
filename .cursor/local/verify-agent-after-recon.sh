#!/bin/bash
set -e
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
NODE=/opt/plesk/node/24/bin/node
curl -sS --max-time 10 https://app.sync2dine.io/api/agent/status > /tmp/agent-after.json
$NODE <<'JS'
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('/tmp/agent-after.json','utf8'));
console.log('AGENT', JSON.stringify({
  activeCall: j.activeCall && j.activeCall.id || null,
  activeCount: (j.activeCalls || []).length,
  totalActive: j.capacity && j.capacity.totalActive,
  ringing: j.ringingCount,
}, null, 2));
const dir = 'server/data';
for (const f of fs.readdirSync(dir).filter(x => x.startsWith('synced-data') && x.endsWith('.json'))) {
  const data = JSON.parse(fs.readFileSync(dir + '/' + f, 'utf8'));
  const open = (data.calls || []).filter(c => ['ringing','in_progress'].includes(String(c.status||'')));
  const fixed = (data.calls || []).filter(c => String(c.id||'').startsWith('out-178455449'));
  if (open.length || fixed.length) {
    console.log(f, 'openCount', open.length, 'targetRows', JSON.stringify(fixed.map(c => ({id:c.id,status:c.status,outcome:c.outcome,endedAt:c.endedAt||null}))));
  }
}
JS
