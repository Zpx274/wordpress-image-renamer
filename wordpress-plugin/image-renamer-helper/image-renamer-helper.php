<?php
/**
 * Plugin Name: Image Renamer Helper
 * Plugin URI: https://github.com/wordpress-image-renamer
 * Description: Expose les champs meta Elementor via REST API
 * Version: 1.0.0
 * Author: WordPress Image Renamer
 * License: GPL v2 or later
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('init', 'image_renamer_register_elementor_meta');

function image_renamer_register_elementor_meta() {
    $post_types = array('page', 'post', 'elementor_library');
    $meta_keys = array(
        '_elementor_data',
        '_elementor_css',
        '_elementor_edit_mode',
        '_elementor_page_settings',
        '_elementor_version'
    );

    foreach ($post_types as $post_type) {
        foreach ($meta_keys as $meta_key) {
            register_post_meta($post_type, $meta_key, array(
                'type' => 'string',
                'single' => true,
                'show_in_rest' => true,
            ));
        }
    }
}
