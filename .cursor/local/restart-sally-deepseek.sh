#!/bin/bash
set -e
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
NODE=/opt/plesk/node/24/bin/node

echo "== import check =="
$NODE \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env \
  -e "Promise.all([import('./server/vapi-assistant.ts'),import('./server/sally-sales-phone.ts'),import('./server/vapi-llm-model.ts'),import('./server/vapi-routes.ts'),import('./server/phone-webhook.ts'),import('./server/telephony/vapiAdapter.ts')]).then(()=>{console.log('imports-ok');process.exit(0)}).catch((e)=>{console.error(e);process.exit(1)})"

echo "== env =="
grep -E '^VAPI_LLM_' .env || true

echo "== restart =="
fuser -k 3011/tcp 2>/dev/null || true
pkill -9 -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 3
nohup $NODE \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env server/index.ts \
  >/tmp/sync2dine-api.log 2>&1 &
sleep 7
echo PROCESS:
pgrep -af 'sync2dine.io/sync2dine-backend.*server/index.ts' | head -3 || true
echo HEALTH:
curl -sS --max-time 10 https://app.sync2dine.io/health; echo
echo VAPI:
curl -sS --max-time 10 https://app.sync2dine.io/api/vapi/health; echo
echo AI_DEEPSEEK:
curl -sS --max-time 20 -X POST https://app.sync2dine.io/api/ai/health -H 'Content-Type: application/json' -d '{"provider":"deepseek"}'; echo
echo LOG_TAIL:
tail -40 /tmp/sync2dine-api.log || true
