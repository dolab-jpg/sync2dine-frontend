#!/bin/bash
set -euo pipefail
ROOT="/c/Users/dolab/Downloads/sync2dine-frontend"
BE_REPO="/c/Users/dolab/Downloads/sync2dine-backend"
BE_DIR="/var/www/vhosts/sync2dine.io/sync2dine-backend"
VPS_SSH=vps
cd "$ROOT"
LOCAL_SPA_ASSET="$(ls -1 dist/assets/index-*.js 2>/dev/null | head -1 | xargs -n1 basename 2>/dev/null || true)"
echo "LOCAL_SPA_ASSET=$LOCAL_SPA_ASSET"
tar -czf /tmp/sync2dine-deploy.tar.gz dist
scp /tmp/sync2dine-deploy.tar.gz "$VPS_SSH:/tmp/sync2dine-deploy.tar.gz"
scp "$ROOT/scripts/deploy-spa.sh" "$VPS_SSH:/tmp/deploy-spa.sh"
ssh "$VPS_SSH" "sudo bash /tmp/deploy-spa.sh"
echo "== Sync backend =="
TAR=/tmp/sync2dine-backend-sync.tar.gz
(
  cd "$BE_REPO"
  tar -czf "$TAR" --exclude=node_modules --exclude=.git --exclude=server/data --exclude=.env .
)
scp "$TAR" "$VPS_SSH:/tmp/sync2dine-backend-sync.tar.gz"
ssh "$VPS_SSH" "mkdir -p '$BE_DIR' && tar -xzf /tmp/sync2dine-backend-sync.tar.gz -C '$BE_DIR'"
echo "== Restart API =="
ssh "$VPS_SSH" "export PATH=/opt/plesk/node/24/bin:\$PATH; cd '$BE_DIR'; bash scripts/restart-sync2dine-api.sh"
echo "== Probes =="
curl -sS https://app.sync2dine.io/health; echo
curl -sS https://app.sync2dine.io/api/vapi/health; echo
LIVE_SPA_ASSET="$(curl -sS https://app.sync2dine.io/ | grep -oE 'assets/index-[^"]+\.js' | head -1 || true)"
echo "live SPA asset: $LIVE_SPA_ASSET"
curl -sS -o /tmp/live-cap.json -w "capacity=%{http_code}\n" https://app.sync2dine.io/api/agent/capacity || true
head -c 400 /tmp/live-cap.json; echo
echo DONE
