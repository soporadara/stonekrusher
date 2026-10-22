<?php

/**
 * Duplicate Finder AJAX Handler
 * ==============================
 * Scans folder(s) for duplicate images.
 * Uses SHA256 + MD5 + size hashing, cached in SQLite.
 */

declare(strict_types=1);

if (! defined('FEATURE_DB_PATH')) {
    require_once __DIR__.'/config.php';
}
require_once __DIR__.'/feature_db.php';

function duplicate_finder_handle(array $post, string $baseDir, string $currentDir, string $baseUrl, string $current): void
{
    header('Content-Type: application/json');

    $scope = ($post['scope'] ?? 'all') === 'current' ? 'current' : 'all';
    $byHash = ! empty($post['by_hash']);
    $byName = ! empty($post['by_name']);
    $bySize = ! empty($post['by_size']);

    if (! $byHash && ! $byName && ! $bySize) {
        $byHash = true;
    } // default

    $scanDir = ($scope === 'current') ? $currentDir : $baseDir;
    $scanRelBase = ($scope === 'current') ? $current : '';

    // Collect all image files
    $files = duplicate_collect_files($scanDir, $scanRelBase);

    // Compute/load hashes
    $files = duplicate_load_hashes($files);

    // Group by criteria
    $groups = duplicate_group($files, $byHash, $byName, $bySize, $baseUrl, $baseDir);

    echo json_encode(['success' => true, 'groups' => array_values($groups), 'total_files' => count($files)]);
    exit;
}

function duplicate_collect_files(string $dir, string $relBase): array
{
    $files = [];
    if (! is_dir($dir)) {
        return $files;
    }

    $imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );

    foreach ($it as $file) {
        if (! $file->isFile()) {
            continue;
        }
        $name = $file->getFilename();
        if (str_starts_with($name, '.')) {
            continue;
        }
        if (str_starts_with($file->getPath(), $dir.'/.versions')) {
            continue;
        }
        if (str_starts_with($file->getPath(), $dir.'/.trash')) {
            continue;
        }

        $ext = strtolower($file->getExtension());
        if (! in_array($ext, $imageExts, true)) {
            continue;
        }

        $abs = $file->getPathname();
        $rel = ltrim(str_replace($dir, '', $abs), '/');
        if ($relBase) {
            $rel = $relBase.'/'.$rel;
        }
        $rel = ltrim($rel, '/');

        $files[] = [
            'abs' => $abs,
            'rel' => $rel,
            'name' => $name,
            'size' => $file->getSize(),
            'mtime' => (int) $file->getMTime(),
            'sha256' => '',
            'md5' => '',
        ];
    }

    return $files;
}

function duplicate_load_hashes(array $files): array
{
    $db = feature_db();

    foreach ($files as &$f) {
        $sha256 = '';
        $md5 = '';

        if ($db) {
            try {
                $stmt = $db->prepare('SELECT sha256, md5, size, mtime FROM file_hashes WHERE path=?');
                $stmt->execute([$f['abs']]);
                $row = $stmt->fetch();
                if ($row && (int) $row['size'] === $f['size'] && (int) $row['mtime'] === $f['mtime']) {
                    $sha256 = $row['sha256'];
                    $md5 = $row['md5'];
                }
            } catch (Throwable $e) {
            }
        }

        if ($sha256 === '') {
            $sha256 = (string) (@hash_file('sha256', $f['abs']) ?: '');
            $md5 = (string) (@hash_file('md5', $f['abs']) ?: '');
            if ($db && $sha256 !== '') {
                try {
                    $db->prepare('INSERT INTO file_hashes(path, sha256, md5, size, mtime) VALUES(?,?,?,?,?) ON CONFLICT(path) DO UPDATE SET sha256=excluded.sha256, md5=excluded.md5, size=excluded.size, mtime=excluded.mtime')
                        ->execute([$f['abs'], $sha256, $md5, $f['size'], $f['mtime']]);
                } catch (Throwable $e) {
                }
            }
        }

        $f['sha256'] = $sha256;
        $f['md5'] = $md5;
    }
    unset($f);

    return $files;
}

function duplicate_group(array $files, bool $byHash, bool $byName, bool $bySize, string $baseUrl, string $baseDir): array
{
    $buckets = [];

    foreach ($files as $f) {
        $keys = [];
        if ($byHash && $f['sha256']) {
            $keys[] = 'hash:'.$f['sha256'];
        }
        if ($byName) {
            $keys[] = 'name:'.strtolower($f['name']);
        }
        if ($bySize) {
            $keys[] = 'size:'.$f['size'];
        }

        foreach ($keys as $key) {
            $buckets[$key][] = $f;
        }
    }

    $groups = [];
    $seen = [];

    foreach ($buckets as $key => $group) {
        if (count($group) < 2) {
            continue;
        }

        // De-duplicate by set of paths
        $pathSet = implode('|', array_map(fn ($f) => $f['rel'], $group));
        if (isset($seen[$pathSet])) {
            continue;
        }
        $seen[$pathSet] = true;

        $reason = match (true) {
            str_starts_with($key, 'hash:') => 'Identical file (SHA256)',
            str_starts_with($key, 'name:') => 'Same filename',
            str_starts_with($key, 'size:') => 'Same file size',
            default => 'Duplicate',
        };

        $items = [];
        foreach ($group as $f) {
            $urlParts = array_map('rawurlencode', explode('/', $f['rel']));
            $pubUrl = $baseUrl.'/'.implode('/', $urlParts);
            $isImg = in_array(strtolower(pathinfo($f['name'], PATHINFO_EXTENSION)), ['jpg', 'jpeg', 'png', 'webp', 'gif'], true);
            $items[] = [
                'name' => $f['name'],
                'rel' => $f['rel'],
                'size' => $f['size'],
                'sha256' => $f['sha256'],
                'md5' => $f['md5'],
                'mtime' => $f['mtime'],
                'url' => $pubUrl,
                'thumb_url' => $isImg ? $pubUrl.'?v='.$f['mtime'] : '',
            ];
        }

        $groups[] = [
            'reason' => $reason,
            'key' => $key,
            'count' => count($items),
            'items' => $items,
        ];
    }

    return $groups;
}
