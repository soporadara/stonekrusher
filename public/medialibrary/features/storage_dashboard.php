<?php
/**
 * Storage Dashboard Handler (Optimized)
 * =====================================
 * Returns storage stats for the AJAX storage widget.
 * Features single-pass directory traversal and 120s transient caching.
 */

declare(strict_types=1);

function storage_dashboard_handle(string $baseDir, int $quotaBytes): void {
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }
    header('Content-Type: application/json');

    $quota         = max(1, $quotaBytes);
    $cacheHash     = md5($baseDir);
    $cacheFile     = sys_get_temp_dir() . '/imghost_storage_' . $cacheHash . '.json';
    $projCacheFile = dirname(__DIR__) . '/.storage_cache_' . $cacheHash . '.json';
    $activeCache   = is_file($projCacheFile) ? $projCacheFile : (is_file($cacheFile) ? $cacheFile : $projCacheFile);
    $force         = !empty($_POST['force']) || !empty($_GET['force']);

    // Serve from transient cache if valid (< 600 seconds = 10 minutes)
    if (!$force && is_file($activeCache) && (time() - (int)@filemtime($activeCache) < 600)) {
        $cached = @file_get_contents($activeCache);
        if ($cached) {
            $data = json_decode($cached, true);
            if (is_array($data) && !empty($data['success'])) {
                // Recalculate percentage in case quota parameter changed
                $data['quota_bytes'] = $quota;
                $data['quota_fmt']   = storage_format_bytes($quota);
                $data['pct']         = min(100, round(($data['used_bytes'] / $quota) * 100, 1));
                echo json_encode($data);
                exit;
            }
        }
    }

    $used        = 0;
    $imageCount  = 0;
    $videoCount  = 0;
    $folderCount = 0;
    $fileCount   = 0;
    $imageExts   = ['jpg','jpeg','png','webp','gif','svg','avif'];
    $videoExts   = ['mp4','webm','mov','mkv','avi','wmv','flv','m4v','3gp','ogv','ogg','ts','mts','m2ts','vob','mpg','mpeg','asf','rm','rmvb'];

    global $BASE_DIR;
    $isRoot = empty($BASE_DIR) || realpath($baseDir) === realpath($BASE_DIR);

    if (is_dir($baseDir)) {
        try {
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
                    $used += (int)$f->getSize();
                    $fExt = strtolower($f->getExtension());
                    if (in_array($fExt, $imageExts, true)) {
                        $imageCount++;
                    } elseif (in_array($fExt, $videoExts, true)) {
                        $videoCount++;
                    }
                }
            }
        } catch (\Throwable $e) {
            $entries = @scandir($baseDir) ?: [];
            foreach ($entries as $item) {
                if ($item === '.' || $item === '..' || storage_hidden_name($item)) continue;
                $p = $baseDir . '/' . $item;
                if (is_dir($p)) {
                    $folderCount++;
                } elseif (is_file($p)) {
                    $fileCount++;
                    $used += (int)@filesize($p);
                }
            }
        }
    }

    $pct = min(100, round(($used / $quota) * 100, 1));

    $response = [
        'success'      => true,
        'used_bytes'   => $used,
        'quota_bytes'  => $quota,
        'used_fmt'     => storage_format_bytes($used),
        'quota_fmt'    => storage_format_bytes($quota),
        'pct'          => $pct,
        'image_count'  => $imageCount,
        'video_count'  => $videoCount,
        'folder_count' => $folderCount,
        'file_count'   => $fileCount,
        'cached_at'    => time(),
    ];

    $payload = json_encode($response);
    @file_put_contents($projCacheFile, $payload, LOCK_EX);
    if ($projCacheFile !== $cacheFile) {
        @file_put_contents($cacheFile, $payload, LOCK_EX);
    }

    echo $payload;
    exit;
}

/**
 * Invalidate all storage dashboard caches when files are added, deleted, or moved.
 */
function storage_dashboard_invalidate_cache(): void {
    $tempDir = sys_get_temp_dir();
    $files = @glob($tempDir . '/imghost_storage_*.json') ?: [];
    $projFiles = @glob(dirname(__DIR__) . '/.storage_cache_*.json') ?: [];
    foreach (array_merge($files, $projFiles) as $f) {
        if (is_file($f)) {
            @unlink($f);
        }
    }
}

function storage_dir_size(string $dir): int {
    $size = 0;
    if (!is_dir($dir)) return 0;
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );
    foreach ($it as $f) {
        if (storage_should_skip($f)) {
            continue;
        }
        if ($f->isFile()) $size += $f->getSize();
    }
    return $size;
}

function storage_should_skip(SplFileInfo $file): bool {
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

function storage_hidden_name(string $base): bool {
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

function storage_format_bytes(int $bytes): string {
    if ($bytes >= 1073741824) return round($bytes / 1073741824, 2) . ' GB';
    if ($bytes >= 1048576)    return round($bytes / 1048576, 2) . ' MB';
    if ($bytes >= 1024)       return round($bytes / 1024, 2) . ' KB';
    return $bytes . ' B';
}
