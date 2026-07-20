#!/usr/bin/env python3
from pathlib import Path

p = Path(
    "/var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child/sync2dine-dual-product.php"
)
text = p.read_text()

old_photo = """function sync2dine_judie_avatar_url() {
	$staff = WP_CONTENT_DIR . '/uploads/sync2dine/lizzie-staff.jpg';
	if ( file_exists( $staff ) ) {
		return content_url( 'uploads/sync2dine/lizzie-staff.jpg' );
	}
	return content_url( 'uploads/sync2dine/lizzie-avatar.png' );
}"""

new_photo = """function sync2dine_judie_avatar_url() {
	// Prefer avatar (safe crop) over staff portrait for marketing band.
	$avatar = WP_CONTENT_DIR . '/uploads/sync2dine/lizzie-avatar.png';
	if ( file_exists( $avatar ) ) {
		return content_url( 'uploads/sync2dine/lizzie-avatar.png' );
	}
	$staff = WP_CONTENT_DIR . '/uploads/sync2dine/lizzie-staff.jpg';
	if ( file_exists( $staff ) ) {
		return content_url( 'uploads/sync2dine/lizzie-staff.jpg' );
	}
	return content_url( 'uploads/sync2dine/lizzie-avatar.png' );
}"""

if old_photo in text:
    text = text.replace(old_photo, new_photo)
    print("avatar preference updated")
else:
    print("avatar block not matched")

old_css = (
    ".s2d-dual-photo{margin:0;border-radius:16px;overflow:hidden;border:2px solid #e8c26a;"
    "background:#0a2a2b;max-width:280px;aspect-ratio:687/1024;min-height:240px;width:100%}\n"
    ".s2d-dual-photo img{width:100%;height:auto;max-height:360px;object-fit:cover;"
    "object-position:center top;display:block}"
)
new_css = (
    ".s2d-dual-photo{margin:0;border-radius:16px;overflow:hidden;border:2px solid #e8c26a;"
    "background:#0a2a2b;max-width:220px;aspect-ratio:3/4;min-height:200px;width:100%}\n"
    ".s2d-dual-photo img{width:100%;height:100%;object-fit:cover;"
    "object-position:center 18%;display:block}"
)
if old_css in text:
    text = text.replace(old_css, new_css)
    print("photo css updated")
else:
    print("photo css not matched")

old_js = """document.addEventListener('DOMContentLoaded', function () {
  var bandHtml = {$band};
  var root = document.querySelector('.elementor') || document.querySelector('#content') || document.body;
  var first = root.querySelector('.e-con-full, .elementor-top-section, .e-con');
  var wrap = document.createElement('div');
  wrap.innerHTML = bandHtml;
  var band = wrap.firstElementChild;
  if (first && first.parentNode) {
    first.parentNode.insertBefore(band, first.nextSibling);
  } else {
    root.insertBefore(band, root.firstChild);
  }
});"""

new_js = """document.addEventListener('DOMContentLoaded', function () {
  var bandHtml = {$band};
  // Never inject into Elementor header/footer — that collapses site chrome.
  var root = document.querySelector('.elementor[data-elementor-type=\"wp-page\"]')
    || document.querySelector('main .elementor')
    || document.querySelector('#content .elementor')
    || document.querySelector('.elementor-location-single')
    || document.querySelector('#content')
    || document.body;
  var first = root.querySelector('.elementor-element.e-con-parent, .elementor-top-section, .e-con-full.e-con-parent, .e-con');
  var wrap = document.createElement('div');
  wrap.innerHTML = bandHtml;
  var band = wrap.firstElementChild;
  if (!band) return;
  if (first && first.parentNode) {
    first.parentNode.insertBefore(band, first);
  } else {
    root.insertBefore(band, root.firstChild);
  }
});"""

if old_js in text:
    text = text.replace(old_js, new_js)
    print("js inject fixed")
else:
    print("js block not matched")
    idx = text.find("var root = document.querySelector('.elementor')")
    print("idx", idx)
    if idx > 0:
        print(repr(text[idx - 100 : idx + 280]))

p.write_text(text)
print("written ok")
