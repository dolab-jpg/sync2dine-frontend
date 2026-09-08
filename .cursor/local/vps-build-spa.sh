#!/bin/bash
set -euo pipefail
export PATH="/opt/plesk/node/24/bin:$PATH"
BUILD=/tmp/sync2dine-fe-build
rm -rf "$BUILD"
mkdir -p "$BUILD"
cd "$BUILD"
echo "== Clone frontend master =="
git clone --depth 1 --branch master https://github.com/dolab-jpg/sync2dine-frontend.git .
echo "== npm ci =="
npm ci
echo "== build =="
npm run build
echo "== pack =="
tar -czf /tmp/sync2dine-deploy.tar.gz dist
echo "== deploy =="
if [ ! -f /tmp/deploy-spa.sh ]; then
  echo "ERROR: /tmp/deploy-spa.sh missing"
  exit 1
fi
sudo bash /tmp/deploy-spa.sh
echo "== verify =="
test -f /var/www/vhosts/sync2dine.io/app.sync2dine.io/index.html && echo spa_index_ok
curl -sS -o /dev/null -w "home:%{http_code}\n" https://app.sync2dine.io/
curl -sS https://app.sync2dine.io/health || true
echo
echo DONE
