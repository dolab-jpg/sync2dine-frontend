#!/bin/bash
# Recover Sync2Dine API process.
# Source of truth for DeepSeek-primary AI brain = sync2dine-frontend/server (NOT tradepro-backend).
# Never copy tradepro-backend llm/openai/channel files onto this host — that undoes DeepSeek-primary.
set -e
cd /var/www/vhosts/sync2dine.io/sync2dine-backend

git checkout -- server/ || true
mkdir -p /tmp/s2d-bak
for f in \
  server/compose-email-handler.ts \
  server/org-elevenlabs.ts \
  server/org-phone-billing-routes.ts \
  server/phone-billing.ts \
  server/phone-number-type.ts \
  server/sales-email-html.ts \
  server/sales-templates.ts \
  server/sally-receptionist.ts \
  server/scheduled-message-worker.ts \
  server/scheduled-messages-store.ts \
  server/whatsapp-web-browser-login.ts \
  server/integration-secret-fields.ts \
  server/org-integrations-routes.ts \
  server/org-integrations-store.ts \
  server/llm-connection.ts \
  server/openai-health.ts \
  server/openai-connection.ts \
  server/channel-inbound-handler.ts \
  server/vision-handler.ts \
  server/receipt-handler.ts \
  server/usage.ts \
  server/ai-proxy.ts \
  server/org-openai-key-routes.ts
do
  if [ -e "$f" ]; then mv "$f" /tmp/s2d-bak/; fi
done

git stash push -u -m "pre-deepseek-recover" -- package.json package-lock.json || true
git pull --ff-only origin master

# Restore DeepSeek-primary + other protected server files after pull
if [ -d /tmp/s2d-bak ]; then
  for f in /tmp/s2d-bak/*; do
    base=$(basename "$f")
    mv "$f" "server/$base"
  done
fi

echo "== Confirm DeepSeek-primary files still present =="
grep -n "createVisionClientForOrg\|DeepSeek or OpenAI as primary" server/llm-connection.ts | head -5 || {
  echo "ERROR: DeepSeek-primary llm-connection missing after recover — re-run apply-deepseek-backend.sh"
  exit 1
}

pkill -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 2

nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env server/index.ts \
  >/tmp/sync2dine-api.log 2>&1 &

sleep 5
echo PROCESS:
pgrep -af 'sync2dine.io/sync2dine-backend.*server/index.ts' | head -5 || true
echo LOG:
tail -30 /tmp/sync2dine-api.log || true
echo HEALTH:
curl -sS --max-time 10 https://app.sync2dine.io/health; echo
echo AI_HEALTH:
curl -sS --max-time 10 -X POST https://app.sync2dine.io/api/ai/health \
  -H 'Content-Type: application/json' -d '{"provider":"deepseek"}'; echo
