#!/bin/bash
set -euo pipefail
BE="/c/Users/dolab/Downloads/sync2dine-backend"
BE_DIR="/var/www/vhosts/sync2dine.io/sync2dine-backend"
TAR="/tmp/sync2dine-backend-sync.tar.gz"
cd "$BE"
echo "== tar backend =="
tar -czf "$TAR" --exclude=node_modules --exclude=.git --exclude=server/data --exclude=.env .
echo "== scp =="
scp "$TAR" vps:/tmp/sync2dine-backend-sync.tar.gz
echo "== extract on VPS =="
ssh vps "mkdir -p '$BE_DIR' && tar -xzf /tmp/sync2dine-backend-sync.tar.gz -C '$BE_DIR'"
echo "== restart API =="
ssh vps "bash '$BE_DIR/scripts/restart-sync2dine-api.sh'"
echo "== probes =="
curl -sS -m 10 https://app.sync2dine.io/health; echo
curl -sS -m 10 -o /tmp/recruitment-probe.json -w 'recruitment=%{http_code}\n' https://app.sync2dine.io/api/recruitment || true
head -c 200 /tmp/recruitment-probe.json; echo
