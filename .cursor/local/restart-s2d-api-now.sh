#!/bin/bash
set -euo pipefail
BE=/var/www/vhosts/sync2dine.io/sync2dine-backend
cd "$BE"
pkill -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 2
# also kill anything on 3011
OLD=$(ss -tlnp | grep ':3011' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1 || true)
if [ -n "${OLD:-}" ]; then kill -9 "$OLD" || true; sleep 1; fi
nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import "file://$PWD/node_modules/tsx/dist/loader.mjs" \
  --env-file=.env \
  server/index.ts > /tmp/sync2dine-api.log 2>&1 &
sleep 10
ss -tlnp | grep 3011 || true
tail -25 /tmp/sync2dine-api.log
curl -sS --max-time 10 http://127.0.0.1:3011/health || true
echo
curl -sS --max-time 10 https://app.sync2dine.io/health || true
echo
/opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import "file://$PWD/node_modules/tsx/dist/loader.mjs" \
  -e 'import { buildOfferTermsPayload, resolveCallbackIso } from "./server/sally-sales-phone.ts"; const o=buildOfferTermsPayload(); console.log(JSON.stringify({ok:o.ok,n:(o.packages||[]).length,demo:o.demoPhone,spoken:o.spokenDemoPhone,iso:resolveCallbackIso("tomorrow 4pm")}));'
