#!/bin/bash
# Deploy Sync2Dine SPA + API to the live VPS using an SSH private key.
#
# Usage (from a machine / agent with the key):
#   export VPS_HOST=77.68.51.27
#   export VPS_USER=ubuntu          # or your Plesk SSH user
#   export VPS_SSH_KEY_FILE=/path/to/id_ed25519
#   # optional: BACKEND_DIR, DOCROOT
#   bash scripts/deploy-live-from-key.sh
#
# Or paste the key into VPS_SSH_KEY (PEM text) instead of a file.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BE_REPO="${BE_REPO:-$(cd "$ROOT/../sync2dine-backend" && pwd)}"
VPS_HOST="${VPS_HOST:-77.68.51.27}"
VPS_USER="${VPS_USER:?Set VPS_USER (SSH login on the VPS)}"
BACKEND_DIR="${BACKEND_DIR:-/var/www/vhosts/sync2dine.io/sync2dine-backend}"
DOCROOT="${DOCROOT:-/var/www/vhosts/sync2dine.io/app.sync2dine.io}"

KEY_FILE="${VPS_SSH_KEY_FILE:-}"
CLEANUP_KEY=0
if [ -z "$KEY_FILE" ]; then
  if [ -z "${VPS_SSH_KEY:-}" ]; then
    echo "ERROR: set VPS_SSH_KEY_FILE or VPS_SSH_KEY"
    exit 1
  fi
  KEY_FILE=$(mktemp)
  CLEANUP_KEY=1
  printf '%s\n' "$VPS_SSH_KEY" >"$KEY_FILE"
  chmod 600 "$KEY_FILE"
fi
trap 'if [ "$CLEANUP_KEY" = 1 ]; then rm -f "$KEY_FILE"; fi' EXIT

SSH=(ssh -i "$KEY_FILE" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new "${VPS_USER}@${VPS_HOST}")
SCP=(scp -i "$KEY_FILE" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new)

echo "== SSH smoke =="
"${SSH[@]}" 'hostname; whoami; ls -ld '"$BACKEND_DIR"' '"$DOCROOT"''

echo "== Build SPA =="
cd "$ROOT"
npm ci
npm run build

echo "== Publish SPA tarball =="
tar -czf /tmp/sync2dine-deploy.tar.gz dist
"${SCP[@]}" /tmp/sync2dine-deploy.tar.gz "${VPS_USER}@${VPS_HOST}:/tmp/sync2dine-deploy.tar.gz"
"${SCP[@]}" "$ROOT/scripts/deploy-spa.sh" "${VPS_USER}@${VPS_HOST}:/tmp/deploy-spa.sh"
"${SSH[@]}" 'sudo bash /tmp/deploy-spa.sh'

echo "== Sync backend tree =="
rsync -az --delete \
  -e "ssh -i $KEY_FILE -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
  --exclude node_modules --exclude .git --exclude server/data --exclude .env \
  "$BE_REPO/" "${VPS_USER}@${VPS_HOST}:${BACKEND_DIR}/"

echo "== Restart API =="
"${SSH[@]}" bash -s <<REMOTE
set -euo pipefail
BE="$BACKEND_DIR"
cd "\$BE"
npm ci --omit=dev
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart sync2dine-backend || pm2 start "npm run start" --name sync2dine-backend
else
  pkill -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
  sleep 2
  nohup /opt/plesk/node/24/bin/node \\
    --require ./node_modules/tsx/dist/preflight.cjs \\
    --import file://\$BE/node_modules/tsx/dist/loader.mjs \\
    --env-file=.env server/index.ts \\
    >/tmp/sync2dine-api.log 2>&1 &
  sleep 5
fi
curl -sS --max-time 10 https://app.sync2dine.io/health || true
echo
REMOTE

echo "== Live probes =="
curl -sS -o /tmp/live-orders.json -w 'orders=%{http_code}\n' https://app.sync2dine.io/api/orders
head -c 120 /tmp/live-orders.json; echo
curl -sS -o /tmp/live-ops.json -w 'ops=%{http_code}\n' https://app.sync2dine.io/api/ops/alerts
head -c 120 /tmp/live-ops.json; echo
echo DONE
