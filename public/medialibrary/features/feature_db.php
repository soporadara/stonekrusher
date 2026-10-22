<?php

/**
 * Feature Database — SQLite Setup
 * ================================
 * Creates and initializes the SQLite database for all new features.
 * All tables use IF NOT EXISTS so this is safe to call on every request.
 */

declare(strict_types=1);

if (! defined('FEATURE_DB_PATH')) {
    require_once __DIR__.'/config.php';
}

function feature_db(): ?PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    if (! class_exists('PDO')) {
        return null;
    }

    $drivers = PDO::getAvailableDrivers();
    if (! in_array('sqlite', $drivers, true)) {
        return null;
    }

    $dbPath = FEATURE_DB_PATH;
    $dir = dirname($dbPath);
    if (! is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }

    try {
        $pdo = new PDO('sqlite:'.$dbPath, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec('PRAGMA journal_mode=WAL');
        $pdo->exec('PRAGMA foreign_keys=ON');
        feature_db_migrate($pdo);

        return $pdo;
    } catch (Throwable $e) {
        error_log('[FeatureDB] '.$e->getMessage());

        return null;
    }
}

function feature_db_migrate(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS folder_meta (
            path        TEXT NOT NULL PRIMARY KEY,
            color       TEXT NOT NULL DEFAULT '',
            updated_at  INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS folder_favorites (
            user_id     TEXT NOT NULL,
            path        TEXT NOT NULL,
            created_at  INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, path)
        );

        CREATE TABLE IF NOT EXISTS folder_pins (
            user_id     TEXT NOT NULL,
            path        TEXT NOT NULL,
            sort_order  INTEGER NOT NULL DEFAULT 0,
            created_at  INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, path)
        );

        CREATE TABLE IF NOT EXISTS sidebar_pins (
            user_id     TEXT NOT NULL,
            path        TEXT NOT NULL,
            is_dir      INTEGER NOT NULL DEFAULT 0,
            created_at  INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, path)
        );

        CREATE TABLE IF NOT EXISTS image_versions (
            id              TEXT NOT NULL PRIMARY KEY,
            original_path   TEXT NOT NULL,
            version_num     INTEGER NOT NULL DEFAULT 1,
            stored_path     TEXT NOT NULL,
            size            INTEGER NOT NULL DEFAULT 0,
            sha256          TEXT NOT NULL DEFAULT '',
            replaced_at     INTEGER NOT NULL DEFAULT 0,
            replaced_by     TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_image_versions_original ON image_versions(original_path);

        CREATE TABLE IF NOT EXISTS file_hashes (
            path        TEXT NOT NULL PRIMARY KEY,
            sha256      TEXT NOT NULL DEFAULT '',
            md5         TEXT NOT NULL DEFAULT '',
            size        INTEGER NOT NULL DEFAULT 0,
            mtime       INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS ai_jobs (
            id              TEXT NOT NULL PRIMARY KEY,
            user_id         TEXT NOT NULL DEFAULT '',
            source_path     TEXT NOT NULL,
            output_type     TEXT NOT NULL DEFAULT 'transparent',
            status          TEXT NOT NULL DEFAULT 'pending',
            result_path     TEXT NOT NULL DEFAULT '',
            error           TEXT NOT NULL DEFAULT '',
            created_at      INTEGER NOT NULL DEFAULT 0,
            updated_at      INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_ai_jobs_user ON ai_jobs(user_id);
        CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_jobs(status);
    ");
}

// ─── Helper: get folder meta for a list of folder paths ─────────────────────
function feature_db_get_folder_meta_bulk(array $paths, string $userId): array
{
    $db = feature_db();
    $result = [];

    foreach ($paths as $p) {
        $result[$p] = ['color' => '', 'is_favorite' => false, 'is_pinned' => false];
    }

    if (! $db || empty($paths)) {
        return $result;
    }

    try {
        $placeholders = implode(',', array_fill(0, count($paths), '?'));

        // Colors
        $stmt = $db->prepare("SELECT path, color FROM folder_meta WHERE path IN ($placeholders)");
        $stmt->execute($paths);
        foreach ($stmt->fetchAll() as $row) {
            $result[$row['path']]['color'] = $row['color'];
        }

        // Favorites
        $stmt = $db->prepare("SELECT path FROM folder_favorites WHERE user_id=? AND path IN ($placeholders)");
        $stmt->execute(array_merge([$userId], $paths));
        foreach ($stmt->fetchAll() as $row) {
            $result[$row['path']]['is_favorite'] = true;
        }

        // Pins
        $stmt = $db->prepare("SELECT path FROM folder_pins WHERE user_id=? AND path IN ($placeholders)");
        $stmt->execute(array_merge([$userId], $paths));
        foreach ($stmt->fetchAll() as $row) {
            $result[$row['path']]['is_pinned'] = true;
        }
    } catch (Throwable $e) {
        error_log('[FeatureDB bulk_meta] '.$e->getMessage());
    }

    return $result;
}
