<?php
/**
 * Force-regenerate Elementor CSS files under uploads/elementor/css.
 * Run: wp eval-file s2d-regen-elementor-css.php
 */
if (!class_exists('Elementor\\Plugin')) {
	echo "no elementor\n";
	return;
}

$plugin = \Elementor\Plugin::$instance;
echo "elementor ok\n";

if (method_exists($plugin->files_manager, 'clear_cache')) {
	$plugin->files_manager->clear_cache();
	echo "cleared\n";
}

$ids = get_posts(array(
	'post_type' => 'any',
	'post_status' => array('publish', 'private', 'draft'),
	'posts_per_page' => 300,
	'fields' => 'ids',
	'meta_key' => '_elementor_edit_mode',
	'meta_value' => 'builder',
));
echo 'posts=' . count($ids) . "\n";

$n = 0;
foreach ($ids as $id) {
	try {
		$css = new \Elementor\Core\Files\CSS\Post($id);
		$css->update();
		$n++;
	} catch (Throwable $e) {
		echo "fail {$id}: " . $e->getMessage() . "\n";
	}
}

try {
	$kit_id = get_option('elementor_active_kit');
	if ($kit_id) {
		$css = new \Elementor\Core\Files\CSS\Post($kit_id);
		$css->update();
		echo "kit={$kit_id}\n";
	}
} catch (Throwable $e) {
	echo 'kit fail: ' . $e->getMessage() . "\n";
}

try {
	if (class_exists('Elementor\\Core\\Files\\CSS\\Global_CSS')) {
		$g = new \Elementor\Core\Files\CSS\Global_CSS('global');
		$g->update();
		echo "global ok\n";
	}
} catch (Throwable $e) {
	echo 'global fail: ' . $e->getMessage() . "\n";
}

echo "regenerated={$n}\n";
$dir = WP_CONTENT_DIR . '/uploads/elementor/css';
$files = glob($dir . '/*');
echo 'files_on_disk=' . (is_array($files) ? count($files) : 0) . "\n";
if (is_array($files)) {
	foreach (array_slice($files, 0, 30) as $f) {
		echo basename($f) . ' ' . filesize($f) . "\n";
	}
}
