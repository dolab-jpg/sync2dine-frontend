#!/bin/bash
set -euo pipefail
ROOT=/var/www/vhosts/sync2dine.io/sync2dine-backend
cd "$ROOT"
# Preserve secrets + WA session
test -f .env || { echo 'MISSING .env'; exit 1; }
git fetch origin master
# Drop local dirty/untracked that block deploy (keep data + env)
git reset --hard origin/master
git clean -fd \
  -e server/data \
  -e .env \
  -e node_modules \
  -e .wwebjs_auth \
  -e '*.log'
# Ensure data auth dir untouched
test -d server/data && echo OK_data_dir
test -f server/sally-product-kb/inject.ts && echo OK_sally_kb
test -f server/sales-brain/supabase-sync.ts && echo OK_dualwrite
test -f supabase/migrations/202607212200_sally_knowledge.sql && echo OK_mig
test -d server/brains && echo OK_brains || echo NO_brains
# Restart API
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
curl -sS --max-time 8 https://app.sync2dine.io/api/sales-brain/status; echo
git rev-parse --short HEAD
grep -n 'staffMode' server/vapi-assistant.ts | head -3
