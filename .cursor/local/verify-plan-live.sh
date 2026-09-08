#!/usr/bin/env bash
set -euo pipefail
echo "=== SPA ==="
curl -sS -D /tmp/spa.hdr -o /tmp/spa.html https://app.sync2dine.io/ || true
head -20 /tmp/spa.hdr
echo "spa_bytes=$(wc -c </tmp/spa.html)"
head -c 500 /tmp/spa.html; echo
JS=$(grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' /tmp/spa.html | head -1 || true)
echo "JS=$JS"
if [ -n "${JS:-}" ]; then
  curl -sS "https://app.sync2dine.io/$JS" -o /tmp/s2d.js
  echo "js_bytes=$(wc -c </tmp/s2d.js)"
  grep -c 'platform/ops' /tmp/s2d.js || true
  grep -c 'Ops alerts' /tmp/s2d.js || true
fi

echo "=== VPS contacts + files ==="
ssh vps 'python3 - <<PY
import json
from pathlib import Path
p = Path("/var/www/vhosts/sync2dine.io/sync2dine-backend/server/data")
p.mkdir(parents=True, exist_ok=True)
f = p / "ops-contacts.json"
f.write_text(json.dumps({
  "alertEmail": "dolab@diamondea.co.uk",
  "alertPhone": "",
  "traeWebhookUrl": "",
  "updatedAt": "2026-08-05T19:10:00Z",
  "updatedBy": "plan-verify",
}, indent=2) + "\n")
print(f.read_text())
PY
head -c 400 /var/www/vhosts/sync2dine.io/app.sync2dine.io/index.html; echo
ls -1 /var/www/vhosts/sync2dine.io/app.sync2dine.io/assets/index-*.js | head -3
crontab -l | grep sync2dine-api-health || echo no_cron
ss -tlnp | grep 3011 || echo no_listen
'

echo "=== API ==="
curl -sS https://app.sync2dine.io/health; echo
curl -sS https://app.sync2dine.io/api/vapi/health; echo
curl -sS https://app.sync2dine.io/api/platform/ops-contacts; echo
curl -sS -X PUT https://app.sync2dine.io/api/platform/ops-contacts \
  -H "Content-Type: application/json" \
  -d '{"alertEmail":"dolab@diamondea.co.uk","alertPhone":"","traeWebhookUrl":""}'; echo
curl -sS -X POST https://app.sync2dine.io/api/platform/ops-contacts/test \
  -H "Content-Type: application/json" -d '{}'; echo
echo DONE
