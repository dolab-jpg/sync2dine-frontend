#!/bin/bash
set -euo pipefail
THEME=/var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child
UPLOADS=/var/www/vhosts/sync2dine.io/httpdocs/wp-content/uploads/sync2dine
STAMP=$(date +%Y%m%d%H%M%S)
OWNER=sync2dine.io_asad090:psacln

# Ensure Judie assets exist (idempotent)
if [ ! -f "$UPLOADS/judie-avatar.png" ]; then
  cp -a "$UPLOADS/lizzie-avatar.png" "$UPLOADS/judie-avatar.png"
  chown "$OWNER" "$UPLOADS/judie-avatar.png"
  chmod 644 "$UPLOADS/judie-avatar.png"
fi
if [ -f "$UPLOADS/lizzie-staff.jpg" ] && [ ! -f "$UPLOADS/judie-staff.jpg" ]; then
  cp -a "$UPLOADS/lizzie-staff.jpg" "$UPLOADS/judie-staff.jpg"
  chown "$OWNER" "$UPLOADS/judie-staff.jpg"
fi

cp -a "$THEME/sync2dine-dual-product.php" "$THEME/sync2dine-dual-product.php.bak-$STAMP"
cp -a "$THEME/page-ai-phone-ordering.php" "$THEME/page-ai-phone-ordering.php.bak-$STAMP"

python3 - <<'PY'
from pathlib import Path

dual = Path("/var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child/sync2dine-dual-product.php")
text = dual.read_text(encoding="utf-8")

helper = """
/**
 * Judie avatar URL (AI Phone & Ordering hero).
 * Prefers judie-avatar.png; falls back to legacy lizzie-avatar.png if needed.
 */
function sync2dine_judie_avatar_url() {
	$rel = 'uploads/sync2dine/judie-avatar.png';
	$abs = trailingslashit( WP_CONTENT_DIR ) . $rel;
	if ( ! file_exists( $abs ) ) {
		$rel = 'uploads/sync2dine/lizzie-avatar.png';
		$abs = trailingslashit( WP_CONTENT_DIR ) . $rel;
	}
	if ( ! file_exists( $abs ) ) {
		return content_url( 'uploads/sync2dine/judie-avatar.png' );
	}
	return set_url_scheme( content_url( $rel ), 'https' );
}

"""

if "function sync2dine_judie_avatar_url" not in text:
    marker = "function sync2dine_brand_wordmark_url()"
    if marker not in text:
        raise SystemExit("brand wordmark function not found")
    idx = text.index(marker)
    rest = text[idx:]
    brace = rest.index("{")
    depth = 0
    end = None
    for i, ch in enumerate(rest[brace:], start=brace):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end is None:
        raise SystemExit("could not find end of brand wordmark function")
    insert_at = idx + end
    text = text[:insert_at] + "\n" + helper + text[insert_at:]

# Support either current topbar block or already-partial state
replacements = [
    (
        """function sync2dine_print_sally_topbar_script() {
	if ( is_admin() ) {
		return;
	}
	$ver = '20260720h';
	echo '<script data-no-optimize=\"1\" data-cfasync=\"false\" src=\"https://app.sync2dine.io/sally-widget.js?v=' . esc_attr( $ver ) . '\" data-api=\"https://app.sync2dine.io\" data-mode=\"topbar\" data-page=\"marketing\" async></script>' . \"\\n\";
}
add_action( 'wp_footer', 'sync2dine_print_sally_topbar_script', 1 );""",
        """function sync2dine_print_sally_widget_script() {
	if ( is_admin() ) {
		return;
	}
	// fab = corner chat; do not use topbar (fights Elementor header/nav).
	$ver = '20260723a';
	echo '<script data-no-optimize=\"1\" data-cfasync=\"false\" src=\"https://app.sync2dine.io/sally-widget.js?v=' . esc_attr( $ver ) . '\" data-api=\"https://app.sync2dine.io\" data-mode=\"fab\" data-page=\"marketing\" async></script>' . \"\\n\";
}
add_action( 'wp_footer', 'sync2dine_print_sally_widget_script', 1 );""",
    ),
]

applied = False
for old, new in replacements:
    if old in text:
        text = text.replace(old, new, 1)
        applied = True
        break

if not applied:
    if "data-mode=\"fab\"" in text and "sync2dine_print_sally_widget_script" in text:
        print("widget already on fab")
    else:
        raise SystemExit("widget embed block not found exactly - abort")

dual.write_text(text, encoding="utf-8")
print("dual-product patched OK")

ai = Path("/var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child/page-ai-phone-ordering.php")
ai_text = ai.read_text(encoding="utf-8")
old_av = """$avatar = function_exists( 'sync2dine_judie_avatar_url' )
	? sync2dine_judie_avatar_url()
	: ( function_exists( 'sync2dine_judie_avatar_url' ) ? sync2dine_judie_avatar_url() : content_url( 'uploads/sync2dine/judie-avatar.png' ) );"""
new_av = """$avatar = function_exists( 'sync2dine_judie_avatar_url' )
	? sync2dine_judie_avatar_url()
	: content_url( 'uploads/sync2dine/judie-avatar.png' );"""
if old_av in ai_text:
    ai.write_text(ai_text.replace(old_av, new_av, 1), encoding="utf-8")
    print("ai template patched OK")
elif new_av in ai_text:
    print("ai template already patched")
else:
    raise SystemExit("avatar block not found - abort")
PY

chown "$OWNER" "$THEME/sync2dine-dual-product.php" "$THEME/page-ai-phone-ordering.php"
echo '=== verify patches ==='
grep -n 'sync2dine_judie_avatar_url\|data-mode\|20260723a\|print_sally' "$THEME/sync2dine-dual-product.php" | head -40
sed -n '10,13p' "$THEME/page-ai-phone-ordering.php"

cd /var/www/vhosts/sync2dine.io/httpdocs
if command -v wp >/dev/null 2>&1; then
  sudo -u sync2dine.io_asad090 wp litespeed-purge all 2>/dev/null || sudo -u sync2dine.io_asad090 wp cache flush 2>/dev/null || true
fi
touch "$THEME/sync2dine-dual-product.php"

curl -sS -o /dev/null -w "judie_asset:%{http_code} size:%{size_download}\n" "https://sync2dine.io/storage-sd/sync2dine/judie-avatar.png"
curl -sS -o /dev/null -w "judie_uploads:%{http_code} size:%{size_download}\n" "https://sync2dine.io/wp-content/uploads/sync2dine/judie-avatar.png"
echo DONE
