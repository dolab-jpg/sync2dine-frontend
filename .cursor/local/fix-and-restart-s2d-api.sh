#!/bin/bash
set -euo pipefail
BE=/var/www/vhosts/sync2dine.io/sync2dine-backend
cd "$BE"

# Ensure getDemoKitchenOrgId alias exists for call-recording-store
if ! grep -q 'getDemoKitchenOrgId' server/home-org.ts; then
  python3 <<'PY'
from pathlib import Path
p = Path('server/home-org.ts')
text = p.read_text()
needle = """export function getHomeOrgId(): string {
  const fromEnv = (process.env.HOME_ORG_ID || process.env.BDIDDIES_HOME_ORG_ID || '').trim();
  if (isOrgUuid(fromEnv)) return fromEnv;
  return FALLBACK_HOME_ORG_UUID;
}"""
insert = needle + """

/** Alias used by call-recording / kitchen demo paths. */
export function getDemoKitchenOrgId(): string {
  return getHomeOrgId();
}"""
if needle not in text:
    raise SystemExit('home-org pattern not found')
p.write_text(text.replace(needle, insert, 1))
print('patched home-org getDemoKitchenOrgId')
PY
else
  echo 'getDemoKitchenOrgId already present'
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
sleep 10
ss -tlnp | grep 3011 || true
tail -30 /tmp/sync2dine-api.log
echo '---'
curl -sS --max-time 10 http://127.0.0.1:3011/health; echo
curl -sS --max-time 10 https://app.sync2dine.io/health; echo
grep -n 'sendSalesFollowUp\|spokenDemoPhone\|Shall I sign' server/sally-sales-phone.ts | head -12
