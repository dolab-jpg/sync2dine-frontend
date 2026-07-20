<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit( 1 );
}

$bad_patterns = array(
	'\\u00a3300',
	'\\u00a3399',
	'\\u00a3799',
	'\\u00a3249',
	'\\u00a360 Per',
	'\\u00a399 Per',
	'£300',
	'£399',
	'£799',
	'£249',
	'£60 Per Week',
	'£99 Per Week',
	'£ 399',
	'£ 799',
	'Billed monthly',
	'Per kiosk screen',
);

$pages = get_posts(
	array(
		'post_type'      => 'page',
		'post_status'    => 'publish',
		'posts_per_page' => -1,
	)
);

foreach ( $pages as $p ) {
	$blob = $p->post_content . "\n" . (string) get_post_meta( $p->ID, '_elementor_data', true );
	$hits = array();
	foreach ( $bad_patterns as $n ) {
		if ( false !== strpos( $blob, $n ) ) {
			$hits[] = $n;
		}
	}
	// Good prices presence for marketing pages
	$good = array();
	foreach ( array( '£139', '\\u00a3139', '£208', '\\u00a3208' ) as $g ) {
		if ( false !== strpos( $blob, $g ) ) {
			$good[] = $g;
		}
	}
	if ( $hits || $good ) {
		WP_CLI::log(
			sprintf(
				'%d %s | bad=[%s] good=[%s]',
				$p->ID,
				$p->post_name,
				implode( ',', $hits ),
				implode( ',', $good )
			)
		);
	}
}
WP_CLI::success( 'scan done' );
