<?php
/**
 * Sync2Dine site helpers — keep Elementor design; one clean pricing strip; legal; Sally chat.
 * Do not inject competing “sales bands” into the homepage hero flow.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function sync2dine_brand_wordmark_url() {
	$path = WP_CONTENT_DIR . '/uploads/sync2dine/brand-wordmark-600.png';
	if ( file_exists( $path ) ) {
		return content_url( 'uploads/sync2dine/brand-wordmark-600.png' );
	}
	$svg = WP_CONTENT_DIR . '/uploads/sync2dine/brand-wordmark.svg';
	if ( file_exists( $svg ) ) {
		return content_url( 'uploads/sync2dine/brand-wordmark.svg' );
	}
	return content_url( 'uploads/2026/07/brand-wordmark-600.png' );
}

/**
 * Minimal launch packages — pricing page only (was→now). No fare-code jargon.
 */
function sync2dine_slash_pricing_html() {
	$inquiry = esc_url( home_url( '/inquiry/' ) );
	$tel     = 'tel:+442037453233';
	ob_start();
	?>
	<section class="s2d-slash" id="s2d-slash-pricing" aria-label="Launch pricing">
		<div class="s2d-slash__inner">
			<p class="s2d-slash__badge">Launch offer · 40% off</p>
			<h2 class="s2d-slash__title">Weekly packages</h2>
			<p class="s2d-slash__lead">Launch fares — 40% off standard weekly rates. Atmosphere for the room; Complete adds Judie on the phone.</p>
			<div class="s2d-pkg-grid" role="list">
				<article class="s2d-pkg s2d-pkg--primary" role="listitem">
					<h3 class="s2d-pkg__name">Atmosphere</h3>
					<p class="s2d-pkg__desc">Venue audio, promo messaging, staff training</p>
					<p class="s2d-pkg__price"><span class="s2d-pkg__was">£232</span> <strong>£139</strong><span class="s2d-pkg__unit">/wk</span></p>
				</article>
				<article class="s2d-pkg s2d-pkg--upsell" role="listitem">
					<h3 class="s2d-pkg__name">Complete</h3>
					<p class="s2d-pkg__desc">Atmosphere + Judie Starter</p>
					<p class="s2d-pkg__price"><span class="s2d-pkg__was">£347</span> <strong>£208</strong><span class="s2d-pkg__unit">/wk</span></p>
				</article>
				<article class="s2d-pkg" role="listitem">
					<h3 class="s2d-pkg__name">Complete Pro</h3>
					<p class="s2d-pkg__desc">Atmosphere + Judie Pro</p>
					<p class="s2d-pkg__price"><span class="s2d-pkg__was">£539</span> <strong>£323</strong><span class="s2d-pkg__unit">/wk</span></p>
				</article>
			</div>
			<div class="s2d-slash__cta">
				<a class="s2d-btn" href="<?php echo esc_url( $tel ); ?>">Call 020 3745 3233</a>
				<a class="s2d-btn s2d-btn--ghost" href="<?php echo $inquiry; ?>">Enquire</a>
			</div>
		</div>
	</section>
	<?php
	return ob_get_clean();
}

