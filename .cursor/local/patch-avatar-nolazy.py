from pathlib import Path
import re

p = Path("/var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child/page-ai-phone-ordering.php")
t = p.read_text(encoding="utf-8")
if 'data-no-lazy="1"' in t and "s2d-ai-avatar skip-lazy" in t:
    print("already opted out")
    raise SystemExit(0)

pat = r'<img class="s2d-ai-avatar"\s+src="<\?php echo esc_url\( \$avatar \); \?>"[^>]*>'
m = re.search(pat, t)
if not m:
    # looser fallback
    m = re.search(r'<img class="s2d-ai-avatar"[^>]*>', t)
if not m:
    raise SystemExit("img tag not found")

new = (
    '<img class="s2d-ai-avatar skip-lazy" '
    'src="<?php echo esc_url( $avatar ); ?>" '
    'alt="Judie - Sync2Dine AI phone assistant" '
    'width="280" height="280" loading="eager" decoding="async" '
    'data-no-lazy="1" data-skip-lazy="1" />'
)
p.write_text(t[: m.start()] + new + t[m.end() :], encoding="utf-8")
print("lazy opt-out patched")
print("was:", m.group(0)[:140])
