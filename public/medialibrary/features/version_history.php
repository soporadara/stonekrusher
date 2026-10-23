<?php
/**
 * Version History Handler
 * =======================
 * Get / restore / delete / download image versions.
 */

declare(strict_types=1);

if (!defined('FEATURE_DB_PATH')) {
    require_once __DIR__ . '/config.php';
}
require_once __DIR__ . '/feature_db.php';

function version_history_handle(string $action, array $post, string $baseDir, string $currentDir, string $current, string $userId, callable $cleanExistingName, callable $formatSize, callable $autoBackup): void {
    header('Content-Type: application/json');

    $db = feature_db();
    if (!$db) {
        echo json_encode(['success' => false, 'error' => 'Feature DB unavailable']);
        exit;
    }

    if ($action === 'get_versions') {
        $itemName   = ($cleanExistingName)($post['item_name'] ?? '');
        $relPath    = $current ? $current . '/' . $itemName : $itemName;

        try {
            $stmt = $db->prepare("SELECT * FROM image_versions WHERE original_path=? ORDER BY version_num DESC");
            $stmt->execute([$relPath]);
            $rows = $stmt->fetchAll();
            $versions = [];
            foreach ($rows as $row) {
                // Legacy paths stored in DB started with .versions/, newer ones don't
                $sp = preg_replace('/^\.versions\//', '', $row['stored_path']);
                $storedAbs = AI_VERSIONS_DIR . '/' . $sp;
                $row['exists']    = is_file($storedAbs);
                $row['size_fmt']  = ($formatSize)((int)$row['size']);
                $row['date_fmt']  = date('M d, Y H:i', (int)$row['replaced_at']);
                $versions[]       = $row;
            }
            echo json_encode(['success' => true, 'versions' => $versions, 'original_path' => $relPath]);
        } catch (Throwable $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'restore_version') {
        $versionId = preg_replace('/[^a-f0-9]/', '', $post['version_id'] ?? '');
        if (!$versionId) { echo json_encode(['success' => false, 'error' => 'Invalid version ID']); exit; }

        try {
            $stmt = $db->prepare("SELECT * FROM image_versions WHERE id=?");
            $stmt->execute([$versionId]);
            $ver = $stmt->fetch();
        } catch (Throwable $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            exit;
        }

        if (!$ver) { echo json_encode(['success' => false, 'error' => 'Version not found']); exit; }

        $sp = preg_replace('/^\.versions\//', '', $ver['stored_path']);
        $storedAbs  = AI_VERSIONS_DIR . '/' . $sp;
        $originalAbs = $baseDir . '/' . $ver['original_path'];

        if (!is_file($storedAbs)) { echo json_encode(['success' => false, 'error' => 'Version file missing on disk']); exit; }

        // Version current live file first
        if (is_file($originalAbs)) {
            ($autoBackup)([$originalAbs]);
            $ext      = strtolower(pathinfo($ver['original_path'], PATHINFO_EXTENSION));
            $versionDir = AI_VERSIONS_DIR . '/' . $ver['original_path'];
            if (!is_dir($versionDir)) @mkdir($versionDir, 0755, true);

            // Next version num
            $stmt = $db->prepare("SELECT MAX(version_num) FROM image_versions WHERE original_path=?");
            $stmt->execute([$ver['original_path']]);
            $max = (int)($stmt->fetchColumn() ?: 0);
            $newVerNum = $max + 1;

            $newVerFile = $versionDir . '/v' . $newVerNum . '.' . $ext;
            $newVerRel  = $ver['original_path'] . '/v' . $newVerNum . '.' . $ext;
            if (@copy($originalAbs, $newVerFile)) {
                $db->prepare("INSERT INTO image_versions(id, original_path, version_num, stored_path, size, sha256, replaced_at, replaced_by) VALUES(?,?,?,?,?,?,?,?)")
                   ->execute([bin2hex(random_bytes(12)), $ver['original_path'], $newVerNum, $newVerRel, (int)filesize($newVerFile), (string)(@hash_file('sha256', $newVerFile) ?: ''), time(), $userId]);
            }
        }

        // Restore version to live path
        $dir = dirname($originalAbs);
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        if (!@copy($storedAbs, $originalAbs)) {
            echo json_encode(['success' => false, 'error' => 'Could not restore version file']); exit;
        }
        @chmod($originalAbs, 0644);

        echo json_encode(['success' => true, 'message' => 'Version ' . $ver['version_num'] . ' restored successfully.']);
        exit;
    }

    if ($action === 'delete_version') {
        $versionId = preg_replace('/[^a-f0-9]/', '', $post['version_id'] ?? '');

        try {
            $stmt = $db->prepare("SELECT * FROM image_versions WHERE id=?");
            $stmt->execute([$versionId]);
            $ver = $stmt->fetch();
        } catch (Throwable $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]); exit;
        }

        if (!$ver) { echo json_encode(['success' => false, 'error' => 'Version not found']); exit; }

        $sp = preg_replace('/^\.versions\//', '', $ver['stored_path']);
        $storedAbs = AI_VERSIONS_DIR . '/' . $sp;
        if (is_file($storedAbs)) @unlink($storedAbs);

        try {
            $db->prepare("DELETE FROM image_versions WHERE id=?")->execute([$versionId]);
        } catch (Throwable $e) {}

        echo json_encode(['success' => true, 'message' => 'Version deleted.']);
        exit;
    }

    if ($action === 'download_version') {
        $versionId = preg_replace('/[^a-f0-9]/', '', $post['version_id'] ?? '');

        try {
            $stmt = $db->prepare("SELECT * FROM image_versions WHERE id=?");
            $stmt->execute([$versionId]);
            $ver = $stmt->fetch();
        } catch (Throwable $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]); exit;
        }

        if (!$ver) { echo json_encode(['success' => false, 'error' => 'Version not found']); exit; }

        $sp = preg_replace('/^\.versions\//', '', $ver['stored_path']);
        $storedAbs = AI_VERSIONS_DIR . '/' . $sp;
        if (!is_file($storedAbs)) { echo json_encode(['success' => false, 'error' => 'Version file missing']); exit; }

        // Stream download
        while (ob_get_level()) ob_end_clean();
        $dlName = pathinfo($ver['original_path'], PATHINFO_FILENAME) . '_v' . $ver['version_num'] . '.' . pathinfo($storedAbs, PATHINFO_EXTENSION);
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . str_replace('"', '', $dlName) . '"');
        header('Content-Length: ' . filesize($storedAbs));
        header('Cache-Control: private, max-age=0');
        readfile($storedAbs);
        exit;
    }

    echo json_encode(['success' => false, 'error' => 'Unknown action']);
    exit;
}
