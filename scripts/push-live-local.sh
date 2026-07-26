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
  # Fail hung npm ci rather than leave the old SPA forever.
  if command -v timeout >/dev/null 2>&1; then
    timeout 240s npm ci
  else
    npm ci
  fi
  npm run build
  LOCAL_SPA_ASSET="$(ls -1 dist/assets/index-*.js 2>/dev/null | head -1 | xargs -n1 basename 2>/dev/null || true)"
  tar -czf /tmp/sync2dine-deploy.tar.gz dist
  scp /tmp/sync2dine-deploy.tar.gz "$VPS_SSH:/tmp/sync2dine-deploy.tar.gz"
  scp "$ROOT/scripts/deploy-spa.sh" "$VPS_SSH:/tmp/deploy-spa.sh"
  ssh "$VPS_SSH" 'sudo bash /tmp/deploy-spa.sh'
fi

if [ "${SKIP_API:-0}" != "1" ]; then
  echo "== Sync backend =="
  # Do NOT curl frontend server-legacy/sally-sales.ts onto the VPS — that tree is
  # saas-products/saas-contracts that are not always present and will 502 the API.
  if command -v rsync >/dev/null 2>&1; then
    rsync -az --delete \
      --exclude node_modules --exclude .git --exclude server/data --exclude .env \
      "$BE_REPO/" "$VPS_SSH:$BE_DIR/"
  else
    echo "rsync not found — using tar/scp fallback"
    TAR=/tmp/sync2dine-backend-sync.tar.gz
    (
      cd "$BE_REPO"
      tar -czf "$TAR" \
        --exclude=node_modules \
        --exclude=.git \
        --exclude=server/data \
        --exclude=.env \
        .
    )
    scp "$TAR" "$VPS_SSH:/tmp/sync2dine-backend-sync.tar.gz"
    ssh "$VPS_SSH" "mkdir -p '$BE_DIR' && tar -xzf /tmp/sync2dine-backend-sync.tar.gz -C '$BE_DIR'"
  fi

  echo "== Restart API =="
  ssh "$VPS_SSH" bash -s <<REMOTE
set -euo pipefail
export PATH="/opt/plesk/node/24/bin:\$PATH"
BE="$BE_DIR"
cd "\$BE"
# Fail hung npm ci rather than leave a half-restarted API.
if command -v timeout >/dev/null 2>&1; then
  timeout 300s npm ci --omit=dev
else
  npm ci --omit=dev
fi
bash scripts/restart-sync2dine-api.sh
REMOTE
fi

echo "== Live probes (expect orders=401, ops=200, sally-offer=200, ai-set=200) =="
curl -sS -o /tmp/live-orders.json -w 'orders=%{http_code}\n' https://app.sync2dine.io/api/orders || true
head -c 160 /tmp/live-orders.json 2>/dev/null; echo
curl -sS -o /tmp/live-ops.json -w 'ops=%{http_code}\n' https://app.sync2dine.io/api/ops/alerts || true
head -c 160 /tmp/live-ops.json 2>/dev/null; echo

SALLY_CODE="$(curl -sS -o /tmp/live-sally-offer.json -w '%{http_code}' https://app.sync2dine.io/api/platform/sally-offer || true)"
echo "sally-offer=$SALLY_CODE"
AI_SET_CODE="$(curl -sS -o /tmp/live-ai-set.json -w '%{http_code}' https://app.sync2dine.io/api/platform/phone-lines/ai-set || true)"
echo "ai-set=$AI_SET_CODE"
if [ "$SALLY_CODE" = "404" ] || [ "$AI_SET_CODE" = "404" ]; then
  echo "ERROR: phone platform routes returned 404 — API did not pick up the new ship"
  exit 1
fi

LIVE_SPA_ASSET="$(curl -sS https://app.sync2dine.io/ | grep -oE 'assets/index-[^\"]+\.js' | head -1 || true)"
echo "live SPA asset: ${LIVE_SPA_ASSET:-unknown}"
if [ -n "${LOCAL_SPA_ASSET:-}" ] && [ -n "$LIVE_SPA_ASSET" ] && [ "$LOCAL_SPA_ASSET" != "$LIVE_SPA_ASSET" ]; then
  echo "ERROR: SPA asset mismatch local=$LOCAL_SPA_ASSET live=$LIVE_SPA_ASSET"
  exit 1
fi
if [ -n "$LIVE_SPA_ASSET" ]; then
  if ! curl -sS "https://app.sync2dine.io/$LIVE_SPA_ASSET" | grep -q 'Go live (all lines)'; then
    echo "ERROR: live SPA bundle missing 'Go live (all lines)' — publish may have stalled"
    exit 1
  fi
  echo "SPA bundle contains Go live (all lines)"
fi
echo "DONE — local deploy via $VPS_SSH"
