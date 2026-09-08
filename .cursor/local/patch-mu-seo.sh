#!/bin/bash
set -euo pipefail
FILE=/var/www/vhosts/sync2dine.io/httpdocs/wp-content/mu-plugins/sync2dine-seo.php
cp -a "$FILE" "${FILE}.bak-$(date +%Y%m%d%H%M%S)"

python3 - <<'PY'
# -*- coding: utf-8 -*-
from pathlib import Path
p = Path("/var/www/vhosts/sync2dine.io/httpdocs/wp-content/mu-plugins/sync2dine-seo.php")
text = p.read_text(encoding="utf-8")

old_phone = "+44-20-3475-0458"
new_phone = "+44-20-3745-3233"
print("phone replaces:", text.count(old_phone))
text = text.replace(old_phone, new_phone)

old_email_line = "$data['email'] = 'info@all1house.com';"
new_email_line = "$data['email'] = 'info@sync2dine.io';"
print("schema email present:", old_email_line in text)
text = text.replace(old_email_line, new_email_line)

text = text.replace("perfect ambiance,", "perfect ambience,")

p.write_text(text, encoding="utf-8")
print("patched ok")
for i, line in enumerate(text.splitlines(), 1):
    if any(k in line for k in ("telephone", "email", "ambiance", "ambience", "all1house")):
        print("%d: %s" % (i, line))
PY

chown sync2dine.io_asad090:psacln "$FILE" 2>/dev/null || true

cd /var/www/vhosts/sync2dine.io/httpdocs
WP=/usr/local/bin/wp
sudo -u sync2dine.io_asad090 $WP cache flush 2>/dev/null || $WP --allow-root cache flush || true
sudo -u sync2dine.io_asad090 $WP litespeed-purge all 2>&1 | tail -8 || true
find wp-content/cache/ls -type f \( -name '*.html' -o -name '*.html.gz' \) -delete 2>/dev/null || true

php -r '
require "wp-load.php";
global $wpdb;
$rows = $wpdb->get_results("SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key=\"_elementor_data\" AND meta_value LIKE \"%Copyrights Reserved%\"");
echo "footer rows: " . count($rows) . "\n";
foreach ($rows as $r) {
  $data = get_post_meta($r->post_id, "_elementor_data", true);
  $new = str_replace(array("All Copyrights Reserved.", "All Copyrights Reserved"), array("All rights reserved.", "All rights reserved"), $data);
  $new = preg_replace("/\xC2\xA9\s*2025/", "\xC2\xA9 2026", $new);
  if ($new !== $data) {
    update_post_meta($r->post_id, "_elementor_data", wp_slash($new));
    delete_post_meta($r->post_id, "_elementor_css");
    echo "updated {$r->post_id}\n";
  }
}
if (class_exists("\\Elementor\\Plugin")) {
  \\Elementor\\Plugin::$instance->files_manager->clear_cache();
}
'

sleep 1
HTML=$(curl -sS -H "Cache-Control: no-cache" -A "s2d-verify" "https://sync2dine.io/?nocache=$(date +%s%N)")
echo "=== schema ==="
echo "$HTML" | grep -oE 'telephone":"[^"]+"' | sort -u
echo "$HTML" | grep -oE '"email":"[^"]+"' | sort -u
echo "=== footer ==="
echo "$HTML" | grep -oE 'Sync2Dine .{0,60}[Rr]eserved\.?' | head -5
echo "old phone count:" $(echo "$HTML" | grep -c '3475-0458' || true)
echo "all1house in HTML count:" $(echo "$HTML" | grep -c 'all1house' || true)
echo DONE
