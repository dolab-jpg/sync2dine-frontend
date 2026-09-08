#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Safe Sync2Dine marketing theme patch: phone tel mismatch + green hero overflow."""
from pathlib import Path

p = Path(
    "/var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/"
    "hello-elementor-child/sync2dine-dual-product.php"
)
t = p.read_text(encoding="utf-8")

MARKER = "/* S2D_AUDIT_PHONE_HERO_20260723 */"
if MARKER in t:
    print("already patched")
    raise SystemExit(0)

old_css_snip = (
    ".elementor-widget-image img[src*=\"Sync2Dine-15\"],"
    ".elementor-widget-theme-site-logo img,"
    ".custom-logo-link img,"
    ".site-header img.custom-logo{"
    "max-height:48px!important;width:auto!important;height:auto!important;"
    "object-fit:contain!important}\n"
    "body.home .s2d-home-trim{display:none!important}\n"
)
new_css_snip = (
    ".elementor-widget-image img[src*=\"Sync2Dine-15\"],"
    ".elementor-widget-theme-site-logo img,"
    ".custom-logo-link img,"
    ".site-header img.custom-logo{"
    "max-height:48px!important;width:auto!important;height:auto!important;"
    "object-fit:contain!important}\n"
    "body.home .s2d-home-trim{display:none!important}\n"
    "/* Hero mosaic: Elementor parent used solid brand-green gradient taller than images */\n"
    "body.home .elementor-element-undefined-3ec2799{"
    "background-image:none!important;background-color:transparent!important;"
    "min-height:0!important;height:auto!important;align-self:flex-start!important}\n"
    "body.home .elementor-element-undefined-3ec2799 > .e-con-inner,"
    "body.home .elementor-element-b6e2d1c{height:auto!important;min-height:0!important}\n"
)
if old_css_snip not in t:
    raise SystemExit("css snip not found - abort")
t = t.replace(old_css_snip, new_css_snip, 1)

append = """

""" + MARKER + """
/**
 * Canonical UK sales line: 020 3745 3233.
 * Elementor/Yoast still ship legacy 020 3475 0458 in tel: hrefs, footer, and schema.
 * Full-page buffer so header/footer templates are corrected too.
 */
function sync2dine_canonical_phone_replacements() {
	return array(
		'tel:+442034750458' => 'tel:+442037453233',
		'tel:+44-20-3475-0458' => 'tel:+442037453233',
		'tel:+4420 3475 0458' => 'tel:+442037453233',
		'020 3475 0458' => '020 3745 3233',
		'02034750458' => '02037453233',
		'+44-20-3475-0458' => '+44-20-3745-3233',
		'+442034750458' => '+442037453233',
	);
}

function sync2dine_rewrite_legacy_phone( $html ) {
	if ( ! is_string( $html ) || $html === '' ) {
		return $html;
	}
	return strtr( $html, sync2dine_canonical_phone_replacements() );
}

function sync2dine_start_phone_rewrite_buffer() {
	if ( is_admin() || wp_doing_ajax() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
		return;
	}
	ob_start( 'sync2dine_rewrite_legacy_phone' );
}
add_action( 'template_redirect', 'sync2dine_start_phone_rewrite_buffer', 0 );
"""

p.write_text(t.rstrip() + "\n" + append + "\n", encoding="utf-8")
print("patched ok")
print("bytes", p.stat().st_size)
