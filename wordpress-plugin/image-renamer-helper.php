<?php
/**
 * Plugin Name: Image Renamer Helper
 * Plugin URI: https://github.com/wordpress-image-renamer
 * Description: Expose les champs meta Elementor via REST API + regeneration cache
 * Version: 1.1.0
 * Author: WordPress Image Renamer
 * License: GPL v2 or later
 */

if (!defined('ABSPATH')) {
    exit;
}

// Register meta fields for REST API
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

// Register REST API endpoint for cache clearing
add_action('rest_api_init', 'image_renamer_register_rest_routes');

function image_renamer_register_rest_routes() {
    register_rest_route('image-renamer/v1', '/clear-cache', array(
        'methods' => 'POST',
        'callback' => 'image_renamer_clear_cache',
        'permission_callback' => function() {
            return current_user_can('edit_posts');
        },
        'args' => array(
            'post_id' => array(
                'required' => false,
                'type' => 'integer',
                'description' => 'Post ID to clear cache for (optional, clears all if not provided)',
            ),
        ),
    ));
}

function image_renamer_clear_cache($request) {
    $post_id = $request->get_param('post_id');
    $cleared = array();

    // Check if Elementor is active
    if (!class_exists('\Elementor\Plugin')) {
        return new WP_REST_Response(array(
            'success' => false,
            'message' => 'Elementor not active',
        ), 400);
    }

    try {
        // Clear specific post cache
        if ($post_id) {
            // Delete CSS file for this post
            $css_file = \Elementor\Core\Files\CSS\Post::create($post_id);
            if ($css_file) {
                $css_file->delete();
                $cleared[] = "Post CSS: $post_id";
            }

            // Clear post meta cache
            delete_post_meta($post_id, '_elementor_css');
            $cleared[] = "Post meta CSS: $post_id";

            // Update modification time to force refresh
            update_post_meta($post_id, '_elementor_version', ELEMENTOR_VERSION);
        }

        // Clear global Elementor cache
        if (class_exists('\Elementor\Plugin')) {
            // Clear files cache
            \Elementor\Plugin::$instance->files_manager->clear_cache();
            $cleared[] = 'Global files cache';
        }

        return new WP_REST_Response(array(
            'success' => true,
            'message' => 'Cache cleared successfully',
            'cleared' => $cleared,
        ), 200);

    } catch (Exception $e) {
        return new WP_REST_Response(array(
            'success' => false,
            'message' => $e->getMessage(),
        ), 500);
    }
}
