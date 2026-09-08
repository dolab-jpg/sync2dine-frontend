#!/bin/bash
# SPA-only deploy to app.sync2dine.io � mirrors scripts/push-live-local.sh
# but skips `npm ci` (Windows node_modules lock issue) and skips the API sync
# (backend has uncommitted in-flight work that must NOT ship).
set -euo pipefail
cd /c/Users/dolab/Downloads/sync2dine-frontend

echo "== build =="
npm run build 2>&1 | tail -3

echo "== pack =="
LOCAL_SPA_ASSET="$(ls -1 dist/assets/index-*.js | head -1 | xargs -n1 basename)"
echo "local asset: assets/$LOCAL_SPA_ASSET"
tar -czf /tmp/sync2dine-deploy.tar.gz dist

echo "== upload =="
scp /tmp/sync2dine-deploy.tar.gz vps:/tmp/sync2dine-deploy.tar.gz
scp scripts/deploy-spa.sh vps:/tmp/deploy-spa.sh

echo "== remote publish =="
ssh vps 'sudo bash /tmp/deploy-spa.sh'

echo "== probes =="
curl -sS -o /dev/null -w 'orders=%{http_code}\n' https://app.sync2dine.io/api/orders || true
curl -sS -o /dev/null -w 'ops=%{http_code}\n' https://app.sync2dine.io/api/ops/alerts || true
curl -sS -o /dev/null -w 'health=%{http_code}\n' https://app.sync2dine.io/health || true
curl -sS -o /dev/null -w 'vapi-health=%{http_code}\n' https://app.sync2dine.io/api/vapi/health || true

LIVE_ASSET="$(curl -sS https://app.sync2dine.io/ | grep -oE 'assets/index-[^"]+\.js' | head -1 || true)"
echo "live asset: $LIVE_ASSET"
if [ -n "$LIVE_ASSET" ] && [ "$LIVE_ASSET" != "assets/$LOCAL_SPA_ASSET" ]; then
  echo "ERROR: SPA asset mismatch local=assets/$LOCAL_SPA_ASSET live=$LIVE_ASSET"
  exit 1
fi
echo "DEPLOY OK"
