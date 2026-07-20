#!/bin/bash
set -e
WP=/var/www/vhosts/sync2dine.io/httpdocs
SRC=$WP/wp-content/uploads/sync2dine/brand-icon.svg
WORD=$WP/wp-content/uploads/sync2dine/brand-wordmark.svg
OUTDIR=$WP/wp-content/uploads/sync2dine
# Rasterize icons
convert -background none -density 300 "$SRC" -resize 512x512 "$OUTDIR/brand-icon-512.png"
convert -background none -density 300 "$SRC" -resize 180x180 "$OUTDIR/brand-icon-180.png"
convert -background none -density 300 "$WORD" -resize 600x180 "$OUTDIR/brand-wordmark-600.png"
# Overwrite the old Sync2Dine-15 variants used by Elementor header/footer
OLDDIR=$WP/wp-content/uploads/2023/08
if [ -f "$OLDDIR/Sync2Dine-15.png" ]; then
  convert -background none -density 300 "$WORD" -resize 650x225 "$OLDDIR/Sync2Dine-15.png"
  convert -background none -density 300 "$WORD" -resize 600x180 "$OLDDIR/Sync2Dine-15-600x180.png"
  convert -background none -density 300 "$WORD" -resize 410x123 "$OLDDIR/Sync2Dine-15-410x123.png"
  convert -background none -density 300 "$WORD" -resize 370x111 "$OLDDIR/Sync2Dine-15-370x111.png"
  convert -background none -density 300 "$WORD" -resize 300x90 "$OLDDIR/Sync2Dine-15-300x90.png"
  convert -background none -density 300 "$SRC" -resize 150x150 "$OLDDIR/Sync2Dine-15-150x150.png"
  convert -background none -density 300 "$SRC" -resize 120x120 "$OLDDIR/Sync2Dine-15-120x120.png"
  echo "overwrote Sync2Dine-15 assets"
fi
# Site icon option via PNG
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path="$WP" eval '
$path = WP_CONTENT_DIR . "/uploads/sync2dine/brand-icon-512.png";
$upload = wp_upload_bits("brand-icon-512.png", null, file_get_contents($path));
if (!empty($upload["error"])) { echo $upload["error"]."\n"; return; }
$att = array("post_mime_type"=>"image/png","post_title"=>"Sync2Dine icon","post_status"=>"inherit");
$id = wp_insert_attachment($att, $upload["file"]);
if (!is_wp_error($id)) {
  require_once ABSPATH . "wp-admin/includes/image.php";
  wp_update_attachment_metadata($id, wp_generate_attachment_metadata($id, $upload["file"]));
  update_option("site_icon", $id);
  echo "site_icon=$id\n";
}
$wpath = WP_CONTENT_DIR . "/uploads/sync2dine/brand-wordmark-600.png";
$wupload = wp_upload_bits("brand-wordmark-600.png", null, file_get_contents($wpath));
if (empty($wupload["error"])) {
  $wid = wp_insert_attachment(array("post_mime_type"=>"image/png","post_title"=>"Sync2Dine wordmark","post_status"=>"inherit"), $wupload["file"]);
  if (!is_wp_error($wid)) {
    require_once ABSPATH . "wp-admin/includes/image.php";
    wp_update_attachment_metadata($wid, wp_generate_attachment_metadata($wid, $wupload["file"]));
    set_theme_mod("custom_logo", $wid);
    echo "custom_logo=$wid\n";
  }
}
'
# Ensure logo CSS is enqueued (fix broken append)
php -l "$WP/wp-content/themes/hello-elementor-child/functions.php"
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path="$WP" cache flush
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path="$WP" eval 'if (class_exists("LiteSpeed\Purge")) { \LiteSpeed\Purge::purge_all(); }'
sudo rm -rf "$WP/wp-content/cache/litespeed" 2>/dev/null || true
chown -R sync2dine.io_asad090:psacln "$OUTDIR" "$OLDDIR"/Sync2Dine-15*.png 2>/dev/null || true
restorecon -Rv "$OUTDIR" "$OLDDIR" >/dev/null 2>&1 || true
curl -sL "https://sync2dine.io/?logo=2" | grep -oE 'sync2dine-logo-fix|brand-wordmark|brand-icon' | sort | uniq -c | head
echo OK
