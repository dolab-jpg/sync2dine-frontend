#!/bin/bash
set -euo pipefail
python3 <<'PY'
import re
from pathlib import Path
js = Path('/var/www/vhosts/sync2gear.io/httpdocs/assets/index-1_y1ouK9.js').read_text(errors='ignore')
paths = sorted(set(re.findall(r'path:"([^"]+)"', js)))
print('ALL path: literals (%d):' % len(paths))
for p in paths:
    print(' ', p)
print('BrowserRouter', js.count('BrowserRouter'), 'createBrowserRouter', js.count('createBrowserRouter'), 'flutter', js.count('flutter'))
print('Login count', js.count('Login'))
for m in re.finditer(r'.{0,50}Login.{0,50}', js):
    print('CTX', m.group(0).replace('\n',' ')[:150])
PY

echo "=== base44 home headers ==="
curl -sSI --max-time 20 https://sync2gear.base44.app/ | tr -d '\r' | head -25
echo "=== base44 home body head ==="
curl -sS --max-time 20 https://sync2gear.base44.app/ | head -35
echo "=== base44 /login ==="
curl -sSI --max-time 20 https://sync2gear.base44.app/login | tr -d '\r' | head -20
echo "=== app /api ==="
curl -sSI --max-time 15 https://app.sync2gear.io/api/ | tr -d '\r' | head -20
echo "=== apex /api ==="
curl -sSI --max-time 15 https://sync2gear.io/api/ | tr -d '\r' | head -20
echo "=== cloudflare? ==="
curl -sSI --max-time 15 https://app.sync2gear.io/ | tr -d '\r' | grep -iE 'cf-|cloudflare|x-cache|via:' || echo 'no Cloudflare/via cache headers'
echo "=== md5 parity app vs apex ==="
md5sum /var/www/vhosts/sync2gear.io/httpdocs/index.html /var/www/vhosts/sync2gear.io/https/index.html
md5sum /var/www/vhosts/sync2gear.io/httpdocs/assets/index-1_y1ouK9.js /var/www/vhosts/sync2gear.io/https/assets/index-1_y1ouK9.js
echo DONE
