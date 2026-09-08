#!/bin/bash
set -uo pipefail

echo "======== 1. Base44 bak: login / routes / test users ========"
JS=/var/www/vhosts/sync2gear.io/https-base44-bak/assets/index-C_t0Bufv.js
if [ -f "$JS" ]; then
  python3 - <<PY
import re
from pathlib import Path
js = Path("$JS").read_text(errors="ignore")
print("size", len(js))
for n in ["/login","Login","password","demo@","test@","Dashboard","ProtectedRoute","stripe","Orders","analytics","admin"]:
    print(n, js.count(n))
paths = sorted(set(re.findall(r'path:"([^"]+)"', js)))
print("paths", paths)
# emails
emails = sorted(set(re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', js)))
print("emails sample", emails[:40])
# password-looking nearby demo
for m in re.finditer(r'.{0,40}(password|Password|demo@|test@).{0,60}', js):
    s=m.group(0)
    if "type===\"password\"" in s or "type==\"password\"" in s: continue
    print("CTX", s[:140])
    if sum(1 for _ in re.finditer(r'(password|demo@|test@)', js))>30: break
PY
fi

echo ""
echo "======== 2. All JS backups in httpdocs/https assets ========"
ls -la --time-style=full-iso /var/www/vhosts/sync2gear.io/httpdocs/assets/ | head -40
for f in /var/www/vhosts/sync2gear.io/httpdocs/assets/index-*.js; do
  [ -f "$f" ] || continue
  login=$(grep -c '/login' "$f" 2>/dev/null || echo 0)
  demo=$(grep -cE 'demo@|test@|Test User|password:' "$f" 2>/dev/null || echo 0)
  echo "FILE $(basename "$f") login_count=$login demoish=$demo size=$(wc -c <"$f")"
done

echo ""
echo "======== 3. wordpress-backups listing (names only) ========"
ls -la /var/www/vhosts/sync2gear.io/wordpress-backups/ | head -40
find /var/www/vhosts/sync2gear.io/wordpress-backups -maxdepth 3 -type d 2>/dev/null | head -40

echo ""
echo "======== 4. Search entire sync2gear vhost for LoginPage / demo credentials ========"
grep -RIn --include='*.js' --include='*.html' --include='*.json' --include='*.tsx' --include='*.ts' \
  -E 'LoginPage|demo@|test@sync|Test Password|seedAccounts|test users|navigateToLogin' \
  /var/www/vhosts/sync2gear.io 2>/dev/null | head -40 || true

echo ""
echo "======== 5. Search sync2dine vhost for sync2gear app source ========"
find /var/www/vhosts/sync2dine.io -maxdepth 4 -iname '*sync2gear*' 2>/dev/null | head -40
grep -RIl --include='package.json' -i 'sync2gear' /var/www/vhosts/sync2dine.io 2>/dev/null | head -20 || true

echo ""
echo "======== 6. asad090 home / trash ========"
ls -la /var/www/vhosts/sync2gear.io/.trash 2>/dev/null | head -30
find /var/www/vhosts/sync2gear.io/.trash -maxdepth 3 2>/dev/null | head -40
getent passwd asad090
ls -la ~asad090 2>/dev/null | head -40 || ls -la /var/www/vhosts/sync2gear.io/ | head -5

echo ""
echo "======== 7. bash history deploy clues ========"
grep -iE 'sync2gear|httpdocs|base44|rsync|scp|vite|npm run build' /root/.bash_history 2>/dev/null | tail -60 || true
grep -iE 'sync2gear|httpdocs|base44|rsync' /var/www/vhosts/sync2gear.io/logs/* 2>/dev/null | head -5 || true

echo ""
echo "======== 8. Plesk backups / archives mentioning gear ========"
find /var/lib/psa/dumps /usr/local/psa/PMM /var/www/vhosts/sync2gear.io -iname '*gear*' 2>/dev/null | head -40
ls /var/lib/psa/dumps 2>/dev/null | head -20

echo ""
echo "======== 9. Current live JS: auth stubs + admin-chat/analytics ========"
python3 - <<'PY'
import re
from pathlib import Path
js = Path('/var/www/vhosts/sync2gear.io/httpdocs/assets/index-1_y1ouK9.js').read_text(errors='ignore')
for n in ['navigateToLogin','checkUserAuth','authChecked','admin-chat','analytics','stripe','Orders','Dashboard','Protected']:
    print(n, js.count(n))
# extract AuthProvider-ish
for m in re.finditer(r'.{0,80}navigateToLogin.{0,120}', js):
    print('NAV', m.group(0)[:200])
    break
for m in re.finditer(r'.{0,40}admin-chat.{0,80}', js):
    print('ADMIN', m.group(0)[:160]); break
for m in re.finditer(r'.{0,40}/analytics.{0,80}', js):
    print('ANAL', m.group(0)[:160]); break
PY

echo ""
echo "======== 10. samples subdomain ========"
ls -laR /var/www/vhosts/sync2gear.io/samples.sync2gear.io/httpdocs 2>/dev/null | head -40
head -40 /var/www/vhosts/sync2gear.io/samples.sync2gear.io/httpdocs/index.html 2>/dev/null

echo DONE_B
