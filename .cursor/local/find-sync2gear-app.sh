#!/bin/bash
# Read-only search for Sync2Gear product application source/artefacts
set -uo pipefail

echo "======== A. Candidate directories under /var/www and homes ========"
ls -la /var/www/vhosts/ 2>/dev/null
ls -la /home 2>/dev/null | head -40
ls -la /root 2>/dev/null | head -40

echo ""
echo "======== B. Find package.json mentioning sync2gear / vite react ========"
find /var/www /home /opt /srv /root -name package.json 2>/dev/null | head -200 | while read -r f; do
  if grep -qiE 'sync2gear|sync-2-gear|Sync2Gear' "$f" 2>/dev/null; then
    echo "HIT $f"
    grep -iE 'name|sync2gear|vite|react' "$f" | head -20
  fi
done

echo ""
echo "======== C. Grep login/test-user strings in likely trees ========"
# Limit depth/path to keep runtime sane
SEARCH_ROOTS="/var/www/vhosts /home /opt /srv /root/deploy /root/apps /var/lib/docker"
for root in $SEARCH_ROOTS; do
  [ -d "$root" ] || continue
  echo "-- scanning $root --"
  grep -RIl --include='*.{tsx,ts,jsx,js,vue,html,json,md}' \
    -E 'test user|test@|demo@|password.*(staff|admin)|LoginPage|/login|displayed test' \
    "$root" 2>/dev/null | head -40 || true
done

echo ""
echo "======== D. Git repos containing sync2gear ========"
find /var/www /home /opt /srv /root -type d -name .git 2>/dev/null | while read -r g; do
  repo=$(dirname "$g")
  remote=$(git -C "$repo" remote get-url origin 2>/dev/null || true)
  if echo "$repo $remote" | grep -qiE 'sync2gear|sync-2-gear|gear'; then
    echo "REPO $repo"
    echo "  remote=$remote"
    echo "  branch=$(git -C "$repo" rev-parse --abbrev-ref HEAD 2>/dev/null)"
    echo "  head=$(git -C "$repo" rev-parse --short HEAD 2>/dev/null) $(git -C "$repo" log -1 --oneline 2>/dev/null)"
  fi
done

echo ""
echo "======== E. PM2 / systemd / docker ========"
command -v pm2 >/dev/null && pm2 list 2>/dev/null || echo "no pm2"
systemctl list-units --type=service --all 2>/dev/null | grep -iE 'sync2|gear|base44|node|vite' | head -40 || true
docker ps -a 2>/dev/null | head -30 || echo "no docker or empty"
docker volume ls 2>/dev/null | head -20 || true

echo ""
echo "======== F. Listening ports that look like apps ========"
ss -lntp 2>/dev/null | head -80 || netstat -lntp 2>/dev/null | head -80

echo ""
echo "======== G. sync2gear.io tree sizes + backups ========"
du -sh /var/www/vhosts/sync2gear.io/* 2>/dev/null | sort -h
find /var/www/vhosts/sync2gear.io -maxdepth 3 -type d \( -iname '*app*' -o -iname '*backup*' -o -iname '*dist*' -o -iname '*build*' -o -iname '*flutter*' -o -iname '*react*' \) 2>/dev/null | head -60

echo ""
echo "======== H. Other sync2gear subdomains docroots ========"
for d in ai chat flow n8n pipelines aider ops samples.sync2gear.io; do
  p="/var/www/vhosts/sync2gear.io/$d"
  echo "=== $p ==="
  ls -la "$p" 2>/dev/null | head -15
  find "$p" -maxdepth 3 -name 'index.html' -o -name 'package.json' 2>/dev/null | head -10
done

echo ""
echo "======== I. Search for protected-route / dashboard component names ========"
grep -RIl --include='*.{tsx,ts,jsx,js}' \
  -E 'ProtectedRoute|AuthProvider|useAuth|DashboardLayout|test-users|demoUsers|seedAccounts' \
  /var/www/vhosts /home 2>/dev/null | head -50 || true

echo DONE_A
