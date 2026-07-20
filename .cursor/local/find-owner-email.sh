#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
# shellcheck disable=SC1091
set -a
source .env
set +a
python3 - <<'PY'
import os, json, urllib.request
url = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/profiles?id=eq.c202f879-838a-4c4b-9174-5334c7a6ddf4&select=id,email,role,org_id"
req = urllib.request.Request(url, headers={
  "apikey": os.environ["SUPABASE_SERVICE_ROLE_KEY"],
  "Authorization": "Bearer " + os.environ["SUPABASE_SERVICE_ROLE_KEY"],
})
print(urllib.request.urlopen(req).read().decode())
PY
