#!/bin/bash
set -euo pipefail
BE=/var/www/vhosts/sync2dine.io/sync2dine-backend
cd "$BE"

# Ensure platform owner for Sync2Dine staff cards if missing
if ! grep -q '^PLATFORM_OWNER_USER_ID=' .env 2>/dev/null; then
  # Prefer an existing profiles/user hint from env or a stable placeholder staff UUID from mailbox connection
  OWNER=$(python3 - <<'PY'
import json
from pathlib import Path
mb=Path('server/data/mailbox-data.json')
if mb.exists():
    d=json.loads(mb.read_text())
    for c in d.get('connections') or []:
        uid=str(c.get('userId') or '').strip()
        if len(uid)>=8:
            print(uid)
            break
PY
)
  if [ -n "${OWNER:-}" ]; then
    echo "PLATFORM_OWNER_USER_ID=$OWNER" >> .env
    echo "set PLATFORM_OWNER_USER_ID=$OWNER"
  else
    echo "WARN: no PLATFORM_OWNER_USER_ID — CRM activity still primary"
  fi
else
  grep '^PLATFORM_OWNER_USER_ID=' .env | head -1
fi

pkill -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 2
OLD=$(ss -tlnp | grep ':3011' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1 || true)
if [ -n "${OLD:-}" ]; then kill -9 "$OLD" || true; sleep 1; fi

nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import "file://$PWD/node_modules/tsx/dist/loader.mjs" \
  --env-file=.env \
  server/index.ts > /tmp/sync2dine-api.log 2>&1 &
sleep 9
ss -tlnp | grep 3011 || true
curl -sS --max-time 10 http://127.0.0.1:3011/health; echo
grep -n 'auditVapiWebhook\|free-dip\|Shall I sign\|PLATFORM_OWNER' server/vapi-routes.ts server/sally-sales-phone.ts 2>/dev/null | head -20

# Repair stuck ringing Sally calls
/opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import "file://$PWD/node_modules/tsx/dist/loader.mjs" \
  --env-file=.env \
  server/_repair-stuck-sally-calls.mts || true

# Smoke offer terms
/opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import "file://$PWD/node_modules/tsx/dist/loader.mjs" \
  --env-file=.env \
  -e 'import { buildOfferTermsPayload } from "./server/sally-sales-phone.ts"; const o=buildOfferTermsPayload(); console.log(JSON.stringify({ok:o.ok,atm:(o.usps as any)?.atmosphere?.length,demo:o.demoPhone},null,2));'
