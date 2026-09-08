#!/bin/bash
set -euo pipefail
export PATH="/opt/plesk/node/24/bin:$PATH"
BE=/var/www/vhosts/sync2dine.io/sync2dine-backend
pkill -f 'sync2dine.io/sync2dine-backend.*server/index.ts' 2>/dev/null || true
pkill -f 'sync2dine.io/sync2dine-backend/node_modules/tsx' 2>/dev/null || true
sleep 2
cd "$BE"
nohup npm run start >/tmp/sync2dine-api.log 2>&1 &
sleep 8
curl -sS --max-time 10 https://app.sync2dine.io/health || true
echo
pgrep -af 'sync2dine.io/sync2dine-backend' | head -5 || true
tail -n 30 /tmp/sync2dine-api.log || true
