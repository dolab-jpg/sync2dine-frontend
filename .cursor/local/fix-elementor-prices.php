<?php
/**
 * Fix Elementor JSON prices that store £ as \u00a3 escapes.
 * Canonical: Atmosphere £139/wk, Complete £208/wk, Complete Pro £323/wk.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit( 1 );
}

$phrase_map = array(
	// Unicode-escaped £ (\u00a3) as stored in _elementor_data JSON strings
	'One-Time Professional Setup: \u00a3300, Atmosphere from \u00a3139\/week launch' =>
		'Atmosphere from \u00a3139\/week launch · Complete from \u00a3208\/week launch',
	'One-Time Professional Setup: \u00a3300, Atmosphere from \u00a3139/week launch' =>
		'Atmosphere from \u00a3139/week launch · Complete from \u00a3208/week launch',
	'Simple Investment: One-Time Professional Setup: \u00a3300, Atmosphere from \u00a3139\/week launch' =>
		'Simple Investment: Atmosphere from \u00a3139\/week launch · Complete from \u00a3208\/week launch',
	'Simple Investment Structure: One-Time Professional Setup: \u00a3300, Atmosphere from \u00a3139\/week launch' =>
		'Simple Investment Structure: Atmosphere from \u00a3139\/week launch · Complete from \u00a3208\/week launch',
	'One-Time Professional Setup: \u00a3300. Then, just \u00a360 Per Week to Drive Revenue.' =>
		'Atmosphere from \u00a3139\/week launch · Complete from \u00a3208\/week launch.',
	'One-Time Professional Setup: \u00a3300. Then, just \u00a360 Per Week to Drive Revenue' =>
		'Atmosphere from \u00a3139\/week launch · Complete from \u00a3208\/week launch',
	'Start Today \u2013 One-Time Setup: \u00a3139, Then Just \u00a399 Per Week!' =>
		'Start Today \u2014 Atmosphere from \u00a3139\/week launch · Complete \u00a3208\/week launch',
	'Start Today – One-Time Setup: \u00a3139, Then Just \u00a399 Per Week!' =>
		'Start Today — Atmosphere from \u00a3139\/week launch · Complete \u00a3208\/week launch',
	'Start Today - One-Time Setup: \u00a3139, Then Just \u00a399 Per Week!' =>
		'Start Today — Atmosphere from \u00a3139\/week launch · Complete \u00a3208\/week launch',
	'Start Today \u2013 One-Time Setup: \u00a3300, Atmosphere from \u00a3139\/week launch' =>
		'Start Today \u2013 Atmosphere from \u00a3139\/week launch',
	'Start Today – One-Time Setup: \u00a3300, Atmosphere from \u00a3139\/week launch' =>
		'Start Today – Atmosphere from \u00a3139\/week launch',
	// Also literal £ forms if present
	'One-Time Professional Setup: £300, Atmosphere from £139/week launch' =>
		'Atmosphere from £139/week launch · Complete from £208/week launch',
	'Simple Investment: One-Time Professional Setup: £300, Atmosphere from £139/week launch' =>
		'Simple Investment: Atmosphere from £139/week launch · Complete from £208/week launch',
	'Simple Investment Structure: One-Time Professional Setup: £300, Atmosphere from £139/week launch' =>
		'Simple Investment Structure: Atmosphere from £139/week launch · Complete from £208/week launch',
	'One-Time Professional Setup: £300. Then, just £60 Per Week to Drive Revenue.' =>
		'Atmosphere from £139/week launch · Complete from £208/week launch.',
	'Start Today – One-Time Setup: £139, Then Just £99 Per Week!' =>
		'Start Today — Atmosphere from £139/week launch · Complete £208/week launch',
	'Start Today - One-Time Setup: £139, Then Just £99 Per Week!' =>
		'Start Today — Atmosphere from £139/week launch · Complete £208/week launch',
	// Old monthly AI tiers
	'\u00a3399' => '\u00a3139',
	'\u00a3799' => '\u00a3208',
	'\u00a3249' => '\u00a3208',
	'£399' => '£139',
	'£799' => '£208',
	'£249' => '£208',
);

$pages = get_posts(
	array(
		'post_type'      => 'page',
		'post_status'    => 'publish',
		'posts_per_page' => -1,
		'fields'         => 'ids',
	)
);

$changed = 0;
foreach ( $pages as $pid ) {
	$raw = get_post_meta( $pid, '_elementor_data', true );
	if ( ! is_string( $raw ) || $raw === '' ) {
		continue;
	}
	$new = $raw;
	foreach ( $phrase_map as $from => $to ) {
		if ( false !== strpos( $new, $from ) ) {
			$new = str_replace( $from, $to, $new );
		}
	}
	// Residual setup fee patterns with unicode pound
	$new2 = preg_replace(
		'/One-Time Professional Setup:\s*\\\\u00a3300[.,]?\s*/u',
		'',
		$new
	);
	if ( is_string( $new2 ) ) {
		$new = $new2;
	}
	$new2 = preg_replace(
		'/One-Time Setup:\s*\\\\u00a3\d+[.,]?\s*/u',
		'',
		$new
	);
	if ( is_string( $new2 ) ) {
		$new = $new2;
	}
	// Bare leftover \u00a3300,
	$new2 = preg_replace( '/\\\\u00a3300\s*[,.]?\s*/u', '', $new );
	if ( is_string( $new2 ) ) {
		$new = $new2;
	}

	if ( $new !== $raw ) {
		update_post_meta( $pid, '_elementor_data', wp_slash( $new ) );
		$post = get_post( $pid );
		WP_CLI::log( "fixed _elementor_data ID $pid {$post->post_name}" );
		$changed++;
	}
}

if ( class_exists( '\Elementor\Plugin' ) ) {
	try {
		\Elementor\Plugin::$instance->files_manager->clear_cache();
		WP_CLI::log( 'Elementor cache cleared' );
	} catch ( Exception $e ) {
		WP_CLI::log( 'Elementor cache: ' . $e->getMessage() );
	}
}

WP_CLI::log( "elementor pages fixed: $changed" );

// Re-check known offenders
foreach ( array( 35546, 36376, 36441, 17410, 19046, 37525 ) as $pid ) {
	$raw  = (string) get_post_meta( $pid, '_elementor_data', true );
	$post = get_post( $pid );
	$bad  = array();
	foreach ( array( '\u00a3300', '\u00a3399', '\u00a3799', '\u00a3249', '\u00a360 Per', '\u00a399 Per', 'Professional Setup: \u00a3' ) as $n ) {
		if ( false !== strpos( $raw, $n ) ) {
			$bad[] = $n;
		}
	}
	if ( $bad ) {
		WP_CLI::log( "STILL BAD $pid {$post->post_name}: " . implode( ', ', $bad ) );
	} else {
		WP_CLI::log( "OK $pid {$post->post_name}" );
	}
}

WP_CLI::success( 'Elementor unicode price fix done' );
