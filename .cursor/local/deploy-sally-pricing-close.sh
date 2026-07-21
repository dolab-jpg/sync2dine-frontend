#!/bin/bash
set -euo pipefail
BE=/var/www/vhosts/sync2dine.io/sync2dine-backend
cd "$BE"

python3 <<'PY'
import json
from pathlib import Path
p = Path("server/data/sally-offer.json")
data = json.loads(p.read_text()) if p.exists() else {}
before = data.get("demoPhone")
if not str(before or "").strip():
    data["demoPhone"] = "02080505029"
    p.write_text(json.dumps(data, indent=2) + "\n")
    print("set demoPhone=02080505029")
else:
    print("demoPhone already", before)
PY

if ! grep -q '^SALLY_DEMO_PHONE=' .env 2>/dev/null; then
  echo 'SALLY_DEMO_PHONE=02080505029' >> .env
  echo appended SALLY_DEMO_PHONE
else
  grep '^SALLY_DEMO_PHONE=' .env
fi

OLD=$(ss -tlnp | grep ':3011' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)
echo "old_pid=${OLD:-none}"
if [ -n "${OLD:-}" ]; then
  kill -9 "$OLD" || true
  sleep 2
fi
pkill -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 1
nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import "file://$PWD/node_modules/tsx/dist/loader.mjs" \
  --env-file=.env \
  server/index.ts > /tmp/sync2dine-api.log 2>&1 &
sleep 8
NEW=$(ss -tlnp | grep ':3011' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)
echo "new_pid=${NEW:-none}"
tail -40 /tmp/sync2dine-api.log
echo '---'
curl -sS --max-time 10 https://app.sync2dine.io/health; echo
grep -n 'sendSalesFollowUp\|spokenDemoPhone\|Shall I sign' server/sally-sales-phone.ts | head -15
/opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import "file://$PWD/node_modules/tsx/dist/loader.mjs" \
  -e 'import { buildOfferTermsPayload, resolveCallbackIso } from "./server/sally-sales-phone.ts"; const o=buildOfferTermsPayload(); console.log(JSON.stringify({ok:o.ok,n:(o.packages||[]).length,demo:o.demoPhone,spoken:o.spokenDemoPhone,iso:resolveCallbackIso("tomorrow 4pm")}));'
