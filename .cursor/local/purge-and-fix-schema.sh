#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/httpdocs
WP=/usr/local/bin/wp

# Run as site owner when possible
if id sync2dine.io_asad090 >/dev/null 2>&1; then
  WP_CMD="sudo -u sync2dine.io_asad090 $WP"
else
  WP_CMD="$WP --allow-root"
fi

echo "=== theme schema filters ==="
grep -RIn '3475\|all1house\|telephone\|org-phone\|yoast.*schema\|wpseo_schema' \
  wp-content/themes/hello-elementor-child/ \
  wp-content/mu-plugins/ 2>/dev/null | head -40 || true

echo "=== yoast indexables org phone ==="
$WP_CMD db query "SHOW TABLES LIKE '%yoast%'" 2>/dev/null || true
$WP_CMD db query "SELECT id, object_type, object_sub_type, title, LEFT(description,80) FROM lYVnVu_yoast_indexable WHERE object_type='home-page' OR permalink='https://sync2dine.io/' LIMIT 5" 2>/dev/null || true
$WP_CMD db query "SELECT id, object_type, permalink FROM lYVnVu_yoast_indexable WHERE description LIKE '%3475%' OR title LIKE '%3475%' LIMIT 10" 2>/dev/null || true

# Check if Organization schema is in indexable meta
$WP_CMD db query "SELECT indexable_id, meta_key, LEFT(meta_value,200) FROM lYVnVu_yoast_indexable_meta WHERE meta_value LIKE '%3475%' OR meta_value LIKE '%all1house%' LIMIT 20" 2>/dev/null || true

echo "=== force update org phone/email via wp option (explicit) ==="
# Read current and show
php -r '
require "wp-load.php";
$t = get_option("wpseo_titles");
echo "before phone=" . ($t["org-phone"] ?? "") . " email=" . ($t["org-email"] ?? "") . "\n";
$t["org-phone"] = "+44-20-3745-3233";
$t["org-email"] = "info@sync2dine.io";
update_option("wpseo_titles", $t);
$t2 = get_option("wpseo_titles");
echo "after phone=" . ($t2["org-phone"] ?? "") . " email=" . ($t2["org-email"] ?? "") . "\n";
'

echo "=== clear yoast cache / indexables if available ==="
$WP_CMD yoast index --reindex 2>&1 | tail -20 || true
$WP_CMD eval 'if (class_exists("WPSEO_Sitemaps_Cache")) { WPSEO_Sitemaps_Cache::clear(); echo "sitemap cache cleared\n"; }' 2>/dev/null || true
$WP_CMD eval 'do_action("wpseo_invalidate_cache"); echo "wpseo invalidate\n";' 2>/dev/null || true

echo "=== litespeed purge ==="
$WP_CMD litespeed-purge all 2>&1 | tail -10 || true
$WP_CMD cache flush 2>&1 || true
# Soft clear page cache files (not rm -rf whole dir)
find wp-content/cache/ls -type f -name '*.html' 2>/dev/null | head -5
find wp-content/cache/ls -type f \( -name '*.html' -o -name '*.html.gz' \) -delete 2>/dev/null || true
echo "deleted ls html cache files"

echo "=== rewrite footer copyright in elementor data ==="
# Footer New = 36695
php -r '
require "wp-load.php";
$post_id = 36695;
$data = get_post_meta($post_id, "_elementor_data", true);
if (!$data) { echo "no elementor data\n"; exit(1); }
$orig = $data;
$repls = [
  "Sync2Dine � 2025. All Copyrights Reserved." => "Sync2Dine � 2026. All rights reserved.",
  "Sync2Dine &copy; 2025. All Copyrights Reserved." => "Sync2Dine � 2026. All rights reserved.",
  "All Copyrights Reserved" => "All rights reserved",
  "� 2025" => "� 2026",
  "&copy; 2025" => "&copy; 2026",
];
foreach ($repls as $a => $b) {
  $data = str_replace($a, $b, $data);
}
# also unicode copyright variants
$data = preg_replace("/Sync2Dine\s*[�\x{00A9}]\s*2025\.\s*All Copyrights Reserved\./u", "Sync2Dine � 2026. All rights reserved.", $data);
if ($data === $orig) {
  echo "footer: no text change (searching samples)\n";
  if (preg_match_all("/.{0,30}[Cc]opyright.{0,40}/u", $orig, $m)) {
    foreach (array_slice($m[0], 0, 10) as $s) echo "  sample: $s\n";
  } else {
    echo "  no Copyright string in elementor JSON\n";
  }
  # dump short text widgets
  $j = json_decode($orig, true);
  $walk = function($nodes) use (&$walk) {
    if (!is_array($nodes)) return;
    foreach ($nodes as $n) {
      if (isset($n["settings"]["editor"])) {
        $e = $n["settings"]["editor"];
        if (stripos($e, "2025") !== false || stripos($e, "opyright") !== false || stripos($e, "Sync2Dine") !== false) {
          echo "  editor: " . substr(strip_tags($e), 0, 120) . "\n";
        }
      }
      if (isset($n["settings"]["title"])) {
        $t = $n["settings"]["title"];
        if (stripos($t, "2025") !== false || stripos($t, "opyright") !== false) {
          echo "  title: " . substr($t, 0, 120) . "\n";
        }
      }
      if (!empty($n["elements"])) $walk($n["elements"]);
    }
  };
  $walk($j);
} else {
  update_post_meta($post_id, "_elementor_data", wp_slash($data));
  // clear elementor css cache
  delete_post_meta($post_id, "_elementor_css");
  if (class_exists("\\Elementor\\Plugin")) {
    \\Elementor\\Plugin::$instance->files_manager->clear_cache();
  }
  echo "footer: updated elementor data\n";
}
'

# Also search ALL elementor library + pages for footer string
php -r '
require "wp-load.php";
global $wpdb;
$rows = $wpdb->get_results("SELECT post_id, meta_id FROM {$wpdb->postmeta} WHERE meta_key=\"_elementor_data\" AND meta_value LIKE \"%Copyrights Reserved%\" LIMIT 20");
echo "elementor rows with Copyrights Reserved: " . count($rows) . "\n";
foreach ($rows as $r) {
  $data = get_post_meta($r->post_id, "_elementor_data", true);
  $new = str_replace(
    ["All Copyrights Reserved.", "All Copyrights Reserved"],
    ["All rights reserved.", "All rights reserved"],
    $data
  );
  $new = preg_replace("/�\s*2025/u", "� 2026", $new);
  if ($new !== $data) {
    update_post_meta($r->post_id, "_elementor_data", wp_slash($new));
    delete_post_meta($r->post_id, "_elementor_css");
    echo "updated post_id={$r->post_id}\n";
  }
}
'

echo "=== purge again ==="
$WP_CMD litespeed-purge all 2>&1 | tail -5 || true
$WP_CMD cache flush 2>&1 || true
find wp-content/cache/ls -type f \( -name '*.html' -o -name '*.html.gz' \) -delete 2>/dev/null || true

sleep 1
echo "=== verify live ==="
HTML=$(curl -sS -H "Cache-Control: no-cache" "https://sync2dine.io/?nocache=$(date +%s%N)")
echo "$HTML" | grep -oE 'telephone":"[^"]+"' | sort -u
echo "$HTML" | grep -oE 'email":"[^"]+"' | sort -u
echo "$HTML" | grep -oE 'Sync2Dine .{0,50}[Rr]eserved' | head -5
echo "DONE"
