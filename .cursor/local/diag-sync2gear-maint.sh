#!/bin/bash
HTTPS=/var/www/vhosts/sync2gear.io/https
cd "$HTTPS"
echo "=== .maintenance content ==="
ls -la .maintenance 2>/dev/null || echo none
cat .maintenance 2>/dev/null || true
echo
echo "=== WP version / db ==="
sudo -u asad090 /usr/local/bin/wp core version --path="$HTTPS" 2>&1
sudo -u asad090 /usr/local/bin/wp core is-installed --path="$HTTPS" 2>&1
echo "=== options related ==="
sudo -u asad090 /usr/local/bin/wp option list --search="*mainten*" --path="$HTTPS" 2>&1 | head -20
sudo -u asad090 /usr/local/bin/wp option get siteurl --path="$HTTPS" 2>&1
sudo -u asad090 /usr/local/bin/wp option get home --path="$HTTPS" 2>&1
echo "=== error logs ==="
tail -40 "$HTTPS/wp-content/debug.log" 2>/dev/null || echo no-debug
ls /var/www/vhosts/system/sync2gear.io/logs/ 2>/dev/null
tail -30 /var/www/vhosts/system/sync2gear.io/logs/error_log 2>/dev/null || true
tail -30 /var/www/vhosts/system/sync2gear.io/logs/proxy_error_log 2>/dev/null || true
echo "=== deactivate maintenance ==="
rm -f .maintenance
sudo -u asad090 /usr/local/bin/wp maintenance-mode deactivate --path="$HTTPS" 2>&1 || true
sleep 1
ls -la .maintenance 2>/dev/null || echo "no .maintenance after deactivate"
echo "=== curl ==="
curl -sSI --max-time 15 https://sync2gear.io/ | tr -d '\r' | head -15
sleep 2
ls -la .maintenance 2>/dev/null || echo "still no .maintenance"
# show body title
curl -sS --max-time 15 https://sync2gear.io/ | tr -d '\r' | sed -n '1,40p'
