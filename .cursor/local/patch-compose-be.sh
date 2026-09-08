#!/bin/bash
set -euo pipefail
scp /c/Users/dolab/Downloads/sync2dine-backend/server/ai/compose-email-handler.ts \
  vps:/var/www/vhosts/sync2dine.io/sync2dine-backend/server/ai/compose-email-handler.ts
scp /c/Users/dolab/Downloads/sync2dine-backend/server/ai/llm-connection.ts \
  vps:/var/www/vhosts/sync2dine.io/sync2dine-backend/server/ai/llm-connection.ts
ssh vps bash <<'REMOTE'
set -euo pipefail
export PATH="/opt/plesk/node/24/bin:$PATH"
BE="/var/www/vhosts/sync2dine.io/sync2dine-backend"
cd "$BE"
pkill -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
pkill -f 'sync2dine.io/sync2dine-backend/node_modules/tsx' || true
sleep 2
nohup npm run start >/tmp/sync2dine-api.log 2>&1 &
sleep 8
curl -sS --max-time 10 https://app.sync2dine.io/health
echo
grep -n "deepseekApiKey\|bodyDeepSeekApiKey" server/ai/compose-email-handler.ts | head -10
REMOTE
echo DONE
