<?php
require '/var/www/vhosts/sync2dine.io/httpdocs/wp-load.php';
global $wpdb;

$rows = $wpdb->get_results(
    "SELECT post_id FROM {$wpdb->postmeta}
     WHERE meta_key = '_elementor_data'
       AND meta_value LIKE '%Copyrights Reserved%'"
);
echo 'footer rows: ' . count($rows) . PHP_EOL;

foreach ($rows as $r) {
    $data = get_post_meta($r->post_id, '_elementor_data', true);
    $new = str_replace(
        array('All Copyrights Reserved.', 'All Copyrights Reserved'),
        array('All rights reserved.', 'All rights reserved'),
        $data
    );
    $new = preg_replace('/�\s*2025/u', '� 2026', $new);
    if ($new !== $data) {
        update_post_meta($r->post_id, '_elementor_data', wp_slash($new));
        delete_post_meta($r->post_id, '_elementor_css');
        echo "updated {$r->post_id}\n";
    } else {
        echo "no change {$r->post_id}\n";
    }
}

if (class_exists('\Elementor\Plugin')) {
    \Elementor\Plugin::$instance->files_manager->clear_cache();
    echo "elementor cache cleared\n";
}

// Also scan rendered HTML fragments in post_content
$posts = $wpdb->get_results(
    "SELECT ID FROM {$wpdb->posts}
     WHERE post_content LIKE '%Copyrights Reserved%'
        OR post_content LIKE '%All Copyrights%'"
);
echo 'post_content rows: ' . count($posts) . PHP_EOL;
foreach ($posts as $p) {
    $c = get_post_field('post_content', $p->ID);
    $n = str_replace(
        array('All Copyrights Reserved.', 'All Copyrights Reserved'),
        array('All rights reserved.', 'All rights reserved'),
        $c
    );
    $n = preg_replace('/�\s*2025/u', '� 2026', $n);
    if ($n !== $c) {
        wp_update_post(array('ID' => $p->ID, 'post_content' => $n));
        echo "updated post_content {$p->ID}\n";
    }
}

echo "DONE\n";
