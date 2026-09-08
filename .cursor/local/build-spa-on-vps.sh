#!/bin/bash
set -euo pipefail
export PATH="/opt/plesk/node/24/bin:$PATH"

rm -rf /tmp/sync2dine-fe-build
mkdir -p /tmp/sync2dine-fe-build
tar -xzf /tmp/sync2dine-fe-src.tar.gz -C /tmp/sync2dine-fe-build
cd /tmp/sync2dine-fe-build

if [ -f /var/www/vhosts/sync2dine.io/sync2dine-frontend/.env.production ]; then
  cp /var/www/vhosts/sync2dine.io/sync2dine-frontend/.env.production .env.production
  echo "copied_env_prod"
elif [ -f /var/www/vhosts/sync2dine.io/sync2dine-backend/.env ]; then
  grep -E '^VITE_' /var/www/vhosts/sync2dine.io/sync2dine-backend/.env > .env.production || true
  echo "from_be_env"
fi

# Prefer existing live SPA env hints if present on docroot build leftovers
if [ ! -s .env.production ] && [ -f /tmp/sync2dine-fe-build/.env.production.local ]; then
  cp .env.production.local .env.production
  echo "from_tarball_env_local"
fi

npm ci
npm run build
tar -czf /tmp/sync2dine-deploy.tar.gz dist
bash scripts/deploy-spa.sh
echo "== post-deploy =="
curl -sS --max-time 10 https://app.sync2dine.io/health || true
ls -1 /var/www/vhosts/sync2dine.io/app.sync2dine.io/assets/index-*.js | tail -3
echo "SPA_DONE"
