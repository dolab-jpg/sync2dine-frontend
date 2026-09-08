#!/bin/bash
set -euo pipefail
BE_REPO=/c/Users/dolab/Downloads/sync2dine-backend
BE_DIR=/var/www/vhosts/sync2dine.io/sync2dine-backend
TAR=/tmp/s2d-be.tar.gz

echo "== Pack backend =="
cd "$BE_REPO"
tar -czf "$TAR" --exclude=node_modules --exclude=.git --exclude=server/data --exclude=.env .
ls -la "$TAR"

echo "== Upload =="
scp -O "$TAR" vps:/tmp/sync2dine-backend-sync.tar.gz

# The VPS drops new sessions opened straight after a transfer — back off and retry.
retry_ssh() {
  local attempt=1
  until ssh -o ConnectTimeout=20 vps "$1"; do
    if [ "$attempt" -ge 5 ]; then
      echo "ssh failed after $attempt attempts: $1" >&2
      return 1
    fi
    attempt=$((attempt + 1))
    sleep 10
  done
}

echo "== Extract =="
sleep 8
retry_ssh "mkdir -p '$BE_DIR' && tar -xzf /tmp/sync2dine-backend-sync.tar.gz -C '$BE_DIR' && ls -la '$BE_DIR/server/sally/cv-intake.ts'"

echo "== Install + restart API =="
sleep 8
retry_ssh "export PATH=/opt/plesk/node/24/bin:\$PATH; cd '$BE_DIR' && timeout 300s npm ci --omit=dev && bash scripts/restart-sync2dine-api.sh"

echo "== Probes =="
curl -sS -o /dev/null -w 'health=%{http_code}\n' https://app.sync2dine.io/health || true
curl -sS -o /dev/null -w 'sally-offer=%{http_code}\n' https://app.sync2dine.io/api/platform/sally-offer || true
curl -sS -o /dev/null -w 'recruitment-cvs-get=%{http_code}\n' https://app.sync2dine.io/api/recruitment/cvs || true
echo DEPLOY_DONE
