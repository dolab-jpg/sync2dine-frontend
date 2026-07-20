#!/bin/bash
# Deploy Cockney Sally prompts to the live Sync2Dine API and restart.
# Requires SSH host `vps` (or set VPS_SSH=user@host).
set -euo pipefail

VPS_SSH="${VPS_SSH:-vps}"
BE=/var/www/vhosts/sync2dine.io/sync2dine-backend
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "== SCP Sally prompt files =="
scp "$ROOT/server/sally-sales.ts" "$VPS_SSH:$BE/server/sally-sales.ts"
scp "$ROOT/server/orchestrator-prompt.ts" "$VPS_SSH:$BE/server/orchestrator-prompt.ts"

echo "== Restart API + smoke =="
ssh "$VPS_SSH" bash -s <<'REMOTE'
set -euo pipefail
BE=/var/www/vhosts/sync2dine.io/sync2dine-backend
cd "$BE"
grep -n "VOICE & HUMOUR" server/sally-sales.ts | head -5
pkill -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 2
nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env server/index.ts \
  >/tmp/sync2dine-api.log 2>&1 &
sleep 6
pgrep -af 'sync2dine.io/sync2dine-backend.*server/index.ts' | head -3
curl -sS --max-time 10 https://app.sync2dine.io/health; echo
curl -sS --max-time 60 -X POST https://app.sync2dine.io/api/sally/web \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://sync2dine.io' \
  -d '{"sessionId":"web_cockney_local","text":"Who are you then?","page":"/"}' | head -c 900
echo
REMOTE

echo DONE
