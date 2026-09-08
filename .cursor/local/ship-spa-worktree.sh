#!/bin/bash
set -euo pipefail
cd /c/Users/dolab/Downloads/sync2dine-frontend
if [ ! -f .env.production.local ]; then
  echo "ERROR: .env.production.local missing"
  exit 1
fi
TAR=/tmp/s2d-fe-worktree.tar.gz
rm -f "$TAR"
tar -czf "$TAR" \
  --exclude=node_modules \
  --exclude=node_modules.bak \
  --exclude=.git \
  --exclude=dist \
  --exclude=.cursor/local \
  .
scp "$TAR" vps:/tmp/s2d-fe-worktree.tar.gz
scp .env.production.local vps:/tmp/s2d-fe.env.production.local
scp scripts/deploy-spa.sh vps:/tmp/deploy-spa.sh
ssh vps 'bash -s' <<'REMOTE'
set -euo pipefail
export PATH="/opt/plesk/node/24/bin:$PATH"
rm -rf /tmp/s2d-fe-build
mkdir -p /tmp/s2d-fe-build
tar -xzf /tmp/s2d-fe-worktree.tar.gz -C /tmp/s2d-fe-build
cd /tmp/s2d-fe-build
cp /tmp/s2d-fe.env.production.local .env.production.local
npm ci
npm run build
test -f dist/index.html
tar -czf /tmp/sync2dine-deploy.tar.gz dist
sudo bash /tmp/deploy-spa.sh
echo SPA_DEPLOY_OK
curl -sS https://app.sync2dine.io/ | grep -oE 'assets/index-[^"]+\.js' | head -1 || true
REMOTE
echo DONE_SPA
