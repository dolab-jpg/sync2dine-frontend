#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/sync2dine-backend

echo "== Confirm DeepSeek health copy on disk =="
grep -n "AI brain not connected\|DeepSeek brain connected\|createVisionClientForOrg" server/openai-health.ts server/llm-connection.ts | head -20

PID=$(pgrep -f 'sync2dine.io/sync2dine-backend.*server/index.ts' | head -1 || true)
echo "old_pid=${PID:-none}"
if [ -n "${PID:-}" ]; then
  kill "$PID" || true
  sleep 2
fi

nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env server/index.ts \
  >/tmp/sync2dine-api.log 2>&1 &

sleep 4
echo "== new process =="
pgrep -af 'sync2dine.io/sync2dine-backend.*server/index.ts' | head -5 || true
echo "== log =="
tail -30 /tmp/sync2dine-api.log || true
echo "== health =="
curl -sS --max-time 10 https://app.sync2dine.io/health; echo
echo "== ai health deepseek =="
curl -sS --max-time 10 -X POST https://app.sync2dine.io/api/ai/health \
  -H 'Content-Type: application/json' \
  -d '{"provider":"deepseek"}'; echo
echo "== org integrations route =="
curl -sS --max-time 10 -o /dev/null -w "%{http_code}\n" https://app.sync2dine.io/api/org/integrations || true
