#!/bin/bash
set -euo pipefail
export PATH=/usr/local/bin:/usr/bin:/bin:$PATH
WP=/var/www/vhosts/sync2dine.io/httpdocs
CHILD=$WP/wp-content/themes/hello-elementor-child

# Sizing only — no content:url (avoids nuking images). Src swap is in PHP filters.
sudo tee "$CHILD/sync2dine-logo-fix.css" >/dev/null <<'CSS'
/* Sync2Dine header wordmark sizing only; light SVG src swapped in functions.php */
#logo-header img,
.elementor-location-header .elementor-widget-image img[src*="brand-wordmark"],
.elementor-location-header .elementor-widget-theme-site-logo img,
.custom-logo-link img,
img.custom-logo {
  max-height: 48px !important;
  width: auto !important;
  height: auto !important;
  object-fit: contain !important;
}
CSS

# Patch functions.php once with light-on-dark wordmark swaps
python3 <<'PY'
from pathlib import Path
fp = Path("/var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child/functions.php")
text = fp.read_text()
marker = "/* S2D_LIGHT_WORDMARK_FILTER */"
block = r'''

/* S2D_LIGHT_WORDMARK_FILTER */
add_filter('wp_get_attachment_image_src', function ($image, $attachment_id) {
  if (! is_array($image)) {
    return $image;
  }
  if ((int) $attachment_id !== 34848 && (int) $attachment_id !== 37534) {
    return $image;
  }
  $path = WP_CONTENT_DIR . '/uploads/sync2dine/brand-wordmark-dark.svg';
  if (! file_exists($path)) {
    return $image;
  }
  $image[0] = set_url_scheme(content_url('uploads/sync2dine/brand-wordmark-dark.svg'), 'https');
  $image[1] = 220;
  $image[2] = 40;
  return $image;
}, 20, 2);

add_filter('wp_calculate_image_srcset', function ($sources, $size_array, $image_src, $image_meta, $attachment_id) {
  if ((int) $attachment_id !== 34848 && (int) $attachment_id !== 37534) {
    return $sources;
  }
  $url = set_url_scheme(content_url('uploads/sync2dine/brand-wordmark-dark.svg'), 'https');
  return array(
    220 => array(
      'url' => $url,
      'descriptor' => 'w',
      'value' => 220,
    ),
  );
}, 20, 5);

add_action('elementor/frontend/the_content', function ($content) {
  $to = set_url_scheme(content_url('uploads/sync2dine/brand-wordmark-dark.svg'), 'https');
  $from = array(
    'https://sync2dine.io/storage-sd/2026/07/brand-wordmark-600.png',
    'https://sync2dine.io/wp-content/uploads/2026/07/brand-wordmark-600.png',
    'https://sync2dine.io/storage-sd/sync2dine/brand-wordmark-600.png',
    'https://sync2dine.io/wp-content/uploads/sync2dine/brand-wordmark-600.png',
    'https://sync2dine.io/storage-sd/2026/07/brand-wordmark-600-300x55.png',
    'https://sync2dine.io/storage-sd/2026/07/brand-wordmark-600-150x109.png',
  );
  return str_replace($from, $to, $content);
}, 30);
'''
if marker not in text:
    fp.write_text(text + block)
    print('functions.php patched')
else:
    print('functions.php already patched')
PY

# Bump logo CSS version if present
sudo sed -i "s/'20260720[a-z]'/'20260720e'/g" "$CHILD/functions.php" || true

# Fix LCP preload in performance MU to light wordmark
if grep -q 'brand-wordmark-600.png' "$WP/wp-content/mu-plugins/sync2dine-performance.php"; then
  sudo sed -i 's#uploads/sync2dine/brand-wordmark-600.png#uploads/sync2dine/brand-wordmark-dark.svg#g' \
    "$WP/wp-content/mu-plugins/sync2dine-performance.php"
  echo 'performance preload updated'
fi

sudo chown sync2dine.io_asad090:psacln "$CHILD/sync2dine-logo-fix.css" "$CHILD/functions.php"
php -l "$CHILD/functions.php"
php -l "$CHILD/sync2dine-dual-product.php"
php -l "$WP/wp-content/mu-plugins/sync2dine-performance.php"

# Keep Elementor optimized CSS loading OFF (missing generated files caused layout collapse)
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path="$WP" option update elementor_experiment-e_optimized_css_loading inactive
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path="$WP" cache flush

# Purge LiteSpeed via small PHP file
cat > /tmp/s2d-purge-litespeed.php <<'PHP'
<?php
if (class_exists('LiteSpeed\\Purge')) {
  \LiteSpeed\Purge::purge_all();
  echo "litespeed purged\n";
} else {
  echo "no litespeed class\n";
}
PHP
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path="$WP" eval-file /tmp/s2d-purge-litespeed.php || true
sudo rm -rf "$WP/wp-content/cache/litespeed" 2>/dev/null || true

echo DONE
