#!/bin/bash
set -e
WP=/var/www/vhosts/sync2dine.io/httpdocs
UPLOAD=$WP/wp-content/uploads/sync2dine
ICON=$UPLOAD/brand-icon.svg
WORD=$UPLOAD/brand-wordmark.svg
# Import brand icon into media library and set as custom logo + site icon
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path="$WP" eval '
$icon = WP_CONTENT_DIR . "/uploads/sync2dine/brand-icon.svg";
$word = WP_CONTENT_DIR . "/uploads/sync2dine/brand-wordmark.svg";
if (!file_exists($icon)) { echo "missing icon\n"; return; }
require_once ABSPATH . "wp-admin/includes/file.php";
require_once ABSPATH . "wp-admin/includes/media.php";
require_once ABSPATH . "wp-admin/includes/image.php";
function s2d_sideload($path, $title) {
  $filetype = wp_check_filetype(basename($path), null);
  $upload = wp_upload_bits(basename($path), null, file_get_contents($path));
  if (!empty($upload["error"])) { echo $upload["error"]."\n"; return 0; }
  $attachment = array(
    "post_mime_type" => $filetype["type"] ?: "image/svg+xml",
    "post_title" => $title,
    "post_content" => "",
    "post_status" => "inherit",
  );
  $id = wp_insert_attachment($attachment, $upload["file"]);
  if (is_wp_error($id)) { echo $id->get_error_message()."\n"; return 0; }
  return (int)$id;
}
$icon_id = s2d_sideload($icon, "Sync2Dine icon");
$word_id = file_exists($word) ? s2d_sideload($word, "Sync2Dine wordmark") : 0;
if ($word_id) {
  set_theme_mod("custom_logo", $word_id);
  echo "custom_logo=$word_id\n";
} elseif ($icon_id) {
  set_theme_mod("custom_logo", $icon_id);
  echo "custom_logo=$icon_id\n";
}
if ($icon_id) {
  update_option("site_icon", $icon_id);
  echo "site_icon=$icon_id\n";
}
// Elementor kit site logo if present
$kit = get_option("elementor_active_kit");
if ($kit && $word_id) {
  $settings = get_post_meta($kit, "_elementor_page_settings", true);
  if (!is_array($settings)) $settings = array();
  $settings["site_logo"] = array("url" => wp_get_attachment_url($word_id), "id" => $word_id);
  update_post_meta($kit, "_elementor_page_settings", $settings);
  echo "elementor kit logo updated\n";
}
'
# Stronger CSS: replace Elementor logo imgs that still point at Sync2Dine-15
sudo tee /var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child/sync2dine-logo-fix.css >/dev/null <<'CSS'
.elementor-widget-theme-site-logo img,
.elementor-widget-image img[src*="Sync2Dine-15"],
.custom-logo,
img.custom-logo {
  content: url("/wp-content/uploads/sync2dine/brand-wordmark.svg") !important;
  width: auto !important;
  max-height: 48px !important;
  height: 48px !important;
  object-fit: contain !important;
}
CSS
# Ensure enqueue in dual-product or functions
if ! grep -q 'sync2dine-logo-fix' "$WP/wp-content/themes/hello-elementor-child/functions.php"; then
  sudo tee -a "$WP/wp-content/themes/hello-elementor-child/functions.php" >/dev/null <<'PHP'

add_action('wp_enqueue_scripts', function () {
  wp_enqueue_style('sync2dine-logo-fix', get_stylesheet_directory_uri() . '/sync2dine-logo-fix.css', array(), '20260720b');
}, 60);
PHP
fi
sudo chown sync2dine.io_asad090:psacln "$WP/wp-content/themes/hello-elementor-child/sync2dine-logo-fix.css"
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path="$WP" cache flush
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path="$WP" eval 'if (class_exists("LiteSpeed\Purge")) { \LiteSpeed\Purge::purge_all(); echo "purged\n"; }'
sudo rm -rf "$WP/wp-content/cache/litespeed" 2>/dev/null || true
echo DONE
