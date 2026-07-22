#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
rm -f /tmp/debug-d0f60a.log
export DEBUG_D0F60A_LOG=/tmp/debug-d0f60a.log
echo "== API probes post-fix =="
curl -sS --max-time 15 https://app.sync2dine.io/api/sally-knowledge/status; echo
curl -sS --max-time 15 -o /tmp/sk-chunks.json https://app.sync2dine.io/api/sally-knowledge/chunks
python3 -c 'import json;d=json.load(open("/tmp/sk-chunks.json"));print("chunks",len(d.get("chunks")or[]),"approved",sum(1 for c in d.get("chunks")or[] if c.get("status")=="approved"))'
curl -sS --max-time 15 https://app.sync2dine.io/api/sales-brain/status; echo
echo "== brain smoke =="
set +e
/opt/plesk/node/24/bin/node --require ./node_modules/tsx/dist/preflight.cjs \
  --import "file://$PWD/node_modules/tsx/dist/loader.mjs" \
  --env-file=.env \
  --input-type=module <<'EOF'
import { buildBrainSession } from './server/brains/index.ts';
import { warmSallyKnowledgeCache, getSallyKnowledgePromptBlockCached } from './server/sally-product-kb/inject.ts';

await warmSallyKnowledgeCache();
const cached = getSallyKnowledgePromptBlockCached();
console.log('cacheLen', cached.length);

const base = {
  partyPhone: '+447700900123',
  direction: 'inbound',
  verified: false,
  callId: 'debug-live-1',
};

const sally = await buildBrainSession({
  ...base,
  identity: { kind: 'customer', route: { mode: 'customer' }, role: 'customer', name: 'Prospect', phone: base.partyPhone, userId: null, pinConfigured: false, needsPin: false },
  agentPersona: 'sally',
  callMeta: { agentPersona: 'sally', campaignTemplate: 'sally_sales' },
  campaignTemplate: 'sally_sales',
});
console.log('sally', sally.id, sally.silencePersona, 'tools', sally.chatTools.length, 'kb', /SALLY PRODUCT KNOWLEDGE/i.test(sally.instructions));

const judie = await buildBrainSession({
  ...base,
  identity: { kind: 'customer', route: { mode: 'customer' }, role: 'customer', name: 'Diner', phone: base.partyPhone, userId: null, pinConfigured: false, needsPin: false },
  agentPersona: 'judie',
  callMeta: { agentPersona: 'judie' },
});
console.log('judie', judie.id, judie.silencePersona, 'tools', judie.chatTools.length, 'transfer', judie.allowTransfer);

const staff = await buildBrainSession({
  ...base,
  identity: { kind: 'staff', route: { mode: 'staff' }, role: 'platform_owner', name: 'Owner', phone: base.partyPhone, userId: 'x', pinConfigured: true, needsPin: true },
  agentPersona: 'sally',
  callMeta: { agentPersona: 'sally', campaignTemplate: 'sally_sales' },
  campaignTemplate: 'sally_sales',
  verified: false,
});
console.log('staffSally', staff.id, staff.assistantName, 'tools', staff.chatTools.length, 'hasPin', staff.chatTools.some(t => t.function.name === 'verifyStaffPhonePin'));
EOF
set -e
echo "== log tail =="
wc -l /tmp/debug-d0f60a.log || true
tail -n 40 /tmp/debug-d0f60a.log || true
