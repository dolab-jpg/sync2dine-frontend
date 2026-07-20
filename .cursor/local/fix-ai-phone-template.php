<?php
/**
 * Patch page-ai-phone-ordering.php to Atmosphere-led weekly fares + Judie naming.
 * Run from theme dir or pass path.
 */
$theme = '/var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child';
$file  = $theme . '/page-ai-phone-ordering.php';
if ( ! is_readable( $file ) ) {
	fwrite( STDERR, "missing $file\n" );
	exit( 1 );
}

$src = file_get_contents( $file );
$bak = $file . '.bak-' . date( 'YmdHis' );
file_put_contents( $bak, $src );

// Prefer Judie avatar helper if present.
$src = str_replace(
	"\$avatar = function_exists( 'sync2dine_lizzie_avatar_url' )\n\t? sync2dine_lizzie_avatar_url()\n\t: content_url( 'uploads/sync2dine/lizzie-avatar.png' );",
	"\$avatar = function_exists( 'sync2dine_judie_avatar_url' )\n\t? sync2dine_judie_avatar_url()\n\t: ( function_exists( 'sync2dine_lizzie_avatar_url' ) ? sync2dine_lizzie_avatar_url() : content_url( 'uploads/sync2dine/lizzie-avatar.png' ) );",
	$src
);

$src = str_replace( 'Lizzie', 'Judie', $src );
$src = str_replace( 'lizzie', 'judie', $src );

$old_pricing = <<<'HTML'
			<h2>Pricing</h2>
			<div class="s2d-ai-prices">
				<div class="s2d-ai-price">
					<p class="amt">£399</p>
					<h3>AI Phone &amp; Ordering platform</h3>
					<p>Phone answering, voice orders, staff tablet, review &amp; reorder callbacks. Billed monthly.</p>
				</div>
				<div class="s2d-ai-price">
					<p class="amt">£249</p>
					<h3>Per kiosk screen</h3>
					<p>Front counter voice ordering, linked to the same kitchen board as your phone line.</p>
				</div>
			</div>
			<div class="s2d-ai-bundle">
				<p><strong>Already on Sync2Dine Audio?</strong> AI Phone &amp; Ordering stacks on the same brand — music for the room, AI for the phone. <a href="<?php echo esc_url( $audio ); ?>">Explore Strategic Audio</a></p>
			</div>
HTML;

$new_pricing = <<<'HTML'
			<h2>Weekly packages (launch fares)</h2>
			<div class="s2d-ai-prices">
				<div class="s2d-ai-price">
					<p class="amt">£139</p>
					<h3>Judie Starter <span style="font:600 14px/1 system-ui,sans-serif;opacity:.85">/wk launch</span></h3>
					<p>AI phone receptionist — orders, bookings, staff tablet. Same fare as Atmosphere alone.</p>
				</div>
				<div class="s2d-ai-price">
					<p class="amt">£208</p>
					<h3>Complete <span style="font:600 14px/1 system-ui,sans-serif;opacity:.85">/wk launch</span></h3>
					<p>Atmosphere venue audio + Judie Starter — best value. Complete Pro £323/wk launch.</p>
				</div>
			</div>
			<div class="s2d-ai-bundle">
				<p><strong>Already on Atmosphere?</strong> Add Judie from £139/wk launch, or Complete at £208/wk. Call <a href="tel:+442037453233">020 3745 3233</a>. <a href="<?php echo esc_url( $audio ); ?>">Explore Atmosphere audio</a> · <a href="<?php echo esc_url( home_url( '/pricing/' ) ); ?>">Full weekly pricing</a></p>
			</div>
HTML;

if ( false === strpos( $src, '£399' ) && false === strpos( $src, 'Billed monthly' ) ) {
	fwrite( STDOUT, "pricing block already updated or missing; writing Judie renames only\n" );
} else {
	if ( false === strpos( $src, $old_pricing ) ) {
		// Fallback: regex replace the pricing section.
		$src2 = preg_replace(
			'#<h2>Pricing</h2>.*?<div class="s2d-ai-bundle">.*?</div>#s',
			trim( $new_pricing ),
			$src,
			1,
			$count
		);
		if ( $count < 1 ) {
			fwrite( STDERR, "Could not locate pricing block\n" );
			exit( 2 );
		}
		$src = $src2;
	} else {
		$src = str_replace( $old_pricing, $new_pricing, $src );
	}
}

// Ensure phone CTA exists near hero if missing.
if ( false === strpos( $src, '020 3745 3233' ) ) {
	$src = str_replace(
		'<a class="s2d-ai-btn s2d-ai-btn--ghost" href="<?php echo esc_url( $mail ); ?>">Email info@sync2dine.io</a>',
		'<a class="s2d-ai-btn s2d-ai-btn--ghost" href="tel:+442037453233">Call 020 3745 3233</a>' . "\n\t\t\t\t\t" .
		'<a class="s2d-ai-btn s2d-ai-btn--ghost" href="<?php echo esc_url( $mail ); ?>">Email info@sync2dine.io</a>',
		$src
	);
}

file_put_contents( $file, $src );
fwrite( STDOUT, "patched $file (backup $bak)\n" );

// Quick verify
foreach ( array( '£399', '£249', 'Lizzie', 'Billed monthly' ) as $bad ) {
	if ( false !== strpos( $src, $bad ) ) {
		fwrite( STDOUT, "WARN still contains: $bad\n" );
	}
}
foreach ( array( '£139', '£208', 'Judie', '020 3745 3233' ) as $good ) {
	fwrite( STDOUT, ( false !== strpos( $src, $good ) ? 'OK' : 'MISSING' ) . " $good\n" );
}
