<?php

/**
 * Storage Dashboard Handler
 * =========================
 * Returns storage stats for the AJAX storage widget.
 */

declare(strict_types=1);

function storage_dashboard_handle(string $baseDir, int $quotaBytes): void
{
    header('Content-Type: application/json');

    $used = storage_dir_size($baseDir);
    $quota = max(1, $quotaBytes);
    $pct = min(100, round(($used / $quota) * 100, 1));

    // Count images and folders
    $imageCount = 0;
    $folderCount = 0;
    $fileCount = 0;
    $imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'];

    if (is_dir($baseDir)) {
        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($baseDir, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );
        foreach ($it as $f) {
            if (storage_should_skip($f)) {
                continue;
            }
            if ($f->isDir()) {
                $folderCount++;
            } elseif ($f->isFile()) {
                $fileCount++;
                if (in_array(strtolower($f->getExtension()), $imageExts, true)) {
                    $imageCount++;
                }
            }
        }
    }

    echo json_encode([
        'success' => true,
        'used_bytes' => $used,
        'quota_bytes' => $quota,
        'used_fmt' => storage_format_bytes($used),
        'quota_fmt' => storage_format_bytes($quota),
        'pct' => $pct,
        'image_count' => $imageCount,
        'folder_count' => $folderCount,
        'file_count' => $fileCount,
    ]);
    exit;
}

function storage_dir_size(string $dir): int
{
    $size = 0;
    if (! is_dir($dir)) {
        return 0;
    }
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );
    foreach ($it as $f) {
        if (storage_should_skip($f)) {
            continue;
        }
        if ($f->isFile()) {
            $size += $f->getSize();
        }
    }

    return $size;
}

function storage_should_skip(SplFileInfo $file): bool
{
    $path = str_replace('\\', '/', $file->getPathname());
    foreach (explode('/', $path) as $part) {
        if ($part === '') {
            continue;
        }
        if (storage_hidden_name($part)) {
            return true;
        }
    }

    return storage_hidden_name($file->getFilename());
}

function storage_hidden_name(string $base): bool
{
    if (function_exists('shouldHideFromFileManager') && shouldHideFromFileManager($base)) {
        return true;
    }

    return $base === 'index.html'
        || $base === '.security.json'
        || $base === '.versions'
        || $base === '.trash'
        || $base === '.DS_Store'
        || str_starts_with($base, '._');
}

function storage_format_bytes(int $bytes): string
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
