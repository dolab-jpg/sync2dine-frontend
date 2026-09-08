#!/bin/bash
set -uo pipefail
echo "== no-key health now =="
curl -sS -m 6 -w "\nHTTP:%{http_code} TIME:%{time_total}\n" \
  https://olpbvumayxxxqmsbfuua.supabase.co/auth/v1/health || echo fail:$?
echo "== api login (no password printed) =="
curl -sS -m 8 -o /tmp/s2d-api-login.txt -w "HTTP:%{http_code} TIME:%{time_total} BYTES:%{size_download}\n" \
  -X POST https://app.sync2dine.io/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@sync2dine.io","password":"x"}'
python -c "import json; d=json.load(open('/tmp/s2d-api-login.txt')); print({k:d.get(k) for k in d if k!='token'})" 2>/dev/null || head -c 200 /tmp/s2d-api-login.txt; echo
