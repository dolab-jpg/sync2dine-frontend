#!/bin/bash
# LOCAL ONLY — run on your PC (the machine where `ssh vps` already works).
# Deploys SPA + API to app.sync2dine.io and prints live probes.
#
# Usage (repos side by side):
#   cd sync2dine-frontend
#   git checkout master && git pull
#   cd ../sync2dine-backend && git checkout master && git pull
#   cd ../sync2dine-frontend
#   bash scripts/push-live-local.sh
#
# Optional:
#   VPS_SSH=user@77.68.51.27 bash scripts/push-live-local.sh
#   SKIP_SPA=1 bash scripts/push-live-local.sh
#   SKIP_API=1 bash scripts/push-live-local.sh
set -euo pipefail

VPS_SSH="${VPS_SSH:-vps}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BE_REPO="${BE_REPO:-$ROOT/../sync2dine-backend}"
BE_DIR="${BE_DIR:-/var/www/vhosts/sync2dine.io/sync2dine-backend}"

if [ ! -f "$BE_REPO/package.json" ]; then
  echo "ERROR: backend repo not found at $BE_REPO"
  echo "Clone sync2dine-backend next to sync2dine-frontend, or set BE_REPO=..."
  exit 1
fi

echo "== SSH check ($VPS_SSH) =="
ssh "$VPS_SSH" 'hostname; whoami; test -d '"$BE_DIR"' && echo backend_ok; test -d /var/www/vhosts/sync2dine.io/app.sync2dine.io && echo spa_ok'

if [ "${SKIP_SPA:-0}" != "1" ]; then
  echo "== Build SPA =="
  cd "$ROOT"
  npm ci
  npm run build
  tar -czf /tmp/sync2dine-deploy.tar.gz dist
  scp /tmp/sync2dine-deploy.tar.gz "$VPS_SSH:/tmp/sync2dine-deploy.tar.gz"
  scp "$ROOT/scripts/deploy-spa.sh" "$VPS_SSH:/tmp/deploy-spa.sh"
  ssh "$VPS_SSH" 'sudo bash /tmp/deploy-spa.sh'
fi

if [ "${SKIP_API:-0}" != "1" ]; then
  echo "== Sync backend =="
  rsync -az --delete \
    --exclude node_modules --exclude .git --exclude server/data --exclude .env \
    "$BE_REPO/" "$VPS_SSH:$BE_DIR/"

  echo "== Restart API =="
  ssh "$VPS_SSH" bash -s <<REMOTE
set -euo pipefail
BE="$BE_DIR"
cd "\$BE"
curl -fsSL "https://raw.githubusercontent.com/dolab-jpg/sync2dine-frontend/master/server/sally-sales.ts" \
  -o server/sally-sales.ts || true
curl -fsSL "https://raw.githubusercontent.com/dolab-jpg/sync2dine-frontend/master/server/orchestrator-prompt.ts" \
  -o server/orchestrator-prompt.ts || true
npm ci --omit=dev
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart sync2dine-backend || pm2 start "npm run start" --name sync2dine-backend
else
  pkill -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
  sleep 2
  nohup /opt/plesk/node/24/bin/node \
    --require ./node_modules/tsx/dist/preflight.cjs \
    --import file://\$BE/node_modules/tsx/dist/loader.mjs \
    --env-file=.env server/index.ts \
    >/tmp/sync2dine-api.log 2>&1 &
  sleep 6
fi
pgrep -af 'sync2dine-backend.*server/index.ts' | head -3 || true
curl -sS --max-time 10 https://app.sync2dine.io/health || true
echo
REMOTE
fi

echo "== Live probes (expect orders=401, ops=200) =="
curl -sS -o /tmp/live-orders.json -w 'orders=%{http_code}\n' https://app.sync2dine.io/api/orders || true
head -c 160 /tmp/live-orders.json 2>/dev/null; echo
curl -sS -o /tmp/live-ops.json -w 'ops=%{http_code}\n' https://app.sync2dine.io/api/ops/alerts || true
head -c 160 /tmp/live-ops.json 2>/dev/null; echo
curl -sS https://app.sync2dine.io/ | grep -oE 'assets/index-[^"]+\.js' | head -1 || true
echo "DONE — local deploy via $VPS_SSH"
