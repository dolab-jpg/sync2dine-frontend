#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
rm -f /tmp/debug-d0f60a.log
export DEBUG_D0F60A_LOG=/tmp/debug-d0f60a.log
/opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import "file://$PWD/node_modules/tsx/dist/loader.mjs" \
  --env-file=.env \
  ./smoke-verify-sally-debug.mts
echo '---LOG---'
wc -l /tmp/debug-d0f60a.log
cat /tmp/debug-d0f60a.log
