<?php
/**
 * Audit + fix Sync2Dine public pricing strings (Atmosphere weekly fares SoT).
 * Run: wp eval-file audit-fix-pricing.php
 *
 * Canonical (s2d-fare-2026-07-19 / dual-product):
 *   Atmosphere £139/wk launch · £232 std
 *   Complete £208/wk launch · £347 std
 *   Complete Pro £323/wk launch · £539 std
 *   Judie Starter £139/wk launch · £232 std
 * No £300/£399/£799/£60/£99 weekly leftovers; setup fees not marketed.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit( 1 );
}

global $wpdb;

$needles = array(
	'£300',
	'£399',
	'£799',
	'£249',
	'£99',
	'£60',
	'£ 399',
	'£ 799',
	'£ 300',
	'£ 60',
	'£ 99',
	'£60 Per Week',
	'£99 Per Week',
	'60 Per Week',
	'99 Per Week',
	's2d-ai-price',
	'One-Time Professional Setup',
	'One-Time Setup',
);

function s2d_log( $msg ) {
	if ( class_exists( 'WP_CLI' ) ) {
		WP_CLI::log( $msg );
	} else {
		echo $msg . "\n";
	}
}

s2d_log( '=== AUDIT: pages/meta containing stale price needles ===' );
$hits = array();

$pages = get_posts(
	array(
		'post_type'      => 'page',
		'post_status'    => 'publish',
		'posts_per_page' => -1,
		'fields'         => 'ids',
	)
);

foreach ( $pages as $pid ) {
	$p     = get_post( $pid );
	$blob  = (string) $p->post_content;
	$meta  = get_post_meta( $pid, '_elementor_data', true );
	if ( is_array( $meta ) || is_object( $meta ) ) {
		$meta = wp_json_encode( $meta );
	}
	$blob .= "\n" . (string) $meta;
	$found = array();
	foreach ( $needles as $n ) {
		if ( false !== stripos( $blob, $n ) ) {
			$found[] = $n;
		}
	}
	// Also catch plain 399/300 near currency in elementor JSON
	if ( preg_match( '/[£$]\s*399|399\s*\/\s*mo|Basic.{0,20}399/i', $blob ) ) {
		$found[] = '~399-pattern';
	}
	if ( $found ) {
		$hits[ $pid ] = array(
			'slug'  => $p->post_name,
			'title' => $p->post_title,
			'found' => array_values( array_unique( $found ) ),
		);
		s2d_log( sprintf( 'ID %d %s (%s): %s', $pid, $p->post_name, $p->post_title, implode( ', ', $hits[ $pid ]['found'] ) ) );
	}
}

if ( ! $hits ) {
	s2d_log( '(no needle hits in published pages)' );
}

/**
 * Phrase-level replacements (order matters — longer first).
 * Prefer Atmosphere weekly model; kill marketed setup fees.
 */
$phrase_map = array(
	'Simple Investment: One-Time Professional Setup: £300, Atmosphere from £139/week launch' =>
		'Simple Investment: Atmosphere from £139/week launch · Complete from £208/week launch',
	'Simple Investment Structure: One-Time Professional Setup: £300, Atmosphere from £139/week launch' =>
		'Simple Investment Structure: Atmosphere from £139/week launch · Complete from £208/week launch',
	'One-Time Professional Setup: £300, Atmosphere from £139/week launch' =>
		'Atmosphere from £139/week launch · Complete from £208/week launch',
	'One-Time Professional Setup: £300. Then, just £60 Per Week to Drive Revenue.' =>
		'Atmosphere from £139/week launch · Complete from £208/week launch.',
	'One-Time Professional Setup: £300. Then, just £60 Per Week to Drive Revenue' =>
		'Atmosphere from £139/week launch · Complete from £208/week launch',
	'Start Today - One-Time Setup: £139, Then Just £99 Per Week!' =>
		'Start Today — Atmosphere from £139/week launch · Complete £208/week launch',
	'Start Today – One-Time Setup: £139, Then Just £99 Per Week!' =>
		'Start Today — Atmosphere from £139/week launch · Complete £208/week launch',
	'Start Today — One-Time Setup: £139, Then Just £99 Per Week!' =>
		'Start Today — Atmosphere from £139/week launch · Complete £208/week launch',
	'Then Just £99 Per Week!' =>
		'Atmosphere from £139/week launch',
	'just £60 Per Week to Drive Revenue.' =>
		'Atmosphere from £139/week launch.',
	'just £60 Per Week to Drive Revenue' =>
		'Atmosphere from £139/week launch',
	'£60 Per Week' => '£139/week launch',
	'£99 Per Week' => '£139/week launch',
	'£60/week' => '£139/week launch',
	'£99/week' => '£139/week launch',
	'£ 300' => '£0 setup — ',
	'£300' => '', // cleaned via phrase maps first; leftover bare £300 stripped in second pass carefully
);

// Safer bare-token map for residual conflicts (applied after phrases).
$token_map = array(
	'£ 399' => '£139',
	'£ 799' => '£208',
	'£399'  => '£139',
	'£799'  => '£208',
	'$399'  => '£139',
	'$799'  => '£208',
	'£249'  => '£139', // old kiosk monthly — align to Judie/Atmosphere launch floor messaging
	'Basic £139' => 'Atmosphere £139/wk launch', // after £399→£139
	'Business £208' => 'Complete £208/wk launch',
);

/**
 * Replace old AI phone Elementor price cards HTML fragments if present as plain text in meta.
 */
