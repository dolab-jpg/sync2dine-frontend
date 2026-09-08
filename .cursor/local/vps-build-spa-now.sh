#!/bin/bash
set -euo pipefail
export PATH="/opt/plesk/node/24/bin:$PATH"
BUILD=/tmp/sync2dine-fe-build
rm -rf "$BUILD"
mkdir -p "$BUILD"
tar -xzf /tmp/s2d-fe-src.tar.gz -C "$BUILD"
cd "$BUILD"
echo "== npm ci =="
npm ci
echo "== build =="
npm run build
echo "== pack =="
tar -czf /tmp/sync2dine-deploy.tar.gz dist
echo "== deploy =="
sudo bash /tmp/deploy-spa.sh
echo DONE
ASSET=$(ls -1 dist/assets/index-*.js | head -1 | xargs -n1 basename)
echo "asset=$ASSET"
grep -c "s2d.crmLaunchCleared.v1" "dist/assets/$ASSET" || true
