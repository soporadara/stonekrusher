<?php

/**
 * Image Replace Handler
 * =====================
 * Replaces an existing image while keeping its URL exactly the same.
 * The old image is versioned into .versions/{relative_path}/v{N}.{ext}
 */

declare(strict_types=1);

if (! defined('FEATURE_DB_PATH')) {
    require_once __DIR__.'/config.php';
}
require_once __DIR__.'/feature_db.php';

function image_replace_handle(array $post, array $files, string $baseDir, string $currentDir, string $current, string $userId, callable $cleanPath, callable $cleanExistingName, callable $autoBackup): void
{
    header('Content-Type: application/json');

    $targetName = ($cleanExistingName)($post['target_name'] ?? '');
    if (! $targetName) {
        echo json_encode(['success' => false, 'error' => 'Target filename missing']);
        exit;
    }

    $targetPath = $currentDir.'/'.$targetName;
    if (! is_file($targetPath)) {
        echo json_encode(['success' => false, 'error' => 'Target file not found']);
        exit;
    }

    // Validate uploaded file
    if (empty($files['replace_file']) || ($files['replace_file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        echo json_encode(['success' => false, 'error' => 'No valid replacement file uploaded']);
        exit;
    }

    $uploadExt = strtolower(pathinfo($files['replace_file']['name'], PATHINFO_EXTENSION));
    $targetExt = strtolower(pathinfo($targetName, PATHINFO_EXTENSION));
    $tmpName = $files['replace_file']['tmp_name'];

    if (! is_uploaded_file($tmpName) && ! is_file($tmpName)) {
        echo json_encode(['success' => false, 'error' => 'Uploaded temp file missing']);
        exit;
    }

    $allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'];
    if (! in_array($uploadExt, $allowedExts, true)) {
        echo json_encode(['success' => false, 'error' => 'File type not allowed']);
        exit;
    }

    // ── Step 1: Version the current file ─────────────────────────────────────
    $relPath = $current ? $current.'/'.$targetName : $targetName;
    $versionDir = AI_VERSIONS_DIR.'/'.$relPath;

    if (! is_dir($versionDir)) {
        @mkdir($versionDir, 0755, true);
    }

    // Find next version number
    $db = feature_db();
    $nextVersionNum = 1;
    if ($db) {
        try {
            $stmt = $db->prepare('SELECT MAX(version_num) FROM image_versions WHERE original_path=?');
            $stmt->execute([$relPath]);
            $max = $stmt->fetchColumn();
            if ($max !== false && $max !== null) {
                $nextVersionNum = (int) $max + 1;
            }
        } catch (Throwable $e) {
        }
    }

    $versionFileName = 'v'.$nextVersionNum.'.'.$targetExt;
    $versionPath = $versionDir.'/'.$versionFileName;
    $versionRelPath = $relPath.'/'.$versionFileName;

    if (! @copy($targetPath, $versionPath)) {
        echo json_encode(['success' => false, 'error' => 'Could not create version backup']);
        exit;
    }

    $versionSha256 = (string) (@hash_file('sha256', $versionPath) ?: '');
    $versionId = bin2hex(random_bytes(12));

    if ($db) {
        try {
            $db->prepare('INSERT INTO image_versions(id, original_path, version_num, stored_path, size, sha256, replaced_at, replaced_by) VALUES(?,?,?,?,?,?,?,?)')
                ->execute([$versionId, $relPath, $nextVersionNum, $versionRelPath, (int) filesize($versionPath), $versionSha256, time(), $userId]);
        } catch (Throwable $e) {
            error_log('[ImageReplace version] '.$e->getMessage());
        }
    }

    // ── Step 2: Replace the original file ────────────────────────────────────
    // Auto-backup old content before replacement
    ($autoBackup)([$targetPath]);

    $placed = false;
    if (is_uploaded_file($tmpName)) {
        $placed = @move_uploaded_file($tmpName, $targetPath);
    }
    if (! $placed) {
        $placed = @rename($tmpName, $targetPath) || (@copy($tmpName, $targetPath) && @unlink($tmpName));
    }

    if (! $placed) {
        // Rollback: restore version file
        @copy($versionPath, $targetPath);
        echo json_encode(['success' => false, 'error' => 'Could not replace file on disk']);
        exit;
    }

    @chmod($targetPath, 0644);

    echo json_encode([
        'success' => true,
        'message' => 'Image replaced. Old version saved as v'.$nextVersionNum.'.',
        'version_num' => $nextVersionNum,
        'version_id' => $versionId,
        'original_path' => $relPath,
    ]);
    exit;
}
