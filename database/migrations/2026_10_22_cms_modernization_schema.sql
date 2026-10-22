-- =========================================================
-- StoneKrusher / KONSTRUCTZ - Enterprise CMS Migration Schema
-- Compatible with MySQL 8.0+ / MariaDB 10.4+ / Hostinger
-- Generated: 2026-10-22
-- =========================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `cms_users` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(255) DEFAULT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'editor',
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `two_factor_secret` VARCHAR(255) DEFAULT NULL,
  `two_factor_enabled` TINYINT(1) DEFAULT 0,
  `failed_login_attempts` INT DEFAULT 0,
  `locked_until` BIGINT DEFAULT NULL,
  `last_login_at` BIGINT DEFAULT NULL,
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Custom Roles Table
CREATE TABLE IF NOT EXISTS `cms_roles` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `display_name` VARCHAR(100) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `permissions` LONGTEXT NOT NULL,
  `is_system` TINYINT(1) DEFAULT 0,
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Sessions Table
CREATE TABLE IF NOT EXISTS `cms_sessions` (
  `id` VARCHAR(128) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(64) NOT NULL,
  `ip_address` VARCHAR(45) NOT NULL,
  `user_agent` TEXT DEFAULT NULL,
  `last_activity` BIGINT NOT NULL,
  `expires_at` BIGINT NOT NULL,
  `is_revoked` TINYINT(1) DEFAULT 0,
  `created_at` BIGINT NOT NULL,
  INDEX `idx_sessions_user` (`user_id`),
  INDEX `idx_sessions_expiry` (`expires_at`, `is_revoked`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Login Attempts Table
CREATE TABLE IF NOT EXISTS `cms_login_attempts` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `identifier` VARCHAR(255) NOT NULL,
  `ip_address` VARCHAR(45) NOT NULL,
  `user_agent` TEXT DEFAULT NULL,
  `success` TINYINT(1) NOT NULL,
  `failure_reason` VARCHAR(100) DEFAULT NULL,
  `created_at` BIGINT NOT NULL,
  INDEX `idx_attempts_ip` (`ip_address`, `created_at`),
  INDEX `idx_attempts_identifier` (`identifier`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Security Blocks Table (IP & Account bans)
CREATE TABLE IF NOT EXISTS `cms_security_blocks` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `type` VARCHAR(20) NOT NULL,
  `target` VARCHAR(255) NOT NULL,
  `reason` TEXT NOT NULL,
  `created_by` VARCHAR(255) NOT NULL,
  `expires_at` BIGINT DEFAULT NULL,
  `created_at` BIGINT NOT NULL,
  INDEX `idx_blocks_target` (`target`, `type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Audit Logs Table
CREATE TABLE IF NOT EXISTS `cms_audit_logs` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(64) DEFAULT NULL,
  `action` VARCHAR(100) NOT NULL,
  `resource_type` VARCHAR(50) NOT NULL,
  `resource_id` VARCHAR(255) DEFAULT NULL,
  `details_json` LONGTEXT DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `created_at` BIGINT NOT NULL,
  INDEX `idx_audit_created` (`created_at`),
  INDEX `idx_audit_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. CMS Settings Table
CREATE TABLE IF NOT EXISTS `cms_settings` (
  `setting_key` VARCHAR(100) NOT NULL PRIMARY KEY,
  `setting_value` LONGTEXT DEFAULT NULL,
  `updated_at` BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Media Library Table
CREATE TABLE IF NOT EXISTS `cms_media` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `filename` VARCHAR(255) NOT NULL,
  `original_name` VARCHAR(255) NOT NULL,
  `filepath` VARCHAR(500) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `file_size` INT NOT NULL,
  `dimensions` VARCHAR(50) DEFAULT NULL,
  `alt_text` VARCHAR(500) DEFAULT NULL,
  `caption` TEXT DEFAULT NULL,
  `uploaded_by` VARCHAR(64) DEFAULT NULL,
  `created_at` BIGINT NOT NULL,
  INDEX `idx_media_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Blog Categories Table
CREATE TABLE IF NOT EXISTS `blog_categories` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL UNIQUE,
  `description` TEXT DEFAULT NULL,
  `parent_id` VARCHAR(64) DEFAULT NULL,
  `display_order` INT DEFAULT 0,
  `created_at` BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Blog Posts Table (Schema update)
CREATE TABLE IF NOT EXISTS `blog_posts` (
  `id` VARCHAR(255) NOT NULL PRIMARY KEY,
  `slug` VARCHAR(255) NOT NULL UNIQUE,
  `title` VARCHAR(500) NOT NULL,
  `category` VARCHAR(100) DEFAULT 'Guide',
  `author` VARCHAR(255) DEFAULT 'Admin KONSTRUCTZ',
  `featured_image` VARCHAR(1000) DEFAULT '',
  `excerpt` TEXT DEFAULT NULL,
  `content` LONGTEXT DEFAULT NULL,
  `data_json` LONGTEXT NOT NULL,
  `status` VARCHAR(50) DEFAULT 'Published',
  `tags_json` TEXT DEFAULT NULL,
  `scheduled_at` BIGINT DEFAULT NULL,
  `published_date` VARCHAR(50) DEFAULT NULL,
  `updated_at` BIGINT DEFAULT NULL,
  `created_by` VARCHAR(64) DEFAULT NULL,
  INDEX `idx_posts_status` (`status`),
  INDEX `idx_posts_category` (`category`),
  INDEX `idx_posts_updated` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Blog Revisions Table
CREATE TABLE IF NOT EXISTS `blog_revisions` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `post_id` VARCHAR(255) NOT NULL,
  `title` VARCHAR(500) NOT NULL,
  `data_json` LONGTEXT NOT NULL,
  `created_by` VARCHAR(64) DEFAULT NULL,
  `created_at` BIGINT NOT NULL,
  INDEX `idx_revisions_post` (`post_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Products Catalog Table
CREATE TABLE IF NOT EXISTS `products` (
  `id` VARCHAR(255) NOT NULL PRIMARY KEY,
  `slug` VARCHAR(255) NOT NULL UNIQUE,
  `name` VARCHAR(500) NOT NULL,
  `sku` VARCHAR(100) DEFAULT NULL,
  `category` VARCHAR(100) DEFAULT NULL,
  `subcategory` VARCHAR(100) DEFAULT NULL,
  `operating_weight` VARCHAR(100) DEFAULT NULL,
  `engine` VARCHAR(255) DEFAULT NULL,
  `price` VARCHAR(100) DEFAULT NULL,
  `image_url` VARCHAR(1000) DEFAULT NULL,
  `gallery_json` LONGTEXT DEFAULT NULL,
  `specs_json` LONGTEXT DEFAULT NULL,
  `description` LONGTEXT DEFAULT NULL,
  `status` VARCHAR(50) DEFAULT 'Published',
  `data_json` LONGTEXT DEFAULT NULL,
  `created_at` BIGINT DEFAULT NULL,
  `updated_at` BIGINT DEFAULT NULL,
  INDEX `idx_products_sku` (`sku`),
  INDEX `idx_products_category` (`category`),
  INDEX `idx_products_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Password Reset Tokens Table
CREATE TABLE IF NOT EXISTS `cms_password_resets` (
  `token` VARCHAR(128) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(64) NOT NULL,
  `expires_at` BIGINT NOT NULL,
  `used` TINYINT(1) DEFAULT 0,
  `created_at` BIGINT NOT NULL,
  INDEX `idx_resets_token` (`token`, `used`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
