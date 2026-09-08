#!/bin/bash
set -euo pipefail

BAK=/var/www/vhosts/sync2gear.io/httpdocs/.bak-mission-20260723145915

echo "======== 1. Pre-mission backup (what httpdocs was before 2026-07-23 14:59) ========"
ls -la "$BAK" | head -40
echo "--- bak index ---"
cat "$BAK/index.html" 2>/dev/null || true
echo ""
echo "--- bak tree ---"
find "$BAK" -maxdepth 3 -type f 2>/dev/null | head -50
echo "--- bak sizes ---"
du -sh "$BAK" 2>/dev/null || true
wc -c "$BAK"/index.html 2>/dev/null || true

echo ""
echo "======== 2. HTTP codes for deep links (prove SPA fallback) ========"
for path in / /login /pricing /dashboard /does-not-exist-xyz; do
  hdr=$(curl -sSI --max-time 15 "https://app.sync2gear.io$path" | tr -d '\r')
  code=$(echo "$hdr" | head -1)
  ctype=$(echo "$hdr" | grep -i '^content-type:' || true)
  clen=$(echo "$hdr" | grep -i '^content-length:' || true)
  echo "PATH=$path => $code | $ctype | $clen"
done

echo ""
echo "======== 3. Body of /login is SPA shell? ========"
curl -sS --max-time 15 "https://app.sync2gear.io/login" | head -30
echo "..."
curl -sS --max-time 15 "https://app.sync2gear.io/login" | grep -E 'root|index-1_y1ouK9|Page Not Found|flutter' | head -10

echo ""
echo "======== 4. Does app.sync2gear.io proxy /api to Base44? ========"
grep -n 'api\|base44' /etc/nginx/plesk.conf.d/vhosts/app.sync2gear.io.conf || echo "NO base44/api in app nginx conf"
echo "--- probe /api on app ---"
curl -sSI --max-time 15 "https://app.sync2gear.io/api/" | tr -d '\r' | head -15
echo "--- probe /api on apex ---"
curl -sSI --max-time 15 "https://sync2gear.io/api/" | tr -d '\r' | head -15

echo ""
echo "======== 5. Base44 hosted app probe ========"
curl -sSI --max-time 15 "https://sync2gear.base44.app/" | tr -d '\r' | head -20
curl -sS --max-time 15 "https://sync2gear.base44.app/" | head -25
curl -sSI --max-time 15 "https://sync2gear.base44.app/login" | tr -d '\r' | head -15

echo ""
echo "======== 6. Who wrote bak-mission / sync evidence ========"
ls -la --time-style=full-iso /var/www/vhosts/sync2gear.io/httpdocs/index.html
ls -la --time-style=full-iso /var/www/vhosts/sync2gear.io/https/index.html
stat /var/www/vhosts/sync2gear.io/httpdocs/index.html
# shell history if any
ls /root/.bash_history /home/asad090/.bash_history 2>/dev/null | head
grep -n 'bak-mission\|httpdocs\|sync2gear' /root/.bash_history 2>/dev/null | tail -30 || true

echo ""
echo "======== 7. agent transcript mention of sync httpdocs ========"
# local only - skip

echo ""
echo "======== 8. Route list from JS (python) ========"
python3 - <<'PY'
import re
from pathlib import Path
js = Path('/var/www/vhosts/sync2gear.io/httpdocs/assets/index-1_y1ouK9.js').read_text(errors='ignore')
# react-router style path: "..."
paths = sorted(set(re.findall(r'path:"([^"]+)"', js)))
print('path:"..." count', len(paths))
for p in paths[:80]:
    print(' ', p)
# also createBrowserRouter objects
paths2 = sorted(set(re.findall(r'\{path:"([^"]+)"', js)))
print('object paths', paths2)
# Login occurrences context
for m in re.finditer(r'.{0,50}Login.{0,50}', js):
    s=m.group(0).replace('\n',' ')
    if 'Page Not Found' in s: continue
    print('Login ctx:', s[:140])
PY

echo DONE
