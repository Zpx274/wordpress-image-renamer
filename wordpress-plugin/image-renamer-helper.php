<?php
/**
 * Plugin Name: Image Renamer Helper
 * Description: Expose les champs meta Elementor via REST API pour permettre la mise a jour des images
 * Version: 1.0.0
 * Author: WordPress Image Renamer
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Register Elementor meta fields to be accessible via REST API
 */
function image_renamer_register_elementor_meta() {
    $post_types = ['page', 'post', 'elementor_library'];

    $meta_fields = [
        '_elementor_data' => [
            'type' => 'string',
            'single' => true,
            'show_in_rest' => true,
            'auth_callback' => function() {
                return current_user_can('edit_posts');
            }
        ],
        '_elementor_css' => [
            'type' => 'string',
            'single' => true,
            'show_in_rest' => true,
            'auth_callback' => function() {
                return current_user_can('edit_posts');
            }
        ],
        '_elementor_edit_mode' => [
            'type' => 'string',
            'single' => true,
            'show_in_rest' => true,
            'auth_callback' => function() {
                return current_user_can('edit_posts');
            }
        ],
        '_elementor_page_settings' => [
            'type' => 'string',
            'single' => true,
            'show_in_rest' => true,
            'auth_callback' => function() {
                return current_user_can('edit_posts');
            }
        ],
        '_elementor_version' => [
            'type' => 'string',
            'single' => true,
            'show_in_rest' => true,
            'auth_callback' => function() {
                return current_user_can('edit_posts');
            }
        ],
        '_elementor_cache_bust' => [
            'type' => 'string',
            'single' => true,
            'show_in_rest' => true,
            'auth_callback' => function() {
                return current_user_can('edit_posts');
            }
        ],
    ];

    foreach ($post_types as $post_type) {
        foreach ($meta_fields as $meta_key => $args) {
            register_post_meta($post_type, $meta_key, $args);
        }
    }
}
add_action('init', 'image_renamer_register_elementor_meta');

/**
 * Clear Elementor CSS cache when meta is updated
 */
function image_renamer_clear_elementor_cache($meta_id, $post_id, $meta_key, $meta_value) {
    if ($meta_key === '_elementor_data') {
        // Delete CSS cache for this post
        delete_post_meta($post_id, '_elementor_css');

        // Try to regenerate CSS using Elementor if available
        if (class_exists('\Elementor\Plugin')) {
            $css_file = \Elementor\Core\Files\CSS\Post::create($post_id);
            if ($css_file) {
                $css_file->delete();
            }
        }
    }
}
add_action('updated_post_meta', 'image_renamer_clear_elementor_cache', 10, 4);
add_action('added_post_meta', 'image_renamer_clear_elementor_cache', 10, 4);
