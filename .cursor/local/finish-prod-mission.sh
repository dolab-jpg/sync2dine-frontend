#!/bin/bash
set -euo pipefail

echo "======== 1) Sync2Gear: app.sync2gear.io docroot sync ========"
# app.sync2gear.io -> httpdocs (stale 1091-byte SPA, /login 404)
# apex sync2gear.io -> https (current marketing site)
SRC=/var/www/vhosts/sync2gear.io/https
DST=/var/www/vhosts/sync2gear.io/httpdocs
STAMP=$(date +%Y%m%d%H%M%S)
mkdir -p "$DST/.bak-mission-$STAMP"
cp -a "$DST/index.html" "$DST/.bak-mission-$STAMP/" 2>/dev/null || true
# Sync marketing SPA assets into app subdomain docroot (keep logo/hero if present)
rsync -a --delete \
  --exclude '.bak-*' \
  --exclude '.well-known' \
  --exclude 'error_docs' \
  "$SRC/" "$DST/"
# Ensure SPA fallback for client routes
if [ ! -f "$DST/.htaccess" ]; then
  cat > "$DST/.htaccess" <<'HT'
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
HT
fi
chown -R asad090:psacln "$DST"
echo "httpdocs index bytes: $(wc -c < "$DST/index.html")"

echo "======== 2) Sync2Dine: phone tel/schema fix via WP-CLI ========"
cd /var/www/vhosts/sync2dine.io/httpdocs
# Count wrong phones before
sudo -u sync2dine.io_asad090 wp db query "SELECT COUNT(*) AS wrong_tel FROM wp_posts WHERE post_content LIKE '%442034750458%' OR post_content LIKE '%020 3475 0458%' OR post_content LIKE '%02034750458%';" 2>/dev/null || true

# Safe search-replace across content + postmeta (Elementor + Yoast)
sudo -u sync2dine.io_asad090 wp search-replace 'tel:+442034750458' 'tel:+442037453233' --all-tables --precise --recurse-objects --report-changed-only 2>/dev/null || true
sudo -u sync2dine.io_asad090 wp search-replace 'tel:+44-20-3475-0458' 'tel:+442037453233' --all-tables --precise --recurse-objects --report-changed-only 2>/dev/null || true
sudo -u sync2dine.io_asad090 wp search-replace '020 3475 0458' '020 3745 3233' --all-tables --precise --recurse-objects --report-changed-only 2>/dev/null || true
sudo -u sync2dine.io_asad090 wp search-replace '02034750458' '02037453233' --all-tables --precise --recurse-objects --report-changed-only 2>/dev/null || true
sudo -u sync2dine.io_asad090 wp search-replace '+44-20-3475-0458' '+44-20-3745-3233' --all-tables --precise --recurse-objects --report-changed-only 2>/dev/null || true

# Copy typos (common Elementor strings)
sudo -u sync2dine.io_asad090 wp search-replace 'Restaurents' 'Restaurants' --all-tables --precise --recurse-objects --report-changed-only 2>/dev/null || true
sudo -u sync2dine.io_asad090 wp search-replace "Sync2DIne's" "Sync2Dine's" --all-tables --precise --recurse-objects --report-changed-only 2>/dev/null || true
sudo -u sync2dine.io_asad090 wp search-replace "Spa's & Wellness" 'Spas & Wellness' --all-tables --precise --recurse-objects --report-changed-only 2>/dev/null || true
sudo -u sync2dine.io_asad090 wp search-replace 'AMBIANCE' 'AMBIENCE' --all-tables --precise --recurse-objects --report-changed-only 2>/dev/null || true
sudo -u sync2dine.io_asad090 wp search-replace 'Sync2Dine � 2025' 'Sync2Dine � 2026' --all-tables --precise --recurse-objects --report-changed-only 2>/dev/null || true

echo "======== 3) Hero green band CSS (theme, non-destructive) ========"
THEME=/var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child
cp -a "$THEME/sync2dine-dual-product.php" "$THEME/sync2dine-dual-product.php.bak-mission-$STAMP"
python3 - <<'PY'
from pathlib import Path
p = Path("/var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child/sync2dine-dual-product.php")
t = p.read_text(encoding="utf-8")
css_snip = """
/* Mission: stop oversized green mosaic overflow on homepage hero */
body.home .elementor-element-3ec2799,
body.home [data-id=\"3ec2799\"]{
  min-height:0!important;height:auto!important;align-self:start!important;
  background-color:transparent!important;background-image:none!important;
}
"""
if "elementor-element-3ec2799" not in t:
    # inject into dual product CSS function if present
    marker = "body.home .s2d-home-trim{display:none!important}"
    if marker in t:
        t = t.replace(marker, marker + css_snip)
        p.write_text(t, encoding="utf-8")
        print("hero CSS injected")
    else:
        # append via wp_head style
        append = """
add_action('wp_head', function () {
	if (!is_front_page()) return;
	echo '<style data-no-optimize=\"1\">body.home .elementor-element-3ec2799,body.home [data-id=\"3ec2799\"]{min-height:0!important;height:auto!important;align-self:start!important;background-color:transparent!important;background-image:none!important;}</style>';
}, 99);
"""
        if "elementor-element-3ec2799" not in t:
            p.write_text(t.rstrip() + "\n" + append + "\n", encoding="utf-8")
            print("hero CSS appended via wp_head")
else:
    print("hero CSS already present")
PY
chown sync2dine.io_asad090:psacln "$THEME/sync2dine-dual-product.php"

echo "======== 4) LiteSpeed-safe cache purge ========"
cd /var/www/vhosts/sync2dine.io/httpdocs
# Do NOT rm -rf cache dirs; use WP-CLI
sudo -u sync2dine.io_asad090 wp cache flush 2>/dev/null || true
sudo -u sync2dine.io_asad090 wp litespeed-purge all 2>/dev/null || true
# Ensure ls cache dirs exist with correct owner
mkdir -p wp-content/cache/ls/css wp-content/cache/ls/js
chown -R sync2dine.io_asad090:psacln wp-content/cache 2>/dev/null || true

echo "======== 5) Verify ========"
curl -sS -o /dev/null -w "s2g_app:%{http_code} bytes:%{size_download}\n" "https://app.sync2gear.io/"
curl -sS -o /dev/null -w "s2g_login:%{http_code} bytes:%{size_download}\n" "https://app.sync2gear.io/login"
curl -sS -o /dev/null -w "s2g_apex:%{http_code} bytes:%{size_download}\n" "https://sync2gear.io/"
curl -sS -o /dev/null -w "s2d_home:%{http_code}\n" "https://sync2dine.io/"
curl -sS "https://sync2dine.io/" | grep -c 'tel:+442034750458' || true
curl -sS "https://sync2dine.io/" | grep -c 'tel:+442037453233' || true
curl -sS "https://sync2dine.io/contact/" | grep -oE 'tel:\+[0-9]+' | sort | uniq -c
echo DONE
