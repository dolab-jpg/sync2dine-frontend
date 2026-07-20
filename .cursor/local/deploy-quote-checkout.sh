#!/bin/bash
set -euo pipefail
BACKEND=/var/www/vhosts/sync2dine.io/sync2dine-backend
SRC=/tmp/sync2dine-quote-ship

cp -a "$SRC/quote-checkout.ts" "$SRC/quote-checkout.test.ts" "$SRC/stripe-routes.ts" "$SRC/stripe-service.ts" "$BACKEND/server/"
echo "== installed =="
grep -n "upsertQuoteForOrg\|checkout-link" "$BACKEND/server/stripe-routes.ts" | head -10
grep -n "upsertQuoteForOrg" "$BACKEND/server/quote-checkout.ts" | head -5

echo "== stopping API =="
PIDS=$(pgrep -f "sync2dine.io/sync2dine-backend.*server/index.ts" || true)
echo "old_pids=${PIDS:-none}"
if [ -n "${PIDS:-}" ]; then
  # shellcheck disable=SC2086
  kill $PIDS || true
  sleep 2
  PIDS2=$(pgrep -f "sync2dine.io/sync2dine-backend.*server/index.ts" || true)
  if [ -n "${PIDS2:-}" ]; then
    # shellcheck disable=SC2086
    kill -9 $PIDS2 || true
    sleep 1
  fi
fi

echo "== starting API =="
cd "$BACKEND"
nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env server/index.ts \
  >/tmp/sync2dine-api.log 2>&1 &
sleep 5
echo "== new process =="
pgrep -af "sync2dine.io/sync2dine-backend.*server/index.ts" | head -5 || true
echo "== log tail =="
tail -50 /tmp/sync2dine-api.log || true
echo "== health =="
curl -sS --max-time 10 https://app.sync2dine.io/health; echo
