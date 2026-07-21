#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
/opt/plesk/node/24/bin/node --import tsx <<'NODE'
import { buildSilenceHooks, buildVapiAssistantForParty } from './server/vapi-assistant.ts';
import { getSallyPhoneSessionChatTools } from './server/sally-sales-phone.ts';

const hooks = buildSilenceHooks('sally');
console.log('sally_hooks', hooks.length, hooks.map((h) => h.name).join(','));
const tools = getSallyPhoneSessionChatTools().map((t) => t.function.name);
console.log('sally_tools', tools.join(','));
if (!tools.includes('bookIntegrationMeeting')) throw new Error('missing bookIntegrationMeeting');
const { assistant } = await buildVapiAssistantForParty({
  partyPhone: '+447464207366',
  direction: 'outbound',
  agentPersona: 'sally',
});
const a = assistant as Record<string, unknown>;
console.log('silenceTimeout', a.silenceTimeoutSeconds);
console.log('hooks_on_assistant', Array.isArray(a.hooks) ? (a.hooks as unknown[]).length : 0);
if (a.silenceTimeoutSeconds !== 35) throw new Error('expected silenceTimeout 35');
if (!Array.isArray(a.hooks) || a.hooks.length < 3) throw new Error('expected 3 silence hooks');
console.log('VERIFY_OK');
NODE

pkill -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 2
OLD=$(ss -tlnp | grep ':3011' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1 || true)
if [ -n "${OLD:-}" ]; then kill -9 "$OLD" || true; sleep 1; fi
nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import "file://$PWD/node_modules/tsx/dist/loader.mjs" \
  --env-file=.env \
  server/index.ts > /tmp/sync2dine-api.log 2>&1 &
sleep 8
curl -sS --max-time 8 http://127.0.0.1:3011/health; echo
curl -sS --max-time 8 https://app.sync2dine.io/health; echo
tail -n 20 /tmp/sync2dine-api.log || true
