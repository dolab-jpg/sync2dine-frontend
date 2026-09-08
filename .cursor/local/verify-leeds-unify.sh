#!/bin/bash
set -euo pipefail
curl -sS https://app.sync2dine.io/health; echo
echo "--- queue-crm dryRun (expect 401 without auth) ---"
curl -sS -w "\nHTTP %{http_code}\n" -X POST https://app.sync2dine.io/api/campaigns/queue-crm \
  -H "Content-Type: application/json" \
  -d '{"dryRun":true,"batchId":"Leeds"}' || true
ASSET=$(curl -sS https://app.sync2dine.io/ | grep -oE 'assets/index-[^"]+\.js' | head -1)
echo "asset=$ASSET"
curl -sS "https://app.sync2dine.io/$ASSET" -o /tmp/s2d-spa.js
wc -c /tmp/s2d-spa.js
for s in \
  "Upload leads" \
  "Start calling this list" \
  "Dial queue" \
  "Leeds" \
  "Hindi" \
  "Sally CSV dial" \
  "Import & queue Sally" \
  "queue-crm" \
  "Open CRM Call Queue"
do
  if grep -F -q "$s" /tmp/s2d-spa.js; then echo "FOUND: $s"; else echo "MISS: $s"; fi
done
echo "Hindi count: $(grep -o Hindi /tmp/s2d-spa.js | wc -l)"
echo "Leeds count: $(grep -o Leeds /tmp/s2d-spa.js | wc -l)"
# confirm route registered on server
ssh vps "grep -n queue-crm /var/www/vhosts/sync2dine.io/sync2dine-backend/server/ai/agent-routes.ts | head -5"
ssh vps "grep -n 'queueCrmCampaign\|LEEDS_CAMPAIGN_ID' /var/www/vhosts/sync2dine.io/sync2dine-backend/server/outbound-campaigns.ts | head -10"
