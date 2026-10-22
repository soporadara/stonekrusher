<?php

/**
 * Properties AJAX Handler
 * =======================
 * Returns full metadata for a file or folder.
 * Computes + caches SHA256/MD5 in SQLite.
 */

declare(strict_types=1);

if (! defined('FEATURE_DB_PATH')) {
    require_once __DIR__.'/config.php';
}
require_once __DIR__.'/feature_db.php';

function properties_handle(string $itemName, string $itemPath, string $relativePath, bool $isDir): void
{
    header('Content-Type: application/json');

    if (! file_exists($itemPath)) {
        echo json_encode(['success' => false, 'error' => 'File not found']);
        exit;
    }

    $props = [];

    if ($isDir) {
        $props = [
            'type' => 'folder',
            'name' => $itemName,
            'path' => $relativePath,
            'size' => properties_folder_size($itemPath),
            'items' => properties_count_items($itemPath),
            'created' => @filectime($itemPath) ?: @filemtime($itemPath),
            'modified' => @filemtime($itemPath),
        ];
    } else {
        $size = @filesize($itemPath) ?: 0;
        $mtime = (int) (@filemtime($itemPath) ?: 0);
        $ctime = (int) (@filectime($itemPath) ?: $mtime);
        $ext = strtolower(pathinfo($itemName, PATHINFO_EXTENSION));
        $mime = properties_mime($itemPath, $ext);

        $width = 0;
        $height = 0;
        $dpi_x = 0;
        $dpi_y = 0;
        if (in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif'], true) && function_exists('getimagesize')) {
            $info = @getimagesize($itemPath);
            if ($info) {
                $width = (int) $info[0];
                $height = (int) $info[1];
                if (isset($info['APP1'])) {
                    // EXIF DPI — best-effort
                }
            }
        }

        // Hash (cached in SQLite)
        [$sha256, $md5] = properties_get_hashes($itemPath, $size, $mtime);

        $props = [
            'type' => 'file',
            'name' => $itemName,
            'path' => $relativePath,
            'extension' => $ext,
            'mime' => $mime,
            'size' => $size,
            'size_fmt' => properties_format_size($size),
            'width' => $width,
            'height' => $height,
            'dpi' => ($dpi_x > 0 ? "{$dpi_x}×{$dpi_y}" : '—'),
            'created' => $ctime,
            'modified' => $mtime,
            'sha256' => $sha256,
            'md5' => $md5,
            'downloads' => '—',
            'views' => '—',
        ];
    }

    echo json_encode(['success' => true, 'props' => $props]);
    exit;
}

function properties_get_hashes(string $path, int $size, int $mtime): array
{
    $db = feature_db();
    if ($db) {
        try {
            $stmt = $db->prepare('SELECT sha256, md5, size, mtime FROM file_hashes WHERE path=?');
            $stmt->execute([$path]);
            $row = $stmt->fetch();
            if ($row && (int) $row['size'] === $size && (int) $row['mtime'] === $mtime) {
                return [$row['sha256'], $row['md5']];
            }
        } catch (Throwable $e) {
        }
    }

    $sha256 = (string) (@hash_file('sha256', $path) ?: '—');
    $md5 = (string) (@hash_file('md5', $path) ?: '—');

    if ($db && $sha256 !== '—') {
        try {
            $db->prepare('INSERT INTO file_hashes(path, sha256, md5, size, mtime) VALUES(?,?,?,?,?) ON CONFLICT(path) DO UPDATE SET sha256=excluded.sha256, md5=excluded.md5, size=excluded.size, mtime=excluded.mtime')
                ->execute([$path, $sha256, $md5, $size, $mtime]);
        } catch (Throwable $e) {
        }
    }

    return [$sha256, $md5];
}

function properties_folder_size(string $dir): int
{
    $size = 0;
    if (! is_dir($dir)) {
        return 0;
    }
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $file) {
        if ($file->isFile()) {
            $size += $file->getSize();
        }
    }

    return $size;
}

function properties_count_items(string $dir): array
{
    $files = $folders = 0;
    if (! is_dir($dir)) {
        return ['files' => 0, 'folders' => 0];
    }
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::SELF_FIRST);
    foreach ($it as $f) {
        if ($f->isDir()) {
            $folders++;
        } elseif ($f->isFile()) {
            $files++;
        }
    }

    return ['files' => $files, 'folders' => $folders];
}

function properties_mime(string $path, string $ext): string
{
    $map = [
        'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp',
        'gif' => 'image/gif', 'svg' => 'image/svg+xml', 'html' => 'text/html', 'css' => 'text/css',
        'js' => 'application/javascript', 'json' => 'application/json', 'php' => 'application/x-php',
        'txt' => 'text/plain',
    ];
    if (isset($map[$ext])) {
        return $map[$ext];
    }
    if (function_exists('mime_content_type')) {
        $m = @mime_content_type($path);
        if ($m) {
            return $m;
        }
    }

    return 'application/octet-stream';
}

function properties_format_size(int $bytes): string
{
    if ($bytes >= 1073741824) {
        return round($bytes / 1073741824, 2).' GB';
    }
    if ($bytes >= 1048576) {
        return round($bytes / 1048576, 2).' MB';
    }
    if ($bytes >= 1024) {
        return round($bytes / 1024, 2).' KB';
    }

    return $bytes.' B';
}
