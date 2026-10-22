<?php
/**
 * Folder Meta AJAX Handler
 * ========================
 * Handles: folder colors, favorites, pins
 * All operations are AJAX (JSON responses).
 * Called from main panel via fetch().
 */

declare(strict_types=1);

if (!defined('FEATURE_DB_PATH')) {
    require_once __DIR__ . '/config.php';
}
require_once __DIR__ . '/feature_db.php';

$FOLDER_COLORS = ['', 'blue', 'green', 'yellow', 'red', 'purple', 'orange'];

function folder_meta_handle(string $action, array $post, string $userId, string $baseDir): void {
    global $FOLDER_COLORS;
    $db = feature_db();
    header('Content-Type: application/json');

    if (!$db) {
        echo json_encode(['success' => false, 'error' => 'Feature DB unavailable (SQLite not installed?)']);
        exit;
    }

    $path = trim($post['folder_path'] ?? '');
    $path = str_replace(['..', "\0", "\\"], '', $path);
    $path = trim($path, '/');

    if ($action === 'set_folder_color') {
        $color = $post['color'] ?? '';
        if (!in_array($color, $FOLDER_COLORS, true)) {
            echo json_encode(['success' => false, 'error' => 'Invalid color']);
            exit;
        }
        try {
            $stmt = $db->prepare("INSERT INTO folder_meta(path, color, updated_at) VALUES(?,?,?) ON CONFLICT(path) DO UPDATE SET color=excluded.color, updated_at=excluded.updated_at");
            $stmt->execute([$path, $color, time()]);
            echo json_encode(['success' => true, 'color' => $color]);
        } catch (Throwable $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'toggle_favorite') {
        try {
            $stmt = $db->prepare("SELECT 1 FROM folder_favorites WHERE user_id=? AND path=?");
            $stmt->execute([$userId, $path]);
            $exists = (bool)$stmt->fetchColumn();
            if ($exists) {
                $db->prepare("DELETE FROM folder_favorites WHERE user_id=? AND path=?")->execute([$userId, $path]);
                echo json_encode(['success' => true, 'is_favorite' => false]);
            } else {
                $db->prepare("INSERT OR IGNORE INTO folder_favorites(user_id, path, created_at) VALUES(?,?,?)")->execute([$userId, $path, time()]);
                echo json_encode(['success' => true, 'is_favorite' => true]);
            }
        } catch (Throwable $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'toggle_pin') {
        try {
            $stmt = $db->prepare("SELECT 1 FROM folder_pins WHERE user_id=? AND path=?");
            $stmt->execute([$userId, $path]);
            $exists = (bool)$stmt->fetchColumn();
            if ($exists) {
                $db->prepare("DELETE FROM folder_pins WHERE user_id=? AND path=?")->execute([$userId, $path]);
                echo json_encode(['success' => true, 'is_pinned' => false]);
            } else {
                $db->prepare("INSERT OR IGNORE INTO folder_pins(user_id, path, sort_order, created_at) VALUES(?,?,?,?)")->execute([$userId, $path, time(), time()]);
                echo json_encode(['success' => true, 'is_pinned' => true]);
            }
        } catch (Throwable $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'toggle_sidebar_pin') {
        $isDir = (int)($post['is_dir'] ?? 0);
        try {
            $stmt = $db->prepare("SELECT 1 FROM sidebar_pins WHERE user_id=? AND path=?");
            $stmt->execute([$userId, $path]);
            $exists = (bool)$stmt->fetchColumn();
            if ($exists) {
                $db->prepare("DELETE FROM sidebar_pins WHERE user_id=? AND path=?")->execute([$userId, $path]);
                echo json_encode(['success' => true, 'is_pinned' => false]);
            } else {
                $db->prepare("INSERT OR IGNORE INTO sidebar_pins(user_id, path, is_dir, created_at) VALUES(?,?,?,?)")->execute([$userId, $path, $isDir, time()]);
                echo json_encode(['success' => true, 'is_pinned' => true]);
            }
        } catch (Throwable $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'get_folder_meta_bulk') {
        $paths = $post['paths'] ?? [];
        if (!is_array($paths)) $paths = [];
        $paths = array_filter(array_map(fn($p) => trim((string)$p, '/'), $paths));
        $meta = feature_db_get_folder_meta_bulk(array_values($paths), $userId);
        echo json_encode(['success' => true, 'meta' => $meta]);
        exit;
    }

    echo json_encode(['success' => false, 'error' => 'Unknown action']);
    exit;
}
