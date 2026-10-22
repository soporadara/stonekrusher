<?php

/**
 * Feature Configuration
 * =====================
 * Edit this file to configure optional features.
 * NEVER expose API keys in frontend code.
 */

// ─── Bria AI API ───────────────────────────────────────────────────────────
// Get your key at: https://platform.bria.ai/
define('BRIA_API_KEY', 'ee1ecfed2b0a4106bf3e7281933b3c5a');
define('BRIA_API_ENDPOINT', 'https://engine.prod.bria-api.com/v1/background/remove');
define('BRIA_MAX_CONCURRENT_JOBS', 5);     // max parallel AI requests per session
define('BRIA_RATE_LIMIT_PER_MINUTE', 20); // max AI calls per minute

// ─── Storage Quota ─────────────────────────────────────────────────────────
// Set the total storage quota shown in the dashboard (in bytes)
define('STORAGE_QUOTA_BYTES', 15 * 1024 * 1024 * 1024); // 15 GB default

// ─── AI Output Settings ────────────────────────────────────────────────────
// Where to save AI-processed images (relative to the source folder)
define('AI_OUTPUT_SUBFOLDER', 'AI Output');   // subfolder inside current folder
define('AI_VERSIONS_DIR', __DIR__.'/.versions'); // hidden folder for image versions (stored outside ebay)

// ─── Feature Toggles ────────────────────────────────────────────────────────
define('FEATURE_AI_BG_REMOVE', true);
define('FEATURE_DUPLICATE_FINDER', true);
define('FEATURE_IMAGE_REPLACE', true);
define('FEATURE_VERSION_HISTORY', true);
define('FEATURE_FOLDER_META', true);  // colors, favorites, pins
define('FEATURE_PROPERTIES', true);

// ─── SQLite DB path ─────────────────────────────────────────────────────────
// Stored outside webroot is ideal; fallback to img root
define('FEATURE_DB_PATH', __DIR__.'/../.feature_db.sqlite');
