#!/bin/bash
set -euo pipefail
BE="/c/Users/dolab/Downloads/sync2dine-backend"
BE_DIR="/var/www/vhosts/sync2dine.io/sync2dine-backend"
TAR="/tmp/sync2dine-backend-sync.tar.gz"
cd "$BE"
tar -czf "$TAR" --exclude=node_modules --exclude=.git --exclude=server/data --exclude=.env .
scp "$TAR" vps:/tmp/sync2dine-backend-sync.tar.gz
ssh vps "mkdir -p ${BE_DIR} && tar -xzf /tmp/sync2dine-backend-sync.tar.gz -C ${BE_DIR}"
echo "== Restart API =="
ssh vps bash <<'REMOTE'
set -euo pipefail
export PATH="/opt/plesk/node/24/bin:$PATH"
BE="/var/www/vhosts/sync2dine.io/sync2dine-backend"
cd "$BE"
npm ci --omit=dev
pkill -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
pkill -f 'sync2dine.io/sync2dine-backend/node_modules/tsx' || true
sleep 2
nohup npm run start >/tmp/sync2dine-api.log 2>&1 &
sleep 8
pgrep -af 'sync2dine.io/sync2dine-backend' | head -5 || true
curl -sS --max-time 10 https://app.sync2dine.io/health || true
echo
REMOTE
echo DONE