function sync2dine_dual_product_assets() {
	$css = '
.s2d-slash{background:#0f3d3e;color:#fff7df;padding:56px 20px;margin:0}
.s2d-slash__inner{max-width:1040px;margin:0 auto}
.s2d-slash__badge{display:inline-block;margin:0 0 12px;padding:6px 12px;border-radius:4px;background:#e8c26a;color:#0f3d3e;font:700 11px/1 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase}
.s2d-slash__title{font:700 clamp(26px,3.5vw,40px)/1.15 Georgia,"Times New Roman",serif;margin:0 0 10px;color:#fff}
.s2d-slash__lead{font:400 17px/1.55 system-ui,sans-serif;margin:0 0 28px;max-width:560px;opacity:.92}
.s2d-pkg-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin:0 0 28px}
@media(max-width:800px){.s2d-pkg-grid{grid-template-columns:1fr}}
.s2d-pkg{background:rgba(255,247,223,.06);border:1px solid rgba(232,194,106,.35);border-radius:4px;padding:22px 20px}
.s2d-pkg--primary,.s2d-pkg--upsell{border-color:#e8c26a}
.s2d-pkg__name{margin:0 0 8px;font:700 22px/1.2 Georgia,serif;color:#fff}
.s2d-pkg__desc{margin:0;font:400 14px/1.45 system-ui,sans-serif;opacity:.85;min-height:2.6em}
.s2d-pkg__price{margin:16px 0 0;display:flex;flex-wrap:wrap;align-items:baseline;gap:10px}
.s2d-pkg__was{text-decoration:line-through;opacity:.55;font:500 15px/1 system-ui,sans-serif}
.s2d-pkg__price strong{font:700 34px/1 Georgia,serif;color:#e8c26a}
.s2d-pkg__unit{font:500 13px/1 system-ui,sans-serif;opacity:.8}
.s2d-slash__cta{display:flex;flex-wrap:wrap;gap:12px}
.s2d-btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:12px 22px;border-radius:4px;background:#e8c26a;color:#0f3d3e;text-decoration:none;font:700 14px/1 system-ui,sans-serif}
.s2d-btn--ghost{background:transparent;border:1px solid #e8c26a;color:#fff7df}
.s2d-legal-footer{background:#0b2223;color:#fff7df;padding:28px 20px;margin:0}
.s2d-legal-footer__inner{max-width:1100px;margin:0 auto;display:flex;flex-wrap:wrap;gap:14px 22px;align-items:center;justify-content:space-between}
.s2d-legal-footer a{color:#e8c26a;text-decoration:none;font:600 13px/1.3 system-ui,sans-serif}
.s2d-legal-footer a:hover{text-decoration:underline}
.s2d-legal-footer__links{display:flex;flex-wrap:wrap;gap:10px 16px}
.s2d-legal-footer__contact{font:500 13px/1.4 system-ui,sans-serif;opacity:.92}
.s2d-legal-footer__contact a{color:#fff7df;text-decoration:underline}
.elementor-widget-image img[src*="Sync2Dine-15"],.elementor-widget-theme-site-logo img,.custom-logo-link img,.site-header img.custom-logo{max-height:48px!important;width:auto!important;height:auto!important;object-fit:contain!important}
body.home .s2d-home-trim{display:none!important}
';
	wp_register_style( 'sync2dine-dual', false );
	wp_enqueue_style( 'sync2dine-dual' );
	wp_add_inline_style( 'sync2dine-dual', $css );
}
add_action( 'wp_enqueue_scripts', 'sync2dine_dual_product_assets', 40 );

/**
 * Trim homepage length: hide redundant Elementor blocks that repeat the same pitch.
 * Keeps hero, product story, pricing, how-it-works, and primary CTA.
 */
function sync2dine_print_home_trim_script() {
	if ( is_admin() || ! is_front_page() ) {
		return;
	}
	$hide = wp_json_encode(
		array(
			'Who we serve',
			'Exclusive Business Benefits',
			'ABOUT OUR STRATEGY',
			'The Engine for Higher Sales',
			'Why Choose Sync2Dine',
			'Hear it straight from our customers',
			"FAQ's",
			'Insights and Updates from Our Blog',
		)
	);
	echo "<script data-no-optimize=\"1\" data-cfasync=\"false\">\n";
	echo "(function(){\n";
	echo "var needles={$hide};\n";
	echo "function trim(){\n";
	echo "  var root=document.querySelector('.elementor[data-elementor-type=\"wp-page\"]')||document.body;\n";
	echo "  needles.forEach(function(n){\n";
	echo "    var nodes=root.querySelectorAll('h1,h2,h3,h4,.elementor-heading-title');\n";
	echo "    nodes.forEach(function(h){\n";
	echo "      var t=(h.textContent||'').replace(/\\s+/g,' ').trim();\n";
	echo "      if(!t||t.toLowerCase().indexOf(n.toLowerCase())===-1) return;\n";
	echo "      var sec=h.closest('.elementor-element.e-con-parent,.elementor-top-section,.e-con.e-parent');\n";
	echo "      if(sec){sec.classList.add('s2d-home-trim');sec.setAttribute('hidden','');}\n";
	echo "    });\n";
	echo "  });\n";
	echo "}\n";
	echo "if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',trim);else trim();\n";
	echo "})();\n";
	echo "</script>\n";
}
add_action( 'wp_footer', 'sync2dine_print_home_trim_script', 2 );

/** Pricing page only — one package strip. */
function sync2dine_append_pricing_strip( $content ) {
	static $done = false;
	if ( $done || is_admin() || ! is_singular( 'page' ) ) {
		return $content;
	}
	if ( false !== strpos( $content, 'id="s2d-slash-pricing"' ) ) {
		$done = true;
		return $content;
	}
	$slug = get_post_field( 'post_name', get_queried_object_id() );
	if ( 'pricing' !== $slug ) {
		return $content;
	}
	$done    = true;
	$content .= sync2dine_slash_pricing_html();
	return $content;
}
add_filter( 'elementor/frontend/the_content', 'sync2dine_append_pricing_strip', 25 );
add_filter( 'the_content', 'sync2dine_append_pricing_strip', 25 );

function sync2dine_print_sally_topbar_script() {
	if ( is_admin() ) {
		return;
	}
	$ver = '20260720h';
	echo '<script data-no-optimize="1" data-cfasync="false" src="https://app.sync2dine.io/sally-widget.js?v=' . esc_attr( $ver ) . '" data-api="https://app.sync2dine.io" data-mode="topbar" data-page="marketing" async></script>' . "\n";
}
add_action( 'wp_footer', 'sync2dine_print_sally_topbar_script', 1 );

function sync2dine_legal_footer_html() {
	$terms   = esc_url( home_url( '/terms/' ) );
	$fair    = esc_url( home_url( '/fair-use-and-fares/' ) );
	$privacy = esc_url( home_url( '/privacy-policy/' ) );
	$cookies = esc_url( home_url( '/cookies/' ) );
	$cancel  = esc_url( home_url( '/cancellation-refunds/' ) );
	ob_start();
	?>
	<footer class="s2d-legal-footer" role="contentinfo">
		<div class="s2d-legal-footer__inner">
			<nav class="s2d-legal-footer__links" aria-label="Legal">
				<a href="<?php echo $privacy; ?>">Privacy</a>
				<a href="<?php echo $terms; ?>">Terms</a>
				<a href="<?php echo $fair; ?>">Fair use &amp; fares</a>
				<a href="<?php echo $cookies; ?>">Cookies</a>
				<a href="<?php echo $cancel; ?>">Cancellation &amp; refunds</a>
			</nav>
			<p class="s2d-legal-footer__contact">
				<a href="tel:+442037453233">020 3745 3233</a>
				·
				<a href="mailto:info@sync2dine.io">info@sync2dine.io</a>
				· Sync2Dine
			</p>
		</div>
	</footer>
	<?php
	return ob_get_clean();
}

function sync2dine_print_legal_footer() {
	if ( is_admin() ) {
		return;
	}
	echo sync2dine_legal_footer_html(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
}
add_action( 'wp_footer', 'sync2dine_print_legal_footer', 5 );

function sync2dine_custom_logo( $html ) {
	$url = esc_url( sync2dine_brand_wordmark_url() );
	return '<a href="' . esc_url( home_url( '/' ) ) . '" class="custom-logo-link" rel="home"><img src="' . $url . '" class="custom-logo" alt="Sync2Dine" width="200" height="60" /></a>';
}
add_filter( 'get_custom_logo', 'sync2dine_custom_logo', 20 );
