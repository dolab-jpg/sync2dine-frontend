#!/bin/bash
set -e
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
cat > /tmp/test-ds.mjs <<'EOF'
import { pathToFileURL } from 'url';
const url = pathToFileURL('/var/www/vhosts/sync2dine.io/sync2dine-backend/server/data-store.ts').href;
import(url).then((m) => {
  console.log('ok', typeof m.getAgentCapacitySnapshot);
}).catch((e) => {
  console.error('fail', e);
  process.exit(1);
});
EOF
/opt/plesk/node/24/bin/node --require ./node_modules/tsx/dist/preflight.cjs --import ./node_modules/tsx/dist/loader.mjs /tmp/test-ds.mjs
# restart
pkill -9 -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 2
fuser -k 3011/tcp 2>/dev/null || true
sleep 1
nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env server/index.ts \
  >/tmp/sync2dine-api.log 2>&1 &
sleep 12
curl -sS --max-time 10 http://127.0.0.1:3011/health; echo
tail -25 /tmp/sync2dine-api.log
