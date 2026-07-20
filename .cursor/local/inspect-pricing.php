<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit( 1 );
}

$ids = array( 35546, 36376, 36441, 37525, 19046, 17410 );
foreach ( $ids as $id ) {
	$meta = get_post_meta( $id, '_elementor_data', true );
	$s    = is_string( $meta ) ? $meta : wp_json_encode( $meta );
	$post = get_post( $id );
	WP_CLI::log( "==== $id {$post->post_name} meta_len=" . strlen( $s ) . ' content_len=' . strlen( $post->post_content ) );
	foreach ( array( '£300', '£399', '£249', '£99', '£60', '&pound;300', '&pound;399', '\\u00a3', '300', '399', '60 Per', '99 Per', 's2d-ai', 'Professional Setup', 'Per Week' ) as $n ) {
		$in_m = false !== stripos( $s, $n );
		$in_c = false !== stripos( $post->post_content, $n );
		if ( $in_m || $in_c ) {
			WP_CLI::log( "  HIT $n meta=" . ( $in_m ? 'Y' : 'n' ) . ' content=' . ( $in_c ? 'Y' : 'n' ) );
		}
	}
	if ( preg_match_all( '/.{0,50}(300|399|249|799|60 Per|99 Per|139|208|Professional Setup).{0,50}/u', $s, $m ) ) {
		$uniq = array_unique( $m[0] );
		$i    = 0;
		foreach ( $uniq as $u ) {
			if ( $i++ > 12 ) {
				break;
			}
			WP_CLI::log( '  META: ' . preg_replace( '/\s+/', ' ', $u ) );
		}
	}
	if ( preg_match_all( '/.{0,50}(300|399|249|799|60 Per|99 Per|139|208|Professional Setup).{0,50}/u', $post->post_content, $m2 ) ) {
		$uniq = array_unique( $m2[0] );
		$i    = 0;
		foreach ( $uniq as $u ) {
			if ( $i++ > 8 ) {
				break;
			}
			WP_CLI::log( '  CONTENT: ' . preg_replace( '/\s+/', ' ', $u ) );
		}
	}
}