$html_block_map = array(
	'<p class="amt">£399</p>' => '<p class="amt">£139</p>',
	'<p class="amt">£249</p>' => '<p class="amt">£208</p>',
);

function s2d_apply_maps( $text, $phrase_map, $token_map, $html_block_map ) {
	$before = $text;
	foreach ( $phrase_map as $from => $to ) {
		if ( $from === '£300' ) {
			continue; // handled specially
		}
		$text = str_replace( $from, $to, $text );
	}
	foreach ( $html_block_map as $from => $to ) {
		$text = str_replace( $from, $to, $text );
	}
	foreach ( $token_map as $from => $to ) {
		$text = str_replace( $from, $to, $text );
	}
	// Remaining marketed setup fee language
	$text = preg_replace(
		'/One-Time Professional Setup:\s*£?300[.,]?\s*/iu',
		'',
		$text
	);
	$text = preg_replace(
		'/One-Time Setup:\s*£?\d+[.,]?\s*/iu',
		'',
		$text
	);
	// Bare leftover £300 (setup) → remove "£300, " or "£300. "
	$text = preg_replace( '/£\s*300\s*[,.]?\s*/u', '', $text );
	return array( $text, $text !== $before );
}

s2d_log( '=== APPLY fixes to published pages (post_content + _elementor_data) ===' );
$changed = 0;

foreach ( $pages as $pid ) {
	$p        = get_post( $pid );
	$content  = (string) $p->post_content;
	list( $new_content, $c_changed ) = s2d_apply_maps( $content, $phrase_map, $token_map, $html_block_map );
	if ( $c_changed ) {
		wp_update_post(
			array(
				'ID'           => $pid,
				'post_content' => $new_content,
			)
		);
		s2d_log( "updated post_content ID $pid {$p->post_name}" );
		$changed++;
	}

	$raw = get_post_meta( $pid, '_elementor_data', true );
	if ( $raw === '' || $raw === null || $raw === false ) {
		continue;
	}
	$is_json_array = is_array( $raw );
	$meta_str      = $is_json_array ? wp_json_encode( $raw ) : (string) $raw;
	list( $new_meta, $m_changed ) = s2d_apply_maps( $meta_str, $phrase_map, $token_map, $html_block_map );

	// Targeted AI phone card copy fixes inside Elementor JSON (escaped).
	if ( false !== strpos( $new_meta, 's2d-ai-price' ) || false !== strpos( $new_meta, 'AI Phone' ) || false !== strpos( $new_meta, 'Per kiosk' ) ) {
		$ai_replaces = array(
			'AI Phone & Ordering platform' => 'Judie Starter — AI phone',
			'AI Phone &amp; Ordering platform' => 'Judie Starter — AI phone',
			'Per kiosk screen' => 'Complete (Atmosphere + Judie)',
			'Front counter voice order' => 'Atmosphere + Judie Starter bundle — weekly launch fare',
			'/ month' => '/ week launch',
			'/month' => '/week launch',
			'per month' => 'per week launch',
			'monthly.' => 'weekly launch.',
		);
		foreach ( $ai_replaces as $from => $to ) {
			if ( false !== strpos( $new_meta, $from ) ) {
				$new_meta  = str_replace( $from, $to, $new_meta );
				$m_changed = true;
			}
		}
	}

	if ( $m_changed ) {
		// Elementor stores JSON string; keep as string.
		if ( $is_json_array ) {
			$decoded = json_decode( $new_meta, true );
			if ( is_array( $decoded ) ) {
				update_post_meta( $pid, '_elementor_data', wp_slash( wp_json_encode( $decoded ) ) );
			} else {
				update_post_meta( $pid, '_elementor_data', wp_slash( $new_meta ) );
			}
		} else {
			// Most installs store as JSON string already.
			$decoded = json_decode( $new_meta, true );
			if ( is_array( $decoded ) ) {
				update_post_meta( $pid, '_elementor_data', wp_slash( $new_meta ) );
			} else {
				update_post_meta( $pid, '_elementor_data', wp_slash( $new_meta ) );
			}
		}
		s2d_log( "updated _elementor_data ID $pid {$p->post_name}" );
		$changed++;
	}
}

// Clear Elementor CSS cache for changed pages if possible.
if ( class_exists( '\Elementor\Plugin' ) ) {
	try {
		\Elementor\Plugin::$instance->files_manager->clear_cache();
		s2d_log( 'Elementor files_manager cache cleared' );
	} catch ( Exception $e ) {
		s2d_log( 'Elementor cache clear skipped: ' . $e->getMessage() );
	}
}

s2d_log( '=== RE-AUDIT after fix ===' );
foreach ( $pages as $pid ) {
	$p    = get_post( $pid );
	$blob = (string) $p->post_content . "\n" . (string) get_post_meta( $pid, '_elementor_data', true );
	$bad  = array();
	foreach ( array( '£300', '£399', '£799', '£249', '£60 Per Week', '£99 Per Week', '£ 399', '£ 799' ) as $n ) {
		if ( false !== strpos( $blob, $n ) ) {
			$bad[] = $n;
		}
	}
	if ( $bad ) {
		s2d_log( "STILL BAD ID $pid {$p->post_name}: " . implode( ', ', $bad ) );
	}
}

s2d_log( "Done. change-events=$changed" );
if ( class_exists( 'WP_CLI' ) ) {
	WP_CLI::success( 'Pricing audit/fix complete' );
}
