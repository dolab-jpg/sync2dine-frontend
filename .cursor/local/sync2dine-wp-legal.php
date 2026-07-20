<?php
/**
 * One-shot: create Sync2Dine legal pages + strip outdated prices from Elementor meta.
 * Run: wp eval-file sync2dine-wp-legal.php --path=/var/www/vhosts/sync2dine.io/httpdocs
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit( 1 );
}

function s2d_upsert_page( $slug, $title, $html ) {
	$existing = get_page_by_path( $slug );
	if ( $existing ) {
		wp_update_post(
			array(
				'ID'           => $existing->ID,
				'post_title'   => $title,
				'post_content' => $html,
				'post_status'  => 'publish',
			)
		);
		return (int) $existing->ID;
	}
	return (int) wp_insert_post(
		array(
			'post_title'   => $title,
			'post_name'    => $slug,
			'post_content' => $html,
			'post_status'  => 'publish',
			'post_type'    => 'page',
		)
	);
}

$legal_shell_open  = '<div style="max-width:760px;margin:40px auto;padding:0 20px;font:500 16px/1.6 system-ui,sans-serif;color:#0b2223">';
$legal_shell_close = '<p style="margin-top:28px"><a href="tel:+442037453233">020 3745 3233</a> · <a href="mailto:info@sync2dine.io">info@sync2dine.io</a></p></div>';

$pages = array(
	'terms' => array(
		'Terms of Service',
		$legal_shell_open . '<h1>Terms of Service</h1><p>These terms govern use of Sync2Dine Atmosphere (venue audio management), Judie (AI phone receptionist), and related Sync2Dine services provided by SYNC BRAIN IT LIMITED.</p><p>Weekly launch and standard fares are published on our <a href="/pricing/">Pricing</a> page and in the Fair use &amp; fares schedule. By enquiring, signing a quote, or paying a Stripe invoice/checkout, you agree to those commercial terms, fair-use minute caps, and overage rules.</p><p>A longer form of these terms is maintained for app users; this page is the customer-facing summary for sync2dine.io.</p>' . $legal_shell_close,
	),
	'fair-use-and-fares' => array(
		'Fair use & fares',
		$legal_shell_open . '<h1>Fair use &amp; fares</h1><p>Fare schedule version <strong>s2d-fare-2026-07-19</strong>.</p><ul><li><strong>Atmosphere</strong> — £139/wk launch · £232/wk standard · venue audio, promo messaging, staff training</li><li><strong>Complete</strong> — £208/wk launch · £347/wk standard · Atmosphere + Judie Starter</li><li><strong>Complete Pro</strong> — £323/wk launch · £539/wk standard</li><li><strong>Judie Starter</strong> — £139/wk launch · £232/wk standard</li></ul><p>Included AI / outbound minutes and token caps apply per package. Overage is billed per minute at the published rate, or paused/transferred according to the overage action you choose.</p><p>Annual prepay discounts follow the current offer sheet. Extra sites from £1/wk.</p>' . $legal_shell_close,
	),
	'cookies' => array(
		'Cookies',
		$legal_shell_open . '<h1>Cookies</h1><p>We use essential cookies for site operation and session cookies for Ask Sync2Dine chat (sales assistant). Analytics cookies, if enabled, help us understand marketing traffic.</p><p>You can control cookies in your browser. Blocking essential cookies may break chat or forms.</p>' . $legal_shell_close,
	),
	'cancellation-refunds' => array(
		'Cancellation & refunds',
		$legal_shell_open . '<h1>Cancellation &amp; refunds</h1><p>Weekly plans can be cancelled with notice as stated on your quote or contract. Annual prepay periods follow the contract term.</p><p>Refunds are assessed case-by-case for billing errors or service failure; launch discounts are promotional and may be non-refundable once service has started. Contact <a href="mailto:info@sync2dine.io">info@sync2dine.io</a> or call <a href="tel:+442037453233">020 3745 3233</a>.</p>' . $legal_shell_close,
	),
);

foreach ( $pages as $slug => $pair ) {
	$id = s2d_upsert_page( $slug, $pair[0], $pair[1] );
	WP_CLI::log( "page $slug => $id" );
}

// Soften outdated Elementor / post content prices where still embedded.
$replaces = array(
	'£399' => '£139',
	'£799' => '£208',
	'$399' => '£139',
	'$799' => '£208',
	'£60/week' => '£139/week launch',
	'£99/week' => '£139/week launch',
	'£399/mo' => '£139/wk launch',
	'£799/mo' => '£208/wk launch',
	'Basic £399' => 'Atmosphere £139/wk launch',
	'Business £799' => 'Complete £208/wk launch',
	'info@all1house.com' => 'info@sync2dine.io',
	'020 3475 0458' => '020 3745 3233',
	'02034750458' => '02037453233',
	'Lizzie' => 'Judie',
	'lizzie' => 'Judie',
);

global $wpdb;
foreach ( $replaces as $from => $to ) {
	$n = $wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->posts} SET post_content = REPLACE(post_content, %s, %s) WHERE post_content LIKE %s", $from, $to, '%' . $wpdb->esc_like( $from ) . '%' ) );
	WP_CLI::log( "posts $from => $to ($n)" );
	$n2 = $wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->postmeta} SET meta_value = REPLACE(meta_value, %s, %s) WHERE meta_value LIKE %s", $from, $to, '%' . $wpdb->esc_like( $from ) . '%' ) );
	WP_CLI::log( "postmeta $from => $to ($n2)" );
}

WP_CLI::success( 'Sync2Dine legal pages + price string cleanup done.' );
