#!/bin/bash
set -euo pipefail
DEST=/var/www/vhosts/sync2dine.io/sync2dine-backend
cp /tmp/integration-secrets.ts "$DEST/server/"
cp /tmp/org-integrations-routes.ts "$DEST/server/"
cp /tmp/org-integrations-status.ts "$DEST/server/"
cp /tmp/oauth-config.ts "$DEST/server/mailbox/oauth-config.ts"
if grep -q '^INTEGRATIONS_MOCK_MODE=' "$DEST/.env"; then
  sed -i 's/^INTEGRATIONS_MOCK_MODE=.*/INTEGRATIONS_MOCK_MODE=false/' "$DEST/.env"
else
  echo 'INTEGRATIONS_MOCK_MODE=false' >> "$DEST/.env"
fi
if grep -q '^MAILBOX_MOCK_MODE=' "$DEST/.env"; then
  sed -i 's/^MAILBOX_MOCK_MODE=.*/MAILBOX_MOCK_MODE=false/' "$DEST/.env"
else
  echo 'MAILBOX_MOCK_MODE=false' >> "$DEST/.env"
fi
echo "env:"
grep -E 'INTEGRATIONS_MOCK_MODE|MAILBOX_MOCK_MODE' "$DEST/.env"
cd "$DEST"
pkill -9 -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 2
fuser -k 3011/tcp 2>/dev/null || true
sleep 1
nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env server/index.ts \
  >/tmp/sync2dine-api.log 2>&1 &
sleep 8
echo "== process =="
pgrep -af 'sync2dine.io/sync2dine-backend.*server/index.ts' | head -3 || true
echo "== health =="
curl -sS --max-time 10 https://app.sync2dine.io/health || true
echo
echo "== wa =="
curl -sS --max-time 10 https://app.sync2dine.io/api/whatsapp-web/status | head -c 300
echo
