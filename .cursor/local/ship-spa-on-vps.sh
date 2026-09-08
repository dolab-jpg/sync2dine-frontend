#!/bin/bash
set -euo pipefail
cd /c/Users/dolab/Downloads/sync2dine-frontend
tar -czf /tmp/sync2dine-frontend-src.tar.gz \
  --exclude=node_modules \
  --exclude='node_modules*' \
  --exclude=.git \
  --exclude=dist \
  --exclude=test-results \
  --exclude=.cursor \
  .
scp /tmp/sync2dine-frontend-src.tar.gz vps:/tmp/sync2dine-frontend-src.tar.gz
scp scripts/deploy-spa.sh vps:/tmp/deploy-spa.sh
if [ -f .env.production.local ]; then
  scp .env.production.local vps:/tmp/s2d-fe.env.production.local
fi
ssh vps bash -s <<'REMOTE'
set -euo pipefail
export PATH="/opt/plesk/node/24/bin:$PATH"
rm -rf /tmp/s2d-fe-build
mkdir -p /tmp/s2d-fe-build
tar -xzf /tmp/sync2dine-frontend-src.tar.gz -C /tmp/s2d-fe-build
cd /tmp/s2d-fe-build
if [ -f /tmp/s2d-fe.env.production.local ]; then
  cp /tmp/s2d-fe.env.production.local .env.production.local
fi
npm ci
npm run build
test -f dist/index.html
tar -czf /tmp/sync2dine-deploy.tar.gz dist
sudo bash /tmp/deploy-spa.sh
echo SPA_DEPLOY_OK
curl -sS https://app.sync2dine.io/ | grep -oE 'assets/index-[^"]+\.js' | head -1 || true
REMOTE
echo DONE_SPA
