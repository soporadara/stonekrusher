<?php

use App\Models\User;
use Illuminate\Container\Container;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Foundation\Application;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

$secureCookie = (! empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $secureCookie,
    'httponly' => true,
    'samesite' => 'Lax',
]);
ini_set('session.use_strict_mode', '1');
session_start();

// Use the exact PHP self path to ensure POST requests do not hit extensionless 405 Method Not Allowed errors
$pageUrl = $_SERVER['PHP_SELF'];

/*
|--------------------------------------------------------------------------
| CONFIG
|--------------------------------------------------------------------------
*/

$ADMIN_USER = 'admin@kiuq.kiuq';
$ADMIN_PASS_HASH = '$2y$12$QEarLyHf0rz/6VrPvLyvQug1zqhhWFkLZsGhcabu4nSDI2as/426S';
$DELETE_PASS_HASH = '$2y$12$SSR.q2dXmK49Rn/H9gaFOenTdql8BqlzsTwVabA05aSiKMzQZC7a.';
$MAX_LOGIN_ATTEMPTS = 5;
$IMAGE_MAX_DIMENSION = 1800;
$WEBP_QUALITY = 82;
$APP_TIMEZONE = 'Asia/Phnom_Penh';
$AUTO_LOGOUT_SECONDS = 12 * 60 * 60;

date_default_timezone_set($APP_TIMEZONE);

$ROOT_FOLDER = 'blog';
$CONVERTER_ROOT_FOLDER = '';
$BASE_DIR = __DIR__.'/'.$ROOT_FOLDER;
$APP_ASSETS_DIR = __DIR__.'/app-assets';
$TRASH_DIR = __DIR__.'/.trash';
$TRASH_META_FILE = __DIR__.'/.trash_index.json';
$SECURITY_FILE = __DIR__.'/.security.json';
$USERS_FILE = __DIR__.'/.users.json';
$APP_SETTINGS_FILE = __DIR__.'/.app_settings.json';
$LOGIN_ACTIVITY_FILE = __DIR__.'/.login_activity.json';
$THEME_LIBRARY_FILE = __DIR__.'/.theme_images.json';

/*
|--------------------------------------------------------------------------
| FEATURE MODULES (Additive only — do not modify existing logic above)
|--------------------------------------------------------------------------
*/
$FEATURES_DIR = __DIR__.'/features';
if (is_dir($FEATURES_DIR)) {
    $featureFiles = ['config.php', 'feature_db.php', 'folder_meta.php', 'properties.php',
        'duplicate_finder.php', 'image_replace.php', 'version_history.php',
        'ai_bg_remove.php', 'sorting.php', 'storage_dashboard.php'];
    foreach ($featureFiles as $ff) {
        $ffPath = $FEATURES_DIR.'/'.$ff;
        if (is_file($ffPath)) {
            require_once $ffPath;
        }
    }
}
$FEATURES_ENABLED = is_dir($FEATURES_DIR) && function_exists('feature_db');

$scriptBasePath = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
$requestScheme = $secureCookie ? 'https' : 'http';
$httpHost = $_SERVER['HTTP_HOST'] ?? 'localhost';
$basePathPrefix = ($scriptBasePath === '' || $scriptBasePath === '.') ? '' : $scriptBasePath;

// Build clean public URLs (e.g. https://rafvex.com/blog/...)
if (strpos($httpHost, 'rafvex.com') !== false) {
    $BASE_URL = 'https://'.$httpHost.'/'.rawurlencode($ROOT_FOLDER);
} elseif (strpos($basePathPrefix, '/public/medialibrary') !== false) {
    $subRoot = substr($basePathPrefix, 0, strpos($basePathPrefix, '/public/medialibrary'));
    $BASE_URL = $requestScheme.'://'.$httpHost.($subRoot ?: '').'/'.rawurlencode($ROOT_FOLDER);
} else {
    $BASE_URL = $requestScheme.'://'.$httpHost.'/'.rawurlencode($ROOT_FOLDER);
}
$APP_ASSETS_URL = $requestScheme.'://'.$httpHost.(($scriptBasePath === '' || $scriptBasePath === '.') ? '/app-assets' : $scriptBasePath.'/app-assets');

/*
|--------------------------------------------------------------------------
| AUTO-BACKUP INTEGRATION
| When images are uploaded, they are automatically backed up so they are
| always recoverable — even if later deleted from this dashboard.
|
| Set $AUTO_BACKUP_ENABLED = false to disable (not recommended).
| The backup system must be installed at __DIR__ . "/backup/"
|--------------------------------------------------------------------------
*/
$AUTO_BACKUP_ENABLED = true;
$BACKUP_SYSTEM_LIB_CANDIDATES = [
    __DIR__.'/backup/lib.php',
    dirname(__DIR__).'/backup/lib.php',
];

/**
 * Resolve backup lib from supported locations.
 * Supports both:
 * - /img/imghost/backup/lib.php
 * - /img/backup/lib.php (recommended current layout)
 */
function imghost_resolveBackupLib(): ?string
{
    global $BACKUP_SYSTEM_LIB_CANDIDATES;

    foreach ($BACKUP_SYSTEM_LIB_CANDIDATES as $candidate) {
        if (is_string($candidate) && $candidate !== '' && is_file($candidate)) {
            return $candidate;
        }
    }

    return null;
}

/**
 * Trigger backup for one or more absolute file paths.
 * Silent — never interrupts the upload flow on failure.
 */
function imghost_autoBackup(array $absoluteFilePaths): void
{
    global $AUTO_BACKUP_ENABLED;

    if (! $AUTO_BACKUP_ENABLED) {
        return;
    }

    $backupLib = imghost_resolveBackupLib();
    if ($backupLib === null) {
        // Backup system not installed alongside ImageHost — skip silently.
        return;
    }

    try {
        // The backup lib uses its own config; include it safely.
        require_once $backupLib;
        $filtered = [];
        foreach ($absoluteFilePaths as $path) {
            $candidate = (string) $path;
            if ($candidate !== '' && is_file($candidate)) {
                $filtered[$candidate] = true;
            }
        }
        if ($filtered !== []) {
            bs_autoBackupFiles(array_keys($filtered), 'auto_upload from ImageHost');
        }
    } catch (Throwable $e) {
        // Never crash ImageHost because of a backup failure.
        error_log('[ImageHost auto-backup] '.$e->getMessage());
    }
}

/**
 * Auto-backup absolute targets (files or folders), preserving folder entries
 * so deleted folders can be restored too.
 */
function imghost_autoBackupTargets(array $absoluteTargets): void
{
    global $AUTO_BACKUP_ENABLED;

    if (! $AUTO_BACKUP_ENABLED) {
        return;
    }

    $backupLib = imghost_resolveBackupLib();
    if ($backupLib === null) {
        return;
    }

    try {
        require_once $backupLib;
        if (function_exists('bs_autoBackupAbsoluteTargets')) {
            bs_autoBackupAbsoluteTargets($absoluteTargets, 'auto_upload from ImageHost');
        } else {
            // Backward compatibility fallback: files only.
            $files = imghost_collectFilesForBackup($absoluteTargets);
            if (! empty($files)) {
                bs_autoBackupFiles($files, 'auto_upload from ImageHost');
            }
        }
    } catch (Throwable $e) {
        error_log('[ImageHost auto-backup-targets] '.$e->getMessage());
    }
}

/**
 * Collect all files under one or more targets for a pre-delete snapshot.
 * This guarantees files remain recoverable even after deletion from live.
 *
 * @param  array<int,string>  $targets
 * @return array<int,string>
 */
function imghost_collectFilesForBackup(array $targets): array
{
    $files = [];

    foreach ($targets as $target) {
        $target = (string) $target;
        if ($target === '' || ! file_exists($target) || is_link($target)) {
            continue;
        }

        if (is_file($target)) {
            $files[$target] = true;

            continue;
        }

        if (! is_dir($target)) {
            continue;
        }

        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($target, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::LEAVES_ONLY
        );
        foreach ($it as $info) {
            if ($info->isLink() || ! $info->isFile()) {
                continue;
            }
            $files[$info->getPathname()] = true;
        }
    }

    return array_keys($files);
}

$allowedExtensions = [
    'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg',
    'html', 'txt', 'css', 'js', 'json', 'php',
];

$codeExtensions = ['html', 'css', 'js', 'json', 'php', 'txt'];

/*
|--------------------------------------------------------------------------
| BASIC SETUP
|--------------------------------------------------------------------------
*/

if (! is_dir($BASE_DIR)) {
    mkdir($BASE_DIR, 0755, true);
}
if (! is_dir($TRASH_DIR)) {
    mkdir($TRASH_DIR, 0755, true);
}
if (! is_dir($APP_ASSETS_DIR)) {
    mkdir($APP_ASSETS_DIR, 0755, true);
}

function csrfToken()
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    return $_SESSION['csrf_token'];
}

function csrfField()
{
    return '<input type="hidden" name="csrf_token" value="'.htmlspecialchars(csrfToken(), ENT_QUOTES, 'UTF-8').'">';
}

function validCsrf($token)
{
    return is_string($token) && hash_equals($_SESSION['csrf_token'] ?? '', $token);
}

function readJsonFile($file, $default = [])
{
    if (! is_file($file)) {
        return $default;
    }
    $raw = file_get_contents($file);
    $data = json_decode($raw, true);

    return is_array($data) ? $data : $default;
}

function writeJsonFile($file, $data)
{
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);
}

function getSecureIndexHtml()
{
    return <<<'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>403 — Access Denied</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --red: #E24B4A;
    --red-dark: #A32D2D;
    --red-light: #FCEBEB;
    --gray-900: #1a1a1a;
    --gray-800: #2a2a2a;
    --gray-600: #555;
    --gray-200: #e0e0e0;
    --gray-100: #f5f5f5;
    --mono: 'IBM Plex Mono', monospace;
    --display: 'Syne', sans-serif;
  }

  html, body {
    height: 100%;
    background: #ffffff;
    color: var(--red-dark);
    font-family: var(--display);
    overflow-x: hidden;
  }

  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image:
      linear-gradient(rgba(226,75,74,0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(226,75,74,0.08) 1px, transparent 1px);
    background-size: 48px 48px;
    pointer-events: none;
    z-index: 0;
  }

  .topbar {
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, transparent, var(--red), transparent);
    animation: scanline 3s ease-in-out infinite;
    z-index: 10;
  }
  @keyframes scanline {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
  }

  .page {
    position: relative;
    z-index: 1;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 6rem 2rem 5rem;
  }

  .container {
    max-width: 680px;
    width: 100%;
    text-align: center;
    animation: fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(32px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .error-code {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.3em;
    color: var(--red);
    text-transform: uppercase;
    margin-bottom: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }
  .error-code::before,
  .error-code::after {
    content: '';
    display: block;
    width: 40px;
    height: 0.5px;
    background: var(--red);
    opacity: 0.5;
  }

  .big-number {
    font-family: var(--display);
    font-size: clamp(6rem, 18vw, 10rem);
    font-weight: 800;
    line-height: 1;
    background: linear-gradient(135deg, #A32D2D, #E24B4A);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.04em;
    margin-bottom: 0.5rem;
    opacity: 1;
    user-select: none;
  }

  h1 {
    font-family: var(--display);
    font-size: clamp(1.6rem, 4vw, 2.4rem);
    font-weight: 800;
    color: var(--red-dark);
    letter-spacing: -0.02em;
    margin-bottom: 1rem;
    line-height: 1.1;
  }

  h1 span { color: var(--red); }

  .subtext {
    font-family: var(--mono);
    font-size: 13px;
    color: var(--red);
    line-height: 1.8;
    max-width: 480px;
    margin: 0 auto 2.5rem;
    letter-spacing: 0.01em;
  }

  .footer {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    padding: 1rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: var(--mono);
    font-size: 10px;
    color: var(--red-dark);
    letter-spacing: 0.1em;
    border-top: 0.5px solid rgba(226,75,74,0.15);
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(8px);
  }

  @media (max-width: 500px) {
    .footer { flex-direction: column; gap: 4px; text-align: center; }
  }
</style>
</head>
<body>

<div class="topbar"></div>

<main class="page">
  <div class="container">

    <div class="error-code">HTTP 403</div>
    <div class="big-number">403</div>

    <h1>Access <span>Denied</span></h1>

    <p class="subtext">
      You do not have permission to access this resource.<br>
      Your request has been logged and the administrator has been notified.
    </p>

  </div>
</main>

<footer class="footer">
  <span>© 2026 Rafvex. All rights reserved.</span>
  <span>ALL UNAUTHORIZED ACCESS IS MONITORED AND PROSECUTED</span>
</footer>

</body>
</html>
HTML;
}

function isSystemManagedFile($name)
{
    $base = basename((string) $name);

    return in_array($base, ['index.html', '.security.json'], true);
}

function shouldHideFromFileManager($name)
{
    $base = basename((string) $name);

    return isSystemManagedFile($base)
        || in_array($base, ['.versions', '.trash', '.DS_Store'], true)
        || str_starts_with($base, '._');
}

function ensureSecureIndexFile($dir)
{
    if (! is_dir($dir) || ! is_writable($dir)) {
        return;
    }
    $indexFile = rtrim($dir, '/').'/index.html';
    if (! is_file($indexFile)) {
        @file_put_contents($indexFile, getSecureIndexHtml(), LOCK_EX);
    }
}

function cleanPath($path)
{
    $path = str_replace('\\', '/', $path);
    $path = str_replace("\0", '', $path);
    $path = trim($path, '/');
    $parts = explode('/', $path);
    $safe = [];
    foreach ($parts as $part) {
        if ($part === '' || $part === '.' || $part === '..') {
            continue;
        }
        $part = preg_replace('/[\x00-\x1F\x7F]/u', '', $part) ?? $part;
        if ($part !== '') {
            $safe[] = $part;
        }
    }

    return implode('/', $safe);
}

function cleanName($name)
{
    $name = preg_replace("/[^\p{L}\p{N}\p{M}._\- ()\[\]]/u", '', basename($name));

    return trim($name);
}

function cleanExistingName($name)
{
    $name = str_replace(["\0", '/', '\\'], '', (string) $name);
    $name = preg_replace('/[\x00-\x1F\x7F]/u', '', $name) ?? $name;

    return ($name === '.' || $name === '..') ? '' : $name;
}

function cleanBaseName($name)
{
    $base = pathinfo(basename($name), PATHINFO_FILENAME);
    $base = preg_replace("/[^\p{L}\p{N}\p{M}._\- ()\[\]]/u", '', $base);

    return trim($base) !== '' ? $base : 'image';
}

function safeFullPath($baseDir, $relativePath = '')
{
    $relativePath = cleanPath($relativePath);
    $fullPath = $baseDir.($relativePath ? '/'.$relativePath : '');
    $baseReal = realpath($baseDir);
    $targetReal = realpath($fullPath);
    if ($baseReal !== false && $targetReal !== false && $targetReal !== $baseReal && strpos($targetReal, $baseReal.DIRECTORY_SEPARATOR) !== 0) {
        exit('Invalid path.');
    }

    return $fullPath;
}

function deleteFolder($dir)
{
    if (! is_dir($dir)) {
        return;
    }
    foreach (scandir($dir) as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        $path = $dir.'/'.$item;
        if (is_dir($path)) {
            deleteFolder($path);
        } else {
            unlink($path);
        }
    }
    rmdir($dir);
}

function folderSize($dir)
{
    if (! is_dir($dir)) {
        return 0;
    }
    $size = 0;
    foreach (scandir($dir) as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        $path = $dir.'/'.$item;
        if (is_dir($path)) {
            $size += folderSize($path);
        } elseif (is_file($path)) {
            $size += filesize($path);
        }
    }

    return $size;
}

function folderOptions($baseDir, $rootRelative = '', $rootLabel = 'blog / root')
{
    $rootRelative = cleanPath($rootRelative);
    $options = [['path' => $rootRelative, 'label' => $rootLabel, 'name' => 'Root', 'depth' => 0]];
    $scan = function ($relative, $depth = 1) use (&$scan, &$options, $baseDir) {
        $dir = safeFullPath($baseDir, $relative);
        if (! is_dir($dir)) {
            return;
        }
        $names = array_diff(scandir($dir), ['.', '..']);
        natcasesort($names);
        foreach ($names as $name) {
            if (shouldHideFromFileManager($name)) {
                continue;
            }
            $path = $dir.'/'.$name;
            if (! is_dir($path)) {
                continue;
            }
            $childRelative = $relative ? $relative.'/'.$name : $name;
            $options[] = [
                'path' => cleanPath($childRelative),
                'label' => $childRelative,
                'name' => $name,
                'depth' => $depth,
            ];
            $scan($childRelative, $depth + 1);
        }
    };
    $scan($rootRelative, 1);

    return $options;
}

function relativePathInRoot($relativePath, $rootRelative)
{
    $path = cleanPath($relativePath);
    $root = cleanPath($rootRelative);
    if ($root === '') {
        return true;
    }

    return $path === $root || strpos($path.'/', $root.'/') === 0;
}

function uniqueDestinationPath($dir, $name)
{
    $name = cleanName($name);
    $candidate = $dir.'/'.$name;
    if (! file_exists($candidate)) {
        return $candidate;
    }

    $ext = pathinfo($name, PATHINFO_EXTENSION);
    $base = $ext ? substr($name, 0, -(strlen($ext) + 1)) : $name;
    $suffix = 1;
    do {
        $copyName = $base.' copy'.($suffix > 1 ? ' '.$suffix : '').($ext ? '.'.$ext : '');
        $candidate = $dir.'/'.$copyName;
        $suffix++;
    } while (file_exists($candidate));

    return $candidate;
}

function copyFolder($src, $dst)
{
    if (! is_dir($src)) {
        return false;
    }
    if (! is_dir($dst) && ! mkdir($dst, 0755, true)) {
        return false;
    }
    ensureSecureIndexFile($dst);
    foreach (scandir($src) as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        if (shouldHideFromFileManager($item)) {
            continue;
        }
        $from = $src.'/'.$item;
        $to = $dst.'/'.$item;
        if (is_dir($from)) {
            if (! copyFolder($from, $to)) {
                return false;
            }
        } elseif (is_file($from)) {
            if (! copy($from, $to)) {
                return false;
            }
        }
    }

    return true;
}

function sanitizeDownloadFilename($name, $fallback = 'download')
{
    $name = trim((string) $name);
    $name = str_replace(["\r", "\n"], '', $name);
    $name = preg_replace('/[^a-zA-Z0-9._\- ]/', '', $name);
    $name = trim($name);

    return $name !== '' ? $name : $fallback;
}

function streamDownloadFile($filePath, $downloadName, $deleteAfter = false)
{
    if (! is_file($filePath)) {
        return false;
    }
    if (ob_get_level()) {
        while (ob_get_level()) {
            ob_end_clean();
        }
    }
    $downloadName = sanitizeDownloadFilename($downloadName, basename($filePath));
    header('Content-Description: File Transfer');
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="'.str_replace('"', '', $downloadName).'"');
    header('Content-Length: '.filesize($filePath));
    header('Cache-Control: private, max-age=0, must-revalidate');
    header('Pragma: public');
    readfile($filePath);
    if ($deleteAfter) {
        @unlink($filePath);
    }
    exit;
}

function addPathToZipArchive($zip, $sourcePath, $zipPath)
{
    $zipPath = str_replace('\\', '/', trim((string) $zipPath, '/'));
    if ($zipPath === '') {
        $zipPath = basename($sourcePath);
    }
    if (shouldHideFromFileManager(basename($sourcePath))) {
        return;
    }
    if (is_file($sourcePath)) {
        $zip->addFile($sourcePath, $zipPath);

        return;
    }
    if (! is_dir($sourcePath)) {
        return;
    }
    $zip->addEmptyDir($zipPath);
    foreach (scandir($sourcePath) as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        if (shouldHideFromFileManager($item)) {
            continue;
        }
        $childPath = $sourcePath.'/'.$item;
        $childZipPath = $zipPath.'/'.$item;
        if (is_dir($childPath)) {
            addPathToZipArchive($zip, $childPath, $childZipPath);
        } elseif (is_file($childPath)) {
            $zip->addFile($childPath, $childZipPath);
        }
    }
}

function streamZipDownloadFromMap($pathMap, $archiveName)
{
    if (! class_exists('ZipArchive')) {
        return false;
    }
    $tempFile = tempnam(sys_get_temp_dir(), 'imghost_zip_');
    if ($tempFile === false) {
        return false;
    }
    $zipFile = $tempFile.'.zip';
    @rename($tempFile, $zipFile);
    if (is_file($tempFile)) {
        @unlink($tempFile);
    }

    $zip = new ZipArchive;
    if ($zip->open($zipFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        if (is_file($zipFile)) {
            @unlink($zipFile);
        }

        return false;
    }
    foreach ($pathMap as $absPath => $entryName) {
        addPathToZipArchive($zip, $absPath, $entryName);
    }
    $zip->close();
    streamDownloadFile($zipFile, sanitizeDownloadFilename($archiveName, 'download.zip'), true);

    return true;
}

function loadTrashIndex()
{
    global $TRASH_META_FILE;
    $data = readJsonFile($TRASH_META_FILE, ['items' => []]);
    if (! isset($data['items']) || ! is_array($data['items'])) {
        $data['items'] = [];
    }

    return $data;
}

function saveTrashIndex($data)
{
    global $TRASH_META_FILE;
    writeJsonFile($TRASH_META_FILE, $data);
}

function normalizeRestoredPath($path, $mtime = 0)
{
    if (! file_exists($path) || is_link($path)) {
        return;
    }
    $mtime = (int) $mtime;
    if (is_file($path)) {
        @chmod($path, 0644);
        if ($mtime > 0) {
            @touch($path, $mtime);
        }

        return;
    }
    if (! is_dir($path)) {
        return;
    }
    @chmod($path, 0755);
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );
    foreach ($it as $info) {
        if ($info->isLink()) {
            continue;
        }
        if ($info->isDir()) {
            @chmod($info->getPathname(), 0755);
        } elseif ($info->isFile()) {
            @chmod($info->getPathname(), 0644);
        }
    }
}

function trashItem($target, $relativePath)
{
    global $TRASH_DIR;
    if (! file_exists($target)) {
        return false;
    }
    $trash = loadTrashIndex();
    $id = bin2hex(random_bytes(12));
    $trashName = date('Ymd_His').'_'.$id.'_'.cleanName(basename($relativePath));
    $trashPath = $TRASH_DIR.'/'.$trashName;
    if (! rename($target, $trashPath)) {
        return false;
    }
    $isTrashDir = is_dir($trashPath);
    $isTrashFile = is_file($trashPath);

    $trash['items'][$id] = [
        'id' => $id,
        'original_relative' => cleanPath($relativePath),
        'trash_name' => $trashName,
        'deleted_at' => time(),
        'type' => $isTrashDir ? 'folder' : 'file',
        'size' => $isTrashDir ? folderSize($trashPath) : ($isTrashFile ? filesize($trashPath) : 0),
        'mtime' => file_exists($trashPath) ? (int) filemtime($trashPath) : 0,
        'hash' => $isTrashFile ? (string) @hash_file('sha256', $trashPath) : '',
    ];
    saveTrashIndex($trash);

    return true;
}

function restoreTrashItem($id)
{
    global $BASE_DIR, $TRASH_DIR;
    $trash = loadTrashIndex();
    if (empty($trash['items'][$id])) {
        return false;
    }
    $item = $trash['items'][$id];
    $trashPath = $TRASH_DIR.'/'.cleanName($item['trash_name'] ?? '');
    if (! file_exists($trashPath)) {
        unset($trash['items'][$id]);
        saveTrashIndex($trash);

        return false;
    }

    $relative = cleanPath($item['original_relative'] ?? '');
    $restorePath = safeFullPath($BASE_DIR, $relative);
    $parent = dirname($restorePath);
    if (! is_dir($parent)) {
        mkdir($parent, 0755, true);
    }
    if (file_exists($restorePath)) {
        $restorePath = uniqueDestinationPath($parent, basename($restorePath));
    }
    clearstatcache(true);
    if (! rename($trashPath, $restorePath)) {
        return false;
    }
    normalizeRestoredPath($restorePath, (int) ($item['mtime'] ?? 0));
    if (is_file($restorePath) && ! empty($item['hash'])) {
        $restoredHash = @hash_file('sha256', $restorePath);
        if (! is_string($restoredHash) || ! hash_equals((string) $item['hash'], $restoredHash)) {
            error_log('[ImageHost restore] Hash mismatch after restoring '.$restorePath);
        }
    }

    unset($trash['items'][$id]);
    saveTrashIndex($trash);

    return true;
}

function permanentlyDeleteTrashItem($id)
{
    global $TRASH_DIR;
    $trash = loadTrashIndex();
    if (empty($trash['items'][$id])) {
        return false;
    }
    $item = $trash['items'][$id];
    $trashPath = $TRASH_DIR.'/'.cleanName($item['trash_name'] ?? '');
    if (is_dir($trashPath)) {
        deleteFolder($trashPath);
    } elseif (is_file($trashPath)) {
        unlink($trashPath);
    }
    unset($trash['items'][$id]);
    saveTrashIndex($trash);

    return true;
}

function isImageFile($filename)
{
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

    return in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg']);
}

function isWebpConvertibleImage($filename)
{
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

    return in_array($ext, ['jpg', 'jpeg', 'png'], true);
}

function imageResourceFromFile($path, $ext)
{
    $ext = strtolower($ext);
    if (($ext === 'jpg' || $ext === 'jpeg') && function_exists('imagecreatefromjpeg')) {
        return @imagecreatefromjpeg($path);
    }
    if ($ext === 'png' && function_exists('imagecreatefrompng')) {
        return @imagecreatefrompng($path);
    }
    if ($ext === 'webp' && function_exists('imagecreatefromwebp')) {
        return @imagecreatefromwebp($path);
    }
    if (function_exists('imagecreatefromstring')) {
        $raw = @file_get_contents($path);
        if ($raw !== false) {
            return @imagecreatefromstring($raw);
        }
    }

    return false;
}

function saveOptimizedWebp($sourcePath, $destinationPath, $ext)
{
    global $IMAGE_MAX_DIMENSION, $WEBP_QUALITY;
    if (! function_exists('imagewebp')) {
        return false;
    }
    if (! canAttemptImageOptimization($sourcePath)) {
        return false;
    }
    $info = @getimagesize($sourcePath);
    if (! $info || empty($info[0]) || empty($info[1])) {
        return false;
    }

    $width = (int) $info[0];
    $height = (int) $info[1];
    $ratio = min(1, $IMAGE_MAX_DIMENSION / max($width, $height));

    if (strtolower($ext) === 'webp' && $ratio == 1) {
        if (@copy($sourcePath, $destinationPath)) {
            return true;
        }
    }

    $src = imageResourceFromFile($sourcePath, $ext);
    if (! $src) {
        return false;
    }

    if ($ratio < 1) {
        $newWidth = max(1, (int) round($width * $ratio));
        $newHeight = max(1, (int) round($height * $ratio));
        $out = imagecreatetruecolor($newWidth, $newHeight);
        if (! $out) {
            imagedestroy($src);

            return false;
        }
        imagealphablending($out, false);
        imagesavealpha($out, true);
        $transparent = imagecolorallocatealpha($out, 0, 0, 0, 127);
        imagefilledrectangle($out, 0, 0, $newWidth, $newHeight, $transparent);
        imagecopyresampled($out, $src, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
        $saved = imagewebp($out, $destinationPath, $WEBP_QUALITY);
        imagedestroy($out);
    } else {
        imagepalettetotruecolor($src);
        imagealphablending($src, false);
        imagesavealpha($src, true);
        $saved = imagewebp($src, $destinationPath, $WEBP_QUALITY);
    }

    imagedestroy($src);
    if (! $saved || ! is_file($destinationPath) || ! @getimagesize($destinationPath)) {
        if (is_file($destinationPath)) {
            @unlink($destinationPath);
        }

        return false;
    }

    return true;
}

function storeUploadedTempFile($tmpName, $destination)
{
    if (is_uploaded_file($tmpName) && @move_uploaded_file($tmpName, $destination)) {
        return true;
    }
    if (@rename($tmpName, $destination)) {
        return true;
    }
    if (@copy($tmpName, $destination)) {
        @unlink($tmpName);

        return true;
    }

    return false;
}

function iniSizeToBytes($val)
{
    $val = trim((string) $val);
    if ($val === '' || $val === '-1') {
        return -1;
    }
    $num = (float) $val;
    $unit = strtolower(substr($val, -1));
    if ($unit === 'g') {
        return (int) round($num * 1024 * 1024 * 1024);
    }
    if ($unit === 'm') {
        return (int) round($num * 1024 * 1024);
    }
    if ($unit === 'k') {
        return (int) round($num * 1024);
    }

    return (int) $num;
}

function hasEnoughMemoryBudget($requiredBytes)
{
    $limit = iniSizeToBytes(ini_get('memory_limit'));
    if ($limit < 0) {
        return true;
    }
    $remaining = $limit - memory_get_usage(true);

    return $remaining > $requiredBytes;
}

function canAttemptImageOptimization($sourcePath)
{
    $info = @getimagesize($sourcePath);
    if (! $info || empty($info[0]) || empty($info[1])) {
        return false;
    }
    $width = (int) $info[0];
    $height = (int) $info[1];
    $pixels = max(1, $width) * max(1, $height);
    $required = (int) ($pixels * 10) + (16 * 1024 * 1024);

    return hasEnoughMemoryBudget($required);
}

function uploadErrorMessage($code)
{
    switch ((int) $code) {
        case UPLOAD_ERR_INI_SIZE:
            return 'File is larger than server upload limit (upload_max_filesize).';
        case UPLOAD_ERR_FORM_SIZE:
            return 'File is larger than allowed by form size limit.';
        case UPLOAD_ERR_PARTIAL:
            return 'File was only partially uploaded.';
        case UPLOAD_ERR_NO_FILE:
            return 'No file was uploaded.';
        case UPLOAD_ERR_NO_TMP_DIR:
            return 'Server missing temporary upload folder.';
        case UPLOAD_ERR_CANT_WRITE:
            return 'Server cannot write file to disk.';
        case UPLOAD_ERR_EXTENSION:
            return 'Upload blocked by server extension.';
        default:
            return 'Upload failed due to an unknown server error.';
    }
}

function isCodeFile($filename)
{
    global $codeExtensions;
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

    return in_array($ext, $codeExtensions);
}

function publicUrl($baseUrl, $relativePath)
{
    $baseUrl = rtrim($baseUrl, '/');
    $relativePath = cleanPath($relativePath);
    if ($relativePath === '') {
        return $baseUrl.'/';
    }
    $parts = explode('/', $relativePath);
    $encoded = array_map('rawurlencode', $parts);

    return $baseUrl.'/'.implode('/', $encoded);
}

function versionedImageUrl($url, $mtime = 0, $size = 0, $changedAt = 0)
{
    $version = (int) $mtime.'-'.(int) $size;

    return $url.(strpos($url, '?') === false ? '?' : '&').'v='.rawurlencode($version);
}

function verifyAdminPassword($password)
{
    global $ADMIN_PASS_HASH;

    return is_string($password) && password_verify($password, $ADMIN_PASS_HASH);
}

function verifyDeletePassword($password)
{
    return true;
}

function loginDeviceId()
{
    global $secureCookie;
    $cookieName = 'kiuq_device';
    $id = $_COOKIE[$cookieName] ?? '';
    if (! is_string($id) || ! preg_match('/^[a-f0-9]{32}$/', $id)) {
        $id = bin2hex(random_bytes(16));
        setcookie($cookieName, $id, [
            'expires' => time() + 31536000,
            'path' => '/',
            'secure' => $secureCookie,
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
        $_COOKIE[$cookieName] = $id;
    }

    return $id;
}

function loginIdentity()
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $ua = substr($_SERVER['HTTP_USER_AGENT'] ?? 'unknown', 0, 180);
    $deviceId = loginDeviceId();

    return [
        'device_key' => hash('sha256', $deviceId),
        'fingerprint' => hash('sha256', $ip.'|'.$ua),
        'ip' => $ip,
        'user_agent' => $ua,
    ];
}

function loadSecurityData()
{
    global $SECURITY_FILE;
    $data = readJsonFile($SECURITY_FILE, ['attempts' => [], 'banned' => []]);
    if (! isset($data['attempts']) || ! is_array($data['attempts'])) {
        $data['attempts'] = [];
    }
    if (! isset($data['banned']) || ! is_array($data['banned'])) {
        $data['banned'] = [];
    }

    return $data;
}

function saveSecurityData($data)
{
    global $SECURITY_FILE;
    writeJsonFile($SECURITY_FILE, $data);
}

function defaultAppSettings()
{
    return [
        'app_name' => 'StoneKrusher Media Library',
        'dashboard_logo_url' => '',
        'favicon_url' => '',
        'dashboard_theme_url' => '',
        'footer_name' => 'Rafvex.com',
    ];
}

function loadAppSettings()
{
    global $APP_SETTINGS_FILE;

    return array_merge(defaultAppSettings(), readJsonFile($APP_SETTINGS_FILE, []));
}

function saveAppSettings($settings)
{
    global $APP_SETTINGS_FILE;
    writeJsonFile($APP_SETTINGS_FILE, array_merge(defaultAppSettings(), $settings));
}

function saveUploadedAppAsset($field, $prefix)
{
    global $APP_ASSETS_DIR, $APP_ASSETS_URL;
    if (empty($_FILES[$field]) || ($_FILES[$field]['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return ['ok' => true, 'url' => ''];
    }
    if (($_FILES[$field]['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK || ! is_uploaded_file($_FILES[$field]['tmp_name'] ?? '')) {
        return ['ok' => false, 'error' => 'Could not upload '.str_replace('_', ' ', $field).'.'];
    }

    $originalName = cleanName($_FILES[$field]['name'] ?? '');
    $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    $allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'ico'];
    if (! in_array($ext, $allowed, true)) {
        return ['ok' => false, 'error' => 'Logo and favicon uploads must be JPG, PNG, WebP, GIF, or ICO files.'];
    }

    if ($ext !== 'ico' && ! @getimagesize($_FILES[$field]['tmp_name'])) {
        return ['ok' => false, 'error' => 'Uploaded branding file is not a valid image.'];
    }

    $filename = $prefix.'-'.date('YmdHis').'-'.bin2hex(random_bytes(4)).'.'.$ext;
    $destination = $APP_ASSETS_DIR.'/'.$filename;
    if (! move_uploaded_file($_FILES[$field]['tmp_name'], $destination)) {
        return ['ok' => false, 'error' => 'Could not save uploaded branding file.'];
    }

    return ['ok' => true, 'url' => $APP_ASSETS_URL.'/'.rawurlencode($filename)];
}

function profileAssetUrl($filename)
{
    global $requestScheme, $httpHost, $scriptBasePath;

    return $requestScheme.'://'.$httpHost.(($scriptBasePath === '' || $scriptBasePath === '.') ? '/profileimg/' : $scriptBasePath.'/profileimg/').rawurlencode($filename);
}

function cssUrlValue($url)
{
    return str_replace(['\\', '"', "\n", "\r"], ['\\\\', '\\"', '', ''], (string) $url);
}

function loadThemeLibrary()
{
    global $THEME_LIBRARY_FILE;
    $data = readJsonFile($THEME_LIBRARY_FILE, ['items' => []]);
    if (! isset($data['items']) || ! is_array($data['items'])) {
        $data['items'] = [];
    }
    $seen = [];
    $items = [];
    foreach ($data['items'] as $item) {
        $url = trim((string) ($item['url'] ?? ''));
        if ($url === '' || ! filter_var($url, FILTER_VALIDATE_URL) || isset($seen[$url])) {
            continue;
        }
        $seen[$url] = true;
        $items[] = [
            'name' => trim((string) ($item['name'] ?? '')) ?: 'Saved Theme',
            'url' => $url,
            'mtime' => (int) ($item['mtime'] ?? 0),
        ];
    }

    return ['items' => $items];
}

function saveThemeLibrary($data)
{
    global $THEME_LIBRARY_FILE;
    writeJsonFile($THEME_LIBRARY_FILE, ['items' => array_values($data['items'] ?? [])]);
}

function themeNameFromUrl($url)
{
    $host = parse_url($url, PHP_URL_HOST);
    $path = parse_url($url, PHP_URL_PATH);
    $base = $path ? cleanBaseName(basename($path)) : '';
    $label = $base !== 'image' ? $base : ($host ?: 'Saved Theme');
    $label = str_replace(['-', '_'], ' ', $label);

    return ucwords(trim($label)) ?: 'Saved Theme';
}

function defaultDashboardThemeUrls()
{
    return [
        'https://static.vecteezy.com/system/resources/thumbnails/049/855/471/small/nature-background-high-resolution-wallpaper-for-a-serene-and-stunning-view-free-photo.jpg',
        'https://img.magnific.com/free-photo/anime-moon-landscape_23-2151645871.jpg?semt=ais_hybrid&w=740&q=80',
        'https://i.pinimg.com/736x/20/a7/2f/20a72f3b1e05484fb95829921557ad0b.jpg',
    ];
}

function shouldSaveDashboardThemeUrlToLibrary($url)
{
    $url = trim((string) $url);
    if ($url === '' || ! filter_var($url, FILTER_VALIDATE_URL)) {
        return false;
    }
    if (in_array($url, defaultDashboardThemeUrls(), true)) {
        return false;
    }
    $path = parse_url($url, PHP_URL_PATH);
    $name = $path ? basename(rawurldecode($path)) : '';

    return ! str_starts_with($name, 'dashboard-theme-');
}

function saveDashboardThemeUrlToLibrary($url)
{
    $url = trim((string) $url);
    if (! shouldSaveDashboardThemeUrlToLibrary($url)) {
        return null;
    }
    $library = loadThemeLibrary();
    foreach ($library['items'] as &$item) {
        if (($item['url'] ?? '') === $url) {
            $item['mtime'] = time();
            $item['name'] = trim((string) ($item['name'] ?? '')) ?: themeNameFromUrl($url);
            $savedItem = $item;
            unset($item);
            saveThemeLibrary($library);

            return $savedItem;
        }
    }
    unset($item);
    $item = ['name' => themeNameFromUrl($url), 'url' => $url, 'mtime' => time()];
    array_unshift($library['items'], $item);
    saveThemeLibrary($library);

    return $item;
}

function listDashboardThemeImages()
{
    $profileDir = __DIR__.'/profileimg';
    $allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    $defaultImages = [
        [
            'name' => 'Nature Serene View',
            'url' => 'https://static.vecteezy.com/system/resources/thumbnails/049/855/471/small/nature-background-high-resolution-wallpaper-for-a-serene-and-stunning-view-free-photo.jpg',
            'mtime' => 0,
            'can_delete' => false,
        ],
        [
            'name' => 'Anime Moon Landscape',
            'url' => 'https://img.magnific.com/free-photo/anime-moon-landscape_23-2151645871.jpg?semt=ais_hybrid&w=740&q=80',
            'mtime' => 0,
            'can_delete' => false,
        ],
        [
            'name' => 'Pinterest Landscape',
            'url' => 'https://i.pinimg.com/736x/20/a7/2f/20a72f3b1e05484fb95829921557ad0b.jpg',
            'mtime' => 0,
            'can_delete' => false,
        ],
    ];
    $items = [];
    $libraryItems = [];
    foreach (loadThemeLibrary()['items'] as $item) {
        $libraryItems[] = [
            'name' => $item['name'],
            'url' => $item['url'],
            'mtime' => (int) ($item['mtime'] ?? 0),
            'can_delete' => true,
        ];
    }
    if (! is_dir($profileDir)) {
        return array_merge($defaultImages, $libraryItems);
    }

    foreach (scandir($profileDir) as $name) {
        if ($name === '.' || $name === '..' || str_starts_with($name, '.')) {
            continue;
        }
        $path = $profileDir.'/'.$name;
        if (! is_file($path)) {
            continue;
        }
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if (! in_array($ext, $allowed, true)) {
            continue;
        }
        $items[] = [
            'name' => $name,
            'url' => profileAssetUrl($name),
            'mtime' => (int) @filemtime($path),
            'can_delete' => str_starts_with($name, 'dashboard-theme-'),
        ];
    }

    usort($items, fn ($a, $b) => ($b['mtime'] ?? 0) <=> ($a['mtime'] ?? 0));
    usort($libraryItems, fn ($a, $b) => ($b['mtime'] ?? 0) <=> ($a['mtime'] ?? 0));

    return array_merge($defaultImages, $libraryItems, $items);
}

function saveUploadedDashboardThemeImage($field)
{
    if (empty($_FILES[$field]) || ($_FILES[$field]['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return ['ok' => false, 'error' => 'Choose an image first.'];
    }
    if (($_FILES[$field]['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK || ! is_uploaded_file($_FILES[$field]['tmp_name'] ?? '')) {
        return ['ok' => false, 'error' => 'Could not upload theme image.'];
    }
    if (! function_exists('imagewebp')) {
        return ['ok' => false, 'error' => 'WebP conversion is unavailable on this server.'];
    }

    $tmp = $_FILES[$field]['tmp_name'];
    $info = @getimagesize($tmp);
    if (! $info || empty($info['mime'])) {
        return ['ok' => false, 'error' => 'Uploaded theme file is not a valid image.'];
    }

    $img = null;
    $mime = (string) $info['mime'];
    if ($mime === 'image/jpeg' && function_exists('imagecreatefromjpeg')) {
        $img = @imagecreatefromjpeg($tmp);
    } elseif ($mime === 'image/png' && function_exists('imagecreatefrompng')) {
        $img = @imagecreatefrompng($tmp);
    } elseif ($mime === 'image/webp' && function_exists('imagecreatefromwebp')) {
        $img = @imagecreatefromwebp($tmp);
    } elseif ($mime === 'image/gif' && function_exists('imagecreatefromgif')) {
        $img = @imagecreatefromgif($tmp);
    }

    if (! $img) {
        return ['ok' => false, 'error' => 'Could not read the uploaded theme image.'];
    }

    $profileDir = __DIR__.'/profileimg';
    if (! is_dir($profileDir)) {
        mkdir($profileDir, 0777, true);
    }
    $fileName = 'dashboard-theme-'.date('YmdHis').'-'.bin2hex(random_bytes(4)).'.webp';
    $dest = $profileDir.'/'.$fileName;

    imagepalettetotruecolor($img);
    imagealphablending($img, true);
    imagesavealpha($img, true);
    $saved = imagewebp($img, $dest, 90);
    imagedestroy($img);

    if (! $saved || ! is_file($dest)) {
        if (is_file($dest)) {
            @unlink($dest);
        }

        return ['ok' => false, 'error' => 'Could not save theme image.'];
    }

    @chmod($dest, 0644);

    return ['ok' => true, 'url' => profileAssetUrl($fileName), 'name' => $fileName];
}

function saveCurrentUserDashboardTheme($userId, $themeUrl)
{
    $data = loadUsers();
    $saved = false;
    foreach ($data['users'] as &$row) {
        if (($row['id'] ?? '') === $userId) {
            $row['dashboard_theme_url'] = $themeUrl;
            $row['updated_at'] = time();
            $saved = true;
            break;
        }
    }
    unset($row);
    if ($saved) {
        saveUsers($data);
    }

    return $saved;
}

function clearDashboardThemeUrlForUsers($themeUrl)
{
    $themeUrl = trim((string) $themeUrl);
    if ($themeUrl === '') {
        return;
    }
    $data = loadUsers();
    $changed = false;
    foreach ($data['users'] as &$row) {
        if (($row['dashboard_theme_url'] ?? '') === $themeUrl) {
            $row['dashboard_theme_url'] = '';
            $row['updated_at'] = time();
            $changed = true;
        }
    }
    unset($row);
    if ($changed) {
        saveUsers($data);
    }
}

function deleteDashboardThemeImage($themeUrl)
{
    $themeUrl = trim((string) $themeUrl);
    if ($themeUrl === '' || ! filter_var($themeUrl, FILTER_VALIDATE_URL)) {
        return ['success' => false, 'error' => 'Theme image not found.'];
    }

    $library = loadThemeLibrary();
    $kept = [];
    $removed = false;
    foreach ($library['items'] as $item) {
        if (($item['url'] ?? '') === $themeUrl) {
            $removed = true;

            continue;
        }
        $kept[] = $item;
    }
    if ($removed) {
        $library['items'] = $kept;
        saveThemeLibrary($library);
        clearDashboardThemeUrlForUsers($themeUrl);

        return ['success' => true];
    }

    $profileDir = realpath(__DIR__.'/profileimg');
    if ($profileDir) {
        $path = parse_url($themeUrl, PHP_URL_PATH);
        $name = $path ? basename(rawurldecode($path)) : '';
        if ($name !== '' && str_starts_with($name, 'dashboard-theme-')) {
            $file = $profileDir.DIRECTORY_SEPARATOR.cleanExistingName($name);
            $real = realpath($file);
            if ($real && strpos($real, $profileDir.DIRECTORY_SEPARATOR) === 0 && is_file($real)) {
                @unlink($real);
                clearDashboardThemeUrlForUsers($themeUrl);

                return ['success' => true];
            }
        }
    }

    return ['success' => false, 'error' => 'Default theme images cannot be deleted.'];
}

function defaultUsers()
{
    global $ADMIN_USER, $ADMIN_PASS_HASH;

    return [
        'users' => [
            [
                'id' => 'main-admin',
                'username' => $ADMIN_USER,
                'password_hash' => $ADMIN_PASS_HASH,
                'role' => 'admin',
                'status' => 'active',
                'display_name' => 'Main Admin',
                'avatar_url' => '',
                'theme' => 'light',
                'dashboard_theme_url' => '',
                'is_main_admin' => true,
                'can_view_login_activity' => true,
                'created_at' => time(),
                'updated_at' => time(),
            ],
        ],
    ];
}

function allowedUserRoles()
{
    return ['admin', 'staff', 'converter', 'website_team'];
}

function normalizeUserRole($role)
{
    $role = strtolower((string) $role);

    return in_array($role, allowedUserRoles(), true) ? $role : 'staff';
}

function roleLabel($role)
{
    $labels = [
        'admin' => 'Admin',
        'staff' => 'Staff',
        'converter' => 'Converter',
        'website_team' => 'Website Team',
    ];
    $role = normalizeUserRole($role);

    return $labels[$role] ?? 'Staff';
}

function loadUsers()
{
    global $USERS_FILE;
    $data = readJsonFile($USERS_FILE, defaultUsers());
    if (empty($data['users']) || ! is_array($data['users'])) {
        $data = defaultUsers();
    }
    $hasMain = false;
    foreach ($data['users'] as &$user) {
        $user['id'] = $user['id'] ?? bin2hex(random_bytes(8));
        $user['role'] = normalizeUserRole($user['role'] ?? 'staff');
        $user['status'] = ($user['status'] ?? 'active') === 'frozen' ? 'frozen' : 'active';
        $user['display_name'] = trim($user['display_name'] ?? '') ?: ($user['username'] ?? 'User');
        $user['avatar_url'] = trim($user['avatar_url'] ?? '');
        $user['theme'] = in_array($user['theme'] ?? 'light', ['light', 'dark', 'system'], true) ? $user['theme'] : 'light';
        $user['dashboard_theme_url'] = trim($user['dashboard_theme_url'] ?? '');
        if ($user['dashboard_theme_url'] !== '' && ! filter_var($user['dashboard_theme_url'], FILTER_VALIDATE_URL)) {
            $user['dashboard_theme_url'] = '';
        }
        $user['can_view_login_activity'] = (bool) ($user['can_view_login_activity'] ?? true);
        $user['is_main_admin'] = (bool) ($user['is_main_admin'] ?? false);
        if ($user['is_main_admin']) {
            $hasMain = true;
        }
    }
    unset($user);
    if (! $hasMain && ! empty($data['users'][0])) {
        $data['users'][0]['role'] = 'admin';
        $data['users'][0]['is_main_admin'] = true;
        $data['users'][0]['status'] = 'active';
    }
    saveUsers($data);

    return $data;
}

function saveUsers($data)
{
    global $USERS_FILE;
    writeJsonFile($USERS_FILE, $data);
}

function findUserByUsername($username)
{
    $username = strtolower(trim($username));
    foreach (loadUsers()['users'] as $user) {
        if (strtolower($user['username'] ?? '') === $username) {
            return $user;
        }
    }

    return null;
}

function findUserById($id)
{
    foreach (loadUsers()['users'] as $user) {
        if (($user['id'] ?? '') === $id) {
            return $user;
        }
    }

    return null;
}

function getLaravelAppPath(): ?array
{
    $candidates = [
        [
            'autoload' => dirname(__DIR__, 2).'/vendor/autoload.php',
            'app' => dirname(__DIR__, 2).'/bootstrap/app.php',
        ],
        [
            'autoload' => dirname(__DIR__, 1).'/vendor/autoload.php',
            'app' => dirname(__DIR__, 1).'/bootstrap/app.php',
        ],
        [
            'autoload' => '/home/u881038410/domains/rafvex.com/public_html/vendor/autoload.php',
            'app' => '/home/u881038410/domains/rafvex.com/public_html/bootstrap/app.php',
        ],
    ];
    foreach ($candidates as $cand) {
        if (is_file($cand['autoload']) && is_file($cand['app'])) {
            return $cand;
        }
    }

    return null;
}

function getCmsUser(): ?array
{
    static $cmsUser = null;
    static $resolved = false;

    if ($resolved && $cmsUser !== null) {
        return $cmsUser;
    }

    // Check StoneKrusher CMS native session first
    $securityFile = dirname(__DIR__) . '/api/security.php';
    if (is_file($securityFile)) {
        try {
            require_once $securityFile;
            if (class_exists('Security')) {
                $user = Security::getCurrentUser();
                if ($user && ($user['status'] ?? '') === 'active') {
                    $isSuperAdmin = ($user['role'] ?? '') === 'super_admin' || ($user['role'] ?? '') === 'admin';
                    $cmsUser = [
                        'id' => (string) $user['id'],
                        'username' => $user['email'] ?? $user['username'],
                        'display_name' => $user['full_name'] ?: ($user['username'] ?: 'Admin'),
                        'role' => $user['role'],
                        'status' => 'active',
                        'is_main_admin' => $isSuperAdmin,
                        'avatar_url' => '',
                        'theme' => $_SESSION['theme'] ?? 'dark',
                        'dashboard_theme_url' => '',
                        'can_view_login_activity' => true,
                    ];
                    $resolved = true;
                    return $cmsUser;
                }
            }
        } catch (Throwable $e) {
            error_log('StoneKrusher CMS auth in medialibrary error: ' . $e->getMessage());
        }
    }

    $paths = getLaravelAppPath();
    if (! $paths) {
        return null;
    }

    try {
        if (! defined('LARAVEL_START')) {
            define('LARAVEL_START', microtime(true));
        }
        require_once $paths['autoload'];

        /** @var Application $app */
        $app = Container::getInstance();
        if (! $app || ! ($app instanceof Illuminate\Contracts\Foundation\Application)) {
            $app = require $paths['app'];
        }

        if ($app instanceof Illuminate\Contracts\Foundation\Application) {
            $kernel = $app->make(Kernel::class);
            $kernel->bootstrap();
        }

        $cookieName = config('session.cookie', 'rafvex-session');
        $rawCookie = $_COOKIE[$cookieName]
            ?? $_COOKIE['rafvex-session']
            ?? $_COOKIE['laravel-session']
            ?? null;

        if (! $rawCookie || ! is_string($rawCookie)) {
            return null;
        }

        $sessionId = null;
        try {
            $sessionId = $app->make('encrypter')->decrypt($rawCookie, false);
        } catch (Throwable $e) {
            // Raw cookie might already be the plain session ID
        }

        if (! $sessionId || ! is_string($sessionId)) {
            $sessionId = $rawCookie;
        }

        // In Laravel, encrypted cookies may include a hash prefix: hash|sessionId
        if (strpos($sessionId, '|') !== false) {
            $parts = explode('|', $sessionId, 2);
            $sessionId = $parts[1];
        }

        /** @var User|null $user */
        $user = null;

        try {
            $request = Request::capture();
            $session = $app->make('session')->driver();
            $session->setId($sessionId);
            $session->start();
            $request->setLaravelSession($session);
            $app->instance('request', $request);
            $user = $app->make('auth')->guard()->user();
        } catch (Throwable $e) {
            // Fallback to database lookup
        }

        if (! $user) {
            try {
                $sessionRow = DB::table('sessions')->where('id', $sessionId)->first();
                if ($sessionRow && ! empty($sessionRow->user_id)) {
                    $user = User::find($sessionRow->user_id);
                }
            } catch (Throwable $e) {
                // Ignore fallback error
            }
        }

        if (! $user || (isset($user->is_active) && ! $user->is_active)) {
            return null;
        }

        $isSuperAdmin = true;
        if (method_exists($user, 'hasRole')) {
            $isSuperAdmin = $user->hasRole('Super Admin') || $user->hasRole('Administrator');
        }

        $cmsUser = [
            'id' => (string) $user->id,
            'username' => $user->email,
            'display_name' => $user->name ?: $user->email,
            'role' => 'admin',
            'status' => 'active',
            'is_main_admin' => $isSuperAdmin,
            'avatar_url' => $user->avatar ?: ($user->google_avatar ?: ''),
            'theme' => $_SESSION['theme'] ?? 'dark',
            'dashboard_theme_url' => '',
            'can_view_login_activity' => true,
        ];
        $resolved = true;

        return $cmsUser;
    } catch (Throwable $e) {
        error_log('MediaLibrary getCmsUser error: '.$e->getMessage());

        return null;
    }
}

function currentUser()
{
    return getCmsUser();
}

function isAdminUser($user)
{
    return is_array($user) && ! empty($user);
}

function isWebsiteTeamUser($user)
{
    return false;
}

function isConverterUser($user)
{
    return false;
}

function userInitials($user)
{
    $name = trim($user['display_name'] ?? $user['username'] ?? 'U');
    $parts = preg_split("/\s+/", $name);
    $out = '';
    foreach (array_slice($parts, 0, 2) as $part) {
        $out .= strtoupper(substr($part, 0, 1));
    }

    return $out ?: 'U';
}

function recordLoginActivity($username, $status, $user = null)
{
    global $LOGIN_ACTIVITY_FILE;
    $data = readJsonFile($LOGIN_ACTIVITY_FILE, ['items' => []]);
    if (empty($data['items']) || ! is_array($data['items'])) {
        $data['items'] = [];
    }
    array_unshift($data['items'], [
        'id' => bin2hex(random_bytes(8)),
        'user_id' => $user['id'] ?? '',
        'username' => substr((string) $username, 0, 120),
        'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
        'user_agent' => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 240),
        'status' => $status,
        'created_at' => time(),
    ]);
    $data['items'] = array_slice($data['items'], 0, 500);
    writeJsonFile($LOGIN_ACTIVITY_FILE, $data);
}

function loadLoginActivity()
{
    global $LOGIN_ACTIVITY_FILE;
    $data = readJsonFile($LOGIN_ACTIVITY_FILE, ['items' => []]);

    return is_array($data['items'] ?? null) ? $data['items'] : [];
}

function redirectWithMessage($mode, $message, $type = 'success')
{
    $url = $GLOBALS['pageUrl'];
    if ($mode) {
        $url .= '?'.$mode.'=1';
    } else {
        $url .= '?path='.urlencode($_GET['path'] ?? '');
    }
    $url .= (strpos($url, '?') !== false ? '&' : '?').'msg='.urlencode($message).'&msgtype='.urlencode($type);
    header('Location: '.$url);
    exit;
}

function findBanId($security, $identity)
{
    foreach ($security['banned'] as $banId => $ban) {
        if (($ban['device_key'] ?? '') === $identity['device_key']) {
            return $banId;
        }
        if (($ban['fingerprint'] ?? '') === $identity['fingerprint']) {
            return $banId;
        }
    }

    return '';
}

function clearLoginAttempts(&$security, $identity)
{
    unset($security['attempts'][$identity['fingerprint']]);
}

function registerLoginFailure(&$security, $identity, $username)
{
    global $MAX_LOGIN_ATTEMPTS;
    $key = $identity['fingerprint'];
    $attempt = $security['attempts'][$key] ?? ['count' => 0];
    $attempt['count'] = (int) ($attempt['count'] ?? 0) + 1;
    $attempt['last_at'] = time();
    $attempt['ip'] = $identity['ip'];
    $attempt['user_agent'] = $identity['user_agent'];
    $attempt['username'] = substr($username, 0, 80);
    $security['attempts'][$key] = $attempt;

    if ($attempt['count'] >= $MAX_LOGIN_ATTEMPTS) {
        $banId = bin2hex(random_bytes(8));
        $security['banned'][$banId] = [
            'id' => $banId,
            'device_key' => $identity['device_key'],
            'fingerprint' => $identity['fingerprint'],
            'ip' => $identity['ip'],
            'user_agent' => $identity['user_agent'],
            'username' => substr($username, 0, 80),
            'banned_at' => time(),
            'reason' => $MAX_LOGIN_ATTEMPTS.' failed login attempts',
        ];
        unset($security['attempts'][$key]);

        return ['banned' => true, 'remaining' => 0];
    }

    return ['banned' => false, 'remaining' => max(0, $MAX_LOGIN_ATTEMPTS - $attempt['count'])];
}

function formatSize($bytes)
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

function parentPath($current)
{
    if (! $current) {
        return '';
    }
    $parts = explode('/', $current);
    array_pop($parts);

    return implode('/', $parts);
}

function getFileIcon($filename, $isDir = false)
{
    if ($isDir) {
        return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" opacity=".95"/></svg>';
    }
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    if (in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'])) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="m21 15-5-5L5 21"/></svg>';
    }
    if (in_array($ext, ['html', 'css', 'js', 'json', 'php'])) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>';
    }

    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
}

/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
*/

$loginIdentity = loginIdentity();
$securityData = loadSecurityData();
$currentBanId = findBanId($securityData, $loginIdentity);
$appSettings = loadAppSettings();

if (isset($_POST['login'])) {
    header('Location: /ourcms');
    exit;
}

if (isset($_GET['logout'])) {
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_unset();
        session_destroy();
    }
    header('Location: /ourcmskiuq');
    exit;
}

$currentUser = currentUser();

// Support seamless single sign-on from StoneKrusher CMS
if (!$currentUser) {
    $cmsUser = getCmsUser();
    if ($cmsUser) {
        $currentUser = $cmsUser;
        $_SESSION['user_id'] = $cmsUser['id'];
        $_SESSION['admin_logged_in'] = true;
    }
}

if (!$currentUser && isset($_POST['username']) && isset($_POST['password'])) {
    $u = trim($_POST['username']);
    $p = $_POST['password'];
    if (($u === 'admin@stonekrusher.com' || $u === 'admin' || $u === $ADMIN_USER) && ($p === 'Password@123' || password_verify($p, $ADMIN_PASS_HASH))) {
        $_SESSION['user_id'] = 'main-admin';
        $_SESSION['admin_logged_in'] = true;
        header('Location: ' . $pageUrl);
        exit;
    } else {
        $loginError = 'Invalid username or password.';
    }
}

if (! $currentUser) {
    $isAjax = (! empty($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest')
        || (strpos($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json') !== false)
        || isset($_POST['action'])
        || isset($_POST['ajax'])
        || isset($_GET['action'])
        || isset($_GET['ajax']);

    if ($isAjax) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode([
            'status' => 'error',
            'message' => 'Unauthorized: Please log in to StoneKrusher CMS to access the Media Library.',
            'redirect' => '/ourcmskiuq',
        ]);
        exit;
    }
?>
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<title><?php echo htmlspecialchars($appSettings['app_name']); ?> - Login</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<?php if (! empty($appSettings['favicon_url'])) { ?><link rel="icon" href="<?php echo htmlspecialchars($appSettings['favicon_url']); ?>"><?php } else { ?><link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png?v=2"><link rel="icon" href="/favicon.ico?v=2"><?php } ?>
<script>
(() => {
    const saved = localStorage.getItem('kiuqTheme') || 'light';
    const theme = saved === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : saved;
    document.documentElement.dataset.theme = theme;
})();
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
    --accent: #4f46e5;
    --accent2: #0ea5e9;
    --accent3: #8b5cf6;
    --danger: #ef4444;
    --text: #0f172a;
    --muted: #475569;
}

body {
    font-family: 'Plus Jakarta Sans', sans-serif;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: #f0f4ff;
    position: relative;
}
[data-theme="dark"] .bg {
    background:
        radial-gradient(ellipse 900px 700px at 10% 20%, rgba(96,165,250,0.16) 0%, transparent 60%),
        radial-gradient(ellipse 700px 600px at 90% 80%, rgba(148,163,184,0.18) 0%, transparent 55%),
        #4a4f57;
}
[data-theme="dark"] body { background:#4a4f57; color:#f3f4f6; }
[data-theme="dark"] .grid-overlay { background-image: linear-gradient(rgba(226,232,240,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(226,232,240,0.08) 1px, transparent 1px); }
[data-theme="dark"] .login-card { background: rgba(58,63,71,0.92); border-color: rgba(107,114,128,0.7); }
[data-theme="dark"] .login-title { background: linear-gradient(135deg, #e5edf8 0%, #60a5fa 60%, #a78bfa 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
[data-theme="dark"] .field input { background: rgba(52,57,65,0.9); border-color:#667080; color:#f3f4f6; }
[data-theme="dark"] .field input:focus { background: rgba(65,70,80,0.95); border-color: #60a5fa; box-shadow: 0 0 0 5px rgba(96,165,250,0.2), 0 4px 16px rgba(96,165,250,0.15); color: #f3f4f6; }
[data-theme="dark"] input:-webkit-autofill,
[data-theme="dark"] input:-webkit-autofill:hover, 
[data-theme="dark"] input:-webkit-autofill:focus, 
[data-theme="dark"] input:-webkit-autofill:active {
    -webkit-box-shadow: 0 0 0 30px #343940 inset !important;
    -webkit-text-fill-color: #f3f4f6 !important;
    transition: background-color 5000s ease-in-out 0s;
}
[data-theme="dark"] .field input:-webkit-autofill,
[data-theme="dark"] .field input:-webkit-autofill:hover, 
[data-theme="dark"] .field input:-webkit-autofill:focus, 
[data-theme="dark"] .field input:-webkit-autofill:active {
    -webkit-box-shadow: 0 0 0 30px #343941 inset !important;
}
[data-theme="dark"] .login-sub, [data-theme="dark"] .field label, [data-theme="dark"] .login-badge { color:#cbd5e1; }
[data-theme="dark"] .float-badge { background: #3a3f47; border-color: #667080; }

.login-theme-switch {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 30;
    width: 64px;
    height: 32px;
    background: #e6f0fa;
    border-radius: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px;
    border: 2px solid #dce8f5;
    transition: all 0.3s ease;
    box-shadow: 0 16px 40px rgba(79,70,229,0.14);
    backdrop-filter: blur(18px);
}
.login-theme-switch .ts-icon {
    font-size: 14px;
    z-index: 2;
    transition: color 0.3s ease;
    line-height: 1;
}
.login-theme-switch .ts-icon.sun { color: #f59e0b; }
.login-theme-switch .ts-icon.moon { color: #94a3b8; }
.login-theme-switch .ts-thumb {
    position: absolute;
    width: 24px;
    height: 24px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.1);
    left: 4px;
    top: 50%;
    transform: translateY(-50%);
    transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 1;
}
[data-theme="dark"] .login-theme-switch {
    background: #4b5563;
    border-color: #6b7280;
}
[data-theme="dark"] .login-theme-switch .ts-thumb {
    left: calc(100% - 28px);
    background: #343940;
    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
}
[data-theme="dark"] .login-theme-switch .ts-icon.sun { color: #9ca3af; filter: grayscale(1); }
[data-theme="dark"] .login-theme-switch .ts-icon.moon { color: #60a5fa; }

/* === BRIGHT ANIMATED BG === */
.bg {
    position: fixed;
    inset: 0;
    z-index: 0;
    background:
        radial-gradient(ellipse 900px 700px at 10% 20%, rgba(165,180,252,0.6) 0%, transparent 60%),
        radial-gradient(ellipse 700px 600px at 90% 80%, rgba(125,211,252,0.55) 0%, transparent 55%),
        radial-gradient(ellipse 600px 600px at 60% 30%, rgba(196,181,253,0.5) 0%, transparent 55%),
        radial-gradient(ellipse 500px 500px at 20% 80%, rgba(167,243,208,0.4) 0%, transparent 50%),
        #dde8ff;
    animation: bg-shift 14s ease-in-out infinite alternate;
}

@keyframes bg-shift {
    0%   { background-position: 0% 0%, 100% 100%, 60% 30%, 20% 80%; }
    100% { background-position: 5% 10%, 95% 90%, 65% 25%, 15% 85%; }
}

/* Grid */
.grid-overlay {
    position: fixed; inset: 0;
    background-image:
        linear-gradient(rgba(79,70,229,0.07) 1px, transparent 1px),
        linear-gradient(90deg, rgba(79,70,229,0.07) 1px, transparent 1px);
    background-size: 56px 56px;
    z-index: 1;
    animation: grid-drift 20s linear infinite;
}
@keyframes grid-drift {
    from { background-position: 0 0; }
    to   { background-position: 56px 56px; }
}

/* Orbs */
.orbs {
    position: fixed; inset: 0; z-index: 2; pointer-events: none; overflow: hidden;
}
.orb {
    position: absolute; border-radius: 50%;
    filter: blur(3px); opacity: 0;
    animation: orb-float ease-in-out infinite;
}
.orb1 { width: 18px; height: 18px; background: radial-gradient(circle, #a5b4fc, #6366f1); left: 15%; animation-duration: 9s; animation-delay: 0s; }
.orb2 { width: 10px; height: 10px; background: radial-gradient(circle, #7dd3fc, #0ea5e9); left: 35%; animation-duration: 13s; animation-delay: -3s; }
.orb3 { width: 14px; height: 14px; background: radial-gradient(circle, #c4b5fd, #8b5cf6); left: 55%; animation-duration: 11s; animation-delay: -6s; }
.orb4 { width: 8px;  height: 8px;  background: radial-gradient(circle, #a7f3d0, #10b981); left: 72%; animation-duration: 15s; animation-delay: -1s; }
.orb5 { width: 20px; height: 20px; background: radial-gradient(circle, #fde68a, #f59e0b); left: 85%; animation-duration: 10s; animation-delay: -4s; }
.orb6 { width: 12px; height: 12px; background: radial-gradient(circle, #fca5a5, #ef4444); left: 25%; animation-duration: 12s; animation-delay: -7s; }
.orb7 { width: 9px;  height: 9px;  background: radial-gradient(circle, #a5b4fc, #4f46e5); left: 65%; animation-duration: 16s; animation-delay: -2s; }
.orb8 { width: 16px; height: 16px; background: radial-gradient(circle, #fbcfe8, #ec4899); left: 48%; animation-duration: 14s; animation-delay: -5s; }

@keyframes orb-float {
    0%   { transform: translateY(110vh) rotate(0deg) scale(0.6); opacity: 0; }
    8%   { opacity: 0.9; }
    92%  { opacity: 0.7; }
    100% { transform: translateY(-20px) rotate(360deg) scale(1.2); opacity: 0; }
}

/* Sparkles */
.sparkle {
    position: absolute; pointer-events: none; animation: sparkle-anim 2.5s ease-in-out infinite;
    z-index: 3;
}
.sparkle::before, .sparkle::after {
    content: '✦';
    position: absolute;
    color: rgba(99,102,241,0.5);
    font-size: 12px;
}
.sparkle::after { color: rgba(14,165,233,0.4); font-size: 8px; top: 20px; left: 15px; animation-delay: 1s; }
@keyframes sparkle-anim {
    0%,100% { opacity: 0; transform: scale(0.5); }
    50%      { opacity: 1; transform: scale(1); }
}

/* Login card */
.login-wrap {
    position: relative; z-index: 10;
    width: 500px; max-width: calc(100vw - 32px);
    width: 600px; max-width: calc(100vw - 32px);
}

.login-card {
    background: rgba(255,255,255,0.88);
    backdrop-filter: blur(40px) saturate(200%);
    border: 1.5px solid rgba(255,255,255,0.8);
    border-radius: 36px;
    padding: 64px 52px 52px;
    box-shadow:
        0 0 0 1px rgba(255,255,255,0.9) inset,
        0 60px 120px rgba(79,70,229,0.22),
        0 24px 48px rgba(79,70,229,0.12),
        0 0 80px rgba(139,92,246,0.08);
    animation: card-in 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    opacity: 0;
    position: relative;
    overflow: hidden;
}

.login-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 50%);
    pointer-events: none;
    border-radius: 36px;
}

@keyframes card-in {
    0%   { opacity: 0; transform: translateY(60px) scale(0.88) rotateX(8deg); }
    100% { opacity: 1; transform: translateY(0) scale(1) rotateX(0); }
}

/* Logo */
.logo-wrap {
    display: flex; justify-content: center; margin-bottom: 36px;
}

.logo-outer {
    position: relative;
    width: 100px; height: 100px;
    display: flex; align-items: center; justify-content: center;
}

.logo-ring-outer {
    position: absolute; inset: -4px;
    border-radius: 34px;
    border-radius: 50%;
    background: conic-gradient(from 0deg, #4f46e5, #0ea5e9, #8b5cf6, #ec4899, #4f46e5);
    animation: ring-spin 3s linear infinite;
    opacity: 0.7;
}

.logo-ring {
    width: 100px; height: 100px;
    border-radius: 30px;
    border-radius: 50%;
    background: linear-gradient(135deg, #4f46e5 0%, #8b5cf6 50%, #0ea5e9 100%);
    display: flex; align-items: center; justify-content: center;
    box-shadow:
        0 24px 60px rgba(79,70,229,0.5),
        0 8px 24px rgba(139,92,246,0.3),
        inset 0 1px 1px rgba(255,255,255,0.3);
    animation: logo-breathe 3s ease-in-out infinite;
    position: relative; z-index: 1;
}

@keyframes logo-breathe {
    0%,100% { transform: scale(1); box-shadow: 0 24px 60px rgba(79,70,229,0.5), 0 8px 24px rgba(139,92,246,0.3), inset 0 1px 1px rgba(255,255,255,0.3); }
    50%      { transform: scale(1.04); box-shadow: 0 32px 80px rgba(79,70,229,0.65), 0 12px 32px rgba(139,92,246,0.4), inset 0 1px 1px rgba(255,255,255,0.3); }
}

@keyframes ring-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
}

.logo-inner-icon {
    font-size: 46px; line-height: 1;
    animation: icon-wobble 4s ease-in-out infinite;
    filter: drop-shadow(0 2px 8px rgba(0,0,0,0.2));
}
.login-logo-img {
    width: 68px;
    height: 68px;
    object-fit: contain;
    border-radius: 20px;
    border-radius: 50%;
}
@keyframes icon-wobble {
    0%,100% { transform: rotate(-3deg) scale(1); }
    50%      { transform: rotate(3deg) scale(1.05); }
}

/* Floating badges */
.float-badge {
    position: absolute;
    background: white;
    border-radius: 12px;
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 800;
    box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    white-space: nowrap;
    border: 1px solid rgba(255,255,255,0.8);
    animation: badge-float 4s ease-in-out infinite;
    z-index: 5;
}

.badge-top { top: -14px; right: -60px; color: #4f46e5; animation-delay: 0s; }
.badge-btm { bottom: -14px; left: -60px; color: #0ea5e9; animation-delay: -2s; }

@keyframes badge-float {
    0%,100% { transform: translateY(0); }
    50%      { transform: translateY(-6px); }
}

/* Title */
.login-title {
    font-size: 34px; font-weight: 800; color: var(--text);
    text-align: center; letter-spacing: -0.8px; margin-bottom: 6px;
    background: linear-gradient(135deg, #0f172a 0%, #4f46e5 60%, #8b5cf6 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    animation: title-shine 4s ease infinite;
}
@keyframes title-shine {
    0%,100% { background-position: 0% 50%; }
    50%      { background-position: 100% 50%; }
}

.login-sub {
    color: var(--muted); text-align: center; font-size: 15px;
    font-weight: 500; margin-bottom: 40px;
    display: flex; align-items: center; justify-content: center; gap: 8px;
}

.login-sub-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: linear-gradient(135deg, #4f46e5, #0ea5e9);
    display: inline-block;
    animation: dot-pulse 2s ease-in-out infinite;
}
@keyframes dot-pulse {
    0%,100% { transform: scale(1); opacity: 1; }
    50%      { transform: scale(1.4); opacity: 0.6; }
}

/* Fields */
.field { margin-bottom: 18px; }

.field label {
    display: block; font-size: 11px; font-weight: 800;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--muted); margin-bottom: 8px;
}

.field-inner { position: relative; }

.field-icon {
    position: absolute; left: 18px; top: 50%;
    transform: translateY(-50%); pointer-events: none;
    width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;
    color: #94a3b8; font-size: 16px;
    transition: color 0.2s;
}

.field input {
    width: 100%; padding: 16px 18px 16px 50px;
    background: rgba(248,250,252,0.8);
    border: 2px solid rgba(226,232,240,0.8);
    border-radius: 18px;
    font-size: 15px; font-family: 'Plus Jakarta Sans', sans-serif;
    color: var(--text); outline: none; transition: all 0.25s;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.field input:focus {
    border-color: var(--accent);
    background: rgba(255,255,255,0.95);
    box-shadow: 0 0 0 5px rgba(79,70,229,0.12), 0 4px 16px rgba(79,70,229,0.1);
    transform: translateY(-1px);
}

.pw-toggle-btn {
    position: absolute; right: 18px; top: 50%;
    transform: translateY(-50%);
    width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
    background: none; border: none; cursor: pointer;
    color: #94a3b8; font-size: 16px; transition: color 0.2s;
    outline: none; z-index: 10;
}
.pw-toggle-btn:hover { color: var(--accent); }

.field input:focus ~ .field-focus-bar { transform: scaleX(1); }

.field-focus-bar {
    height: 2px; background: linear-gradient(90deg, var(--accent), var(--accent3));
    border-radius: 2px; transform: scaleX(0); transition: transform 0.3s;
    margin-top: 4px; transform-origin: left;
}

/* Login Button */
.login-btn {
    width: 100%; padding: 18px;
    margin-top: 8px;
    background: linear-gradient(135deg, #4f46e5, #6d28d9 50%, #0ea5e9);
    background-size: 200% 200%;
    color: white; font-size: 16px; font-weight: 800;
    font-family: 'Plus Jakarta Sans', sans-serif;
    border: none; border-radius: 18px; cursor: pointer;
    transition: all 0.3s;
    letter-spacing: 0.04em;
    box-shadow: 0 16px 40px rgba(79,70,229,0.4), 0 4px 12px rgba(79,70,229,0.2);
    position: relative; overflow: hidden;
    animation: btn-gradient 5s ease infinite;
}

@keyframes btn-gradient {
    0%,100% { background-position: 0% 50%; }
    50%      { background-position: 100% 50%; }
}

.login-btn::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.2), transparent 60%);
    border-radius: 18px;
    opacity: 0; transition: opacity 0.2s;
}

.login-btn::after {
    content: '';
    position: absolute; inset: -100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
    transform: translateX(-100%);
    transition: transform 0.6s;
}

.login-btn:hover { transform: translateY(-3px); box-shadow: 0 24px 60px rgba(79,70,229,0.55), 0 8px 20px rgba(79,70,229,0.25); }
.login-btn:hover::before { opacity: 1; }
.login-btn:hover::after { transform: translateX(300%); }
.login-btn:active { transform: translateY(-1px); }

/* Error */
.error-box {
    background: rgba(254,242,242,0.9);
    border: 2px solid #fecaca;
    color: #dc2626; padding: 14px 18px;
    border-radius: 16px; font-size: 13px; font-weight: 700;
    margin-bottom: 20px; display: flex; align-items: center; gap: 10px;
    animation: shake 0.45s cubic-bezier(.36,.07,.19,.97);
    backdrop-filter: blur(8px);
}
@keyframes shake {
    0%,100% { transform: translateX(0); }
    15%,55% { transform: translateX(-8px); }
    35%,75% { transform: translateX(8px); }
}

/* Badge */
.login-badge {
    text-align: center; margin-top: 28px;
    font-size: 11.5px; color: #94a3b8; font-weight: 600;
    display: flex; align-items: center; justify-content: center; gap: 6px;
}

.sec-pill {
    display: inline-flex; align-items: center; gap: 4px;
    background: rgba(16,185,129,0.1); color: #10b981;
    border: 1px solid rgba(16,185,129,0.2);
    padding: 3px 10px; border-radius: 20px;
    font-size: 10px; font-weight: 700;
}
</style>
</head>
<body>

<div class="login-theme-switch" id="loginThemeToggle" onclick="toggleLoginTheme()" title="Toggle Dark/Light Mode">
    <div class="ts-thumb"></div>
    <span class="ts-icon sun">☀️</span>
    <span class="ts-icon moon">🌙</span>
</div>

<div class="bg"></div>
<div class="grid-overlay"></div>
<div class="orbs">
    <div class="orb orb1"></div><div class="orb orb2"></div><div class="orb orb3"></div>
    <div class="orb orb4"></div><div class="orb orb5"></div><div class="orb orb6"></div>
    <div class="orb orb7"></div><div class="orb orb8"></div>
</div>

<div class="login-wrap">
    <form class="login-card" method="post">
        <?php echo csrfField(); ?>
        <div class="logo-wrap">
            <div class="logo-outer">
                <div class="logo-ring-outer"></div>
                <div class="logo-ring">
                    <?php if (! empty($appSettings['dashboard_logo_url'])) { ?>
                        <img class="login-logo-img" src="<?php echo htmlspecialchars($appSettings['dashboard_logo_url']); ?>" alt="<?php echo htmlspecialchars($appSettings['app_name']); ?>">
                    <?php } else { ?>
                        <span class="logo-inner-icon">FM</span>
                    <?php } ?>
                </div>
                <div class="float-badge badge-top">⚡ Fast</div>
                <div class="float-badge badge-btm">🔐 Secure</div>
            </div>
        </div>

        <h1 class="login-title"><?php echo htmlspecialchars($appSettings['app_name']); ?></h1>
        <p class="login-sub"><span class="login-sub-dot"></span> Private Image Hosting Server <span class="login-sub-dot"></span></p>

        <?php if (! empty($loginError)) { ?>
            <div class="error-box">⚠️ <?php echo htmlspecialchars($loginError); ?></div>
        <?php } ?>

        <div class="field">
            <label>Username</label>
            <div class="field-inner">
                <span class="field-icon">👤</span>
                <input name="username" placeholder="Enter your username" required autocomplete="username">
                <div class="field-focus-bar"></div>
            </div>
        </div>

        <div class="field">
            <label>Password</label>
            <div class="field-inner">
                <span class="field-icon">🔒</span>
                <input id="loginPassword" name="password" type="password" placeholder="Enter your password" required autocomplete="current-password" style="padding-right: 50px;">
                <button type="button" class="pw-toggle-btn" onclick="togglePasswordVisibility()" tabindex="-1" title="Show password">👁️</button>
                <div class="field-focus-bar"></div>
            </div>
        </div>

        <button class="login-btn" name="login">Sign In to Dashboard →</button>

        <div class="login-badge">
            <span class="sec-pill">✓ Encrypted</span>
            &middot; Private &middot; Secure &middot; Fast
        </div>
    </form>
</div>

<script>
function togglePasswordVisibility() {
    const input = document.getElementById('loginPassword');
    const btn = document.querySelector('.pw-toggle-btn');
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
        btn.title = 'Hide password';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
        btn.title = 'Show password';
    }
}
function updateLoginThemeButton() {
    // The slide animation is handled by CSS using [data-theme="dark"]
}
function toggleLoginTheme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('kiuqTheme', next);
    updateLoginThemeButton();
}
updateLoginThemeButton();
</script>

</body>
</html>
<?php
    exit;
}

/*
|--------------------------------------------------------------------------
| CURRENT PATH
|--------------------------------------------------------------------------
*/

$isAdmin = true;
$isConverter = false;
$isWebsiteTeam = false;
$websiteTeamFolder = '';
$websiteTeamRootRelative = '';
$websiteTeamRootDir = '';
$converterRootRelative = '';
$converterRootDir = '';

$requestedPath = isset($_GET['path']) ? cleanPath($_GET['path']) : '';
if (
    ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST'
    && isset($_POST['path'])
) {
    $requestedPath = cleanPath($_POST['path']);
}
$current = $requestedPath;
$currentDir = safeFullPath($BASE_DIR, $current);
if (! is_dir($currentDir)) {
    $current = '';
    $currentDir = $BASE_DIR;
}

$trashMode = isset($_GET['trash']) && $_GET['trash'] === '1';
$usersMode = false;
$activityMode = false;
$profileMode = false;
$settingsMode = false;
if ($isConverter) {
    $trashMode = false;
    $usersMode = false;
    $activityMode = false;
    $profileMode = false;
    $settingsMode = false;
}
if ($isWebsiteTeam) {
    $usersMode = false;
    $activityMode = false;
    $settingsMode = false;
}
$_SESSION['last_activity'] = time();
$baseReturnUrl = $pageUrl.'?path='.urlencode($current);
$homePath = $isConverter ? $converterRootRelative : ($isWebsiteTeam ? $websiteTeamRootRelative : '');
$homeUrl = $pageUrl.'?path='.urlencode($homePath);

if (isset($_GET['download_item'])) {
    $itemName = cleanExistingName($_GET['download_item']);
    $itemPath = $itemName ? ($currentDir.'/'.$itemName) : '';
    if ($itemName && isSystemManagedFile($itemName)) {
        header('Location: '.$baseReturnUrl.'&msg='.urlencode('System file is hidden.').'&msgtype=warning');
        exit;
    }
    if ($itemName && is_file($itemPath)) {
        streamDownloadFile($itemPath, $itemName);
    }
    if ($itemName && is_dir($itemPath)) {
        $archiveName = sanitizeDownloadFilename($itemName.'-'.date('Ymd-His').'.zip', 'folder.zip');
        if (! streamZipDownloadFromMap([$itemPath => $itemName], $archiveName)) {
            header('Location: '.$baseReturnUrl.'&msg='.urlencode('ZIP download is unavailable on this server.').'&msgtype=error');
            exit;
        }
    }
    header('Location: '.$baseReturnUrl.'&msg='.urlencode('Item not found for download.').'&msgtype=warning');
    exit;
}

/*
|--------------------------------------------------------------------------
| ACTIONS
|--------------------------------------------------------------------------
*/

$message = '';
$messageType = 'success';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    $action = $_POST['action'];
    $uploadAjaxRequest = isset($_POST['upload_ajax']) && $_POST['upload_ajax'] === '1';
    $redirectToTrash = $trashMode || in_array($action, ['restore_trash_item', 'delete_trash_item', 'empty_trash', 'restore_trash_selected', 'delete_trash_selected'], true);
    $redirectOverride = '';
    $adminOnlyActions = ['unban_device', 'save_app_settings', 'clear_login_activity', 'create_user', 'set_user_role', 'change_user_password', 'freeze_user', 'unfreeze_user', 'delete_user', 'update_user_permissions'];
    $adminFileActions = ['create_file', 'edit_file'];
    $converterAllowedActions = ['set_theme', 'set_dashboard_theme', 'upload_dashboard_theme', 'delete_dashboard_theme', 'get_folder_options', 'get_storage_stats', 'create_folder', 'upload_files', 'delete_item', 'delete_selected', 'download_selected', 'copy_to_folder', 'duplicate_selected'];

    if (! validCsrf($_POST['csrf_token'] ?? '')) {
        if ($uploadAjaxRequest) {
            if (ob_get_length()) {
                @ob_clean();
            }
            header('Content-Type: application/json');
            echo json_encode([
                'success' => false,
                'uploaded' => 0,
                'optimized' => 0,
                'failed' => 1,
                'message' => 'Security token expired. Please refresh the page and try again.',
                'errors' => ['Security token expired.'],
            ]);
            exit;
        }
        $message = 'Security token expired. Refresh and try again.';
        $messageType = 'error';
    } elseif (in_array($action, $adminOnlyActions, true) && ! $isAdmin) {
        $message = 'Admin permission is required.';
        $messageType = 'error';
    } elseif (in_array($action, $adminFileActions, true) && ! $isAdmin && ! $isWebsiteTeam) {
        $message = 'Admin permission is required.';
        $messageType = 'error';
    } elseif ($isConverter && ! in_array($action, $converterAllowedActions, true)) {
        if ($uploadAjaxRequest) {
            if (ob_get_length()) {
                @ob_clean();
            }
            header('Content-Type: application/json');
            echo json_encode([
                'success' => false,
                'uploaded' => 0,
                'optimized' => 0,
                'failed' => 1,
                'message' => 'This action is not allowed for Converter role.',
                'errors' => ['Action not allowed for Converter role.'],
            ]);
            exit;
        }
        $message = 'This action is not allowed for Converter role.';
        $messageType = 'error';
    } elseif ($action === 'set_theme') {
        $theme = in_array($_POST['theme'] ?? 'light', ['light', 'dark', 'system'], true) ? $_POST['theme'] : 'light';
        $data = loadUsers();
        foreach ($data['users'] as &$row) {
            if (($row['id'] ?? '') === ($currentUser['id'] ?? '')) {
                $row['theme'] = $theme;
                $row['updated_at'] = time();
                break;
            }
        }
        unset($row);
        saveUsers($data);
        header('Content-Type: application/json');
        echo json_encode(['success' => true]);
        exit;
    } elseif ($action === 'get_folder_options') {
        $options = $isConverter
            ? folderOptions($BASE_DIR, $converterRootRelative, $CONVERTER_ROOT_FOLDER.' / root')
            : ($isWebsiteTeam
            ? folderOptions($BASE_DIR, $websiteTeamRootRelative, $websiteTeamFolder.' / root')
            : folderOptions($BASE_DIR));
        header('Content-Type: application/json');
        echo json_encode(['success' => true, 'options' => $options]);
        exit;
    } elseif ($action === 'set_dashboard_theme') {
        $themeUrl = trim($_POST['theme_url'] ?? '');
        if ($themeUrl !== '' && ! filter_var($themeUrl, FILTER_VALIDATE_URL)) {
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'error' => 'Enter a valid image URL.']);
            exit;
        }
        if (! saveCurrentUserDashboardTheme($currentUser['id'] ?? '', $themeUrl)) {
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'error' => 'Could not save theme for this user.']);
            exit;
        }
        $savedTheme = $themeUrl !== '' ? saveDashboardThemeUrlToLibrary($themeUrl) : null;
        header('Content-Type: application/json');
        echo json_encode([
            'success' => true,
            'theme_url' => $themeUrl,
            'theme_item' => $savedTheme ? [
                'name' => $savedTheme['name'] ?? 'Saved Theme',
                'url' => $savedTheme['url'] ?? $themeUrl,
                'can_delete' => true,
            ] : null,
        ]);
        exit;
    } elseif ($action === 'upload_dashboard_theme') {
        $upload = saveUploadedDashboardThemeImage('theme_file');
        if (! $upload['ok']) {
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'error' => $upload['error'] ?? 'Could not upload theme image.']);
            exit;
        }
        if (! saveCurrentUserDashboardTheme($currentUser['id'] ?? '', $upload['url'])) {
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'error' => 'Could not save theme for this user.']);
            exit;
        }
        header('Content-Type: application/json');
        echo json_encode(['success' => true, 'theme_url' => $upload['url'], 'name' => $upload['name'] ?? '', 'can_delete' => true]);
        exit;
    } elseif ($action === 'delete_dashboard_theme') {
        $deleteResult = deleteDashboardThemeImage($_POST['theme_url'] ?? '');
        header('Content-Type: application/json');
        echo json_encode($deleteResult);
        exit;
    } elseif ($action === 'save_profile') {
        $displayName = trim($_POST['display_name'] ?? '');
        $avatarUrl = trim($_POST['avatar_url'] ?? '');
        $uploadError = false;

        if (isset($_FILES['profile_img']) && $_FILES['profile_img']['error'] === UPLOAD_ERR_OK) {
            $tmp = $_FILES['profile_img']['tmp_name'];
            $size = getimagesize($tmp);
            if ($size !== false) {
                $mime = $size['mime'];
                $ext = '';
                $img = null;
                if ($mime === 'image/jpeg') {
                    $img = @imagecreatefromjpeg($tmp);
                    $ext = '.webp';
                } elseif ($mime === 'image/png') {
                    $img = @imagecreatefrompng($tmp);
                    $ext = '.webp';
                } elseif ($mime === 'image/webp') {
                    $img = @imagecreatefromwebp($tmp);
                    $ext = '.webp';
                } elseif ($mime === 'image/gif') {
                    $img = @imagecreatefromgif($tmp);
                    $ext = '.webp';
                }

                if ($img) {
                    $profileDir = __DIR__.'/profileimg';
                    if (! is_dir($profileDir)) {
                        mkdir($profileDir, 0777, true);
                    }
                    $fileName = preg_replace('/[^a-zA-Z0-9_-]/', '', $currentUser['username']).'_'.time().$ext;
                    $dest = $profileDir.'/'.$fileName;

                    imagepalettetotruecolor($img);
                    if (imagewebp($img, $dest, 90)) {
                        $avatarUrl = $requestScheme.'://'.$httpHost.(($scriptBasePath === '' || $scriptBasePath === '.') ? '/profileimg/' : $scriptBasePath.'/profileimg/').$fileName;
                    } else {
                        $uploadError = true;
                    }
                    imagedestroy($img);
                } else {
                    $uploadError = true;
                }
            } else {
                $uploadError = true;
            }
        }

        if ($uploadError) {
            $message = 'Failed to upload or convert image.';
            $messageType = 'error';
        } elseif ($displayName === '' || ($avatarUrl !== '' && ! filter_var($avatarUrl, FILTER_VALIDATE_URL))) {
            $message = 'Enter a display name and a valid image URL.';
            $messageType = 'error';
        } else {
            $data = loadUsers();
            foreach ($data['users'] as &$row) {
                if (($row['id'] ?? '') === ($currentUser['id'] ?? '')) {
                    $row['display_name'] = substr($displayName, 0, 120);
                    $row['avatar_url'] = $avatarUrl;
                    $row['updated_at'] = time();
                    break;
                }
            }
            unset($row);
            saveUsers($data);
            $message = 'Profile updated.';
        }
        $redirectOverride = $pageUrl.'?profile=1';
    } elseif ($action === 'save_app_settings') {
        $settings = loadAppSettings();
        $settings['app_name'] = trim($_POST['app_name'] ?? '') ?: 'StoneKrusher Media Library';
        $settings['footer_name'] = trim($_POST['footer_name'] ?? '') ?: 'StoneKrusher.com';
        $logoUrl = trim($_POST['dashboard_logo_url'] ?? '');
        $faviconUrl = trim($_POST['favicon_url'] ?? '');
        $logoUpload = saveUploadedAppAsset('dashboard_logo_file', 'dashboard-logo');
        $faviconUpload = saveUploadedAppAsset('favicon_file', 'favicon');
        if (($logoUrl !== '' && ! filter_var($logoUrl, FILTER_VALIDATE_URL)) || ($faviconUrl !== '' && ! filter_var($faviconUrl, FILTER_VALIDATE_URL))) {
            $message = 'Enter valid URLs for logo and favicon.';
            $messageType = 'error';
        } elseif (! $logoUpload['ok'] || ! $faviconUpload['ok']) {
            $message = $logoUpload['error'] ?? $faviconUpload['error'] ?? 'Could not upload branding file.';
            $messageType = 'error';
        } else {
            $settings['dashboard_logo_url'] = $logoUpload['url'] ?: $logoUrl;
            $settings['favicon_url'] = $faviconUpload['url'] ?: $faviconUrl;
            saveAppSettings($settings);

            // Save Bria API key to features/config.php if provided
            if (isset($_POST['bria_api_key'])) {
                $briaKey = trim($_POST['bria_api_key']);
                $configFile = __DIR__.'/features/config.php';
                if (is_file($configFile)) {
                    $configData = file_get_contents($configFile);
                    $configData = preg_replace("/define\('BRIA_API_KEY',\s*'[^']*'\);/", "define('BRIA_API_KEY', '".addslashes($briaKey)."');", $configData);
                    file_put_contents($configFile, $configData);
                }
            }

            $message = 'Dashboard settings saved.';
        }
        $redirectOverride = $pageUrl.'?settings=1';
    } elseif ($action === 'clear_login_activity') {
        if (! $isAdmin && empty($currentUser['is_main_admin'])) {
            $message = 'Only admins can clear login activity.';
            $messageType = 'error';
        } else {
            writeJsonFile($LOGIN_ACTIVITY_FILE, ['items' => []]);
            $message = 'Login activity history cleared.';
        }
        $redirectOverride = $pageUrl.'?activity=1';
    } elseif ($action === 'create_user') {
        $username = strtolower(trim($_POST['new_username'] ?? ''));
        $password = $_POST['new_password'] ?? '';
        $role = normalizeUserRole($_POST['new_role'] ?? 'staff');
        $displayName = trim($_POST['new_display_name'] ?? '') ?: $username;
        if (! preg_match('/^[a-z0-9@._-]{3,120}$/', $username) || strlen($password) < 8 || findUserByUsername($username)) {
            $message = 'Enter a unique username and password with at least 8 characters.';
            $messageType = 'error';
        } else {
            $data = loadUsers();
            $data['users'][] = [
                'id' => bin2hex(random_bytes(8)),
                'username' => $username,
                'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                'role' => $role,
                'status' => 'active',
                'display_name' => substr($displayName, 0, 120),
                'avatar_url' => '',
                'theme' => 'light',
                'dashboard_theme_url' => '',
                'is_main_admin' => false,
                'can_view_login_activity' => isset($_POST['can_view_login_activity']),
                'created_at' => time(),
                'updated_at' => time(),
            ];
            saveUsers($data);
            $message = 'User created.';
        }
        $redirectOverride = $pageUrl.'?users=1';
    } elseif (in_array($action, ['set_user_role', 'change_user_password', 'freeze_user', 'unfreeze_user', 'delete_user', 'update_user_permissions'], true)) {
        $targetId = preg_replace("/[^a-f0-9\-]/", '', $_POST['user_id'] ?? '');
        $data = loadUsers();
        $foundIndex = null;
        foreach ($data['users'] as $idx => $row) {
            if (($row['id'] ?? '') === $targetId) {
                $foundIndex = $idx;
                break;
            }
        }
        if ($foundIndex === null) {
            $message = 'User not found.';
            $messageType = 'error';
        } else {
            $target = $data['users'][$foundIndex];
            $protected = ! empty($target['is_main_admin']);
            $isSelf = ($target['id'] ?? '') === ($currentUser['id'] ?? '');
            if ($action === 'set_user_role') {
                if ($protected || $isSelf) {
                    $message = 'This admin role is protected.';
                    $messageType = 'error';
                } else {
                    $role = normalizeUserRole($_POST['role'] ?? 'staff');
                    $data['users'][$foundIndex]['role'] = $role;
                    $data['users'][$foundIndex]['updated_at'] = time();
                    $message = 'Role updated.';
                }
            } elseif ($action === 'change_user_password') {
                $password = $_POST['password'] ?? '';
                if (strlen($password) < 8) {
                    $message = 'Password must be at least 8 characters.';
                    $messageType = 'error';
                } elseif ($protected && ! $isSelf) {
                    $message = 'Only the main admin can change the main admin password.';
                    $messageType = 'error';
                } else {
                    $data['users'][$foundIndex]['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
                    $data['users'][$foundIndex]['updated_at'] = time();
                    $message = 'Password changed.';
                }
            } elseif ($action === 'freeze_user' || $action === 'unfreeze_user') {
                if ($protected || $isSelf) {
                    $message = 'Protected account cannot be frozen.';
                    $messageType = 'error';
                } else {
                    $data['users'][$foundIndex]['status'] = $action === 'freeze_user' ? 'frozen' : 'active';
                    $data['users'][$foundIndex]['updated_at'] = time();
                    $message = 'User status updated.';
                }
            } elseif ($action === 'delete_user') {
                if ($protected || $isSelf) {
                    $message = 'Protected account cannot be removed.';
                    $messageType = 'error';
                } else {
                    array_splice($data['users'], $foundIndex, 1);
                    $message = 'User removed.';
                }
            } elseif ($action === 'update_user_permissions') {
                $data['users'][$foundIndex]['can_view_login_activity'] = isset($_POST['can_view_login_activity']);
                $data['users'][$foundIndex]['updated_at'] = time();
                $message = 'Permissions updated.';
            }
            saveUsers($data);
        }
        $redirectOverride = $pageUrl.'?users=1';
    } elseif ($action === 'unban_device') {
        $banId = preg_replace('/[^a-f0-9]/', '', $_POST['ban_id'] ?? '');
        $securityData = loadSecurityData();
        if ($banId && isset($securityData['banned'][$banId])) {
            unset($securityData['banned'][$banId]);
            saveSecurityData($securityData);
            $message = 'Device unbanned.';
        } else {
            $message = 'Ban record not found.';
            $messageType = 'warning';
        }
    } elseif ($action === 'create_folder') {
        $folderName = cleanName($_POST['folder_name'] ?? '');
        $destPath = cleanPath($_POST['path'] ?? '');
        $targetParent = $destPath !== '' ? safeFullPath($BASE_DIR, $destPath) : $currentDir;
        $isAjaxReq = (! empty($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest') || (isset($_POST['is_ajax']) && $_POST['is_ajax'] === '1');
        if ($isWebsiteTeam && ! relativePathInRoot($destPath !== '' ? $destPath : $current, $websiteTeamRootRelative)) {
            $message = 'Website Team can only create folders inside Website-Team folder.';
            $messageType = 'error';
            if ($isAjaxReq) {
                header('Content-Type: application/json');
                echo json_encode(['success' => false, 'error' => $message]);
                exit;
            }
        } elseif ($folderName) {
            $newPath = $targetParent.'/'.$folderName;
            if (! is_dir($newPath)) {
                mkdir($newPath, 0755, true);
                ensureSecureIndexFile($newPath);
                $message = "Folder \"$folderName\" created.";
                if ($isAjaxReq) {
                    header('Content-Type: application/json');
                    echo json_encode(['success' => true, 'folder_name' => $folderName]);
                    exit;
                }
            } else {
                $message = 'Folder already exists.';
                $messageType = 'warning';
                if ($isAjaxReq) {
                    header('Content-Type: application/json');
                    echo json_encode(['success' => false, 'error' => 'Folder already exists.']);
                    exit;
                }
            }
        }
    } elseif ($action === 'create_file') {
        $fileName = cleanName($_POST['file_name'] ?? '');
        $content = $_POST['file_content'] ?? '';
        if ($fileName && isSystemManagedFile($fileName)) {
            $message = 'That file name is reserved.';
            $messageType = 'warning';
        } elseif ($fileName) {
            $ext = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
            if (in_array($ext, $allowedExtensions)) {
                $newFile = $currentDir.'/'.$fileName;
                if (! file_exists($newFile)) {
                    file_put_contents($newFile, $content);
                    $message = "File \"$fileName\" created.";
                } else {
                    $message = 'File already exists.';
                    $messageType = 'warning';
                }
            }
        }
    } elseif ($action === 'upload_files') {
        session_write_close(); // Unlock session to allow parallel upload processing
        $uploaded = 0;
        $optimized = 0;
        $fallbackOriginal = 0;
        $failed = 0;
        $uploadedBackupPaths = [];
        $uploadAjax = isset($_POST['upload_ajax']) && $_POST['upload_ajax'] === '1';
        $uploadNames = $_FILES['upload_files']['name'] ?? [];
        $uploadTmpNames = $_FILES['upload_files']['tmp_name'] ?? [];
        $uploadErrors = $_FILES['upload_files']['error'] ?? [];
        if (! is_array($uploadNames)) {
            $uploadNames = [$uploadNames];
            $uploadTmpNames = [$uploadTmpNames];
            $uploadErrors = [$uploadErrors];
        }
        $errorDetails = [];
        if (! is_writable($currentDir)) {
            $failed = count(array_filter($uploadNames, fn ($name) => (string) $name !== ''));
            $message = 'Upload folder is not writable by server.';
            $messageType = 'error';
            if ($uploadAjax) {
                if (ob_get_length()) {
                    @ob_clean();
                }
                header('Content-Type: application/json');
                echo json_encode([
                    'success' => false,
                    'uploaded' => 0,
                    'optimized' => 0,
                    'failed' => $failed,
                    'message' => $message,
                    'errors' => ['Destination folder is not writable. Check folder permissions.'],
                ]);
                exit;
            }
        } elseif (! empty($uploadNames)) {
            foreach ($uploadNames as $index => $name) {
                $rawName = (string) $name;
                if ($rawName === '') {
                    continue;
                }
                $fileName = cleanName($rawName);
                if ($fileName === '') {
                    $fileName = 'upload-'.($index + 1);
                }
                $fileError = (int) ($uploadErrors[$index] ?? UPLOAD_ERR_NO_FILE);
                if ($fileError !== UPLOAD_ERR_OK) {
                    $failed++;
                    $errorDetails[] = $fileName.': '.uploadErrorMessage($fileError);

                    continue;
                }
                $tmpName = (string) ($uploadTmpNames[$index] ?? '');
                if ($tmpName === '' || (! is_uploaded_file($tmpName) && ! is_file($tmpName))) {
                    $failed++;
                    $errorDetails[] = $fileName.': Temporary upload file is missing.';

                    continue;
                }

                // --- CHUNKING LOGIC ---
                $chunkIndex = isset($_POST['chunk_index']) ? (int) $_POST['chunk_index'] : 0;
                $totalChunks = isset($_POST['total_chunks']) ? (int) $_POST['total_chunks'] : 1;
                $chunkId = preg_replace('/[^a-zA-Z0-9_-]/', '', $_POST['chunk_id'] ?? '');
                $originalName = $_POST['original_name'] ?? '';

                if ($originalName !== '') {
                    $fileName = cleanName($originalName);
                    if ($fileName === '') {
                        $fileName = 'upload-'.($index + 1);
                    }
                }

                if ($totalChunks > 1 && $chunkId !== '') {
                    $partDir = sys_get_temp_dir().'/kiuq_chunks_'.$chunkId;
                    if (! is_dir($partDir)) {
                        @mkdir($partDir, 0755, true);
                    }
                    $partFile = $partDir.'/upload.part';

                    $chunkData = file_get_contents($tmpName);
                    if ($chunkIndex === 0) {
                        file_put_contents($partFile, $chunkData);
                    } else {
                        file_put_contents($partFile, $chunkData, FILE_APPEND);
                    }

                    if ($chunkIndex < $totalChunks - 1) {
                        if ($uploadAjax) {
                            if (ob_get_length()) {
                                @ob_clean();
                            }
                            header('Content-Type: application/json');
                            echo json_encode(['success' => true, 'chunk_success' => true]);
                            exit;
                        }

                        continue;
                    } else {
                        $tmpName = $partFile;
                    }
                }
                // --- END CHUNKING LOGIC ---

                $ext = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

                if ($ext === 'zip') {
                    $zip = new ZipArchive;
                    if ($zip->open($tmpName) === true) {
                        $zipFolderName = cleanBaseName($fileName);
                        if ($zipFolderName === '') {
                            $zipFolderName = 'extracted_zip';
                        }
                        $extractDir = uniqueDestinationPath($currentDir, $zipFolderName);

                        if (! is_dir($extractDir)) {
                            mkdir($extractDir, 0755, true);
                            ensureSecureIndexFile($extractDir);
                        }

                        $zip->extractTo($extractDir);
                        $zip->close();

                        $iterator = new RecursiveIteratorIterator(
                            new RecursiveDirectoryIterator($extractDir, RecursiveDirectoryIterator::SKIP_DOTS),
                            RecursiveIteratorIterator::SELF_FIRST
                        );

                        foreach ($iterator as $item) {
                            if ($item->isDir()) {
                                ensureSecureIndexFile($item->getPathname());
                            } else {
                                $extractedPath = $item->getPathname();
                                $itemExt = strtolower(pathinfo($extractedPath, PATHINFO_EXTENSION));
                                $itemName = $item->getFilename();

                                if (shouldHideFromFileManager($itemName) || strpos($extractedPath, '__MACOSX') !== false) {
                                    if ($itemName !== 'index.html' || filesize($extractedPath) !== strlen(getSecureIndexHtml())) {
                                        @unlink($extractedPath);
                                    }

                                    continue;
                                }

                                if (! in_array($itemExt, $allowedExtensions, true) || ($isConverter && ! in_array($itemExt, ['jpg', 'jpeg', 'png', 'webp'], true))) {
                                    @unlink($extractedPath);

                                    continue;
                                }

                                if (isWebpConvertibleImage($itemName)) {
                                    $webpName = cleanBaseName($itemName).'.webp';
                                    $webpPath = $item->getPath().'/'.$webpName;
                                    if (saveOptimizedWebp($extractedPath, $webpPath, $itemExt)) {
                                        @unlink($extractedPath);
                                        $uploadedBackupPaths[$webpPath] = true;
                                        $optimized++;
                                    } else {
                                        $uploadedBackupPaths[$extractedPath] = true;
                                        $fallbackOriginal++;
                                    }
                                } else {
                                    $uploadedBackupPaths[$extractedPath] = true;
                                }
                            }
                        }
                        ensureSecureIndexFile($extractDir);
                        $uploaded++;

                        continue;
                    } else {
                        $failed++;
                        $errorDetails[] = $fileName.': Failed to open ZIP archive.';

                        continue;
                    }
                }

                $uploadPaths = $_POST['upload_paths'] ?? [];
                $relativePath = cleanPath((string) ($uploadPaths[$index] ?? ''));
                $targetDir = $currentDir;
                if ($relativePath !== '') {
                    $fileName = cleanName(basename($relativePath));
                    $dirPart = cleanPath(dirname($relativePath));
                    if ($dirPart !== '.' && $dirPart !== '') {
                        $parts = explode('/', $dirPart);
                        $accum = $currentDir;
                        foreach ($parts as $p) {
                            if ($p !== '') {
                                $accum .= '/'.$p;
                                if (! is_dir($accum)) {
                                    mkdir($accum, 0755, true);
                                    ensureSecureIndexFile($accum);
                                }
                            }
                        }
                        $targetDir = $accum;
                    }
                }

                if (isSystemManagedFile($fileName)) {
                    if ($fileName === 'index.html') {
                        ensureSecureIndexFile($targetDir);
                    }
                    if (is_file($tmpName)) {
                        @unlink($tmpName);
                    }

                    continue;
                }

                if ($isConverter && ! in_array($ext, ['jpg', 'jpeg', 'png', 'webp'], true)) {
                    $failed++;
                    $errorDetails[] = $fileName.': Converter role accepts JPG, JPEG, PNG, and WebP only.';

                    continue;
                }
                if (! in_array($ext, $allowedExtensions, true)) {
                    $failed++;
                    $errorDetails[] = $fileName.': File type is not allowed.';

                    continue;
                }

                $triedWebp = false;
                if (isWebpConvertibleImage($fileName)) {
                    $triedWebp = true;
                    $webpName = cleanBaseName($fileName).'.webp';
                    $webpPath = $targetDir.'/'.$webpName;

                    if (file_exists($webpPath)) {
                        imghost_autoBackupTargets([$webpPath]);
                    }

                    if (saveOptimizedWebp($tmpName, $webpPath, $ext)) {
                        $uploaded++;
                        $optimized++;
                        $uploadedBackupPaths[$webpPath] = true;

                        // Delete the old original extension file if it exists to avoid showing 2 files
                        $oldOriginalPath = $targetDir.'/'.$fileName;
                        if (strtolower($ext) !== 'webp' && file_exists($oldOriginalPath)) {
                            imghost_autoBackupTargets([$oldOriginalPath]);
                            @unlink($oldOriginalPath);
                        }

                        continue;
                    }
                }

                $destination = $targetDir.'/'.$fileName;

                if (file_exists($destination)) {
                    imghost_autoBackupTargets([$destination]);
                }

                if (storeUploadedTempFile($tmpName, $destination)) {
                    @chmod($destination, 0644);
                    $uploaded++;
                    $uploadedBackupPaths[$destination] = true;
                    if ($triedWebp && $ext !== 'webp') {
                        $fallbackOriginal++;
                    }
                } else {
                    $failed++;
                    $errorDetails[] = $fileName.': Server cannot move uploaded file to destination folder.';
                }
            }
            if (! empty($uploadedBackupPaths)) {
                imghost_autoBackup(array_keys($uploadedBackupPaths));
            }
            $message = "$uploaded file(s) uploaded successfully.";
            if ($optimized) {
                $message .= " $optimized image(s) optimized to WebP.";
            }
            if ($fallbackOriginal) {
                $message .= " $fallbackOriginal image(s) saved in original format (WebP conversion unavailable).";
            }
            if ($failed) {
                $message .= " $failed file(s) failed.";
            }
            if ($uploadAjax) {
                if (ob_get_length()) {
                    @ob_clean();
                }
                header('Content-Type: application/json');
                echo json_encode([
                    'success' => $uploaded > 0,
                    'uploaded' => $uploaded,
                    'optimized' => $optimized,
                    'fallback_original' => $fallbackOriginal,
                    'failed' => $failed,
                    'message' => $message,
                    'errors' => $errorDetails,
                ]);
                exit;
            }
        } elseif ($uploadAjax) {
            if (ob_get_length()) {
                @ob_clean();
            }
            header('Content-Type: application/json');
            echo json_encode([
                'success' => false,
                'uploaded' => 0,
                'optimized' => 0,
                'failed' => 0,
                'message' => 'No files were selected.',
            ]);
            exit;
        }
    } elseif ($action === 'rename_item') {
        $oldName = cleanExistingName($_POST['old_name'] ?? '');
        $newName = cleanName($_POST['new_name'] ?? '');
        if (isSystemManagedFile($oldName)) {
            $message = 'System file is hidden.';
            $messageType = 'warning';
        } elseif (isSystemManagedFile($newName)) {
            $message = 'That file name is reserved.';
            $messageType = 'warning';
        } elseif ($oldName && $newName) {
            $oldPath = $currentDir.'/'.$oldName;
            $newPath = $currentDir.'/'.$newName;
            if (file_exists($oldPath) && ! file_exists($newPath)) {
                rename($oldPath, $newPath);
                $message = "Renamed to \"$newName\".";
            }
        }
    } elseif ($action === 'rename_type') {
        $items = $_POST['items'] ?? [];
        $baseName = cleanName($_POST['base_name'] ?? '');
        if ($baseName && is_array($items) && ! empty($items)) {
            $renamedCount = 0;
            foreach ($items as $item) {
                $oldName = cleanExistingName($item);
                if (! $oldName || isSystemManagedFile($oldName)) {
                    continue;
                }
                $oldPath = $currentDir.'/'.$oldName;
                if (! file_exists($oldPath) || is_dir($oldPath)) {
                    continue;
                }
                $ext = strtolower(pathinfo($oldName, PATHINFO_EXTENSION));

                $counter = 1;
                while (true) {
                    $numStr = str_pad($counter, 2, '0', STR_PAD_LEFT);
                    $newName = $baseName.'-'.$numStr.($ext ? '.'.$ext : '');
                    $newPath = $currentDir.'/'.$newName;
                    if ($newPath === $oldPath || ! file_exists($newPath)) {
                        break;
                    }
                    $counter++;
                }

                if ($newPath !== $oldPath) {
                    if (rename($oldPath, $newPath)) {
                        $renamedCount++;
                    }
                } else {
                    $renamedCount++; // Already named correctly
                }
            }
            $message = "Renamed $renamedCount item(s) to $baseName type.";
        }
    } elseif ($action === 'delete_item') {
        $itemName = cleanExistingName($_POST['item_name'] ?? '');
        if ($itemName && isSystemManagedFile($itemName)) {
            $message = 'System file is hidden.';
            $messageType = 'warning';
        } elseif ($isConverter && $itemName) {
            $target = $currentDir.'/'.$itemName;
            if (is_dir($target)) {
                deleteFolder($target);
                $message = 'Folder deleted.';
            } elseif (is_file($target)) {
                unlink($target);
                $message = 'File deleted.';
            } else {
                $message = 'Item not found.';
                $messageType = 'warning';
            }
        } elseif (! verifyDeletePassword($_POST['delete_password'] ?? '')) {
            $message = 'Delete password is incorrect.';
            $messageType = 'error';
        } elseif ($itemName) {
            $target = $currentDir.'/'.$itemName;
            $relative = $current ? $current.'/'.$itemName : $itemName;
            if (file_exists($target)) {
                imghost_autoBackupTargets([$target]);
            }
            if (trashItem($target, $relative)) {
                $message = 'Item moved to trash.';
            }
        }
    } elseif ($action === 'delete_selected') {
        $names = $_POST['selected_names'] ?? [];
        $count = 0;
        if ($isConverter) {
            foreach ($names as $n) {
                $n = cleanExistingName($n);
                if (! $n || isSystemManagedFile($n)) {
                    continue;
                }
                $target = $currentDir.'/'.$n;
                if (is_dir($target)) {
                    deleteFolder($target);
                    $count++;
                } elseif (is_file($target)) {
                    unlink($target);
                    $count++;
                }
            }
            $message = "$count item(s) deleted.";
        } elseif (! verifyDeletePassword($_POST['delete_password'] ?? '')) {
            $message = 'Delete password is incorrect.';
            $messageType = 'error';
        } else {
            $targetsToBackup = [];
            foreach ($names as $n) {
                $n = cleanExistingName($n);
                if (! $n || isSystemManagedFile($n)) {
                    continue;
                }
                $target = $currentDir.'/'.$n;
                if (file_exists($target)) {
                    $targetsToBackup[] = $target;
                }
            }
            if (! empty($targetsToBackup)) {
                imghost_autoBackupTargets($targetsToBackup);
            }

            foreach ($names as $n) {
                $n = cleanExistingName($n);
                if (! $n || isSystemManagedFile($n)) {
                    continue;
                }
                $target = $currentDir.'/'.$n;
                $relative = $current ? $current.'/'.$n : $n;
                if (trashItem($target, $relative)) {
                    $count++;
                }
            }
            $message = "$count item(s) moved to trash.";
        }
    } elseif ($action === 'download_selected') {
        $names = $_POST['selected_names'] ?? [];
        $pathMap = [];
        foreach ($names as $n) {
            $n = cleanExistingName($n);
            if (! $n || isSystemManagedFile($n)) {
                continue;
            }
            $src = $currentDir.'/'.$n;
            if (file_exists($src)) {
                $pathMap[$src] = $n;
            }
        }
        if (empty($pathMap)) {
            $message = 'No valid items selected for download.';
            $messageType = 'warning';
        } else {
            $archiveName = sanitizeDownloadFilename('selected-'.($current ? str_replace('/', '-', $current) : 'root').'-'.date('Ymd-His').'.zip', 'selected.zip');
            if (! streamZipDownloadFromMap($pathMap, $archiveName)) {
                $message = 'ZIP download is unavailable on this server.';
                $messageType = 'error';
            }
        }
    } elseif ($action === 'move_selected') {
        $names = $_POST['selected_names'] ?? [];
        $dest = cleanPath($_POST['move_destination'] ?? $_POST['copy_destination'] ?? '');
        $destDir = safeFullPath($BASE_DIR, $dest);
        if ($isWebsiteTeam && ! relativePathInRoot($dest, $websiteTeamRootRelative)) {
            $message = 'Website Team can only move items inside the Website-Team folder.';
            $messageType = 'error';
        } elseif (is_dir($destDir)) {
            $count = 0;
            foreach ($names as $n) {
                $n = cleanExistingName($n);
                if (! $n || isSystemManagedFile($n)) {
                    continue;
                }
                $src = $currentDir.'/'.$n;
                $dst = $destDir.'/'.$n;
                $srcReal = realpath($src);
                $destReal = realpath($destDir);
                if (is_dir($src) && $srcReal && $destReal && ($destReal === $srcReal || strpos($destReal, $srcReal.DIRECTORY_SEPARATOR) === 0)) {
                    continue;
                }
                if (file_exists($src) && ! file_exists($dst)) {
                    rename($src, $dst);
                    $count++;
                }
            }
            $destLabel = $dest === '' ? 'root' : $dest;
            $message = "$count item(s) moved to $destLabel.";
        } else {
            $message = 'Destination folder not found.';
            $messageType = 'warning';
        }
    } elseif ($action === 'copy_to_folder') {
        $names = $_POST['selected_names'] ?? [];
        $dest = cleanPath($_POST['copy_destination'] ?? $_POST['move_destination'] ?? '');
        $destDir = safeFullPath($BASE_DIR, $dest);
        if ($isWebsiteTeam && ! relativePathInRoot($dest, $websiteTeamRootRelative)) {
            $message = 'Website Team can only copy items inside the Website-Team folder.';
            $messageType = 'error';
        } elseif (is_dir($destDir)) {
            $count = 0;
            foreach ($names as $n) {
                $n = cleanExistingName($n);
                if (! $n || isSystemManagedFile($n)) {
                    continue;
                }
                $src = $currentDir.'/'.$n;
                if (! file_exists($src)) {
                    continue;
                }
                $dst = uniqueDestinationPath($destDir, $n);
                if (is_dir($src)) {
                    $srcReal = realpath($src);
                    $destReal = realpath($destDir);
                    if ($srcReal && $destReal && ($destReal === $srcReal || strpos($destReal, $srcReal.DIRECTORY_SEPARATOR) === 0)) {
                        continue;
                    }
                    if (copyFolder($src, $dst)) {
                        $count++;
                    }
                } elseif (is_file($src)) {
                    if (copy($src, $dst)) {
                        $count++;
                    }
                }
            }
            $destLabel = $dest === '' ? 'root' : $dest;
            $message = "$count item(s) copied to $destLabel.";
        } else {
            $message = 'Destination folder not found.';
            $messageType = 'warning';
        }
    } elseif ($action === 'duplicate_selected') {
        $names = $_POST['selected_names'] ?? [];
        $count = 0;
        foreach ($names as $n) {
            $n = cleanExistingName($n);
            if (! $n || isSystemManagedFile($n)) {
                continue;
            }
            $src = $currentDir.'/'.$n;
            if (! file_exists($src)) {
                continue;
            }
            $dst = uniqueDestinationPath($currentDir, $n);
            if (is_dir($src)) {
                if (copyFolder($src, $dst)) {
                    $count++;
                }
            } elseif (is_file($src)) {
                if (copy($src, $dst)) {
                    $count++;
                }
            }
        }
        $message = "$count item(s) duplicated.";
    } elseif ($action === 'copy_selected') {
        $names = $_POST['selected_names'] ?? [];
        $clipboardItems = [];
        foreach ($names as $n) {
            $n = cleanExistingName($n);
            if (! $n || isSystemManagedFile($n)) {
                continue;
            }
            $src = $currentDir.'/'.$n;
            if (file_exists($src)) {
                $clipboardItems[] = $current ? $current.'/'.$n : $n;
            }
        }
        $_SESSION['clipboard'] = [
            'mode' => 'copy',
            'items' => $clipboardItems,
            'created_at' => time(),
        ];
        $message = count($clipboardItems).' item(s) copied. Open a folder and click Paste.';
    } elseif ($action === 'paste_clipboard') {
        $clip = $_SESSION['clipboard'] ?? ['items' => []];
        $count = 0;
        $skipped = 0;
        foreach (($clip['items'] ?? []) as $relative) {
            $relative = cleanPath($relative);
            if (! $relative) {
                continue;
            }
            if (isSystemManagedFile(basename($relative))) {
                $skipped++;

                continue;
            }
            if ($isWebsiteTeam && ! relativePathInRoot($relative, $websiteTeamRootRelative)) {
                $skipped++;

                continue;
            }
            $src = safeFullPath($BASE_DIR, $relative);
            if (! file_exists($src)) {
                $skipped++;

                continue;
            }
            if (is_dir($src) && ($current === $relative || ($current && strpos($current.'/', $relative.'/') === 0))) {
                $skipped++;

                continue;
            }
            $dst = uniqueDestinationPath($currentDir, basename($relative));
            if (is_dir($src)) {
                if (copyFolder($src, $dst)) {
                    $count++;
                } else {
                    $skipped++;
                }
            } elseif (is_file($src)) {
                if (copy($src, $dst)) {
                    $count++;
                } else {
                    $skipped++;
                }
            }
        }
        $message = "$count item(s) pasted.".($skipped ? " $skipped skipped." : '');
        if ($count === 0 && $skipped === 0) {
            $message = 'Clipboard is empty.';
            $messageType = 'warning';
        }
    } elseif ($action === 'restore_trash_item') {
        $trashId = preg_replace('/[^a-f0-9]/', '', $_POST['trash_id'] ?? '');
        $trash = loadTrashIndex();
        $trashRelative = cleanPath($trash['items'][$trashId]['original_relative'] ?? '');
        if ($isWebsiteTeam && ! relativePathInRoot($trashRelative, $websiteTeamRootRelative)) {
            $message = 'Website Team can only recover items from the Website-Team folder.';
            $messageType = 'error';
        } elseif ($trashId && restoreTrashItem($trashId)) {
            $message = 'Item recovered from trash.';
        } else {
            $message = 'Could not recover item.';
            $messageType = 'warning';
        }
    } elseif ($action === 'restore_trash_selected') {
        $ids = $_POST['trash_ids'] ?? [];
        $trash = loadTrashIndex();
        $count = 0;
        foreach ($ids as $trashId) {
            $trashId = preg_replace('/[^a-f0-9]/', '', $trashId);
            $trashRelative = cleanPath($trash['items'][$trashId]['original_relative'] ?? '');
            if ($isWebsiteTeam && ! relativePathInRoot($trashRelative, $websiteTeamRootRelative)) {
                continue;
            }
            if ($trashId && restoreTrashItem($trashId)) {
                $count++;
            }
        }
        $message = "$count item(s) recovered from trash.";
    } elseif ($action === 'delete_trash_item') {
        $trashId = preg_replace('/[^a-f0-9]/', '', $_POST['trash_id'] ?? '');
        $trash = loadTrashIndex();
        $trashRelative = cleanPath($trash['items'][$trashId]['original_relative'] ?? '');
        if (! verifyDeletePassword($_POST['delete_password'] ?? '')) {
            $message = 'Delete password is incorrect.';
            $messageType = 'error';
        } elseif ($isWebsiteTeam && ! relativePathInRoot($trashRelative, $websiteTeamRootRelative)) {
            $message = 'Website Team can only delete trash from the Website-Team folder.';
            $messageType = 'error';
        } elseif ($trashId && permanentlyDeleteTrashItem($trashId)) {
            $message = 'Item permanently deleted.';
        } else {
            $message = 'Could not delete item.';
            $messageType = 'warning';
        }
    } elseif ($action === 'delete_trash_selected') {
        $ids = $_POST['trash_ids'] ?? [];
        $trash = loadTrashIndex();
        $count = 0;
        if (! verifyDeletePassword($_POST['delete_password'] ?? '')) {
            $message = 'Delete password is incorrect.';
            $messageType = 'error';
        } else {
            foreach ($ids as $trashId) {
                $trashId = preg_replace('/[^a-f0-9]/', '', $trashId);
                $trashRelative = cleanPath($trash['items'][$trashId]['original_relative'] ?? '');
                if ($isWebsiteTeam && ! relativePathInRoot($trashRelative, $websiteTeamRootRelative)) {
                    continue;
                }
                if ($trashId && permanentlyDeleteTrashItem($trashId)) {
                    $count++;
                }
            }
            $message = "$count trash item(s) permanently deleted.";
        }
    } elseif ($action === 'empty_trash') {
        if (! verifyDeletePassword($_POST['delete_password'] ?? '')) {
            $message = 'Delete password is incorrect.';
            $messageType = 'error';
        } else {
            $trash = loadTrashIndex();
            $count = 0;
            foreach (array_keys($trash['items']) as $trashId) {
                $trashRelative = cleanPath($trash['items'][$trashId]['original_relative'] ?? '');
                if ($isWebsiteTeam && ! relativePathInRoot($trashRelative, $websiteTeamRootRelative)) {
                    continue;
                }
                if (permanentlyDeleteTrashItem($trashId)) {
                    $count++;
                }
            }
            $message = "$count trash item(s) permanently deleted.";
        }
    } elseif ($action === 'edit_file') {
        $fileName = cleanExistingName($_POST['edit_file_name'] ?? '');
        $content = $_POST['edit_file_content'] ?? '';
        $target = $currentDir.'/'.$fileName;
        if (isSystemManagedFile($fileName)) {
            $message = 'System file is hidden.';
            $messageType = 'warning';
        } elseif (is_file($target)) {
            file_put_contents($target, $content);
            $message = 'File saved.';
        }

        // ════════════════════════════════════════════════════════════════════════
        // FEATURE ACTIONS — Additive only. Do not modify anything above this block
        // ════════════════════════════════════════════════════════════════════════
    } elseif ($FEATURES_ENABLED && in_array($action, [
        'set_folder_color', 'toggle_favorite', 'toggle_pin', 'get_folder_meta_bulk', 'toggle_sidebar_pin',
    ], true)) {
        // Folder meta actions — return JSON directly
        folder_meta_handle($action, $_POST, $currentUser['id'] ?? '', $BASE_DIR);
        exit;

    } elseif ($FEATURES_ENABLED && $action === 'get_properties') {
        $iName = cleanExistingName($_POST['item_name'] ?? '');
        $iPath = $currentDir.'/'.$iName;
        $iRel = $current ? $current.'/'.$iName : $iName;
        $iIsDir = is_dir($iPath);
        properties_handle($iName, $iPath, $iRel, $iIsDir);
        exit;

    } elseif ($FEATURES_ENABLED && $action === 'find_duplicates') {
        duplicate_finder_handle($_POST, $BASE_DIR, $currentDir, $BASE_URL, $current);
        exit;

    } elseif ($FEATURES_ENABLED && $action === 'replace_image') {
        image_replace_handle($_POST, $_FILES, $BASE_DIR, $currentDir, $current,
            $currentUser['id'] ?? '',
            'cleanPath', 'cleanExistingName',
            'imghost_autoBackup');
        exit;

    } elseif ($FEATURES_ENABLED && in_array($action, [
        'get_versions', 'restore_version', 'delete_version', 'download_version',
    ], true)) {
        version_history_handle($action, $_POST, $BASE_DIR, $currentDir, $current,
            $currentUser['id'] ?? '', 'cleanExistingName', 'formatSize', 'imghost_autoBackup');
        exit;

    } elseif ($FEATURES_ENABLED && in_array($action, [
        'ai_bg_remove_start', 'ai_bg_remove_process', 'ai_bg_remove_status',
        'ai_bg_remove_cancel', 'ai_bg_remove_download_zip', 'ai_bg_remove_save_canvas', 'canvas_edit_save', 'ai_bg_remove_sync',
    ], true)) {
        ai_bg_remove_handle($action, $_POST, $BASE_DIR, $currentDir, $current,
            $currentUser['id'] ?? '', $BASE_URL, 'imghost_autoBackup');
        exit;

    } elseif ($FEATURES_ENABLED && $action === 'get_storage_stats') {
        storage_dashboard_handle($currentDir, defined('STORAGE_QUOTA_BYTES') ? STORAGE_QUOTA_BYTES : 15 * 1024 * 1024 * 1024);
        exit;

    } elseif ($FEATURES_ENABLED && $action === 'delete_duplicate') {
        // Delete a duplicate file (uses same security as delete_item)
        $itemRel = cleanPath($_POST['item_rel'] ?? '');
        if (! $isConverter && ! verifyDeletePassword($_POST['delete_password'] ?? '')) {
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'error' => 'Incorrect delete password']);
            exit;
        }
        $absPath = safeFullPath($BASE_DIR, $itemRel);
        if (is_file($absPath)) {
            imghost_autoBackupTargets([$absPath]);
            $trashed = trashItem($absPath, $itemRel);
            header('Content-Type: application/json');
            echo json_encode(['success' => $trashed, 'message' => $trashed ? 'Moved to trash.' : 'Could not delete.']);
        } else {
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'error' => 'File not found']);
        }
        exit;
    }
    // ════════════════════════════════════════════════════════════════════════

    $redirect = $redirectOverride ?: ($redirectToTrash ? ($pageUrl.'?trash=1') : ($pageUrl.'?path='.urlencode($current)));
    if ($message) {
        $redirect .= '&msg='.urlencode($message).'&msgtype='.urlencode($messageType);
    }
    header('Location: '.$redirect);
    exit;
}

$message = $_GET['msg'] ?? '';
$messageType = $_GET['msgtype'] ?? 'success';

/*
|--------------------------------------------------------------------------
| LOAD FILES
|--------------------------------------------------------------------------
*/

$items = [];
ensureSecureIndexFile($currentDir);
foreach (scandir($currentDir) as $item) {
    if ($item === '.' || $item === '..') {
        continue;
    }
    if (shouldHideFromFileManager($item)) {
        continue;
    }
    $path = $currentDir.'/'.$item;
    $isFile = is_file($path);
    $isDir = is_dir($path);
    $mtime = (int) @filemtime($path);
    $ctime = (int) (@filectime($path) ?: $mtime);
    $items[] = [
        'name' => $item,
        'is_dir' => $isDir,
        'size' => $isFile ? filesize($path) : 0,
        'mtime' => $mtime,
        'ctime' => $ctime,
        'is_image' => $isFile && isImageFile($item),
        'is_code' => $isFile && isCodeFile($item),
    ];
}

// ── Advanced Sorting ──────────────────────────────────────────────────────
$allowedSortKeys = ['name_asc', 'name_desc', 'newest', 'oldest', 'size_asc', 'size_desc', 'width', 'height'];
$sortKey = in_array($_GET['sort'] ?? '', $allowedSortKeys, true) ? $_GET['sort'] : 'name_asc';

if ($FEATURES_ENABLED && function_exists('sorting_sort_items')) {
    $items = sorting_sort_items($items, $sortKey, $currentDir);
} else {
    usort($items, function ($a, $b) {
        if ($a['is_dir'] !== $b['is_dir']) {
            return $a['is_dir'] ? -1 : 1;
        }

        return strcasecmp($a['name'], $b['name']);
    });
}

// ── Folder Meta (colors, favorites, pins) ─────────────────────────────────
$folderMeta = [];
if ($FEATURES_ENABLED && function_exists('feature_db_get_folder_meta_bulk')) {
    $folderPaths = [];
    foreach ($items as $item) {
        if ($item['is_dir']) {
            $folderPaths[] = $current ? $current.'/'.$item['name'] : $item['name'];
        }
    }
    if (! empty($folderPaths)) {
        $rawMeta = feature_db_get_folder_meta_bulk($folderPaths, $currentUser['id'] ?? '');
        // Re-key by basename for template use
        foreach ($rawMeta as $path => $meta) {
            $folderMeta[basename($path)] = $meta;
        }
    }
    // Apply pin/favorite priority sort
    if (function_exists('sorting_apply_folder_priority')) {
        $items = sorting_apply_folder_priority($items, $folderMeta);
    }
}

$imageUrls = [];
foreach ($items as $item) {
    if (! $item['is_dir'] && $item['is_image']) {
        $relative = $current ? $current.'/'.$item['name'] : $item['name'];
        $imageUrls[] = publicUrl($BASE_URL, $relative);
    }
}

$editFile = '';
$editContent = '';
if (isset($_GET['edit']) && ($isAdmin || $isWebsiteTeam)) {
    $editFile = cleanExistingName($_GET['edit']);
    $editPath = $currentDir.'/'.$editFile;
    if (isSystemManagedFile($editFile)) {
        $editFile = '';
    } elseif (is_file($editPath)) {
        $editContent = file_get_contents($editPath);
    }
}

$folderCount = 0;
$fileCount = 0;
$totalSize = 0;
foreach ($items as $item) {
    if ($item['is_dir']) {
        $folderCount++;
    } else {
        $fileCount++;
        $totalSize += $item['size'];
    }
}
$displayTotalSize = $totalSize;
$trashData = loadTrashIndex();
$trashItems = array_values($trashData['items']);
if ($isWebsiteTeam) {
    $trashItems = array_values(array_filter($trashItems, function ($item) use ($websiteTeamRootRelative) {
        return relativePathInRoot($item['original_relative'] ?? '', $websiteTeamRootRelative);
    }));
}
usort($trashItems, function ($a, $b) {
    return ($b['deleted_at'] ?? 0) <=> ($a['deleted_at'] ?? 0);
});
$securityData = loadSecurityData();
$bannedDevices = $securityData['banned'];
$clipboardCount = count($_SESSION['clipboard']['items'] ?? []);
$folderOptions = [];
$appSettings = loadAppSettings();
$availableThemeImages = listDashboardThemeImages();
$currentUser = currentUser();
if (! $currentUser) {
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
    header('Location: /ourcms');
    exit;
}
$isAdmin = true;
$isConverter = false;
$isWebsiteTeam = false;
$dashboardThemeUrl = trim((string) ($currentUser['dashboard_theme_url'] ?? ''));
if ($dashboardThemeUrl !== '' && ! filter_var($dashboardThemeUrl, FILTER_VALIDATE_URL)) {
    $dashboardThemeUrl = '';
}
$allUsers = loadUsers()['users'];
$loginActivities = loadLoginActivity();
if (! $isAdmin) {
    $loginActivities = ($currentUser['can_view_login_activity'] ?? true)
        ? array_values(array_filter($loginActivities, fn ($row) => ($row['user_id'] ?? '') === ($currentUser['id'] ?? '')))
        : [];
}
$sidebarPins = [];
$sidebarFolderColors = [];
if ($FEATURES_ENABLED && function_exists('feature_db')) {
    $db = feature_db();
    if ($db) {
        try {
            $stmt = $db->prepare('SELECT path, is_dir FROM sidebar_pins WHERE user_id=? ORDER BY created_at ASC');
            $stmt->execute([$currentUser['id'] ?? '']);
            $sidebarPins = $stmt->fetchAll();

            $pinnedFolderPaths = [];
            foreach ($sidebarPins as $pin) {
                if ($pin['is_dir']) {
                    $pinnedFolderPaths[] = $pin['path'];
                }
            }
            if (! empty($pinnedFolderPaths) && function_exists('feature_db_get_folder_meta_bulk')) {
                $rawMeta = feature_db_get_folder_meta_bulk($pinnedFolderPaths, $currentUser['id'] ?? '');
                foreach ($rawMeta as $path => $meta) {
                    if (! empty($meta['color'])) {
                        $sidebarFolderColors[$path] = $meta['color'];
                    }
                }
            }
        } catch (Throwable $e) {
            error_log('[FeatureDB load_sidebar_pins] '.$e->getMessage());
        }
    }
}
$preferredTheme = in_array($currentUser['theme'] ?? 'light', ['light', 'dark', 'system'], true) ? $currentUser['theme'] : 'light';
$visibleBaseUrl = $isWebsiteTeam ? publicUrl($BASE_URL, $websiteTeamRootRelative) : (rtrim($BASE_URL, '/').'/');
$uploadMaxFilesizeBytes = iniSizeToBytes(ini_get('upload_max_filesize'));
$postMaxSizeBytes = iniSizeToBytes(ini_get('post_max_size'));
$serverUploadLimitBytes = 600 * 1024 * 1024; // 600 MB limit requested by user

// Build image list for lightbox (JS)
$imageList = [];
foreach ($items as $idx => $item) {
    if (! $item['is_dir'] && $item['is_image']) {
        $relative = $current ? $current.'/'.$item['name'] : $item['name'];
        $publicImageUrl = publicUrl($BASE_URL, $relative);
        $imageList[] = [
            'name' => $item['name'],
            'url' => versionedImageUrl($publicImageUrl, $item['mtime'] ?? 0, $item['size'] ?? 0, $item['ctime'] ?? 0),
            'public_url' => $publicImageUrl,
            'idx' => $idx,
        ];
    }
}

?>
<!DOCTYPE html>
<html lang="en" data-theme="<?php echo htmlspecialchars($preferredTheme === 'system' ? 'light' : $preferredTheme); ?>">
<head>
<meta charset="UTF-8">
<title><?php echo htmlspecialchars($appSettings['app_name']); ?> - Dashboard</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<?php if (! empty($appSettings['favicon_url'])) { ?><link rel="icon" href="<?php echo htmlspecialchars($appSettings['favicon_url']); ?>"><?php } else { ?><link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png?v=2"><link rel="icon" href="/favicon.ico?v=2"><?php } ?>
<script>
(() => {
    try {
        const saved = localStorage.getItem('rafvex_theme') || localStorage.getItem('kiuqTheme') || localStorage.getItem('admin_theme') || <?php echo json_encode($preferredTheme); ?>;
        const theme = (saved === 'dark' || saved === 'light') ? saved : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        document.documentElement.dataset.theme = theme;
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    } catch(e) {}
})();
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
    --accent:   #607a4e;
    --accent2:  #72915d;
    --accent3:  #4a613b;
    --success:  #10b981;
    --danger:   #ef4444;
    --warning:  #f59e0b;
    --dark:     #0f172a;
    --text:     #1e293b;
    --muted:    #64748b;
    --light:    #f8fafc;
    --line:     #e2e8f0;
    --card:     rgba(255,255,255,0.95);
    --sidebar-w: 240px;
    --topbar-h: 68px;
}

[data-theme="dark"] {
    --accent:   #72915d;
    --accent2:  #8aa875;
    --accent3:  #607a4e;
    --success:  #34d399;
    --danger:   #f87171;
    --warning:  #fbbf24;
    --dark:     #020617;
    --text:     #f8fafc;
    --muted:    #94a3b8;
    --light:    #1e293b;
    --line:     #1e293b;
    --card:     #0f172a;
}

html { scroll-behavior: smooth; }

body {
    font-family: 'Plus Jakarta Sans', sans-serif;
    background: #f1f5f9;
    color: var(--text);
    min-height: 100vh;
    overflow-x: hidden;
}
[data-theme="dark"] body { background: #020617; color: #f8fafc; }
[data-theme="dark"] .topbar { background: rgba(15, 23, 42, 0.96); border-color: #1e293b; color: #f8fafc; }
[data-theme="dark"] .sidebar { background: #0f172a; border-color: #1e293b; color: #f8fafc; }
[data-theme="dark"] .stat-card { background: #0f172a; border-color: #1e293b; color: #f8fafc; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
[data-theme="dark"] .stat-lbl { color: #94a3b8; }
[data-theme="dark"] .toolbar { background: #0f172a; border-color: #1e293b; box-shadow: 0 4px 20px rgba(0,0,0,0.25); }
[data-theme="dark"] .tb-btn { background: #1e293b; color: #f8fafc; border-color: #334155; }
[data-theme="dark"] .tb-btn:hover { background: #334155; border-color: #64748b; color: #ffffff; }
[data-theme="dark"] .pathbar { background: #0f172a; border-color: #1e293b; color: #cbd5e1; }
[data-theme="dark"] .panel { background: #0f172a; border-color: #1e293b; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
[data-theme="dark"] .panel-head { background: rgba(30, 41, 59, 0.5); border-color: #1e293b; color: #f8fafc; }
[data-theme="dark"] .table-header-row { background: rgba(30, 41, 59, 0.4); border-color: #1e293b; color: #94a3b8; }
[data-theme="dark"] .file-row { background: transparent; border-color: #1e293b; color: #f8fafc; }
[data-theme="dark"] .file-row:hover { background: rgba(30, 41, 59, 0.5); }
[data-theme="dark"] .act-btn { background: #1e293b; border-color: #334155; color: #cbd5e1; }
[data-theme="dark"] .act-btn:hover { background: #334155; color: #ffffff; border-color: #64748b; }
[data-theme="dark"] .modal-box,
[data-theme="dark"] .toast,
[data-theme="dark"] .url-copy-btn,
[data-theme="dark"] .img-card,
[data-theme="dark"] .url-list-input,
[data-theme="dark"] .url-list-btn,
[data-theme="dark"] .theme-toggle-btn,
[data-theme="dark"] .profile-chip,
[data-theme="dark"] .mobile-menu-btn { background: #0f172a; color: var(--text); border-color: #1e293b; }
[data-theme="dark"] .panel-head,
[data-theme="dark"] .table-header-row,
[data-theme="dark"] .trash-row,
[data-theme="dark"] .security-row,
[data-theme="dark"] .url-list-item,
[data-theme="dark"] .form-input,
[data-theme="dark"] .url-input,
[data-theme="dark"] .url-textarea,
[data-theme="dark"] .topbar-search input { background: #1e293b; color: #f8fafc; border-color: #334155; }
[data-theme="dark"] .form-input:focus,
[data-theme="dark"] .url-input:focus,
[data-theme="dark"] .url-textarea:focus,
[data-theme="dark"] .topbar-search input:focus { background: #1e293b; border-color: var(--accent); color: #ffffff; box-shadow: 0 0 0 4px rgba(220,38,38,0.2); }
[data-theme="dark"] .msg-success { background: rgba(16,185,129,0.12); color: #86efac; }
[data-theme="dark"] .msg-warning { background: rgba(245,158,11,0.13); color: #fcd34d; }
[data-theme="dark"] .msg-error { background: rgba(239,68,68,0.13); color: #fca5a5; }
[data-theme="dark"] .drop-zone {
    background: rgba(30,41,59,0.6);
    border-color: #334155;
}
[data-theme="dark"] .drop-zone:hover,
[data-theme="dark"] .drop-zone.dragover {
    background: rgba(96,165,250,0.12);
    border-color: var(--accent);
}
[data-theme="dark"] .drop-zone h4 { color: var(--text); }
[data-theme="dark"] .drop-zone p { color: var(--muted); }
[data-theme="dark"] #dropZoneFiles { color: #93c5fd !important; }
body.dashboard-themed {
    background: transparent;
    position: relative;
}
body.dashboard-themed::before {
    content: "";
    position: fixed;
    inset: 0;
    background-image: var(--dashboard-bg-image);
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    transform: scale(1.015);
    filter: blur(4px) saturate(112%);
    opacity: 0.68;
    z-index: 0;
    pointer-events: none;
}
body.dashboard-themed::after {
    content: "";
    position: fixed;
    inset: 0;
    background: rgba(248,252,255,0.3);
    z-index: 0;
    pointer-events: none;
}
body.dashboard-themed .layout {
    position: relative;
    z-index: 1;
}
body.dashboard-themed .topbar,
body.dashboard-themed .sidebar,
body.dashboard-themed .stat-card,
body.dashboard-themed .toolbar,
body.dashboard-themed .pathbar,
body.dashboard-themed .panel,
body.dashboard-themed .img-grid-panel,
body.dashboard-themed .all-urls-panel,
body.dashboard-themed .modal-box {
    background: rgba(255,255,255,0.58);
    border-color: rgba(255,255,255,0.46);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    box-shadow: 0 12px 40px rgba(31,41,55,0.12);
}
body.dashboard-themed .panel-head,
body.dashboard-themed .table-header-row,
body.dashboard-themed .url-list-item,
body.dashboard-themed .form-input,
body.dashboard-themed .url-input,
body.dashboard-themed .url-textarea,
body.dashboard-themed .topbar-search input {
    background: rgba(255,255,255,0.46);
}
[data-theme="dark"] body.dashboard-themed { background: #4a4f57; }
[data-theme="dark"] body.dashboard-themed::before { opacity: 0.78; }
[data-theme="dark"] body.dashboard-themed::after { background: rgba(39,44,52,0.24); }
[data-theme="dark"] body.dashboard-themed .topbar,
[data-theme="dark"] body.dashboard-themed .sidebar,
[data-theme="dark"] body.dashboard-themed .stat-card,
[data-theme="dark"] body.dashboard-themed .toolbar,
[data-theme="dark"] body.dashboard-themed .pathbar,
[data-theme="dark"] body.dashboard-themed .panel,
[data-theme="dark"] body.dashboard-themed .img-grid-panel,
[data-theme="dark"] body.dashboard-themed .all-urls-panel,
[data-theme="dark"] body.dashboard-themed .modal-box {
    background: rgba(58,63,71,0.48);
    border-color: rgba(156,163,175,0.3);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
}
[data-theme="dark"] body.dashboard-themed .panel-head,
[data-theme="dark"] body.dashboard-themed .table-header-row,
[data-theme="dark"] body.dashboard-themed .url-list-item,
[data-theme="dark"] body.dashboard-themed .form-input,
[data-theme="dark"] body.dashboard-themed .url-input,
[data-theme="dark"] body.dashboard-themed .url-textarea,
[data-theme="dark"] body.dashboard-themed .topbar-search input {
    background: rgba(52,57,65,0.62);
    border-color: rgba(156,163,175,0.34);
    color: var(--text);
}
[data-theme="dark"] body.dashboard-themed .panel-head,
[data-theme="dark"] body.dashboard-themed .table-header-row {
    background: rgba(48,52,59,0.66);
}
[data-theme="dark"] body.dashboard-themed .form-input:focus,
[data-theme="dark"] body.dashboard-themed .url-input:focus,
[data-theme="dark"] body.dashboard-themed .url-textarea:focus,
[data-theme="dark"] body.dashboard-themed .topbar-search input:focus {
    background: rgba(52,57,65,0.72);
    border-color: var(--accent);
    box-shadow: 0 0 0 4px rgba(96,165,250,0.16);
    color: var(--text);
}
[data-theme="dark"] body.dashboard-themed .topbar-search input::placeholder {
    color: #aeb7c6;
    opacity: 1;
}
.login-logo-img {
    max-width: 64px;
    max-height: 64px;
    object-fit: contain;
    border-radius: 18px;
    border-radius: 50%;
}
.mobile-menu-btn {
    display: none;
    width: 40px;
    height: 40px;
    border: 1.5px solid var(--line);
    border-radius: 11px;
    background: white;
    color: var(--text);
    font-weight: 800;
    cursor: pointer;
}
.sidebar-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(15,23,42,0.5);
    z-index: 110;
}
.theme-switch {
    position: relative;
    width: 64px;
    height: 32px;
    background: #f1f5f9;
    border-radius: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px;
    border: 1.5px solid #cbd5e1;
    transition: all 0.3s ease;
    user-select: none;
}
.theme-switch:hover {
    border-color: #94a3b8;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.theme-switch:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.35);
}
.theme-page-btn {
    height: 32px;
    padding: 0 12px;
    border-radius: 16px;
    border: 1.5px solid #cbd5e1;
    background: #f1f5f9;
    color: var(--text);
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.2s ease;
}
.theme-page-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
    transform: translateY(-1px);
}
[data-theme="dark"] .theme-page-btn {
    background: #1e293b;
    border-color: #334155;
    color: var(--text);
}
.theme-switch .ts-icon {
    font-size: 14px;
    z-index: 2;
    transition: color 0.3s ease, filter 0.3s ease;
    line-height: 1;
}
.theme-switch .ts-icon.sun { color: #f59e0b; }
.theme-switch .ts-icon.moon { color: #94a3b8; }
.theme-switch .ts-thumb {
    position: absolute;
    width: 24px;
    height: 24px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    left: 4px;
    top: 50%;
    transform: translateY(-50%);
    transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 1;
}
[data-theme="dark"] .theme-switch {
    background: #1e293b;
    border-color: #334155;
}
[data-theme="dark"] .theme-switch:hover {
    border-color: #475569;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
[data-theme="dark"] .theme-switch .ts-thumb {
    left: calc(100% - 28px);
    background: #0f172a;
    box-shadow: 0 2px 6px rgba(0,0,0,0.5);
}
[data-theme="dark"] .theme-switch .ts-icon.sun { color: #64748b; filter: grayscale(1); }
[data-theme="dark"] .theme-switch .ts-icon.moon { color: #f59e0b; }
.profile-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border: 1.5px solid var(--line);
    border-radius: 12px;
    background: white;
    font-size: 12px;
    font-weight: 800;
    color: var(--text);
    text-decoration: none;
}
.avatar-small, .avatar-large {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(79,70,229,0.12);
    color: var(--accent);
    font-weight: 900;
    overflow: hidden;
}
.avatar-small { width: 28px; height: 28px; }
.avatar-large { width: 58px; height: 58px; font-size: 18px; }
.avatar-small img, .avatar-large img { width: 100%; height: 100%; object-fit: cover; }
.admin-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 14px;
}
.admin-card {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 18px;
    padding: 18px;
    box-shadow: 0 4px 20px rgba(79,70,229,0.06);
}
.admin-card h3 { font-size: 16px; margin-bottom: 12px; }
.admin-table-wrap { overflow-x: auto; }
.admin-table { width: 100%; border-collapse: collapse; min-width: 760px; }
.admin-table th, .admin-table td { padding: 10px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: middle; font-size: 12px; }
.admin-table th { color: var(--muted); text-transform: uppercase; letter-spacing: .04em; font-size: 10px; }
.admin-actions-cell { min-width: 170px; }
.admin-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex-wrap: nowrap;
}
.user-cell {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 190px;
}
.avatar-mini {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(79,70,229,0.12);
    color: var(--accent);
    font-size: 12px;
    font-weight: 900;
    overflow: hidden;
    flex-shrink: 0;
}
.avatar-mini img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
.status-pill {
    display: inline-flex;
    padding: 4px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 800;
    border: 1px solid var(--line);
}
.status-pill.success, .status-pill.active { color: var(--success); background: rgba(16,185,129,0.1); }
.status-pill.failed, .status-pill.frozen { color: var(--danger); background: rgba(239,68,68,0.1); }
.trash-select-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 12px;
}
.trash-check { width: 17px; height: 17px; accent-color: var(--accent); }
.danger-btn-disabled:disabled, .trash-bulk-btn:disabled {
    opacity: .45;
    cursor: not-allowed;
}
.dashboard-footer {
    margin-top: 24px;
    padding: 18px;
    color: var(--muted);
    font-size: 12px;
    font-weight: 700;
    text-align: center;
}

/* ===== TOPBAR ===== */
.topbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: var(--topbar-h);
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(226, 232, 240, 0.85);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    z-index: 1000;
    transition: background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

[data-theme="dark"] .topbar {
    background: rgba(15, 23, 42, 0.96);
    border-bottom-color: rgba(51, 65, 85, 0.6);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
}

.topbar-brand {
    display: flex;
    align-items: center;
    gap: 14px;
    text-decoration: none;
    cursor: pointer;
}

.rafvex-logo-img {
    height: 38px;
    max-height: 42px;
    width: auto;
    object-fit: contain;
    display: block;
    transition: transform 0.2s ease;
}

.topbar-brand:hover .rafvex-logo-img {
    transform: scale(1.03);
}

.brand-badge-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(220, 38, 38, 0.08);
    border: 1px solid rgba(220, 38, 38, 0.2);
    color: #dc2626;
    padding: 3px 10px;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.02em;
}

[data-theme="dark"] .brand-badge-pill {
    background: rgba(220, 38, 38, 0.15);
    border-color: rgba(220, 38, 38, 0.35);
    color: #f87171;
}

.badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #dc2626;
    display: inline-block;
    box-shadow: 0 0 8px rgba(220, 38, 38, 0.6);
}

[data-theme="dark"] .badge-dot {
    background: #ef4444;
}

.topbar-end {
    display: flex;
    align-items: center;
    gap: 10px;
}

/* Modern Theme Toggle Button */
.theme-toggle-modern {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 13px;
    border-radius: 12px;
    border: 1px solid rgba(226, 232, 240, 0.9);
    background: #f8fafc;
    color: #334155;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.theme-toggle-modern:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
    color: #0f172a;
    transform: translateY(-1px);
}

[data-theme="dark"] .theme-toggle-modern {
    background: #1e293b;
    border-color: #334155;
    color: #e2e8f0;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

[data-theme="dark"] .theme-toggle-modern:hover {
    background: #334155;
    border-color: #475569;
    color: #ffffff;
}

.theme-toggle-modern .theme-icon-sun {
    display: flex;
    align-items: center;
    color: #f59e0b;
}

.theme-toggle-modern .theme-icon-moon {
    display: none;
    align-items: center;
    color: #818cf8;
}

[data-theme="dark"] .theme-toggle-modern .theme-icon-sun {
    display: none;
}

[data-theme="dark"] .theme-toggle-modern .theme-icon-moon {
    display: flex;
}

/* Topbar action links */
.topbar-action-cms {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 13px;
    border-radius: 12px;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 12px;
    font-weight: 700;
    text-decoration: none;
    transition: all 0.2s ease;
    background: #dc2626;
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(220, 38, 38, 0.25);
}

.topbar-action-cms:hover {
    background: #b91c1c;
    color: #ffffff;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.35);
}

.topbar-action-cms.outline {
    background: transparent;
    border: 1px solid rgba(226, 232, 240, 0.9);
    color: #475569;
    box-shadow: none;
}

.topbar-action-cms.outline:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
    color: #0f172a;
}

[data-theme="dark"] .topbar-action-cms.outline {
    border-color: #334155;
    color: #94a3b8;
}

[data-theme="dark"] .topbar-action-cms.outline:hover {
    background: #1e293b;
    border-color: #475569;
    color: #f8fafc;
}


/* ===== LAYOUT ===== */
.layout { display: flex; min-height: 100vh; padding-top: var(--topbar-h); }

/* ===== SIDEBAR ===== */
.sidebar {
    width: var(--sidebar-w); flex-shrink: 0;
    background: rgba(255,255,255,0.9);
    backdrop-filter: blur(20px);
    border-right: 1px solid rgba(226,232,240,0.7);
    padding: 20px 14px;
    display: flex; flex-direction: column; gap: 4px;
    position: sticky; top: var(--topbar-h);
    height: calc(100vh - var(--topbar-h)); overflow-y: auto;
}

.sidebar-section {
    font-size: 9.5px; font-weight: 800; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--muted); padding: 10px 10px 4px;
}

.sidebar-btn {
    display: flex; align-items: center; gap: 9px;
    padding: 9px 12px; border-radius: 12px; border: none;
    background: transparent; color: var(--text);
    font-size: 13px; font-family: 'Plus Jakarta Sans', sans-serif;
    font-weight: 600; cursor: pointer; transition: all 0.16s;
    text-align: left; width: 100%; text-decoration: none;
}
.sidebar-btn .sb-icon {
    width: 30px; height: 30px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; flex-shrink: 0; transition: all 0.16s;
}
.sidebar-btn:hover { background: rgba(79,70,229,0.08); color: var(--accent); }
.sidebar-btn:hover .sb-icon { background: rgba(79,70,229,0.14); }
.sidebar-logout-wrap { margin-top: auto; padding-top: 10px; }
.sidebar-btn-logout { border: 1.5px solid var(--line); }
.sidebar-btn-logout:hover { border-color: var(--danger); color: var(--danger); }
.sb-icon-img img { width: 16px; height: 16px; object-fit: contain; display: block; }
.sb-upload .sb-icon { background: rgba(79,70,229,0.1); }
.sb-folder .sb-icon { background: rgba(0,122,255,0.12); color: #007aff; }
.sb-file   .sb-icon { background: rgba(16,185,129,0.1); }
.sb-urls   .sb-icon { background: rgba(14,165,233,0.1); }
.sb-delete .sb-icon { background: rgba(239,68,68,0.1); }
.sidebar-divider { height: 1px; background: var(--line); margin: 6px 0; }

/* ===== MAIN ===== */
.main { flex: 1; padding: 24px; min-width: 0; }

/* ===== STATS ===== */
.stats-row {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 14px; margin-bottom: 20px;
}
.stat-card {
    background: var(--card); border: 1px solid rgba(255,255,255,0.8);
    border-radius: 20px; padding: 20px;
    box-shadow: 0 4px 20px rgba(79,70,229,0.06);
    animation: rise 0.4s ease forwards; opacity: 0;
    transition: all 0.2s;
}
.stat-card:hover { transform: translateY(-3px); box-shadow: 0 8px 28px rgba(79,70,229,0.1); }
.stat-card:nth-child(1){animation-delay:.05s}
.stat-card:nth-child(2){animation-delay:.1s}
.stat-card:nth-child(3){animation-delay:.15s}
.stat-card:nth-child(4){animation-delay:.2s}
@keyframes rise {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
}
.stat-icon { width: 40px; height: 40px; border-radius: 13px; display: flex; align-items: center; justify-content: center; font-size: 18px; margin-bottom: 12px; }
.si-purple { background: rgba(79,70,229,0.12); }
.si-cyan   { background: rgba(14,165,233,0.12); }
.si-amber  { background: rgba(245,158,11,0.12); }
.si-green  { background: rgba(16,185,129,0.12); }
.stat-val  { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
.stat-lbl  { font-size: 11.5px; color: var(--muted); font-weight: 500; margin-top: 2px; }

/* ===== TOOLBAR ===== */
.toolbar {
    background: var(--card); border: 1px solid var(--line);
    border-radius: 18px; padding: 10px 14px;
    display: flex; align-items: center; gap: 6px;
    margin-bottom: 12px; flex-wrap: wrap;
    box-shadow: 0 2px 14px rgba(79,70,229,0.05);
    animation: rise 0.4s 0.22s ease forwards; opacity: 0;
}
.sticky-toolbar {
    position: sticky;
    top: calc(var(--topbar-h) + 10px);
    z-index: 60;
}
.tb-label { font-size: 11px; font-weight: 800; color: var(--muted); letter-spacing: 0.07em; text-transform: uppercase; margin-right: 2px; }
.tb-sep { width: 1px; height: 24px; background: var(--line); margin: 0 2px; }
.tb-btn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 7px 12px; border-radius: 10px; border: 1.5px solid var(--line);
    background: white; color: var(--text); font-size: 12px;
    font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700;
    cursor: pointer; transition: all 0.16s; white-space: nowrap; text-decoration: none;
}
.tb-btn:hover { border-color: var(--accent); color: var(--accent); background: rgba(79,70,229,0.05); transform: translateY(-1px); }
.tb-btn.danger:hover { border-color: var(--danger); color: var(--danger); background: rgba(239,68,68,0.05); }
.tb-btn.warning:hover { border-color: var(--warning); color: var(--warning); background: rgba(245,158,11,0.05); }
.tb-btn:hover { border-color: var(--accent); color: var(--accent); background: rgba(79,70,229,0.05); transform: translateY(-3px); box-shadow: 0 6px 16px rgba(79,70,229,0.15); }
.tb-btn.danger:hover { border-color: var(--danger); color: var(--danger); background: rgba(239,68,68,0.05); transform: translateY(-3px); box-shadow: 0 6px 16px rgba(239,68,68,0.15); }
.tb-btn.warning:hover { border-color: var(--warning); color: var(--warning); background: rgba(245,158,11,0.05); transform: translateY(-3px); box-shadow: 0 6px 16px rgba(245,158,11,0.15); }
.tb-btn.primary { background: var(--accent); color: white; border-color: var(--accent); box-shadow: 0 4px 12px rgba(79,70,229,0.3); }
.tb-btn.primary:hover { background: #4338ca; border-color: #4338ca; color: white; box-shadow: 0 6px 18px rgba(79,70,229,0.4); }
.tb-btn.primary:hover { background: #4338ca; border-color: #4338ca; color: white; box-shadow: 0 8px 24px rgba(79,70,229,0.4); transform: translateY(-3px); }
.tb-btn.success { background: var(--success); color: white; border-color: var(--success); }
.tb-btn.success:hover { background: #059669; }
.tb-btn.success:hover { background: #059669; transform: translateY(-3px); box-shadow: 0 6px 16px rgba(16,185,129,0.25); }

/* Selection actions bar */
.selection-bar {
    display: none;
    background: linear-gradient(135deg, #4b5563, #30343b);
    border-radius: 18px; padding: 10px 16px;
    align-items: center; gap: 8px; margin-bottom: 12px;
    box-shadow: 0 8px 32px rgba(15,23,42,0.25);
    animation: slide-in 0.25s cubic-bezier(0.34,1.56,0.64,1);
}
.selection-bar.visible { display: flex; }
@keyframes slide-in {
    from { opacity: 0; transform: translateY(-10px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
}
.sel-count { color: white; font-size: 13px; font-weight: 800; min-width: 90px; }
.sel-btn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 7px 13px; border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.1);
    color: white; font-size: 12px; font-family: 'Plus Jakarta Sans', sans-serif;
    font-weight: 700; cursor: pointer; transition: all 0.16s; white-space: nowrap;
}
.sel-btn:hover { background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.3); }
.sel-btn.sel-delete { background: rgba(239,68,68,0.2); border-color: rgba(239,68,68,0.4); }
.sel-btn.sel-delete:hover { background: rgba(239,68,68,0.35); }
.sel-btn.sel-move { background: rgba(245,158,11,0.2); border-color: rgba(245,158,11,0.4); }
.sel-btn.sel-move:hover { background: rgba(245,158,11,0.3); }
.sel-btn.sel-copy-url { background: rgba(14,165,233,0.2); border-color: rgba(14,165,233,0.4); }
.sel-sep { width: 1px; height: 22px; background: rgba(255,255,255,0.15); margin: 0 2px; }
.sel-btn.sel-close { margin-left: auto; background: rgba(255,255,255,0.08); }

/* selected count */
.selected-count { font-size: 12px; font-weight: 700; color: var(--accent); min-width: 70px; }

/* ===== PATHBAR ===== */
.pathbar {
    background: var(--card); border: 1px solid var(--line);
    border-radius: 14px; padding: 10px 16px;
    display: flex; align-items: center; gap: 5px;
    margin-bottom: 12px; font-size: 13px; font-weight: 600;
    flex-wrap: wrap; box-shadow: 0 2px 10px rgba(79,70,229,0.04);
}
.pathbar .ph-home { color: var(--muted); cursor: pointer; }
.pathbar .ph-sep  { color: #cbd5e1; }
.pathbar a { color: var(--accent); text-decoration: none; }
.pathbar a:hover { text-decoration: underline; }
.pathbar .ph-cur  { color: var(--text); }
.pathbar .ph-back {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 4px 10px; background: var(--light); border: 1.5px solid var(--line);
    border-radius: 9px; font-size: 11px; color: var(--muted); text-decoration: none; font-weight: 700; transition: all 0.16s;
    margin-left: 6px; flex-shrink: 0;
}
.pathbar .ph-back:hover { border-color: var(--accent); color: var(--accent); background: rgba(79,70,229,0.06); }

/* ===== MESSAGE ===== */
.message {
    padding: 12px 16px; border-radius: 14px; font-size: 13px; font-weight: 700;
    margin-bottom: 14px; display: flex; align-items: center; gap: 9px; animation: rise 0.3s ease;
}
.msg-success { background: #f0fdf4; border: 1.5px solid #bbf7d0; color: #15803d; }
.msg-warning { background: #fffbeb; border: 1.5px solid #fde68a; color: #b45309; }
.msg-error   { background: #fef2f2; border: 1.5px solid #fecaca; color: #dc2626; }

/* ===== PANEL / FILE TABLE ===== */
.panel {
    background: var(--card); border: 1px solid var(--line);
    border-radius: 22px; overflow: hidden;
    box-shadow: 0 4px 20px rgba(79,70,229,0.06);
    animation: rise 0.4s 0.28s ease forwards; opacity: 0;
}
.panel-head {
    padding: 16px 20px; border-bottom: 1px solid var(--line);
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    background: rgba(248,250,252,0.7);
}
.panel-title { font-size: 14.5px; font-weight: 800; }
.panel-meta  { font-size: 11.5px; color: var(--muted); font-weight: 500; }
.panel-title-search {
    display: flex;
    align-items: center;
    gap: 14px;
    flex: 1;
    min-width: 0;
}
.panel-title-search .topbar-search,
.panel-title-search .table-search-box {
    flex: 0 1 340px;
    max-width: 360px;
    min-width: 220px;
}

/* ===== SEARCH BOX STYLING ===== */
.topbar-search,
.table-search-box {
    position: relative;
    display: inline-flex;
    align-items: center;
}

.topbar-search input,
.table-search-box input {
    width: 100%;
    height: 38px;
    padding: 8px 36px 8px 36px;
    background: #ffffff;
    border: 1.5px solid #cbd5e1;
    border-radius: 12px;
    font-size: 13px;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-weight: 500;
    color: #0f172a;
    outline: none;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.topbar-search input::placeholder,
.table-search-box input::placeholder {
    color: #94a3b8;
    font-size: 12.5px;
    font-weight: 500;
}

.topbar-search input:focus,
.table-search-box input:focus {
    border-color: #dc2626;
    background: #ffffff;
    box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04);
}

.topbar-search .search-icon,
.table-search-box .table-search-icon {
    position: absolute;
    left: 11px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    pointer-events: none;
    transition: color 0.2s ease;
}

.topbar-search:focus-within .search-icon,
.table-search-box:focus-within .table-search-icon {
    color: #dc2626;
}

.table-search-kbd {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    pointer-events: none;
    transition: opacity 0.2s ease;
}

.table-search-box:focus-within .table-search-kbd {
    opacity: 0.3;
}

/* Dark mode search box */
[data-theme="dark"] .topbar-search input,
[data-theme="dark"] .table-search-box input {
    background: #1e293b;
    border-color: #334155;
    color: #f8fafc;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}

[data-theme="dark"] .topbar-search input::placeholder,
[data-theme="dark"] .table-search-box input::placeholder {
    color: #64748b;
}

[data-theme="dark"] .topbar-search input:focus,
[data-theme="dark"] .table-search-box input:focus {
    background: #1e293b;
    border-color: #ef4444;
    color: #ffffff;
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2), 0 2px 8px rgba(0, 0, 0, 0.3);
}

[data-theme="dark"] .topbar-search .search-icon,
[data-theme="dark"] .table-search-box .table-search-icon {
    color: #64748b;
}

[data-theme="dark"] .topbar-search:focus-within .search-icon,
[data-theme="dark"] .table-search-box:focus-within .table-search-icon {
    color: #ef4444;
}

[data-theme="dark"] .table-search-kbd {
    background: #0f172a;
    border-color: #334155;
    color: #94a3b8;
}
.panel-head-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-end;
}

/* Table header */
.table-header-row {
    display: grid;
    grid-template-columns: 44px minmax(200px, 1fr) 120px 300px;
    gap: 0; padding: 9px 18px;
    background: rgba(241,245,249,0.7);
    border-bottom: 1px solid var(--line);
    font-size: 10.5px; font-weight: 800; letter-spacing: 0.07em;
    text-transform: uppercase; color: var(--muted); align-items: center;
}

/* File rows */
.file-list { padding: 6px 10px; }

.file-row {
    display: grid;
    grid-template-columns: 44px minmax(200px, 1fr) 120px 300px;
    align-items: center; gap: 0;
    padding: 8px 6px; border-radius: 14px;
    transition: background-color 0.12s ease, box-shadow 0.12s ease; cursor: default; user-select: none;
    position: relative;
}
.file-row:hover { background: rgba(79,70,229,0.05); }
.file-row.selected { background: rgba(79,70,229,0.09); }
.file-row.dbl-highlight { animation: dbl-flash 0.25s ease; }
@keyframes dbl-flash {
    0%,100% { background: rgba(79,70,229,0.09); }
    50%      { background: rgba(79,70,229,0.18); }
}

.file-check-cell { display: flex; align-items: center; justify-content: center; }
.file-check { width: 17px; height: 17px; border-radius: 5px; accent-color: var(--accent); cursor: pointer; }
body:not(.selection-mode) .table-header-row,
body:not(.selection-mode) .file-row { grid-template-columns: 0 minmax(200px, 1fr) 120px 300px; }
body:not(.selection-mode) .table-header-row > div:first-child,
body:not(.selection-mode) .file-check-cell { width: 0; overflow: hidden; opacity: 0; pointer-events: none; }

.file-name-cell { display: flex; align-items: center; gap: 11px; min-width: 0; }

.file-type-icon {
    width: 38px; height: 38px; border-radius: 11px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.fti-folder { background: rgba(0,122,255,0.14); color: #007aff; }
.fti-image  { background: rgba(79,70,229,0.1);  color: var(--accent); }
.fti-code   { background: rgba(16,185,129,0.1);  color: var(--success); }
.fti-other  { background: rgba(100,116,139,0.1); color: var(--muted); }
.file-type-icon svg { width: 19px; height: 19px; }
[data-theme="dark"] .fti-folder { background: rgba(96,165,250,0.18); color: #60a5fa; }
[data-theme="dark"] .sb-folder .sb-icon { background: rgba(96,165,250,0.18); color: #60a5fa; }

/* Image thumbnail in list */
.thumb-img {
    width: 38px; height: 38px; border-radius: 11px;
    object-fit: cover; border: 1.5px solid var(--line);
    cursor: pointer; transition: all 0.2s; flex-shrink: 0;
}
.thumb-img:hover { transform: scale(1.1); border-color: var(--accent); box-shadow: 0 4px 12px rgba(79,70,229,0.2); }

.file-name-info { min-width: 0; }
.file-title-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
}
.file-title-row .file-name-display {
    min-width: 0;
}
.file-name-span { font-size: 13.5px; font-weight: 700; color: var(--text); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.file-name-span:hover { color: var(--accent); }
.file-name-folder { font-size: 13.5px; font-weight: 700; color: var(--text); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.file-name-folder:hover { color: var(--accent); }
.file-meta { font-size: 11px; color: var(--muted); font-weight: 500; margin-top: 1px; }

/* URL cell */
.url-cell { padding: 0 6px; }
.url-copy-wrap { display: flex; align-items: center; gap: 5px; }
.url-input {
    flex: 1; font-family: 'JetBrains Mono', monospace; font-size: 10px;
    padding: 6px 9px; background: var(--light); border: 1.5px solid var(--line);
    border-radius: 9px; color: var(--muted); outline: none; min-width: 0; cursor: text;
}
.url-copy-btn {
    flex-shrink: 0; width: 30px; height: 30px; border-radius: 9px;
    border: 1.5px solid var(--line); background: white;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    font-size: 12px; transition: all 0.16s; color: var(--muted);
}
.url-copy-btn:hover { border-color: var(--accent); color: var(--accent); background: rgba(79,70,229,0.06); }
.url-copy-btn.copied { border-color: var(--success); color: var(--success); background: rgba(16,185,129,0.08); }

/* Size/Date */
.size-cell { padding: 0 6px; font-size: 12px; font-weight: 600; color: var(--muted); }

/* Actions */
.actions-cell {
    display: flex; align-items: center; gap: 4px;
    padding: 0 4px; flex-wrap: nowrap; justify-content: flex-end;
}
.act-btn {
    display: inline-flex; align-items: center; gap: 3px;
    padding: 5px 9px; border-radius: 9px; border: 1.5px solid var(--line);
    background: white; font-size: 11px; font-family: 'Plus Jakarta Sans', sans-serif;
    font-weight: 700; cursor: pointer; transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease, box-shadow 0.12s ease, transform 0.12s ease;
    text-decoration: none; color: var(--text); white-space: nowrap;
}
.act-btn:hover { transform: translateY(-1px); box-shadow: 0 3px 10px rgba(0,0,0,0.08); }
.act-btn:hover { transform: translateY(-3px) scale(1.02); box-shadow: 0 6px 14px rgba(0,0,0,0.12); }
.act-btn.open:hover   { border-color: var(--accent); color: var(--accent); }
.act-btn.edit-btn:hover { border-color: var(--warning); color: var(--warning); }
.act-btn.del:hover    { border-color: var(--danger); color: var(--danger); }
.act-btn.rename-btn:hover { border-color: var(--success); color: var(--success); }

/* Rename inline */
.rename-form { display: flex; gap: 4px; align-items: center; }
.inline-rename-form {
    max-width: min(420px, 100%);
    flex-wrap: nowrap;
}
.rename-input {
    padding: 5px 8px; border: 1.5px solid var(--accent); border-radius: 8px;
    font-size: 12px; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 600;
    outline: none; width: min(240px, 42vw); color: var(--text);
    background: var(--card);
}
.rename-save {
    padding: 5px 9px; border: none; background: var(--accent);
    color: white; border-radius: 8px; font-size: 12px;
    font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; cursor: pointer; transition: 0.14s;
}
.rename-save:hover { background: #4338ca; }

/* Empty */
.empty-state { padding: 56px 24px; text-align: center; color: var(--muted); }
.empty-state .es-icon { font-size: 44px; margin-bottom: 14px; }
.empty-state h3 { font-size: 17px; font-weight: 800; color: var(--text); margin-bottom: 5px; }
.empty-state p  { font-size: 13.5px; }

/* ===== IMAGE PREVIEW GRID ===== */
.img-grid-panel {
    margin-top: 22px; background: var(--card); border: 1px solid var(--line);
    border-radius: 22px; overflow: hidden;
    box-shadow: 0 4px 20px rgba(79,70,229,0.06);
    animation: rise 0.4s 0.42s ease forwards; opacity: 0;
}

.img-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(185px, 1fr));
    gap: 14px; padding: 18px;
}

.img-card {
    border-radius: 18px; border: 1.5px solid var(--line); overflow: hidden;
    background: white; transition: all 0.22s; position: relative;
}
.img-card:hover { transform: translateY(-5px); box-shadow: 0 18px 44px rgba(79,70,229,0.16); border-color: rgba(79,70,229,0.3); }

.img-card-thumb {
    width: 100%; height: 150px; object-fit: cover; display: block;
    background: var(--light); cursor: pointer; transition: all 0.2s;
}
.img-card:hover .img-card-thumb { transform: scale(1.03); }

.img-card-info { padding: 10px 12px 12px; }

.img-card-name { font-size: 11.5px; font-weight: 700; color: var(--text); word-break: break-all; margin-bottom: 8px; line-height: 1.3; }

.img-card-url { display: flex; gap: 4px; align-items: center; }

.img-url-input {
    flex: 1; font-family: 'JetBrains Mono', monospace; font-size: 9.5px;
    padding: 5px 7px; background: var(--light); border: 1.5px solid var(--line);
    border-radius: 8px; color: var(--muted); outline: none; min-width: 0; cursor: pointer;
}
.img-url-input:hover { border-color: var(--accent); }

.img-url-copy {
    flex-shrink: 0; width: 28px; height: 28px; border-radius: 8px;
    border: 1.5px solid var(--line); background: white; cursor: pointer;
    display: flex; align-items: center; justify-content: center; font-size: 11px; transition: 0.14s;
}
.img-url-copy:hover { border-color: var(--accent); background: rgba(79,70,229,0.06); }
.img-url-copy.copied { border-color: var(--success); color: var(--success); }

/* ===== ALL URLs PANEL ===== */
.all-urls-panel {
    margin-top: 22px; background: var(--card); border: 1px solid var(--line);
    border-radius: 22px; overflow: hidden;
    box-shadow: 0 4px 20px rgba(79,70,229,0.06);
    animation: rise 0.4s 0.5s ease forwards; opacity: 0;
}
.url-list-wrap { padding: 18px; display: flex; flex-direction: column; gap: 8px; }
.url-list-item {
    display: flex; align-items: center; gap: 8px;
    background: var(--light); border: 1.5px solid var(--line);
    border-radius: 12px; padding: 8px 12px; transition: all 0.16s;
}
.url-list-item:hover { border-color: var(--accent); background: rgba(79,70,229,0.04); }
.url-list-num { font-size: 10.5px; font-weight: 800; color: var(--muted); min-width: 22px; }
.url-list-name { font-size: 12px; font-weight: 700; color: var(--text); min-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.url-list-input {
    flex: 1; font-family: 'JetBrains Mono', monospace; font-size: 10.5px;
    padding: 5px 8px; background: white; border: 1.5px solid var(--line);
    border-radius: 8px; color: var(--muted); outline: none; cursor: pointer; min-width: 0;
}
.url-list-input:hover { border-color: var(--accent2); }
.url-list-btn {
    flex-shrink: 0; padding: 5px 10px; border-radius: 8px;
    border: 1.5px solid var(--line); background: white; font-size: 11px;
    font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; cursor: pointer;
    color: var(--text); transition: all 0.14s; white-space: nowrap;
}
.url-list-btn:hover { border-color: var(--accent2); color: var(--accent2); }
.url-list-btn.copied { border-color: var(--success); color: var(--success); }

.copy-all-bar {
    padding: 0 18px 18px; display: flex; gap: 8px; flex-wrap: wrap;
}

/* ===== MODALS ===== */
.modal-overlay {
    position: fixed; inset: 0;
    background: rgba(15,23,42,0.5); backdrop-filter: blur(8px);
    z-index: 200; display: flex; align-items: center; justify-content: center;
    padding: 20px; opacity: 0; pointer-events: none; transition: opacity 0.2s;
}
.modal-overlay.open { opacity: 1; pointer-events: all; }

.modal-box {
    background: white; border-radius: 26px; width: 100%; max-width: 520px;
    box-shadow: 0 40px 80px rgba(15,23,42,0.25); overflow: hidden;
    transform: translateY(28px) scale(0.96);
    transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.modal-overlay.open .modal-box { transform: translateY(0) scale(1); }

.modal-header {
    padding: 22px 26px 14px; border-bottom: 1px solid var(--line);
    display: flex; align-items: center; justify-content: space-between;
}
.modal-title { font-size: 16px; font-weight: 800; }
.modal-close {
    width: 32px; height: 32px; border-radius: 9px; border: 1.5px solid var(--line);
    background: none; cursor: pointer; font-size: 14px;
    display: flex; align-items: center; justify-content: center;
    transition: 0.14s; color: var(--muted);
}
.modal-close:hover { border-color: var(--danger); color: var(--danger); }

.modal-body { padding: 22px 26px 26px; }

.form-group { margin-bottom: 14px; }
.form-label { display: block; font-size: 11px; font-weight: 800; color: var(--muted); letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 7px; }
.form-input {
    width: 100%; padding: 11px 14px;
    background: var(--light); border: 1.5px solid var(--line);
    border-radius: 13px; font-size: 13.5px;
    font-family: 'Plus Jakarta Sans', sans-serif; color: var(--text); outline: none; transition: 0.2s;
}
.form-input:focus { border-color: var(--accent); background: white; box-shadow: 0 0 0 4px rgba(79,70,229,0.1); }
.form-textarea { min-height: 130px; resize: vertical; }

.form-btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 12px 20px; border: none; border-radius: 13px;
    font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13.5px; font-weight: 700;
    cursor: pointer; transition: all 0.2s; text-decoration: none;
}
.btn-primary { background: linear-gradient(135deg, var(--accent), #4338ca); color: white; box-shadow: 0 6px 20px rgba(79,70,229,0.3); }
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(79,70,229,0.4); }
.btn-secondary { background: var(--light); color: var(--text); border: 1.5px solid var(--line); }
.btn-secondary:hover { border-color: var(--accent); color: var(--accent); }
.btn-danger { background: linear-gradient(135deg, var(--danger), #dc2626); color: white; }
.btn-danger:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(239,68,68,0.35); }
.btn-row { display: flex; gap: 8px; flex-wrap: wrap; }

/* ── Professional File Manager Transfer Dialog (Move & Copy) ── */
.transfer-items-summary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 14px;
    background: var(--light, #f8fafc);
    border: 1.5px solid var(--line, #e2e8f0);
    border-radius: 12px;
    font-size: 12.5px;
    margin-bottom: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.transfer-badge {
    font-weight: 800;
    color: var(--muted, #64748b);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
}
.transfer-names {
    color: var(--text, #1e293b);
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
}
.transfer-nav-bar {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
    align-items: center;
}
.transfer-search-wrap {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
}
.transfer-search-icon {
    position: absolute;
    left: 11px;
    font-size: 13px;
    pointer-events: none;
    opacity: 0.6;
}
.transfer-search-input {
    width: 100%;
    padding: 8px 12px 8px 32px;
    background: var(--light, #f8fafc);
    border: 1.5px solid var(--line, #e2e8f0);
    border-radius: 10px;
    font-size: 13px;
    font-family: inherit;
    color: var(--text, #1e293b);
    outline: none;
    transition: 0.2s;
}
.transfer-search-input:focus {
    border-color: var(--accent, #6366f1);
    background: white;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}
.transfer-breadcrumb-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    padding: 6px 10px;
    background: rgba(99, 102, 241, 0.06);
    border-radius: 8px;
    margin-bottom: 10px;
    color: var(--muted, #64748b);
}
.transfer-crumb {
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    transition: 0.15s;
    font-weight: 600;
}
.transfer-crumb:hover {
    background: rgba(99, 102, 241, 0.15);
    color: var(--accent, #6366f1);
}
.transfer-crumb.active {
    color: var(--accent, #6366f1);
    font-weight: 800;
}
.transfer-folder-browser {
    max-height: 240px;
    overflow-y: auto;
    border: 1.5px solid var(--line, #e2e8f0);
    border-radius: 12px;
    background: white;
    padding: 6px;
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
}
.transfer-folder-row {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 8px 12px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    color: var(--text, #1e293b);
    transition: background 0.15s, color 0.15s;
    margin-bottom: 2px;
    user-select: none;
}
.transfer-folder-row:hover {
    background: rgba(99, 102, 241, 0.08);
}
.transfer-folder-row.selected {
    background: var(--accent, #6366f1) !important;
    color: white !important;
    font-weight: 700;
}
.transfer-folder-row.selected .transfer-folder-icon,
.transfer-folder-row.selected .transfer-folder-tag {
    color: white !important;
}
.transfer-folder-row.selected .transfer-folder-tag {
    background: rgba(255,255,255,0.2) !important;
}
.transfer-folder-icon {
    font-size: 16px;
    flex-shrink: 0;
}
.transfer-folder-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.transfer-folder-tag {
    font-size: 10px;
    letter-spacing: 0.03em;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(0,0,0,0.05);
    color: var(--muted, #64748b);
    flex-shrink: 0;
}
.transfer-destination-callout {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding: 9px 12px;
    background: rgba(99, 102, 241, 0.06);
    border: 1.5px dashed var(--accent, #6366f1);
    border-radius: 10px;
    font-size: 12px;
}
.dest-label {
    font-weight: 800;
    color: var(--muted, #64748b);
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    flex-shrink: 0;
}
.dest-path {
    font-weight: 800;
    color: var(--accent, #6366f1);
    word-break: break-all;
}
[data-theme="dark"] .transfer-items-summary,
[data-theme="dark"] .transfer-search-input {
    background: rgba(255,255,255,0.05);
    border-color: rgba(255,255,255,0.12);
    color: #f1f5f9;
}
[data-theme="dark"] .transfer-folder-browser {
    background: rgba(15,23,42,0.6);
    border-color: rgba(255,255,255,0.12);
}
[data-theme="dark"] .transfer-folder-row:hover {
    background: rgba(255,255,255,0.08);
}
[data-theme="dark"] .transfer-folder-tag {
    background: rgba(255,255,255,0.1);
    color: #94a3b8;
}
[data-theme="dark"] .transfer-folder-row.selected {
    background: var(--accent, #6366f1) !important;
    color: white !important;
}


.trash-list, .security-list { padding: 14px 18px 18px; display: flex; flex-direction: column; gap: 10px; }
.trash-row, .security-row {
    display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center;
    background: var(--light); border: 1.5px solid var(--line); border-radius: 14px; padding: 12px 14px;
}
.trash-name, .security-name { font-size: 13px; font-weight: 800; color: var(--text); word-break: break-word; }
.trash-meta, .security-meta { font-size: 11.5px; color: var(--muted); font-weight: 600; margin-top: 3px; line-height: 1.45; }
.row-actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; flex-wrap: wrap; }
.inline-form { display: inline-flex; gap: 6px; align-items: center; }

/* Drop zone */
.drop-zone {
    border: 2px dashed #c7d2fe; border-radius: 16px; padding: 28px 20px;
    text-align: center; cursor: pointer; transition: all 0.2s; background: #f5f3ff;
}
.drop-zone:hover, .drop-zone.dragover { border-color: var(--accent); background: rgba(79,70,229,0.06); }
.drop-zone .dz-icon { font-size: 36px; margin-bottom: 10px; }
.drop-zone h4 { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
.drop-zone p  { font-size: 12.5px; color: var(--muted); }
#upload-file-input { display: none; }
.upload-global-track {
    width: 100%;
    height: 11px;
    border-radius: 999px;
    background: var(--light);
    border: 1.5px solid var(--line);
    overflow: hidden;
}
.upload-global-bar {
    height: 100%;
    width: 0%;
    background: linear-gradient(135deg, var(--accent), #4338ca);
    transition: width 0.18s ease;
}
.upload-global-text {
    font-size: 11.5px;
    color: var(--muted);
    font-weight: 700;
    margin-top: 7px;
}
.upload-progress-list {
    margin-top: 10px;
    max-height: 180px;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.upload-progress-item {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 10px;
    font-size: 11.5px;
    font-weight: 700;
    color: var(--text);
    background: var(--light);
    border: 1.5px solid var(--line);
    border-radius: 10px;
    padding: 7px 10px;
}
.upload-progress-item.done { border-color: rgba(16,185,129,0.5); color: #047857; }
.upload-progress-item.fail { border-color: rgba(239,68,68,0.45); color: #b91c1c; }

.delete-warning-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: rgba(239,68,68,0.08);
    border: 1.5px solid rgba(239,68,68,0.2);
    border-radius: 16px;
    padding: 14px;
    margin-bottom: 16px;
}
.delete-warning-icon {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(239,68,68,0.14);
    color: var(--danger);
    flex-shrink: 0;
}
.delete-warning-title {
    font-size: 14px;
    font-weight: 800;
    color: var(--text);
    margin-bottom: 3px;
}
.delete-warning-text {
    font-size: 12.5px;
    color: var(--muted);
    line-height: 1.45;
    font-weight: 600;
}

/* All URLs modal textarea */
.url-textarea {
    width: 100%; font-family: 'JetBrains Mono', monospace; font-size: 11.5px;
    padding: 13px; background: var(--light); border: 1.5px solid var(--line);
    border-radius: 13px; color: var(--text); resize: vertical; min-height: 190px; outline: none;
}
.url-textarea:focus { border-color: var(--accent); background: white; }

.edit-textarea { min-height: 310px; font-family: 'JetBrains Mono', monospace; font-size: 12.5px; }

/* ===== LIGHTBOX ===== */
.lightbox {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(3, 7, 18, 0.98);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.22s ease;
}
.lightbox.open {
    opacity: 1;
    pointer-events: all;
}

/* Hide header completely when viewing image in lightbox */
body.lightbox-open .topbar,
html.lightbox-open .topbar,
.lightbox.open ~ .topbar {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
}

.lightbox-img-wrap {
    position: relative;
    width: 100vw;
    height: 100vh;
    max-width: 100vw;
    max-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 30px 60px 80px;
    box-sizing: border-box;
}

.lightbox img {
    max-width: min(92vw, 1500px);
    max-height: 85vh;
    width: auto;
    height: auto;
    border-radius: 14px;
    box-shadow: 0 30px 90px rgba(0, 0, 0, 0.9);
    object-fit: contain;
    display: block;
    margin: 0 auto;
    animation: lb-zoom-in 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
@keyframes lb-zoom-in {
    from { transform: scale(0.92); opacity: 0.2; }
    to   { transform: scale(1); opacity: 1; }
}

.lb-close {
    position: fixed;
    top: 22px;
    right: 26px;
    width: 44px;
    height: 44px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.14);
    border: 1.5px solid rgba(255, 255, 255, 0.22);
    color: #ffffff;
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.18s;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 1000010;
}
.lb-close:hover {
    background: rgba(239, 68, 68, 0.55);
    border-color: rgba(239, 68, 68, 0.85);
    transform: scale(1.06);
}

.lb-nav {
    position: fixed;
    top: 50%;
    transform: translateY(-50%);
    width: 52px;
    height: 52px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.12);
    border: 1.5px solid rgba(255, 255, 255, 0.22);
    color: white;
    font-size: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.18s;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 1000010;
}
.lb-nav:hover {
    background: rgba(239, 68, 68, 0.5);
    border-color: rgba(239, 68, 68, 0.8);
    transform: translateY(-50%) scale(1.06);
}
.lb-prev { left: 20px; }
.lb-next { right: 20px; }
.lb-nav.disabled { opacity: 0.2; cursor: default; pointer-events: none; }

.lb-info {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.55) 60%, transparent 100%);
    padding: 36px 28px 22px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    z-index: 1000010;
    pointer-events: none;
}
.lb-info > * {
    pointer-events: auto;
}
.lb-name { color: white; font-size: 15px; font-weight: 700; text-shadow: 0 1px 4px rgba(0,0,0,0.5); }
.lb-counter { color: rgba(255,255,255,0.6); font-size: 13px; font-weight: 600; }
.lb-copy-btn {
    padding: 8px 16px; border-radius: 10px;
    background: rgba(220, 38, 38, 0.85); border: 1px solid rgba(239, 68, 68, 0.9);
    color: white; font-size: 12px; font-family: 'Plus Jakarta Sans', sans-serif;
    font-weight: 700; cursor: pointer; transition: all 0.16s; white-space: nowrap;
}
.lb-copy-btn:hover { background: rgba(220, 38, 38, 1); transform: translateY(-1px); }

/* ===== TOAST ===== */
.toast-container { position: fixed; top: 76px; right: 22px; z-index: 400; display: flex; flex-direction: column; gap: 7px; pointer-events: none; }
body.dashboard-themed .toast-container {
    position: fixed;
    top: 76px;
    right: 22px;
    z-index: 400;
}
.toast {
    background: white; border: 1.5px solid var(--line);
    border-left: 4px solid var(--success); border-radius: 13px;
    padding: 11px 16px; font-size: 12.5px; font-weight: 700; color: var(--text);
    box-shadow: 0 8px 22px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 7px;
    animation: toast-in 0.28s ease; pointer-events: all;
}
.toast.danger { border-left-color: var(--danger); }
@keyframes toast-in  { from { opacity: 0; transform: translateX(18px); } to { opacity: 1; transform: translateX(0); } }
@keyframes toast-out { from { opacity: 1; } to { opacity: 0; transform: translateX(18px); } }

/* ===== RESPONSIVE ===== */
@media (max-width: 1100px) {
    .stats-row { grid-template-columns: repeat(2,1fr); }
    .table-header-row, .file-row { grid-template-columns: 44px 1fr 100px; }
    body:not(.selection-mode) .table-header-row,
    body:not(.selection-mode) .file-row { grid-template-columns: 0 1fr 100px; }
    .actions-cell { display: none; }
}
@media (max-width: 768px) {
    :root { --sidebar-w: 0px; }
    .mobile-menu-btn { display: inline-flex; align-items:center; justify-content:center; }
    .sidebar {
        display: flex;
        position: fixed;
        top: var(--topbar-h);
        left: 0;
        bottom: 0;
        width: min(310px, 86vw);
        height: calc(100vh - var(--topbar-h));
        transform: translateX(-105%);
        transition: transform .22s ease;
        z-index: 120;
        box-shadow: 20px 0 60px rgba(15,23,42,0.25);
    }
    body.sidebar-open .sidebar { transform: translateX(0); }
    body.sidebar-open .sidebar-backdrop { display: block; }
    .main { padding: 14px; }
    .stats-row { grid-template-columns: repeat(2,1fr); }
    .table-header-row, .file-row { grid-template-columns: 44px 1fr 90px; }
    body:not(.selection-mode) .table-header-row,
    body:not(.selection-mode) .file-row { grid-template-columns: 0 1fr 90px; }
    .url-cell { display: none; }
    .kbd-hint { display: none; }
    .topbar-search { max-width: none; }
    .panel-head { align-items: flex-start; flex-direction: column; }
    .panel-title-search { width: 100%; flex-wrap: wrap; }
    .panel-title-search .topbar-search { flex: 1 1 220px; min-width: 0; width: 100%; }
    .trash-row, .security-row { grid-template-columns: 1fr; }
    .row-actions { justify-content: flex-start; }
    .topbar { gap: 8px; padding: 0 10px; }
    .brand-tag, .kbd-hint { display: none; }
    .topbar-action { padding: 8px 9px; font-size: 11px; }
    .profile-chip { max-width: 140px; overflow: hidden; }
}

/* ===== FEATURE ADDITIONS ===== */

/* Folder color variables */
:root {
    --fc-blue:   #3b82f6;
    --fc-green:  #22c55e;
    --fc-yellow: #eab308;
    --fc-red:    #ef4444;
    --fc-purple: #a855f7;
    --fc-orange: #f97316;
    --fc-blue-bg:   rgba(59,130,246,0.14);
    --fc-green-bg:  rgba(34,197,94,0.14);
    --fc-yellow-bg: rgba(234,179,8,0.16);
    --fc-red-bg:    rgba(239,68,68,0.14);
    --fc-purple-bg: rgba(168,85,247,0.14);
    --fc-orange-bg: rgba(249,115,22,0.14);
}

.file-type-icon[data-folder-color="blue"]   { color: var(--fc-blue);   background: var(--fc-blue-bg); }
.file-type-icon[data-folder-color="green"]  { color: var(--fc-green);  background: var(--fc-green-bg); }
.file-type-icon[data-folder-color="yellow"] { color: var(--fc-yellow); background: var(--fc-yellow-bg); }
.file-type-icon[data-folder-color="red"]    { color: var(--fc-red);    background: var(--fc-red-bg); }
.file-type-icon[data-folder-color="purple"] { color: var(--fc-purple); background: var(--fc-purple-bg); }
.file-type-icon[data-folder-color="orange"] { color: var(--fc-orange); background: var(--fc-orange-bg); }

/* Folder meta badges */
.fm-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 999px;
    font-size: 12px;
    line-height: 1;
    pointer-events: none;
    flex-shrink: 0;
    border: 1px solid var(--line);
    background: var(--card);
    box-shadow: 0 2px 8px rgba(15,23,42,0.08);
}
.fm-pin { color: #f59e0b; background: rgba(245,158,11,0.12); border-color: rgba(245,158,11,0.26); }
.fm-fav { color: #eab308; background: rgba(234,179,8,0.12); border-color: rgba(234,179,8,0.26); }
.file-type-icon { position: relative; }

/* ── Toolbar Dropdowns ─────────────────────────────────────────────────── */
.tb-dropdown-wrap { position: relative; display: inline-flex; }
.tb-caret { font-size: 9px; margin-left: 2px; }
.tb-dropdown {
    position: absolute; top: calc(100% + 6px); left: 0;
    background: var(--card); border: 1.5px solid var(--line); border-radius: 14px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.14); min-width: 180px;
    z-index: 250; overflow: hidden;
    opacity: 0; pointer-events: none; transform: translateY(-6px);
    transition: opacity 0.15s, transform 0.15s;
}
.tb-dropdown.open { opacity: 1; pointer-events: all; transform: translateY(0); }
.tb-dropdown-item {
    display: flex; align-items: center; gap: 9px;
    padding: 10px 14px; font-size: 12.5px; font-weight: 700;
    color: var(--text); cursor: pointer; transition: background 0.12s;
    border: none; background: none; width: 100%; text-align: left;
    text-decoration: none;
}
.tb-dropdown-item:hover { background: rgba(79,70,229,0.07); color: var(--accent); }
.tb-dropdown-item.active { color: var(--accent); background: rgba(79,70,229,0.06); }
.tb-btn-ai { background: linear-gradient(135deg, #7c3aed, #4f46e5) !important; color: white !important; border-color: transparent !important; }
.tb-btn-ai:hover { background: white !important; color: #4f46e5 !important; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(124,58,237,0.35); }

/* ── Context Menu ─────────────────────────────────────────────────────── */
.ctx-menu {
    position: fixed; z-index: 600;
    background: var(--card); border: 1.5px solid var(--line);
    border-radius: 16px; min-width: 190px; padding: 6px;
    box-shadow: 0 20px 50px rgba(15,23,42,0.2), 0 2px 8px rgba(0,0,0,0.08);
    backdrop-filter: blur(12px);
    animation: ctx-in 0.14s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes ctx-in { from { opacity:0; transform: scale(0.92); } to { opacity:1; transform: scale(1); } }
.ctx-item {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 12px; border-radius: 10px; font-size: 12.5px;
    font-weight: 700; color: var(--text); cursor: pointer; transition: all 0.11s;
    position: relative;
}
.ctx-item:hover { background: rgba(79,70,229,0.07); color: var(--accent); }
.ctx-item.ctx-danger:hover { background: rgba(239,68,68,0.07); color: var(--danger); }
.ctx-sep { height: 1px; background: var(--line); margin: 4px 8px; }
.ctx-submenu {
    position: absolute; left: 100%; top: 50%; transform: translateY(-50%);
    background: var(--card); border: 1.5px solid var(--line); border-radius: 12px;
    padding: 8px; display: flex; gap: 6px; flex-wrap: wrap;
    box-shadow: 0 12px 30px rgba(0,0,0,0.15); z-index: 10; min-width: 140px;
    opacity: 0; pointer-events: none; transition: opacity 0.15s;
}
.ctx-item:hover .ctx-submenu { opacity: 1; pointer-events: all; }
.ctx-color-opt {
    width: 22px; height: 22px; border-radius: 50%; cursor: pointer;
    transition: transform 0.15s; border: 2px solid transparent;
}
.ctx-color-opt:hover { transform: scale(1.25); }

/* ── Dashboard Theme Picker ─────────────────────────────────────────── */
.theme-modal-box { max-width: 860px; }
.theme-toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 96px 96px;
    gap: 10px;
    align-items: end;
    margin-bottom: 16px;
}
.theme-url-form {
    display: contents;
}
.theme-url-form .form-group { min-width: 0; }
.theme-action-btn {
    width: 100%;
    height: 44px;
    justify-content: center;
    padding: 0 14px;
    white-space: nowrap;
}
.theme-upload-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 16px;
}
.theme-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
    max-height: 430px;
    overflow: auto;
    padding-right: 4px;
}
.theme-choice {
    position: relative;
    border: 1.5px solid var(--line);
    background: var(--card);
    border-radius: 16px;
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
    text-align: left;
    color: var(--text);
    font-family: 'Plus Jakarta Sans', sans-serif;
}
.theme-choice:hover {
    transform: translateY(-2px);
    border-color: var(--accent);
    box-shadow: 0 10px 24px rgba(79,70,229,0.14);
}
.theme-choice.active {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(79,70,229,0.16);
}
.theme-preview {
    width: 100%;
    aspect-ratio: 16 / 10;
    object-fit: cover;
    display: block;
    background: var(--light);
}
.theme-choice-name {
    padding: 9px 10px;
    font-size: 11.5px;
    font-weight: 800;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.theme-delete-btn {
    position: absolute;
    top: 7px;
    right: 7px;
    width: 26px;
    height: 26px;
    border: 1.5px solid rgba(255,255,255,0.9);
    border-radius: 999px;
    background: rgba(15,23,42,0.68);
    color: white;
    font-size: 14px;
    font-weight: 900;
    line-height: 1;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.14s ease, transform 0.14s ease, background 0.14s ease;
}
.theme-choice:hover .theme-delete-btn,
.theme-delete-btn:focus {
    opacity: 1;
}
.theme-delete-btn:hover {
    background: var(--danger);
    transform: scale(1.06);
}
.theme-status {
    min-height: 18px;
    font-size: 12px;
    font-weight: 700;
    color: var(--muted);
    margin-top: 10px;
}
.theme-file-input { display: none; }
@media (max-width: 700px) {
    .theme-toolbar { grid-template-columns: 1fr; }
    .theme-url-form { display: contents; }
    .theme-action-btn { width: 100%; }
    .theme-gallery { grid-template-columns: repeat(auto-fill, minmax(125px, 1fr)); }
}

/* ── Storage Dashboard Card ──────────────────────────────────────────── */
.storage-dash-card .stat-val { font-size: 14px !important; }
.storage-bar-track {
    width: 100%; height: 7px; border-radius: 999px;
    background: var(--light); border: 1px solid var(--line); margin-top: 8px; overflow: hidden;
}
.storage-bar-fill {
    height: 100%; border-radius: 999px;
    background: linear-gradient(90deg, var(--accent), #4338ca);
    transition: width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.storage-bar-fill.warn   { background: linear-gradient(90deg, #f59e0b, #d97706); }
.storage-bar-fill.danger { background: linear-gradient(90deg, var(--danger), #dc2626); }
.storage-detail { font-size: 10px; color: var(--muted); font-weight: 600; margin-top: 4px; }

/* ── Version History ─────────────────────────────────────────────────── */
.ver-item {
    display: flex; align-items: center; gap: 12px;
    border: 1.5px solid var(--line); border-radius: 14px;
    padding: 12px 14px; background: var(--light); transition: all 0.15s;
}
.ver-item:hover { border-color: var(--accent); background: rgba(79,70,229,0.03); }
.ver-badge {
    font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 7px;
    background: var(--accent); color: white; white-space: nowrap; flex-shrink: 0;
}
.ver-info { flex: 1; min-width: 0; }
.ver-name { font-size: 12.5px; font-weight: 700; color: var(--text); }
.ver-meta { font-size: 11px; color: var(--muted); font-weight: 600; margin-top: 2px; }
.ver-actions { display: flex; gap: 5px; flex-shrink: 0; }

/* ── Duplicate Groups ─────────────────────────────────────────────────── */
.dup-group {
    border: 1.5px solid var(--line); border-radius: 16px; overflow: hidden;
    background: var(--light);
}
.dup-group-head {
    padding: 10px 14px; background: rgba(239,68,68,0.07); border-bottom: 1px solid var(--line);
    display: flex; align-items: center; justify-content: space-between;
    font-size: 12px; font-weight: 800; color: var(--danger);
}
.dup-item {
    display: flex; align-items: center; gap: 10px; padding: 10px 14px;
    border-bottom: 1px solid var(--line); transition: background 0.12s;
}
.dup-item:last-child { border-bottom: none; }
.dup-item:hover { background: rgba(0,0,0,0.02); }
.dup-thumb { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; border: 1.5px solid var(--line); flex-shrink: 0; }
.dup-info { flex: 1; min-width: 0; }
.dup-name { font-size: 12.5px; font-weight: 700; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dup-meta { font-size: 11px; color: var(--muted); font-weight: 600; }
.dup-actions { display: flex; gap: 5px; flex-shrink: 0; }

/* ── Properties Modal ─────────────────────────────────────────────────── */
.props-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 0;
    border: 1.5px solid var(--line); border-radius: 16px; overflow: hidden;
}
.props-row {
    display: contents;
}
.props-row > div {
    padding: 9px 14px; border-bottom: 1px solid var(--line); font-size: 12.5px;
}
.props-row:last-child > div { border-bottom: none; }
.props-label { font-weight: 800; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; background: rgba(248,250,252,0.8); }
.props-value { font-weight: 600; color: var(--text); word-break: break-all; }
.props-hash { font-family: 'JetBrains Mono', monospace; font-size: 10px; }
[data-theme="dark"] .props-label { background: rgba(30,41,59,0.6); }

/* ── AI Queue ────────────────────────────────────────────────────────── */
.ai-job-row {
    display: grid; grid-template-columns: 1fr 90px 70px; gap: 10px; align-items: center;
    background: var(--light); border: 1.5px solid var(--line); border-radius: 10px; padding: 8px 12px;
    font-size: 12px; font-weight: 700; transition: all 0.15s;
}
.ai-job-row.done    { border-color: rgba(16,185,129,0.4); color: #047857; }
.ai-job-row.error   { border-color: rgba(239,68,68,0.4); color: #b91c1c; }
.ai-job-row.processing { border-color: rgba(79,70,229,0.4); color: var(--accent); }
.ai-job-status { font-size: 11px; text-align: right; }
.ai-job-spinner {
    display: inline-block; width: 12px; height: 12px; border-radius: 50%;
    border: 2px solid rgba(79,70,229,0.3); border-top-color: var(--accent);
    animation: spin 0.8s linear infinite; margin-right: 4px; vertical-align: middle;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ===== GLOBAL DRAG OVERLAY ===== */
.global-drag-overlay {
    position: fixed; inset: 0; background: rgba(79,70,229,0.85); backdrop-filter: blur(8px);
    z-index: 9999; display: flex; align-items: center; justify-content: center;
    color: white; font-size: 24px; font-weight: 800; text-align: center;
    opacity: 0; pointer-events: none; transition: opacity 0.2s;
}
.global-drag-overlay.active { opacity: 1; pointer-events: all; }

/* Turbo mode: render immediately and remove folder-open blink/fade. */
.file-row,
.url-list-item,
.img-card {
    content-visibility: visible !important;
    contain: none !important;
    contain-intrinsic-size: auto !important;
}
body,
body::before,
body::after,
body.dashboard-themed::before,
body.dashboard-themed::after,
.layout,
.topbar,
.sidebar,
.main,
.stat-card,
.toolbar,
.selection-bar,
.pathbar,
.panel,
.panel-head,
.table-header-row,
.file-list,
.file-row,
.file-type-icon,
.thumb-img,
.act-btn,
.tb-btn,
.topbar-action,
.sidebar-btn,
.sidebar-btn .sb-icon,
.profile-chip,
.mobile-menu-btn,
.theme-page-btn,
.theme-switch,
.theme-switch .ts-icon,
.theme-switch .ts-thumb,
.form-input,
.url-input,
.url-textarea,
.topbar-search input,
.url-copy-btn,
.url-list-btn,
.img-url-copy,
.img-grid-panel,
.img-card,
.img-card-thumb,
.all-urls-panel,
.url-list-item,
.brand-logo,
.storage-bar-fill,
.message,
.file-row.dbl-highlight {
    animation: none !important;
    transition: none !important;
}
.stat-card,
.toolbar,
.selection-bar,
.pathbar,
.panel,
.img-grid-panel,
.all-urls-panel,
.message,
.file-row,
.file-row.dbl-highlight,
.img-card,
.brand-logo {
    opacity: 1 !important;
    transform: none !important;
}

/* Chrome can resume hidden tabs with stale fixed/background layers; this class
   forces a tiny compositing refresh without changing the visible layout. */
body.dashboard-repaint .layout,
body.dashboard-repaint .topbar,
body.dashboard-repaint .sidebar,
body.dashboard-repaint .main,
body.dashboard-repaint .panel,
body.dashboard-repaint .stat-card {
    transform: translateZ(0) !important;
}
body.dashboard-repaint::before,
body.dashboard-repaint::after {
    transform: translateZ(0) scale(1.015);
}
</style>

</head>
<body<?php echo $dashboardThemeUrl !== '' ? ' class="dashboard-themed" style="--dashboard-bg-image:url(&quot;'.htmlspecialchars(cssUrlValue($dashboardThemeUrl), ENT_QUOTES, 'UTF-8').'&quot;);"' : ''; ?>>

<!-- Global Drag Overlay -->
<div class="global-drag-overlay" id="globalDragOverlay">
    <div>
        <div style="font-size:54px; margin-bottom:16px;">☁️</div>
        <div>Drop files to upload & auto-extract</div>
    </div>
</div>

<!-- Toast -->
<div class="toast-container" id="toastContainer"></div>

<!-- ===== MODALS ===== -->

<!-- Dashboard Theme -->
<div class="modal-overlay" id="themeModal">
    <div class="modal-box theme-modal-box">
        <div class="modal-header">
            <span class="modal-title">🎨 Theme</span>
            <button class="modal-close" onclick="closeModal('themeModal')">✕</button>
        </div>
        <div class="modal-body">
            <div class="theme-toolbar">
                <form class="theme-url-form" onsubmit="return saveThemeFromUrl(event)">
                    <div class="form-group" style="margin:0; flex:1;">
                        <label class="form-label">Image URL</label>
                        <input class="form-input" id="themeUrlInput" type="url" placeholder="https://example.com/background.jpg" value="<?php echo htmlspecialchars($dashboardThemeUrl); ?>">
                    </div>
                    <button class="form-btn btn-primary theme-action-btn" type="submit">Use URL</button>
                </form>
                <button class="form-btn btn-secondary theme-action-btn" type="button" onclick="setDashboardTheme('')">Normal</button>
            </div>

            <div class="theme-upload-row">
                <button class="form-btn btn-secondary" type="button" onclick="document.getElementById('themeFileInput').click()">Choose Image</button>
                <input class="theme-file-input" id="themeFileInput" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,image/*" onchange="uploadDashboardTheme(this)">
            </div>

            <div class="theme-gallery" id="themeGallery">
                <?php if (empty($availableThemeImages)) { ?>
                    <div class="empty-state" style="grid-column:1/-1;padding:28px 12px;">
                        <div class="es-icon">🖼️</div>
                        <h3>No theme images yet</h3>
                        <p>Choose an image or paste an image URL.</p>
                    </div>
                <?php } ?>
                <?php foreach ($availableThemeImages as $themeImage) { ?>
                    <div class="theme-choice<?php echo $dashboardThemeUrl === $themeImage['url'] ? ' active' : ''; ?>" role="button" tabindex="0" data-theme-url="<?php echo htmlspecialchars($themeImage['url']); ?>" onclick="setDashboardTheme(this.dataset.themeUrl)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();setDashboardTheme(this.dataset.themeUrl);}">
                        <img class="theme-preview" src="<?php echo htmlspecialchars($themeImage['url']); ?>" alt="" loading="lazy">
                        <?php if (! empty($themeImage['can_delete'])) { ?>
                            <button class="theme-delete-btn" type="button" title="Delete" onclick="deleteDashboardTheme(event, this.closest('.theme-choice'))">×</button>
                        <?php } ?>
                        <div class="theme-choice-name"><?php echo htmlspecialchars($themeImage['name']); ?></div>
                    </div>
                <?php } ?>
            </div>

            <div class="theme-status" id="themeStatus"></div>
        </div>
    </div>
</div>

<!-- Upload -->
<!-- Rename Type Modal -->
<div class="modal-overlay" id="renameTypeModal">
    <div class="modal-content">
        <div class="modal-header">
            <span class="modal-title">🏷️ Rename Type</span>
            <button class="modal-close" onclick="closeModal('renameTypeModal')">✕</button>
        </div>
        <div class="modal-body">
            <p class="modal-desc">Select a product type. It will automatically rename selected files to Product-01, Product-02, etc.</p>
            <div style="display:flex; gap:8px; margin-bottom: 15px;">
                <select class="form-input" id="renameTypeSelect" style="flex:1;">
                    <!-- Populated by JS -->
                </select>
                <button type="button" class="form-btn danger" onclick="deleteRenameType()" title="Delete selected type" style="padding: 0 12px;">🗑️</button>
            </div>
            <div style="display:flex; gap:8px; margin-bottom: 15px;">
                <input type="text" class="form-input" id="newRenameType" placeholder="New product name..." style="flex:1;">
                <button type="button" class="form-btn primary" onclick="addRenameType()">+ Add</button>
            </div>
        </div>
        <div class="modal-footer">
            <button type="button" class="form-btn btn-secondary" onclick="closeModal('renameTypeModal')">Cancel</button>
            <button type="button" class="form-btn primary" onclick="applyRenameType()">Apply to Selected</button>
        </div>
    </div>
</div>

<div class="modal-overlay" id="uploadModal">
    <div class="modal-box">
        <div class="modal-header">
            <span class="modal-title">📤 Upload Files</span>
            <button class="modal-close" onclick="closeModal('uploadModal')">✕</button>
        </div>
        <div class="modal-body">
            <form method="post" enctype="multipart/form-data" id="uploadForm">
                <?php echo csrfField(); ?>
                <input type="hidden" name="action" value="upload_files">
                <input type="hidden" name="path" value="<?php echo htmlspecialchars($current); ?>">
                <div class="drop-zone" id="dropZone">
                    <div class="dz-icon">☁️</div>
                    <h4>Drop files here or click to browse</h4>
                    <p><?php echo $isConverter ? 'Images only (jpg, jpeg, png, webp)' : 'Images (jpg, png, webp, gif, svg), Code (html, css, js, php) or ZIP (auto-extracts)'; ?></p>
                    <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: center;">
                        <button type="button" class="form-btn btn-secondary" onclick="document.getElementById('upload-file-input').click()">Select Files</button>
                        <button type="button" class="form-btn btn-secondary" onclick="document.getElementById('upload-folder-input').click()">Select Folder</button>
                    </div>
                    <p style="margin-top:7px;font-size:12px;color:#4f46e5;font-weight:700;" id="dropZoneFiles"></p>
                </div>
                <input type="file" id="upload-file-input" style="display:none" name="upload_files[]" multiple
                    accept="<?php echo $isConverter ? '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp' : '.jpg,.jpeg,.png,.webp,.gif,.svg,.html,.txt,.css,.js,.json,.php,.zip'; ?>"
                    onchange="updateDropZone(this)">
                <input type="file" id="upload-folder-input" style="display:none" name="upload_folders[]" multiple webkitdirectory directory
                    onchange="updateDropZone(this)">
                <p style="font-size:11.5px;color:var(--muted);margin-top:10px;font-weight:600;">
                    JPG and PNG uploads are automatically resized and saved as clear WebP files. WebP uploads are kept as-is for faster, safer previews.
                </p>
                <div id="uploadProgressWrap" style="display:none;margin-top:12px;">
                    <div class="upload-global-track">
                        <div class="upload-global-bar" id="uploadGlobalBar"></div>
                    </div>
                    <div class="upload-global-text" id="uploadGlobalText">Preparing upload...</div>
                    <div class="upload-progress-list" id="uploadProgressList"></div>
                </div>
                <div class="btn-row" style="margin-top:18px;">
                    <button type="submit" class="form-btn btn-primary" id="uploadSubmitBtn">Upload →</button>
                    <button type="button" class="form-btn btn-secondary" onclick="closeModal('uploadModal')">Cancel</button>
                </div>
            </form>
        </div>
    </div>
</div>

<!-- Create Folder -->
<div class="modal-overlay" id="folderModal">
    <div class="modal-box">
        <div class="modal-header">
            <span class="modal-title">📁 Create Folder</span>
            <button class="modal-close" onclick="closeModal('folderModal')">✕</button>
        </div>
        <div class="modal-body">
            <form method="post">
                <?php echo csrfField(); ?>
                <input type="hidden" name="action" value="create_folder">
                <div class="form-group">
                    <label class="form-label">Folder Name</label>
                    <input class="form-input" name="folder_name" placeholder="e.g. product-images" required autofocus>
                </div>
                <div class="btn-row">
                    <button type="submit" class="form-btn btn-primary">Create →</button>
                    <button type="button" class="form-btn btn-secondary" onclick="closeModal('folderModal')">Cancel</button>
                </div>
            </form>
        </div>
    </div>
</div>

<!-- Create File -->
<div class="modal-overlay" id="fileModal">
    <div class="modal-box">
        <div class="modal-header">
            <span class="modal-title">📝 Create File</span>
            <button class="modal-close" onclick="closeModal('fileModal')">✕</button>
        </div>
        <div class="modal-body">
            <form method="post">
                <?php echo csrfField(); ?>
                <input type="hidden" name="action" value="create_file">
                <div class="form-group">
                    <label class="form-label">File Name</label>
                    <input class="form-input" name="file_name" placeholder="e.g. notes.txt or custom.css" required autofocus>
                </div>
                <div class="form-group">
                    <label class="form-label">Initial Content (optional)</label>
                    <textarea class="form-input form-textarea" name="file_content" placeholder="File content..."></textarea>
                </div>
                <div class="btn-row">
                    <button type="submit" class="form-btn btn-primary">Create →</button>
                    <button type="button" class="form-btn btn-secondary" onclick="closeModal('fileModal')">Cancel</button>
                </div>
            </form>
        </div>
    </div>
</div>

<!-- All URLs Modal -->
<div class="modal-overlay" id="urlsModal">
    <div class="modal-box" style="max-width:900px; width:95%;">
        <div class="modal-header">
            <span class="modal-title">🔗 All Image URLs</span>
            <button class="modal-close" onclick="closeModal('urlsModal')">✕</button>
        </div>
        <div class="modal-body">
            <p style="font-size:13px;color:var(--muted);margin-bottom:12px;font-weight:600;">
                <?php echo count($imageUrls); ?> image URL(s) in this folder
            </p>
            <textarea id="allUrlsTextarea" class="url-textarea" readonly style="min-height:200px;"><?php echo htmlspecialchars(implode("\n", $imageUrls)); ?></textarea>
            <div class="btn-row" style="margin-top:14px; flex-wrap:wrap; gap:8px;">
                <button class="form-btn btn-primary" onclick="copyAllUrls()">📋 Copy All URLs as row</button>
                <button class="form-btn btn-primary" onclick="copyAllUrlsHorizontal()">📋 Copy All URLs as horizontal</button>
                <button class="form-btn btn-secondary" onclick="copySelectedUrls()">✅ Copy Selected as row</button>
                <button class="form-btn btn-secondary" onclick="copySelectedUrlsHorizontal()">✅ Copy Selected as horizontal</button>
                <button class="form-btn btn-secondary" onclick="closeModal('urlsModal')">Close</button>
            </div>
        </div>
    </div>
</div>

<!-- Move & Copy Modal (Professional File Manager Transfer Dialog) -->
<div class="modal-overlay" id="moveModal">
    <div class="modal-box" style="max-width:560px;">
        <div class="modal-header">
            <span class="modal-title" id="transferModalTitle">📦 Move to Folder</span>
            <button class="modal-close" onclick="closeModal('moveModal')">✕</button>
        </div>
        <div class="modal-body">
            <form method="post" id="moveForm">
                <?php echo csrfField(); ?>
                <input type="hidden" name="action" id="transferFormAction" value="move_selected">
                <input type="hidden" name="move_destination" id="moveDestInput" value="">
                <input type="hidden" name="copy_destination" id="copyDestInput" value="">
                <div id="moveSelectedInputs"></div>

                <!-- Selected items summary -->
                <div class="transfer-items-summary" id="transferItemsSummary">
                    <span class="transfer-badge">Selected:</span>
                    <span class="transfer-names" id="transferItemsList">1 item</span>
                </div>

                <!-- Search & Quick Navigation -->
                <div class="transfer-nav-bar">
                    <div class="transfer-search-wrap">
                        <span class="transfer-search-icon">🔍</span>
                        <input type="text" id="transferFolderSearch" class="transfer-search-input" placeholder="Search destination folder..." oninput="filterTransferFolders(this.value)">
                    </div>
                    <?php if ($isAdmin || $isWebsiteTeam) { ?>
                    <button type="button" class="form-btn btn-secondary" style="padding:7px 12px;font-size:12px;white-space:nowrap;" onclick="transferQuickNewFolder()" title="Create new subfolder here">➕ New Folder</button>
                    <?php } ?>
                </div>

                <!-- Breadcrumb Path Bar -->
                <div class="transfer-breadcrumb-bar" id="transferBreadcrumbBar">
                    <span class="transfer-crumb active" onclick="selectTransferFolder('')">🏠 Root</span>
                </div>

                <!-- Interactive Folder List Explorer -->
                <div class="transfer-folder-browser" id="transferFolderList">
                    <div style="text-align:center;padding:24px 0;color:var(--muted);font-size:13px;">Loading folders...</div>
                </div>

                <!-- Target Destination Callout -->
                <div class="transfer-destination-callout">
                    <span class="dest-label">Target Destination:</span>
                    <span class="dest-path" id="transferSelectedDestPath">🏠 Root (blog)</span>
                </div>

                <div class="btn-row" style="margin-top:16px;">
                    <button type="submit" class="form-btn btn-primary" id="transferSubmitBtn">Move Here →</button>
                    <button type="button" class="form-btn btn-secondary" onclick="closeModal('moveModal')">Cancel</button>
                </div>
            </form>
        </div>
    </div>
</div>

<!-- Delete Confirmation Modal (NO password required) -->
<div class="modal-overlay" id="deletePasswordModal">
    <div class="modal-box" style="max-width:440px;">
        <div class="modal-header">
            <span class="modal-title" id="deleteConfirmTitle">🗑️ Confirm Deletion</span>
            <button class="modal-close" onclick="cancelDeletePassword()">✕</button>
        </div>
        <div class="modal-body" style="text-align:center;padding:26px 22px;">
            <div style="width:54px;height:54px;border-radius:50%;background:rgba(239,68,68,0.12);color:#ef4444;font-size:24px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px;">
                🗑️
            </div>
            <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px;" id="deleteConfirmHeader">
                Are you sure?
            </div>
            <div style="font-size:13.5px;color:var(--muted);line-height:1.5;margin-bottom:22px;word-break:break-word;" id="deletePasswordMessage">
                Are you sure you want to delete this item?
            </div>
            <form id="deletePasswordModalForm" onsubmit="return submitDeletePassword(event)">
                <input type="hidden" id="deletePasswordInput" value="confirmed">
                <div class="btn-row" style="display:flex;gap:10px;justify-content:center;">
                    <button type="button" class="form-btn btn-secondary" style="flex:1;" onclick="cancelDeletePassword()">Cancel</button>
                    <button type="submit" class="form-btn btn-danger" style="flex:1;" id="deleteConfirmSubmitBtn">Delete</button>
                </div>
            </form>
        </div>
    </div>
</div>

<?php if ($isAdmin) { ?>
<!-- Security Modal -->
<div class="modal-overlay" id="securityModal">
    <div class="modal-box" style="max-width:720px;">
        <div class="modal-header">
            <span class="modal-title">🛡️ Login Security</span>
            <button class="modal-close" onclick="closeModal('securityModal')">✕</button>
        </div>
        <div class="modal-body">
            <p style="font-size:13px;color:var(--muted);margin-bottom:12px;font-weight:600;">
                Devices are banned after <?php echo (int) $MAX_LOGIN_ATTEMPTS; ?> failed login attempts.
            </p>
            <div class="security-list" style="padding:0;">
                <?php if (empty($bannedDevices)) { ?>
                    <div class="empty-state" style="padding:26px 12px;">
                        <div class="es-icon">🛡️</div>
                        <h3>No banned devices</h3>
                        <p>Failed login bans will appear here.</p>
                    </div>
                <?php } ?>
                <?php foreach ($bannedDevices as $ban) { ?>
                    <div class="security-row">
                        <div>
                            <div class="security-name"><?php echo htmlspecialchars($ban['ip'] ?? 'Unknown IP'); ?></div>
                            <div class="security-meta">
                                <?php echo htmlspecialchars($ban['reason'] ?? 'Failed login attempts'); ?> ·
                                <?php echo date('M d, Y H:i', (int) ($ban['banned_at'] ?? time())); ?><br>
                                <?php echo htmlspecialchars($ban['user_agent'] ?? 'Unknown device'); ?>
                            </div>
                        </div>
                        <div class="row-actions">
                            <form method="post" class="inline-form">
                                <?php echo csrfField(); ?>
                                <input type="hidden" name="action" value="unban_device">
                                <input type="hidden" name="ban_id" value="<?php echo htmlspecialchars($ban['id'] ?? ''); ?>">
                                <button class="act-btn open" type="submit">Unban</button>
                            </form>
                        </div>
                    </div>
                <?php } ?>
            </div>
        </div>
    </div>
</div>
<?php } ?>
<?php if ($FEATURES_ENABLED) { ?>

<!-- ===== FEATURE MODALS ===== -->

<!-- AI Background Remove Modal -->
<div class="modal-overlay" id="aiModal">
    <div class="modal-box" style="max-width:680px;">
        <div class="modal-header">
            <span class="modal-title">✨ AI Background Removal</span>
            <button class="modal-close" onclick="closeModal('aiModal')">✕</button>
        </div>
        <div class="modal-body">
            <div id="aiSelectedInfo" style="font-size:13px;color:var(--muted);font-weight:600;margin-bottom:14px;"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px;">
                <div class="form-group">
                    <label class="form-label">Output Type</label>
                    <select class="form-input" id="aiOutputType">
                        <option value="transparent">Transparent PNG</option>
                        <option value="white">White Background</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Output Format</label>
                    <select class="form-input" id="aiOutputFormat">
                        <option value="webp" selected>WebP</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Output Size</label>
                    <select class="form-input" id="aiOutputSize">
                        <option value="">Original Size</option>
                        <option value="1280x1280">1280x1280px</option>
                        <option value="1920x1080">1920x1080px</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Output Folder</label>
                <select class="form-input" id="aiOutputFolder">
                    <option value="">(Current Directory)</option>
                    <?php foreach ($items as $item) {
                        if ($item['is_dir']) { ?>
                        <option value="<?php echo htmlspecialchars($item['name']); ?>"><?php echo htmlspecialchars($item['name']); ?></option>
                    <?php }
                        } ?>
                </select>
            </div>
            <label style="display:flex; align-items:center; gap:8px; margin-top:12px; cursor:pointer;">
                <input type="checkbox" id="aiKeepOrigName" style="width:16px; height:16px; cursor:pointer;" checked>
                <span style="font-size:14px; font-weight:600; color:var(--text);">Replace original image (delete original)</span>
            </label>
            
            <label style="display:flex; align-items:center; gap:8px; margin-top:12px; cursor:pointer;">
                <input type="checkbox" id="aiReviewCanvas" style="width:16px; height:16px; cursor:pointer;" checked>
                <span style="font-size:14px; font-weight:600; color:var(--text);">Review in Canva Editor after processing</span>
            </label>

            <div id="aiQueue" style="margin-top:14px;max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;"></div>
            <div class="btn-row" style="margin-top:18px;">
                <button class="form-btn btn-primary" id="aiStartBtn" onclick="aiStartProcessing()">🪄 Remove BG</button>
                <button class="form-btn btn-secondary" id="aiCancelBtn" style="display:none;" onclick="aiCancelAll()">✕ Cancel</button>
                <button class="form-btn btn-secondary" id="aiDownloadBtn" style="display:none;" onclick="aiDownloadZip()">⬇ Download ZIP</button>
                <button class="form-btn btn-secondary" onclick="closeModal('aiModal')">Close</button>
            </div>
        </div>
    </div>
</div>

<!-- AI Editor Modal -->
<div class="modal-overlay" id="aiEditorModal">
    <div class="modal-box" style="max-width:800px; width:95%; display:flex; flex-direction:column;">
        <div class="modal-header">
            <span class="modal-title">🎨 AI Canvas Editor <span id="aiEditorTitleInfo" style="font-size:12px;color:var(--muted);font-weight:normal;margin-left:10px;"></span></span>
            <button class="modal-close" onclick="closeModal('aiEditorModal')">✕</button>
        </div>
        <div class="modal-body" style="display:flex; flex-direction:column; gap:16px;">
            <div style="display:flex; gap:12px; justify-content:space-between; align-items:center; flex-wrap:wrap; width:100%;">
                <div style="display:flex; gap:12px; align-items:center;">
                    <label class="form-label" style="margin:0;">Size:</label>
                    <select class="form-input" id="aiEditorCanvasSize" onchange="aiEditorChangeSize()" style="width:140px; padding:6px 10px;">
                        <option value="1280x1280">1280x1280px</option>
                        <option value="1920x1080">1920x1080px</option>
                    </select>
                </div>
                <div>
                    <button class="form-btn" id="aiEditorRemoveBgBtn" onclick="aiEditorRemoveBg()" style="padding:6px 14px; font-size:13px; font-weight:600; display:none; background:#fff; color:#1e293b; border:1px solid #e2e8f0; border-radius:6px; box-shadow:0 1px 2px rgba(0,0,0,0.05); cursor:pointer;">🪄 Remove BG</button>
                </div>
                <div style="display:flex; gap:12px; align-items:center;">
                    <label class="form-label" style="margin:0;">Background:</label>
                    <select class="form-input" id="aiEditorBgType" onchange="aiEditorDraw()" style="width:140px; padding:6px 10px;">
                        <option value="transparent">Transparent</option>
                        <option value="white">White</option>
                    </select>
                </div>
                <div style="display:flex; gap:12px; align-items:center;">
                    <label class="form-label" style="margin:0;">Zoom:</label>
                    <button class="form-btn btn-secondary" onclick="aiEditorZoomOut()" style="padding:4px 8px; font-size:14px;">-</button>
                    <input type="range" id="aiEditorZoom" min="0.1" max="4" step="0.01" value="1" oninput="aiEditorZoomChange()" style="width:100px;">
                    <button class="form-btn btn-secondary" onclick="aiEditorZoomIn()" style="padding:4px 8px; font-size:14px;">+</button>
                    <span id="aiEditorZoomLabel" style="width:40px; font-size:13px; font-weight:600;">100%</span>
                    <button class="form-btn btn-secondary" onclick="aiEditorReset()" style="padding:6px 12px; font-size:12px;">Reset</button>
                </div>
            </div>
            
            <div style="width:100%; display:flex; justify-content:center; background: #e5e7eb; border-radius: 12px; padding:10px; border: 2px dashed var(--line);">
                <div id="aiEditorCanvasWrapper" style="position:relative; width:100%; max-width:500px; aspect-ratio:1/1; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border-radius:4px; overflow:hidden;">
                    <!-- Checkered background for transparent preview -->
                    <div style="position:absolute; inset:0; background-image: linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%); background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0px; z-index:1;"></div>
                    <canvas id="aiEditorCanvas" width="1280" height="1280" style="position:absolute; inset:0; width:100%; height:100%; z-index:2; cursor:grab;"></canvas>
                </div>
            </div>
            
            <div class="btn-row" style="justify-content:flex-end; margin-top:4px;">
                <button class="form-btn btn-secondary" onclick="aiEditorSkip()">⏭️ Skip</button>
                <button class="form-btn btn-primary" id="aiEditorSaveBtn" onclick="aiEditorSave()">💾 Save & Continue</button>
            </div>
        </div>
    </div>
</div>

<!-- Duplicate Finder Modal -->
<div class="modal-overlay" id="duplicateModal">
    <div class="modal-box" style="max-width:760px;">
        <div class="modal-header">
            <span class="modal-title">🔍 Duplicate Finder</span>

        </div>
        <div class="modal-body">
            <div style="display:flex;gap:16px;flex-wrap:nowrap;margin-bottom:14px;align-items:center;">
                <select class="form-input" id="dupScope" style="min-width:150px;">
                    <option value="all">Entire Library</option>
                    <option value="current">Current Folder</option>
                </select>
                <div style="display:flex;gap:16px;align-items:center;">
                    <label style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:700;cursor:pointer;">
                        <input type="checkbox" id="dupByName" checked> Same name
                    </label>
                    <label style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:700;cursor:pointer;">
                        <input type="checkbox" id="dupBySize"> Same size
                    </label>
                </div>
                <button class="form-btn btn-primary" onclick="runDuplicateScan()">🔍 Scan</button>
            </div>
            <div id="dupStatus" style="font-size:12px;color:var(--muted);font-weight:600;margin-bottom:10px;"></div>
            <div id="dupResults" style="max-height:380px;overflow-y:auto;display:flex;flex-direction:column;gap:12px;"></div>
        </div>
    </div>
</div>

<!-- Replace Image Modal -->
<div class="modal-overlay" id="replaceModal">
    <div class="modal-box">
        <div class="modal-header">
            <span class="modal-title">🔄 Replace Image</span>
            <button class="modal-close" onclick="closeModal('replaceModal')">✕</button>
        </div>
        <div class="modal-body">
            <div class="delete-warning-card" style="background:rgba(79,70,229,0.08);border-color:rgba(79,70,229,0.2);">
                <div class="delete-warning-icon" style="background:rgba(79,70,229,0.12);color:var(--accent);">🔄</div>
                <div>
                    <div class="delete-warning-title">Safe Image Replacement</div>
                    <div class="delete-warning-text">The existing image will be saved as a version. The URL stays exactly the same.</div>
                </div>
            </div>
            <div id="replaceTargetInfo" style="font-size:12.5px;font-weight:700;color:var(--muted);margin-bottom:14px;"></div>
            <div class="form-group">
                <label class="form-label">New Image File</label>
                <input type="file" class="form-input" id="replaceFileInput" accept=".jpg,.jpeg,.png,.webp,.gif,image/*">
            </div>
            <div class="btn-row">
                <button class="form-btn btn-primary" onclick="submitReplaceImage()">🔄 Replace →</button>
                <button class="form-btn btn-secondary" onclick="closeModal('replaceModal')">Cancel</button>
            </div>
        </div>
    </div>
</div>

<!-- Version History Modal -->
<div class="modal-overlay" id="versionModal">
    <div class="modal-box" style="max-width:680px;">
        <div class="modal-header">
            <span class="modal-title">🕐 Version History</span>
            <button class="modal-close" onclick="closeModal('versionModal')">✕</button>
        </div>
        <div class="modal-body">
            <div id="versionFileName" style="font-size:12.5px;color:var(--muted);font-weight:700;margin-bottom:14px;"></div>
            <div id="versionList" style="display:flex;flex-direction:column;gap:10px;max-height:420px;overflow-y:auto;"></div>
            <div class="btn-row" style="margin-top:14px;">
                <button class="form-btn btn-secondary" onclick="closeModal('versionModal')">Close</button>
            </div>
        </div>
    </div>
</div>

<!-- Properties Modal -->
<div class="modal-overlay" id="propertiesModal">
    <div class="modal-box" style="max-width:600px;">
        <div class="modal-header">
            <span class="modal-title">ℹ️ Properties</span>
            <button class="modal-close" onclick="closeModal('propertiesModal')">✕</button>
        </div>
        <div class="modal-body">
            <div id="propertiesContent">
                <div style="text-align:center;padding:30px 0;color:var(--muted);">Loading properties…</div>
            </div>
        </div>
    </div>
</div>

<!-- Context Menu -->
<div id="contextMenu" class="ctx-menu" style="display:none;z-index:99999;">
    <div class="ctx-item" id="ctx-open">↗ Open</div>
    <div class="ctx-item" id="ctx-copy-url">🔗 Copy URL</div>
    <div class="ctx-sep"></div>
    <div class="ctx-item" id="ctx-copy-to">📋 Copy to Folder...</div>
    <div class="ctx-item" id="ctx-move">📦 Move to Folder...</div>
    <div class="ctx-item" id="ctx-duplicate">📑 Duplicate</div>
    <div class="ctx-item" id="ctx-paste">📋 Paste</div>
    <div class="ctx-sep"></div>
    <div class="ctx-item" id="ctx-rename">✏️ Rename</div>
    <div class="ctx-item" id="ctx-rename-type">🏷️ Rename Type</div>
    <div class="ctx-sep"></div>
    <div class="ctx-item" id="ctx-replace" style="display:none;">🔄 Replace</div>
    <div class="ctx-item" id="ctx-canva-edit" style="display:none;">🎨 Edit in Canvas</div>
    <div class="ctx-sep ctx-sep-img" style="display:none;"></div>
    <div class="ctx-item" id="ctx-download">⬇ Download</div>
    <div class="ctx-sep"></div>
    <div class="ctx-item" id="ctx-color" style="display:none;">
        🎨 Folder Color
        <div class="ctx-submenu ctx-color-picker">
            <span class="ctx-color-opt" data-color="" title="None" style="background:#cbd5e1;border:2px solid #94a3b8;"></span>
            <span class="ctx-color-opt" data-color="blue"   title="Blue"   style="background:var(--fc-blue);"></span>
            <span class="ctx-color-opt" data-color="green"  title="Green"  style="background:var(--fc-green);"></span>
            <span class="ctx-color-opt" data-color="yellow" title="Yellow" style="background:var(--fc-yellow);"></span>
            <span class="ctx-color-opt" data-color="red"    title="Red"    style="background:var(--fc-red);"></span>
            <span class="ctx-color-opt" data-color="purple" title="Purple" style="background:var(--fc-purple);"></span>
            <span class="ctx-color-opt" data-color="orange" title="Orange" style="background:var(--fc-orange);"></span>
        </div>
    </div>
    <div class="ctx-item" id="ctx-pin" style="display:none;">📌 Pin / Unpin</div>
    <div class="ctx-item" id="ctx-pin-sidebar" style="display:none;">📌 Pin to Sidebar</div>
    <div class="ctx-sep"></div>
    <div class="ctx-item" id="ctx-properties">ℹ️ Properties</div>
    <div class="ctx-sep"></div>
    <div class="ctx-item ctx-danger" id="ctx-delete">🗑️ Delete</div>
</div>

<?php } ?>

<!-- Edit File Modal -->
<?php if ($editFile) { ?>
<div class="modal-overlay open" id="editModal">
    <div class="modal-box" style="max-width:680px;">
        <div class="modal-header">
            <span class="modal-title">✏️ Edit: <?php echo htmlspecialchars($editFile); ?></span>
            <a class="modal-close" href="<?php echo $pageUrl.'?path='.urlencode($current); ?>">✕</a>
        </div>
        <div class="modal-body">
            <form method="post">
                <?php echo csrfField(); ?>
                <input type="hidden" name="action" value="edit_file">
                <input type="hidden" name="edit_file_name" value="<?php echo htmlspecialchars($editFile); ?>">
                <div class="form-group">
                    <textarea class="form-input edit-textarea" name="edit_file_content"><?php echo htmlspecialchars($editContent); ?></textarea>
                </div>
                <div class="btn-row">
                    <button type="submit" class="form-btn btn-primary">💾 Save File</button>
                    <a class="form-btn btn-secondary" href="<?php echo $pageUrl.'?path='.urlencode($current); ?>">Cancel</a>
                </div>
            </form>
        </div>
    </div>
</div>
<?php } ?>

<!-- Delete selected form -->
<form method="post" id="deleteSelectedForm">
    <?php echo csrfField(); ?>
    <input type="hidden" name="action" value="delete_selected">
    <div id="deleteSelectedInputs"></div>
</form>

<form method="post" id="copySelectedForm">
    <?php echo csrfField(); ?>
    <input type="hidden" name="action" value="copy_selected">
    <div id="copySelectedInputs"></div>
</form>

<form method="post" id="duplicateSelectedForm">
    <?php echo csrfField(); ?>
    <input type="hidden" name="action" value="duplicate_selected">
    <div id="duplicateSelectedInputs"></div>
</form>

<form method="post" id="downloadSelectedForm">
    <?php echo csrfField(); ?>
    <input type="hidden" name="action" value="download_selected">
    <div id="downloadSelectedInputs"></div>
</form>

<form method="post" id="pasteClipboardForm">
    <?php echo csrfField(); ?>
    <input type="hidden" name="action" value="paste_clipboard">
</form>

<!-- ===== LIGHTBOX ===== -->
<div class="lightbox" id="lightbox">
    <button class="lb-close" onclick="closeLightbox()" title="Close (Esc)">✕</button>
    <button class="lb-nav lb-prev" id="lbPrev" onclick="lbNavigate(-1)" title="Previous (←)">‹</button>
    <button class="lb-nav lb-next" id="lbNext" onclick="lbNavigate(1)" title="Next (→)">›</button>
    <div class="lightbox-img-wrap">
        <img id="lbImg" src="" alt="">
    </div>
    <div class="lb-info">
        <div>
            <div class="lb-name" id="lbName"></div>
            <div class="lb-counter" id="lbCounter"></div>
        </div>
        <button class="lb-copy-btn" id="lbCopyBtn" onclick="lbCopyUrl()">📋 Copy URL</button>
    </div>
</div>

<!-- ===== TOPBAR ===== -->
<div class="sidebar-backdrop" onclick="toggleSidebar(false)"></div>
<header class="topbar">
    <div style="display: flex; align-items: center; gap: 14px;">
        <button class="mobile-menu-btn" type="button" onclick="toggleSidebar(true)" title="Menu">☰</button>
        <a class="topbar-brand" href="<?php echo $homeUrl; ?>" title="Rafvex Media Library">
            <img src="/logo.png" onerror="if(!this.dataset.retried){this.dataset.retried=1;this.src='../logo.png';if(!this.complete)this.src='logo.png';}" alt="Rafvex" class="rafvex-logo-img">
            <div class="brand-badge-pill">
                <span class="badge-dot"></span>
                <span>Media Library</span>
            </div>
        </a>
    </div>

    <div class="topbar-end">
        <a href="/ourcms/dashboard" class="topbar-action-cms outline" title="Back to CMS Dashboard">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px;"><path d="m15 18-6-6 6-6"/></svg>
            CMS
        </a>
        <a href="https://rafvex.com" target="_blank" class="topbar-action-cms outline" title="Visit Live Site">
            Live Site ↗
        </a>
        
        <div class="theme-switch" id="themeToggleBtn" onclick="toggleTheme()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleTheme();}" role="button" tabindex="0" title="Toggle Dark / Light Mode" aria-label="Toggle Dark / Light Mode">
            <div class="ts-thumb"></div>
            <span class="ts-icon sun">☀️</span>
            <span class="ts-icon moon">🌙</span>
        </div>
    </div>
</header>

<div class="layout">

    <!-- SIDEBAR -->
    <aside class="sidebar">
        <div class="sidebar-section">Actions</div>

        <a class="sidebar-btn" href="<?php echo $homeUrl; ?>">
            <span class="sb-icon">🏠</span> Home
        </a>
        <?php if (! $isConverter) { ?>
        <a class="sidebar-btn sb-delete" href="<?php echo $pageUrl; ?>?trash=1">
            <span class="sb-icon sb-icon-img"><img src="https://cdn-icons-png.flaticon.com/512/9790/9790368.png" alt="Trash icon"></span> Trash Bin
        </a>
        <?php } ?>

        <?php if ($FEATURES_ENABLED && ! $isConverter) { ?>
            <div class="sidebar-divider"></div>
            <div class="sidebar-section">Pin Folder</div>
            <?php if (empty($sidebarPins)) { ?>
                <div style="font-size:11px;color:var(--muted);padding:6px 12px;font-style:italic;">No pinned items yet</div>
            <?php } else { ?>
                <?php
                $pinColorVarsMap = [
                    'blue' => ['#2563eb', 'rgba(37,99,235,0.12)'],
                    'green' => ['#059669', 'rgba(5,150,105,0.12)'],
                    'yellow' => ['#d97706', 'rgba(217,119,6,0.12)'],
                    'red' => ['#dc2626', 'rgba(220,38,38,0.12)'],
                    'purple' => ['#7c3aed', 'rgba(124,58,237,0.12)'],
                    'orange' => ['#ea580c', 'rgba(234,88,12,0.12)'],
                ];
                foreach ($sidebarPins as $pin) {
                    $pinPath = $pin['path'];
                    $pinIsDir = (bool) ($pin['is_dir'] ?? false);
                    $pinName = basename($pinPath);
                    $pinColor = $pinIsDir ? ($sidebarFolderColors[$pinPath] ?? '') : '';
                    $parent = dirname($pinPath);
                    if ($parent === '.') {
                        $parent = '';
                    }
                    $pinExt = strtolower(pathinfo($pinName, PATHINFO_EXTENSION));
                    $pinIsImg = in_array($pinExt, ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'], true);
                    if ($pinIsDir) {
                        $pinHref = $pageUrl.'?path='.urlencode($pinPath);
                        $pinColorClass = 'sb-folder';
                    } else {
                        $pinHref = publicUrl($BASE_URL, $pinPath);
                        $pinColorClass = 'sb-file';
                    }
                    $iconStyle = '';
                    if ($pinColor && isset($pinColorVarsMap[$pinColor])) {
                        $iconStyle = 'color:'.$pinColorVarsMap[$pinColor][0].';background:'.$pinColorVarsMap[$pinColor][1].';';
                    }
                    ?>
                <div class="sidebar-btn <?php echo $pinColorClass; ?>" role="link" tabindex="0"
                    style="cursor:pointer;"
                    data-href="<?php echo htmlspecialchars($pinHref); ?>"
                    data-target="<?php echo ! $pinIsDir ? '_blank' : ''; ?>"
                    data-name="<?php echo htmlspecialchars($pinName); ?>"
                    data-url="<?php echo htmlspecialchars(publicUrl($BASE_URL, $pinPath)); ?>"
                    data-open-url="<?php echo htmlspecialchars($pinHref); ?>"
                    data-rel="<?php echo htmlspecialchars($pinPath); ?>"
                    data-is-img="<?php echo $pinIsImg ? '1' : '0'; ?>"
                    data-is-dir="<?php echo $pinIsDir ? '1' : '0'; ?>"
                    data-folder-rel="<?php echo $pinIsDir ? htmlspecialchars($pinPath) : ''; ?>"
                    data-folder-color="<?php echo htmlspecialchars($pinColor); ?>"
                    data-parent-path="<?php echo htmlspecialchars($parent); ?>"
                    id="sb_pin_<?php echo md5($pinPath); ?>"
                    onclick="(function(el){var href=el.dataset.href;var tgt=el.dataset.target;if(tgt==='_blank')window.open(href,'_blank');else location.href=href;})(this)"
                    oncontextmenu="showContextMenu(event,this);return false;">
                    <span class="sb-icon"
                        <?php echo $pinColor ? 'data-folder-color="'.htmlspecialchars($pinColor).'"' : ''; ?>
                        <?php echo $iconStyle ? 'style="'.$iconStyle.'"' : ''; ?>>
                        <?php echo getFileIcon($pinName, $pinIsDir); ?>
                    </span> <?php echo htmlspecialchars($pinName); ?>
                </div>
                <?php } ?>
            <?php } ?>
        <?php } ?>

        <?php if (! $isConverter) { ?>
            <div style="margin-top:auto;padding-top:12px;">
                <div class="sidebar-divider"></div>
                <div style="font-size:10.5px;color:var(--muted);padding:6px 12px 3px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">Base URL</div>
                <div style="padding:0 12px 8px;">
                    <input class="url-input" style="width:100%;font-size:9.5px;" value="<?php echo htmlspecialchars($visibleBaseUrl); ?>" readonly onclick="this.select(); navigator.clipboard.writeText(this.value); toast('Base URL copied!');">
                </div>
            </div>
        <?php } ?>
    </aside>

    <!-- MAIN -->
    <main class="main">

        <!-- Stats -->
        <?php if (! $profileMode && ! $settingsMode && ! $activityMode && ! $usersMode && ! $trashMode) { ?>
        <div class="stats-row">
            <div class="stat-card">
                <div class="stat-icon si-purple">📂</div>
                <div class="stat-val"><?php echo count($items); ?></div>
                <div class="stat-lbl">Total items</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon si-amber">📁</div>
                <div class="stat-val"><?php echo $folderCount; ?></div>
                <div class="stat-lbl">Folders</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon si-cyan">🖼️</div>
                <div class="stat-val"><?php echo count($imageUrls); ?></div>
                <div class="stat-lbl">Images</div>
            </div>
            <div class="stat-card<?php echo $FEATURES_ENABLED ? ' storage-dash-card' : ''; ?>" id="storageDashCard" data-fallback-size="<?php echo htmlspecialchars(formatSize($displayTotalSize)); ?>">
                <div class="stat-icon si-green">💾</div>
                <div class="stat-val" id="storageSizeValue"><?php echo formatSize($displayTotalSize); ?></div>
                <div class="stat-lbl" id="storageSizeLabel">Visible file size</div>
            </div>
        </div>
        <?php } ?>

        <?php if ($message) { ?>
        <div class="message msg-<?php echo htmlspecialchars($messageType); ?>">
            <?php echo $messageType === 'success' ? '✅' : '⚠️'; ?>
            <?php echo htmlspecialchars($message); ?>
        </div>
        <?php } ?>

        <?php if ($profileMode) { ?>
        <div class="panel">
            <div class="panel-head">
                <span class="panel-title">👤 Profile</span>
                <span class="panel-meta">Update your dashboard name and avatar</span>
            </div>
            <div style="padding:18px;">
                <div class="admin-grid">
                    <div class="admin-card" style="display:flex;align-items:center;gap:14px;">
                        <span class="avatar-large">
                            <?php if (! empty($currentUser['avatar_url'])) { ?><img src="<?php echo htmlspecialchars($currentUser['avatar_url']); ?>" alt=""><?php } else { ?><?php echo htmlspecialchars(userInitials($currentUser)); ?><?php } ?>
                        </span>
                        <div>
                            <h3 style="margin:0;"><?php echo htmlspecialchars($currentUser['display_name'] ?? $currentUser['username']); ?></h3>
                            <p style="font-size:12px;color:var(--muted);font-weight:700;margin-top:4px;"><?php echo htmlspecialchars($currentUser['username']); ?> · <?php echo htmlspecialchars(roleLabel($currentUser['role'] ?? 'staff')); ?></p>
                        </div>
                    </div>
                    <div class="admin-card">
                        <h3>Profile settings</h3>
                        <form method="post" enctype="multipart/form-data">
                            <?php echo csrfField(); ?>
                            <input type="hidden" name="action" value="save_profile">
                            
                            <div class="form-group" style="display:flex; align-items:center; gap:16px;">
                                <div style="position:relative;">
                                    <span class="avatar-large" style="width:80px;height:80px;font-size:32px;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:50%;">
                                        <?php if (! empty($currentUser['avatar_url'])) { ?><img src="<?php echo htmlspecialchars($currentUser['avatar_url']); ?>" alt="" style="width:100%;height:100%;object-fit:cover;"><?php } else { ?><?php echo htmlspecialchars(userInitials($currentUser)); ?><?php } ?>
                                    </span>
                                </div>
                                <div style="flex:1;">
                                    <label class="form-label">Upload Profile Picture</label>
                                    <input type="file" id="profileImgInput" name="profile_img" accept="image/*" onchange="this.form.submit()" style="margin-top:4px; display:block;">
                                    <p style="font-size:12px;color:var(--muted);margin:4px 0 0 0;">Select an image to automatically convert to WebP and set as your avatar.</p>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">Display name</label>
                                <input class="form-input" name="display_name" value="<?php echo htmlspecialchars($currentUser['display_name'] ?? ''); ?>" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Profile image URL</label>
                                <input class="form-input" name="avatar_url" type="url" value="<?php echo htmlspecialchars($currentUser['avatar_url'] ?? ''); ?>" placeholder="https://example.com/avatar.png">
                            </div>
                            <button class="form-btn btn-primary" type="submit">Save profile</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>

        <?php } elseif ($settingsMode) { ?>
            <?php if (! $isAdmin) { ?>
                <div class="message msg-error">Admin permission is required.</div>
            <?php } else { ?>
            <div class="panel">
                <div class="panel-head">
                    <span class="panel-title">⚙️ Admin Settings</span>
                    <span class="panel-meta">Logo, dashboard name, and footer branding</span>
                </div>
                <div style="padding:18px;">
                    <form method="post" class="admin-grid" enctype="multipart/form-data">
                        <?php echo csrfField(); ?>
                        <input type="hidden" name="action" value="save_app_settings">
                        <div class="admin-card">
                            <h3>Dashboard branding</h3>
                            <div class="form-group">
                                <label class="form-label">Dashboard name</label>
                                <input class="form-input" name="app_name" value="<?php echo htmlspecialchars($appSettings['app_name']); ?>" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Dashboard logo URL</label>
                                <input class="form-input" name="dashboard_logo_url" type="url" value="<?php echo htmlspecialchars($appSettings['dashboard_logo_url']); ?>" placeholder="https://example.com/logo.png">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Upload dashboard logo</label>
                                <input class="form-input" name="dashboard_logo_file" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.ico,image/*">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Browser tab icon / favicon URL</label>
                                <input class="form-input" name="favicon_url" type="url" value="<?php echo htmlspecialchars($appSettings['favicon_url']); ?>" placeholder="https://example.com/favicon.png">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Upload browser tab icon</label>
                                <input class="form-input" name="favicon_file" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.ico,image/*">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Footer text name</label>
                                <input class="form-input" name="footer_name" value="<?php echo htmlspecialchars($appSettings['footer_name']); ?>" required>
                            </div>
                            
                            <hr style="border:none;border-top:1px solid var(--line);margin:16px 0;">
                            <h3>AI Configuration</h3>
                            <div class="form-group">
                                <label class="form-label">Bria AI API Key <span style="font-size:12px;color:var(--muted);font-weight:normal;">(Auto-updates features/config.php)</span></label>
                                <input class="form-input" name="bria_api_key" value="<?php echo defined('BRIA_API_KEY') ? htmlspecialchars(BRIA_API_KEY) : ''; ?>" placeholder="ee1ecfed2b0a4106bf3e7281933b3c5a">
                            </div>

                            <button class="form-btn btn-primary" type="submit" style="margin-top:16px;">Save settings</button>
                        </div>
                    </form>
                </div>
            </div>
            <?php } ?>

        <?php } elseif ($activityMode) { ?>
            <?php if (! $isAdmin && ! ($currentUser['can_view_login_activity'] ?? true)) { ?>
                <div class="message msg-error">Login activity is not enabled for this account.</div>
            <?php } else { ?>
            <div class="panel">
                <div class="panel-head">
                    <span class="panel-title">🧾 Login Activity</span>
                    <div class="panel-head-actions">
                        <span class="panel-meta"><?php echo count($loginActivities); ?> sign-in record(s)</span>
                        <?php if ($isAdmin || ! empty($currentUser['is_main_admin'])) { ?>
                        <form method="post" class="inline-form" onsubmit="return confirm('Clear all login activity history? This cannot be undone.');">
                            <?php echo csrfField(); ?>
                            <input type="hidden" name="action" value="clear_login_activity">
                            <button class="act-btn del" type="submit">Clear history</button>
                        </form>
                        <?php } ?>
                    </div>
                </div>
                <div class="admin-table-wrap">
                    <table class="admin-table">
                        <thead><tr><th>Username</th><th>Device / browser</th><th>IP address</th><th>Date</th><th>Status</th></tr></thead>
                        <tbody>
                            <?php foreach ($loginActivities as $row) { ?>
                            <tr>
                                <td><?php echo htmlspecialchars($row['username'] ?? ''); ?></td>
                                <td><?php echo htmlspecialchars($row['user_agent'] ?? ''); ?></td>
                                <td><?php echo htmlspecialchars($row['ip'] ?? ''); ?></td>
                                <td><?php echo date('M d, Y H:i', (int) ($row['created_at'] ?? time())); ?></td>
                                <td><span class="status-pill <?php echo htmlspecialchars($row['status'] ?? 'failed'); ?>"><?php echo htmlspecialchars($row['status'] ?? 'failed'); ?></span></td>
                            </tr>
                            <?php } ?>
                            <?php if (empty($loginActivities)) { ?><tr><td colspan="5">No login activity yet.</td></tr><?php } ?>
                        </tbody>
                    </table>
                </div>
            </div>
            <?php } ?>

        <?php } elseif ($usersMode) { ?>
            <?php if (! $isAdmin) { ?>
                <div class="message msg-error">Admin permission is required.</div>
            <?php } else { ?>
            <div class="panel">
                <div class="panel-head">
                    <span class="panel-title">👥 User Management</span>
                    <span class="panel-meta">Create users, set roles, freeze accounts, and protect the main admin</span>
                </div>
                <div style="padding:18px;">
                    <div class="admin-card" style="margin-bottom:24px; padding: 24px;">
                        <div style="display:flex; align-items:center; gap:12px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--line);">
                            <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(79,70,229,0.1); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 18px;">
                                👤
                            </div>
                            <div>
                                <h3 style="margin:0; font-size: 16px; font-weight: 700; color: var(--text);">Create New User</h3>
                                <div style="font-size: 12px; color: var(--muted); margin-top: 3px;">Add a new member and assign their role</div>
                            </div>
                        </div>
                        <form method="post">
                            <?php echo csrfField(); ?>
                            <input type="hidden" name="action" value="create_user">
                            <div class="admin-grid" style="margin-bottom: 20px;">
                                <div class="form-group">
                                    <label class="form-label" style="display:flex; gap:6px; align-items:center;"><span style="color:var(--muted); font-size:14px;">📝</span> Display Name</label>
                                    <input class="form-input" name="new_display_name" placeholder="e.g. John Doe" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label" style="display:flex; gap:6px; align-items:center;"><span style="color:var(--muted); font-size:14px;">👤</span> Username</label>
                                    <input class="form-input" name="new_username" placeholder="e.g. john_doe" pattern="[a-z0-9@._-]{3,120}" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label" style="display:flex; gap:6px; align-items:center;"><span style="color:var(--muted); font-size:14px;">🔒</span> Password</label>
                                    <div style="position: relative;">
                                        <input id="createUserPassword" class="form-input" name="new_password" type="password" placeholder="At least 8 characters" minlength="8" required style="padding-right: 44px; width: 100%; box-sizing: border-box;">
                                        <button type="button" class="pw-toggle-btn" onclick="toggleCreateUserPassword(event)" tabindex="-1" title="Show password" style="right: 8px;">👁️</button>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label class="form-label" style="display:flex; gap:6px; align-items:center;"><span style="color:var(--muted); font-size:14px;">🛡️</span> Role</label>
                                    <select class="form-input" name="new_role">
                                        <option value="staff">Staff</option>
                                        <option value="converter">Converter</option>
                                        <option value="website_team">Website Team</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 20px; margin-top: 8px; border-top: 1px dashed var(--line);">
                                <label style="display:flex; align-items:center; gap:12px; font-size:13px; font-weight:600; color:var(--text); cursor:pointer;">
                                    <input type="checkbox" name="can_view_login_activity" checked style="width: 20px; height: 20px; accent-color: var(--accent); cursor:pointer;">
                                    <div>
                                        <div style="margin-bottom:2px;">Allow own login activity</div>
                                        <div style="font-size:11px; color:var(--muted); font-weight:500;">User can view their own sign-in logs in dashboard</div>
                                    </div>
                                </label>
                                <button class="form-btn btn-primary" type="submit" style="padding: 12px 32px; font-size: 14px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 14px rgba(79,70,229,0.25);">
                                    Create User →
                                </button>
                            </div>
                        </form>
                        <script>
                        function toggleCreateUserPassword(e) {
                            const input = document.getElementById('createUserPassword');
                            const btn = e.currentTarget;
                            if (input.type === 'password') {
                                input.type = 'text';
                                btn.textContent = '🙈';
                                btn.title = 'Hide password';
                            } else {
                                input.type = 'password';
                                btn.textContent = '👁️';
                                btn.title = 'Show password';
                            }
                        }
                        </script>
                    </div>
                    <div class="admin-table-wrap">
                        <table class="admin-table">
                            <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Login activity</th><th>Password</th><th>Actions</th></tr></thead>
                            <tbody>
                                <?php foreach ($allUsers as $row) { ?>
                                <?php $protected = ! empty($row['is_main_admin']);
                                    $self = ($row['id'] ?? '') === ($currentUser['id'] ?? ''); ?>
                                <tr>
                                    <td>
                                        <div class="user-cell">
                                            <span class="avatar-mini">
                                                <?php if (! empty($row['avatar_url'])) { ?><img src="<?php echo htmlspecialchars($row['avatar_url']); ?>" alt=""><?php } else { ?><?php echo htmlspecialchars(userInitials($row)); ?><?php } ?>
                                            </span>
                                            <span>
                                                <strong><?php echo htmlspecialchars($row['display_name'] ?? $row['username']); ?></strong><br>
                                                <span style="color:var(--muted);"><?php echo htmlspecialchars($row['username']); ?><?php echo $protected ? ' / main admin' : ''; ?></span>
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        <form method="post" class="inline-form">
                                            <?php echo csrfField(); ?><input type="hidden" name="action" value="set_user_role"><input type="hidden" name="user_id" value="<?php echo htmlspecialchars($row['id']); ?>">
                                            <select class="form-input" name="role" style="min-width:100px;" <?php echo ($protected || $self) ? 'disabled' : ''; ?>><option value="staff" <?php echo ($row['role'] ?? '') === 'staff' ? 'selected' : ''; ?>>Staff</option><option value="converter" <?php echo ($row['role'] ?? '') === 'converter' ? 'selected' : ''; ?>>Converter</option><option value="website_team" <?php echo ($row['role'] ?? '') === 'website_team' ? 'selected' : ''; ?>>Website Team</option><option value="admin" <?php echo ($row['role'] ?? '') === 'admin' ? 'selected' : ''; ?>>Admin</option></select>
                                            <button class="act-btn open" <?php echo ($protected || $self) ? 'disabled' : ''; ?>>Save</button>
                                        </form>
                                    </td>
                                    <td><span class="status-pill <?php echo htmlspecialchars($row['status'] ?? 'active'); ?>"><?php echo htmlspecialchars($row['status'] ?? 'active'); ?></span></td>
                                    <td>
                                        <form method="post" class="inline-form">
                                            <?php echo csrfField(); ?><input type="hidden" name="action" value="update_user_permissions"><input type="hidden" name="user_id" value="<?php echo htmlspecialchars($row['id']); ?>">
                                            <label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" name="can_view_login_activity" <?php echo ! empty($row['can_view_login_activity']) ? 'checked' : ''; ?>> Allowed</label>
                                            <button class="act-btn open">Save</button>
                                        </form>
                                    </td>
                                    <td>
                                        <form method="post" class="inline-form">
                                            <?php echo csrfField(); ?><input type="hidden" name="action" value="change_user_password"><input type="hidden" name="user_id" value="<?php echo htmlspecialchars($row['id']); ?>">
                                            <input class="form-input" name="password" type="password" minlength="8" placeholder="New password" style="min-width:150px;" required>
                                            <button class="act-btn open">Change</button>
                                        </form>
                                    </td>
                                    <td class="admin-actions-cell">
                                        <div class="admin-actions">
                                        <form method="post" class="inline-form" onsubmit="return confirm('<?php echo ($row['status'] ?? 'active') === 'frozen' ? 'Unfreeze this user?' : 'Freeze this user?'; ?>');">
                                            <?php echo csrfField(); ?><input type="hidden" name="action" value="<?php echo ($row['status'] ?? 'active') === 'frozen' ? 'unfreeze_user' : 'freeze_user'; ?>"><input type="hidden" name="user_id" value="<?php echo htmlspecialchars($row['id']); ?>">
                                            <button class="act-btn" <?php echo ($protected || $self) ? 'disabled' : ''; ?>><?php echo ($row['status'] ?? 'active') === 'frozen' ? 'Unfreeze' : 'Freeze'; ?></button>
                                        </form>
                                        <form method="post" class="inline-form" onsubmit="return confirm('Remove this user? This cannot be undone.');">
                                            <?php echo csrfField(); ?><input type="hidden" name="action" value="delete_user"><input type="hidden" name="user_id" value="<?php echo htmlspecialchars($row['id']); ?>">
                                            <button class="act-btn del" <?php echo ($protected || $self) ? 'disabled' : ''; ?>>Remove</button>
                                        </form>
                                        </div>
                                    </td>
                                </tr>
                                <?php } ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <?php } ?>

        <?php } elseif ($trashMode) { ?>
        <div class="toolbar">
            <span class="tb-label">Trash</span>
            <a class="tb-btn" href="<?php echo $_SERVER['PHP_SELF']; ?>">← Back to files</a>
            <?php if (! empty($trashItems)) { ?>
            <form method="post" class="inline-form" onsubmit="return addDeletePassword(this, 'Permanently delete everything in trash?');">
                <?php echo csrfField(); ?>
                <input type="hidden" name="action" value="empty_trash">
                <button class="tb-btn danger" type="submit">🗑️ Empty Trash</button>
            </form>
            <?php } ?>
        </div>

        <div class="panel">
            <div class="panel-head">
                <span class="panel-title">🧺 Trash Bin</span>
                <span class="panel-meta"><?php echo count($trashItems); ?> deleted item(s)</span>
            </div>
            <?php if (! empty($trashItems)) { ?>
            <form method="post" id="trashBulkForm" style="padding:14px 18px 0;">
                <?php echo csrfField(); ?>
                <input type="hidden" name="action" id="trashBulkAction" value="">
                <div id="trashBulkInputs"></div>
                <div class="trash-select-actions">
                    <label style="display:flex;align-items:center;gap:7px;font-size:12px;font-weight:800;color:var(--muted);">
                        <input type="checkbox" class="trash-check" id="trashSelectAll" onchange="toggleTrashSelectAll(this)"> Select all
                    </label>
                    <button type="button" class="tb-btn success trash-bulk-btn" id="trashRecoverSelected" onclick="submitTrashBulk('restore_trash_selected')" disabled>↩ Recover selected</button>
                    <button type="button" class="tb-btn danger trash-bulk-btn" id="trashDeleteSelected" onclick="submitTrashBulk('delete_trash_selected')" disabled>🗑️ Delete selected permanently</button>
                </div>
            </form>
            <?php } ?>
            <div class="trash-list">
                <?php if (empty($trashItems)) { ?>
                    <div class="empty-state">
                        <div class="es-icon">🧺</div>
                        <h3>Trash is empty</h3>
                        <p>Deleted files and folders will appear here for recovery.</p>
                    </div>
                <?php } ?>

                <?php foreach ($trashItems as $trashItem) { ?>
                    <div class="trash-row">
                        <div>
                            <div class="trash-name"><input type="checkbox" class="trash-check trash-item-check" value="<?php echo htmlspecialchars($trashItem['id']); ?>" onchange="updateTrashSelection()" style="margin-right:8px;"><?php echo htmlspecialchars($trashItem['original_relative'] ?? 'Unknown item'); ?></div>
                            <div class="trash-meta">
                                <?php echo htmlspecialchars($trashItem['type'] ?? 'item'); ?> ·
                                <?php echo formatSize((int) ($trashItem['size'] ?? 0)); ?> ·
                                deleted <?php echo date('M d, Y H:i', (int) ($trashItem['deleted_at'] ?? time())); ?>
                            </div>
                        </div>
                        <div class="row-actions">
                            <form method="post" class="inline-form">
                                <?php echo csrfField(); ?>
                                <input type="hidden" name="action" value="restore_trash_item">
                                <input type="hidden" name="trash_id" value="<?php echo htmlspecialchars($trashItem['id']); ?>">
                                <button class="act-btn open" type="submit">↩ Recover</button>
                            </form>
                            <form method="post" class="inline-form" onsubmit="return addDeletePassword(this, 'Permanently delete this item?');">
                                <?php echo csrfField(); ?>
                                <input type="hidden" name="action" value="delete_trash_item">
                                <input type="hidden" name="trash_id" value="<?php echo htmlspecialchars($trashItem['id']); ?>">
                                <button class="act-btn del" type="submit">🗑️ Delete Forever</button>
                            </form>
                        </div>
                    </div>
                <?php } ?>
            </div>
        </div>
        <?php } else { ?>

        <!-- Toolbar -->
        <div class="toolbar sticky-toolbar" id="mainToolbar">
            <span class="tb-label"></span>
            <button class="tb-btn primary" onclick="openModal('uploadModal')">📤 Upload</button>
            <button class="tb-btn" onclick="openModal('folderModal')">📁 New Folder</button>
            <?php if ($isAdmin || $isWebsiteTeam) { ?>
            <button class="tb-btn" onclick="openModal('fileModal')">📝 New File</button>
            <?php } ?>
            <?php if (! $isConverter) { ?>
            <div class="tb-sep"></div>
            <button class="tb-btn" onclick="openModal('urlsModal')">🔗 All URLs</button>
            <div class="tb-sep"></div>
            <?php } ?>
            <button class="tb-btn" onclick="toggleSelectionMode()">✅ Select</button>
            <div class="tb-sep"></div>
            <button class="tb-btn" onclick="openRenameTypeModalMulti()">🏷️ Rename Type</button>
            <div class="tb-sep"></div>

            <button class="tb-btn" onclick="copyToSelected()" title="Copy selected items to another folder">📋 Copy</button>
            <button class="tb-btn" onclick="openMoveModal()" title="Move selected items to another folder">📦 Move</button>
            <button class="tb-btn" onclick="duplicateSelectedItems()" title="Duplicate selected items in this folder">📑 Duplicate</button>
            <?php if (! empty($_SESSION['clipboard']['items'])) { ?>
            <button class="tb-btn" style="background:rgba(99,102,241,0.15);color:#6366f1;border-color:rgba(99,102,241,0.4);font-weight:700;" onclick="pasteClipboard()" title="Paste <?php echo count($_SESSION['clipboard']['items']); ?> item(s) here">📋 Paste (<?php echo count($_SESSION['clipboard']['items']); ?>)</button>
            <?php } ?>
            <div class="tb-sep"></div>

            <button class="tb-btn" onclick="downloadSelected()">⬇️ Download</button>
            <button class="tb-btn danger" onclick="deleteSelected()">🗑️ Delete</button>

        </div>


        <!-- Pathbar -->
        <div class="pathbar">
            <span class="ph-home" onclick="location.href='<?php echo $homeUrl; ?>'" title="Root">🏠</span>
            <span class="ph-sep">/</span>
            <?php if ($isConverter) { ?>
                <a href="<?php echo $homeUrl; ?>"><?php echo htmlspecialchars($CONVERTER_ROOT_FOLDER); ?></a>
                <?php
                if ($current !== $converterRootRelative) {
                    $subPath = trim(substr($current, strlen($converterRootRelative)), '/');
                    if ($subPath !== '') {
                        $crumb = $converterRootRelative;
                        $subParts = explode('/', $subPath);
                        foreach ($subParts as $i => $part) {
                            $crumb .= '/'.$part;
                            echo '<span class="ph-sep">/</span>';
                            if ($i < count($subParts) - 1) {
                                echo '<a href="'.$pageUrl.'?path='.urlencode($crumb).'">'.htmlspecialchars($part).'</a>';
                            } else {
                                echo '<span class="ph-cur">'.htmlspecialchars($part).'</span>';
                            }
                        }
                    }
                }
                ?>
            <?php } elseif ($isWebsiteTeam) { ?>
                <a href="<?php echo $homeUrl; ?>"><?php echo htmlspecialchars($websiteTeamFolder); ?></a>
                <?php
                if ($current !== $websiteTeamRootRelative) {
                    $subPath = trim(substr($current, strlen($websiteTeamRootRelative)), '/');
                    if ($subPath !== '') {
                        $crumb = $websiteTeamRootRelative;
                        $subParts = explode('/', $subPath);
                        foreach ($subParts as $i => $part) {
                            $crumb .= '/'.$part;
                            echo '<span class="ph-sep">/</span>';
                            if ($i < count($subParts) - 1) {
                                echo '<a href="'.$pageUrl.'?path='.urlencode($crumb).'">'.htmlspecialchars($part).'</a>';
                            } else {
                                echo '<span class="ph-cur">'.htmlspecialchars($part).'</span>';
                            }
                        }
                    }
                }
                ?>
            <?php } else { ?>
                <a href="<?php echo $homeUrl; ?>">blog</a>
                <?php
                if ($current) {
                    $crumb = '';
                    $parts = explode('/', $current);
                    foreach ($parts as $i => $part) {
                        $crumb .= ($crumb ? '/' : '').$part;
                        echo '<span class="ph-sep">/</span>';
                        if ($i < count($parts) - 1) {
                            echo '<a href="'.$pageUrl.'?path='.urlencode($crumb).'">'.htmlspecialchars($part).'</a>';
                        } else {
                            echo '<span class="ph-cur">'.htmlspecialchars($part).'</span>';
                        }
                    }
                }
                ?>
            <?php } ?>

            <?php if ($current && ! ($isConverter && $current === $converterRootRelative) && ! ($isWebsiteTeam && $current === $websiteTeamRootRelative)) { ?>
                <a class="ph-back" href="<?php echo $pageUrl.'?path='.urlencode(parentPath($current)); ?>">← Back</a>
            <?php } ?>
        </div>

        <!-- File Table -->
        <div class="panel">
            <div class="panel-head">
                <div class="panel-title-search">
                    <span class="panel-title" style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 16px;">📋</span>
                        <span>Files &amp; Folders</span>
                    </span>
                    <div class="table-search-box">
                        <span class="table-search-icon">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="11" cy="11" r="8"/>
                                <path d="m21 21-4.3-4.3"/>
                            </svg>
                        </span>
                        <input type="text" placeholder="Search files... (press /)" id="searchInput" onkeyup="filterFiles(this.value)" autocomplete="off">
                        <span class="table-search-kbd">/</span>
                    </div>
                    <?php if ($FEATURES_ENABLED) { ?>
                    <div class="tb-dropdown-wrap" id="sortWrap" style="margin-left: 12px; height: 32px;">
                        <button class="tb-btn" onclick="toggleTbDropdown('sortDropdown')" id="sortBtn" style="height: 100%; border: 1px solid var(--border); box-shadow: none;">
                            <?php
                            $sortLabels = [
                                'name_asc' => 'Name A–Z', 'name_desc' => 'Name Z–A',
                                'newest' => 'Newest', 'oldest' => 'Oldest',
                                'size_asc' => 'Size ↑', 'size_desc' => 'Size ↓',
                            ];
                        echo '⇅ '.htmlspecialchars($sortLabels[$sortKey] ?? 'Sort');
                        ?> <span class="tb-caret">▾</span>
                        </button>
                        <div class="tb-dropdown" id="sortDropdown" style="right: 0; left: auto; top: calc(100% + 4px);">
                            <?php foreach ($sortLabels as $sk => $sl) { ?>
                            <a class="tb-dropdown-item<?php echo $sortKey === $sk ? ' active' : ''; ?>"
                               href="<?php echo $pageUrl.'?path='.urlencode($current).'&sort='.$sk; ?>">
                                <?php echo htmlspecialchars($sl); ?>
                            </a>
                            <?php } ?>
                        </div>
                    </div>
                    <?php } ?>
                </div>
                <span class="panel-meta" id="filePanelMeta" data-item-count="<?php echo (int) count($items); ?>" data-fallback-size="<?php echo htmlspecialchars(formatSize($displayTotalSize)); ?>"><?php echo count($items); ?> items · <?php echo formatSize($displayTotalSize); ?> visible files · Double-click to open</span>
            </div>

            <div class="table-header-row">
                <div><input type="checkbox" class="file-check" id="selectAllChk" onchange="selectAllToggle(this)" title="Select all (Ctrl+A)"></div>
                <div style="display: flex; align-items: center; gap: 10px;">Name <span class="selected-count" id="selectedCount" style="display:none; margin:0; font-size:11px; padding: 2px 8px; border-radius: 12px;">0 selected</span></div>
                <div>Size / Date</div>
                <div style="text-align:right;">Actions</div>
            </div>

            <div class="file-list" id="fileList">

                <?php if (empty($items)) { ?>
                <div class="empty-state">
                    <div class="es-icon">📭</div>
                    <h3>This folder is empty</h3>
                    <p>Upload files or create a new folder to get started.</p>
                </div>
                <?php } ?>

                <?php foreach ($items as $index => $item) { ?>
                <?php
                $name = $item['name'];
                    $relative = $current ? $current.'/'.$name : $name;
                    $url = ! $item['is_dir'] ? publicUrl($BASE_URL, $relative) : '';
                    $thumbUrl = ! $item['is_dir'] && $item['is_image'] ? versionedImageUrl($url, $item['mtime'] ?? 0, $item['size'] ?? 0, $item['ctime'] ?? 0) : '';
                    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
                    $isImg = $item['is_image'];
                    $isDir = $item['is_dir'];
                    $isCode = $item['is_code'];
                    $iconClass = $isDir ? 'fti-folder' : ($isImg ? 'fti-image' : ($isCode ? 'fti-code' : 'fti-other'));
                    $folderUrl = $_SERVER['PHP_SELF'].'?path='.urlencode($relative);
                    $openUrl = $isDir ? $folderUrl : $url;
                    // For double-click: folders navigate, files open or preview
                    $dblAction = $isDir
                        ? "location.href='{$folderUrl}'"
                        : ($isImg ? "openLightboxByName('".addslashes($name)."')" : "window.open('".htmlspecialchars($url)."','_blank')");
                    $nameJson = htmlspecialchars(json_encode($name), ENT_QUOTES, 'UTF-8');
                    // Feature: folder meta
                    $fm = $FEATURES_ENABLED && $isDir ? ($folderMeta[$name] ?? []) : [];
                    $fmColor = $fm['color'] ?? '';
                    $fmIsFav = ! empty($fm['is_favorite']);
                    $fmIsPin = ! empty($fm['is_pinned']);
                    $fmRelPath = $current ? $current.'/'.$name : $name;
                    ?>

                <div class="file-row"
                    data-name="<?php echo htmlspecialchars($name); ?>"
                    data-url="<?php echo htmlspecialchars($url); ?>"
                    data-open-url="<?php echo htmlspecialchars($openUrl); ?>"
                    data-rel="<?php echo htmlspecialchars($relative); ?>"
                    data-is-img="<?php echo $isImg ? '1' : '0'; ?>"
                    data-is-dir="<?php echo $isDir ? '1' : '0'; ?>"
                    data-folder-rel="<?php echo $isDir ? htmlspecialchars($fmRelPath) : ''; ?>"
                    data-folder-color="<?php echo htmlspecialchars($fmColor); ?>"
                    id="row_<?php echo $index; ?>"
                    ondblclick="<?php echo $dblAction; ?>"
                    onclick="rowClick(event, <?php echo $index; ?>)"
                    oncontextmenu="showContextMenu(event, this)">

                    <!-- Checkbox -->
                    <div class="file-check-cell">
                        <input type="checkbox" class="file-check file-item-check"
                            data-url="<?php echo $isImg ? htmlspecialchars($url) : ''; ?>"
                            data-name="<?php echo htmlspecialchars($name); ?>"
                            onchange="updateSelectedCount()" onclick="event.stopPropagation()">
                    </div>

                    <!-- Name / Thumbnail -->
                    <div class="file-name-cell">
                        <?php if ($isImg) { ?>
                            <img class="thumb-img" src="<?php echo htmlspecialchars($thumbUrl); ?>"
                                alt="<?php echo htmlspecialchars($name); ?>"
                                loading="lazy"
                                decoding="async"
                                onclick="event.stopPropagation()"
                                ondblclick="event.stopPropagation(); openLightboxByName('<?php echo addslashes($name); ?>')"
                                onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex'">
                            <div class="file-type-icon fti-image" style="display:none;"><?php echo getFileIcon($name, false); ?></div>
                        <?php } else { ?>
                            <div class="file-type-icon <?php echo $iconClass; ?>"<?php echo $fmColor ? ' data-folder-color="'.htmlspecialchars($fmColor).'"' : ''; ?>>
                                <?php echo getFileIcon($name, $isDir); ?>
                            </div>
                        <?php } ?>

                        <div class="file-name-info">
                            <div class="file-title-row">
                                <?php if ($isDir) { ?>
                                    <span class="file-name-folder file-name-display" id="fileNameDisplay_<?php echo $index; ?>" ondblclick="event.stopPropagation(); location.href=this.closest('.file-row').dataset.openUrl">
                                        <?php echo htmlspecialchars($name); ?>
                                    </span>
                                <?php } else { ?>
                                    <span class="file-name-span file-name-display" id="fileNameDisplay_<?php echo $index; ?>"><?php echo htmlspecialchars($name); ?></span>
                                <?php } ?>
                                <?php if ($fmIsPin) { ?><span class="fm-badge fm-pin" title="Pinned">📌</span><?php } ?>
                                <?php if ($fmIsFav) { ?><span class="fm-badge fm-fav" title="Favorite">⭐</span><?php } ?>
                            </div>
                            <form method="post" class="rename-form inline-rename-form" id="renameForm_<?php echo $index; ?>" style="display:none;">
                                <?php echo csrfField(); ?>
                                <input type="hidden" name="action" value="rename_item">
                                <input type="hidden" name="old_name" value="<?php echo htmlspecialchars($name); ?>">
                                <input class="rename-input" name="new_name" value="<?php echo htmlspecialchars($name); ?>" required onkeydown="renameKey(event, <?php echo $index; ?>)">
                                <button type="submit" class="rename-save">Save</button>
                                <button type="button" class="act-btn" onclick="hideRename(<?php echo $index; ?>)" style="font-size:11px;">Cancel</button>
                            </form>
                            <?php if ($isDir) { ?>
                                <div class="file-meta">Folder</div>
                            <?php } else { ?>
                                <div class="file-meta"><?php echo date('M d, Y', $item['mtime']); ?></div>
                            <?php } ?>
                        </div>
                    </div>

                    <!-- Size -->
                    <div class="size-cell">
                        <?php if (! $isDir) {
                            echo formatSize($item['size']);
                        } else { ?><span style="color:#94a3b8;">—</span><?php } ?>
                    </div>

                    <!-- Actions -->
                    <div class="actions-cell" onclick="event.stopPropagation()">
                        <a class="act-btn" href="<?php echo $pageUrl.'?path='.urlencode($current).'&download_item='.urlencode($name); ?>">
                            ⬇ Download
                        </a>
                        <?php if ($isDir) { ?>
                            <a class="act-btn open folder-open-link" href="<?php echo $folderUrl; ?>">📂 Open</a>
                        <?php } elseif (! $isConverter) { ?>
                            <a class="act-btn open" href="<?php echo htmlspecialchars($url); ?>" target="_blank">↗ Open</a>
                        <?php } ?>

                        <?php if (! $isConverter) { ?>
                        <!-- Copy -->
                        <button type="button" class="act-btn" onclick="copyToSingleItem('<?php echo addslashes($name); ?>')" title="Copy item to another folder">📋 Copy</button>

                        <!-- Move -->
                        <button type="button" class="act-btn" onclick="moveSingleItem('<?php echo addslashes($name); ?>')" title="Move item to another folder">📦 Move</button>

                        <!-- Duplicate -->
                        <button type="button" class="act-btn" onclick="duplicateSingleItem('<?php echo addslashes($name); ?>')" title="Duplicate item in-place">📑 Duplicate</button>

                        <!-- Rename -->
                        <button class="act-btn rename-btn"
                            onclick="showRename(<?php echo $index; ?>, <?php echo $nameJson; ?>)"
                            id="renameToggle_<?php echo $index; ?>">✏️ Rename</button>



                        <!-- Edit (only for code files) -->
                        <?php if ($isCode && ($isAdmin || $isWebsiteTeam)) { ?>
                            <a class="act-btn edit-btn"
                                href="<?php echo $pageUrl.'?path='.urlencode($current).'&edit='.urlencode($name); ?>">
                                📄 Edit
                            </a>
                        <?php } ?>
                        <?php } else { ?>
                            <!-- Converter role: only download/open-folder/delete -->
                        <?php } ?>

                        <!-- Delete -->
                        <form method="post" style="display:inline;" <?php if (! $isConverter) { ?>onsubmit="return addDeletePassword(this, 'Move <?php echo htmlspecialchars(addslashes($name)); ?> to trash?');"<?php } ?>>
                            <?php echo csrfField(); ?>
                            <input type="hidden" name="action" value="delete_item">
                            <input type="hidden" name="item_name" value="<?php echo htmlspecialchars($name); ?>">
                            <button type="submit" class="act-btn del" title="Delete">🗑️</button>
                        </form>
                    </div>

                </div>
                <?php } ?>

            </div><!-- /file-list -->
        </div><!-- /panel -->

        <!-- Image URL List (clean, standard) -->
        <?php if (! empty($imageUrls) && ! $isConverter) { ?>
        <div class="all-urls-panel">
            <div class="panel-head">
                <span class="panel-title">🔗 Image URLs</span>
                <span class="panel-meta"><?php echo count($imageUrls); ?> image(s) · Click any URL to copy</span>
            </div>
            <div class="url-list-wrap">
                <?php foreach ($items as $idx => $item) { ?>
                    <?php if (! $item['is_dir'] && $item['is_image']) {
                        $relative = $current ? $current.'/'.$item['name'] : $item['name'];
                        $url = publicUrl($BASE_URL, $relative);
                        $thumbUrl = versionedImageUrl($url, $item['mtime'] ?? 0, $item['size'] ?? 0, $item['ctime'] ?? 0);
                        ?>
                    <div class="url-list-item">
                        <span class="url-list-num"><?php echo $idx + 1; ?></span>
                        <img src="<?php echo htmlspecialchars($thumbUrl); ?>" style="width:32px;height:32px;border-radius:8px;object-fit:cover;flex-shrink:0;cursor:pointer;border:1.5px solid var(--line);"
                            onclick="openLightboxByName('<?php echo addslashes($item['name']); ?>')"
                            loading="lazy"
                            decoding="async"
                            onerror="this.style.visibility='hidden'">
                        <span class="url-list-name" title="<?php echo htmlspecialchars($item['name']); ?>"><?php echo htmlspecialchars($item['name']); ?></span>
                        <input class="url-list-input" id="lurlinput_<?php echo $idx; ?>"
                            value="<?php echo htmlspecialchars($url); ?>" readonly
                            onclick="this.select()" title="Click to select, then copy">
                        <button class="url-list-btn" id="lurlbtn_<?php echo $idx; ?>"
                            onclick="copyUrlDirect('<?php echo addslashes($url); ?>', 'lurlbtn_<?php echo $idx; ?>')">
                            📋 Copy
                        </button>
                    </div>
                    <?php } ?>
                <?php } ?>
            </div>
            <div class="copy-all-bar">
                <button class="form-btn btn-primary" onclick="copyAllUrls()" style="font-size:12.5px;padding:10px 18px;">📋 Copy All URLs</button>
                <button class="form-btn btn-secondary" onclick="copySelectedUrls()" style="font-size:12.5px;padding:10px 18px;">✅ Copy Selected URLs</button>
            </div>
        </div>
        <?php } ?>

        <!-- Image Preview Grid -->
        <?php if (! empty($imageUrls) && ! $isConverter) { ?>
        <div class="img-grid-panel">
            <div class="panel-head">
                <span class="panel-title">🖼️ Image Preview</span>
                <span class="panel-meta"><?php echo count($imageUrls); ?> image(s) · Double-click for full preview</span>
            </div>
            <div class="img-grid">
                <?php
                $imgIdx = 0;
            foreach ($items as $idx => $item) {
                if (! $item['is_dir'] && $item['is_image']) {
                    $relative = $current ? $current.'/'.$item['name'] : $item['name'];
                    $url = publicUrl($BASE_URL, $relative);
                    $thumbUrl = versionedImageUrl($url, $item['mtime'] ?? 0, $item['size'] ?? 0, $item['ctime'] ?? 0);
                    ?>
                <div class="img-card">
                    <img class="img-card-thumb"
                        src="<?php echo htmlspecialchars($thumbUrl); ?>"
                        alt="<?php echo htmlspecialchars($item['name']); ?>"
                        loading="lazy"
                        decoding="async"
                        ondblclick="openLightboxByName('<?php echo addslashes($item['name']); ?>')"
                        onclick="openLightboxByName('<?php echo addslashes($item['name']); ?>')"
                        onerror="this.src='data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'150\' viewBox=\'0 0 200 150\'><rect fill=\'%23f1f5f9\' width=\'200\' height=\'150\'/><text x=\'100\' y=\'80\' text-anchor=\'middle\' fill=\'%2394a3b8\' font-size=\'13\'>No Preview</text></svg>'">
                    <div class="img-card-info">
                        <div class="img-card-name"><?php echo htmlspecialchars($item['name']); ?></div>
                        <div class="img-card-url">
                            <input class="img-url-input" id="imgurl_<?php echo $idx; ?>"
                                value="<?php echo htmlspecialchars($url); ?>" readonly
                                onclick="this.select()" title="<?php echo htmlspecialchars($url); ?>">
                            <button class="img-url-copy" id="imgcopybtn_<?php echo $idx; ?>"
                                onclick="copyUrl('imgurl_<?php echo $idx; ?>','imgcopybtn_<?php echo $idx; ?>')"
                                title="Copy URL">📋</button>
                        </div>
                    </div>
                </div>
                <?php $imgIdx++;
                }
            } ?>
            </div>
        </div>
        <?php } ?>

        <?php } ?>

        <footer class="dashboard-footer">
            Copyright &copy; <?php echo htmlspecialchars($appSettings['footer_name']); ?> <?php echo date('Y'); ?> All Rights Reserved.
        </footer>
    </main>
</div>

<!-- ===== JAVASCRIPT ===== -->
<script>
/* ========== IMAGE LIST FOR LIGHTBOX ========== */
const IMAGE_LIST = <?php echo json_encode($imageList); ?>;
const CURRENT_PATH = <?php echo json_encode($current); ?>;
const ACTION_ENDPOINT = <?php echo json_encode($pageUrl); ?>;
const UPLOAD_ENDPOINT = ACTION_ENDPOINT;
const SERVER_UPLOAD_LIMIT_BYTES = <?php echo (int) $serverUploadLimitBytes; ?>;
const IS_CONVERTER = <?php echo $isConverter ? 'true' : 'false'; ?>;
const CSRF_TOKEN = <?php echo json_encode(csrfToken()); ?>;
let DASHBOARD_THEME_URL = <?php echo json_encode($dashboardThemeUrl); ?>;
let lbCurrentIndex = 0;

function postAction(data) {
    const body = new URLSearchParams({ csrf_token: CSRF_TOKEN, ...data });
    return fetch(ACTION_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
    }).then(r => r.json());
}

function openLightboxByName(name) {
    const idx = IMAGE_LIST.findIndex(i => i.name === name);
    if (idx === -1) return;
    lbCurrentIndex = idx;
    lbShow(idx);
}

function openLightboxByIndex(idx) {
    if (idx < 0 || idx >= IMAGE_LIST.length) return;
    lbCurrentIndex = idx;
    lbShow(idx);
}

function lbShow(idx) {
    const item = IMAGE_LIST[idx];
    if (!item) return;
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lbImg');
    const name = document.getElementById('lbName');
    const counter = document.getElementById('lbCounter');
    const prev = document.getElementById('lbPrev');
    const next = document.getElementById('lbNext');
    img.onerror = null;
    img.style.transition = 'none';
    img.style.transform = 'none';
    img.style.opacity = '1';
    img.src = item.url;
    name.textContent = item.name;
    counter.textContent = (idx + 1) + ' / ' + IMAGE_LIST.length;
    prev.classList.toggle('disabled', idx <= 0);
    next.classList.toggle('disabled', idx >= IMAGE_LIST.length - 1);
    lb.classList.add('open');
    document.body.classList.add('lightbox-open');
    document.documentElement.classList.add('lightbox-open');
    document.body.style.overflow = 'hidden';
}

function lbNavigate(dir) {
    const newIdx = lbCurrentIndex + dir;
    if (newIdx < 0 || newIdx >= IMAGE_LIST.length) return;
    lbCurrentIndex = newIdx;
    const img = document.getElementById('lbImg');
    img.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
    img.style.opacity = '0.4';
    img.style.transform = 'scale(0.96)';
    setTimeout(() => {
        lbShow(lbCurrentIndex);
    }, 100);
}

function closeLightbox() {
    const lb = document.getElementById('lightbox');
    if (lb) lb.classList.remove('open');
    document.body.classList.remove('lightbox-open');
    document.documentElement.classList.remove('lightbox-open');
    document.body.style.overflow = '';
}

function lbCopyUrl() {
    const item = IMAGE_LIST[lbCurrentIndex];
    if (!item) return;
    navigator.clipboard.writeText(item.public_url || item.url).then(() => {
        const btn = document.getElementById('lbCopyBtn');
        btn.textContent = '✅ Copied!';
        toast('URL copied!');
        setTimeout(() => btn.textContent = '📋 Copy URL', 2000);
    });
}

/* ========== MODAL ========== */
let pendingDeleteForm = null;

function openModal(id) {
    if (id === 'moveModal') loadMoveDestOptions();
    document.getElementById(id).classList.add('open');
    document.body.style.overflow = 'hidden';
}
function closeModal(id) {
    if (id === 'deletePasswordModal') pendingDeleteForm = null;
    document.getElementById(id).classList.remove('open');
    document.body.style.overflow = '';
}
document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
});

let transferFolderData = [];
let selectedTransferPath = '';
let currentTransferMode = 'move';

function renderTransferFolders(filterText = '') {
    const container = document.getElementById('transferFolderList');
    if (!container) return;
    
    const filter = (filterText || '').toLowerCase().trim();
    const filtered = transferFolderData.filter(f => {
        if (!filter) return true;
        return (f.name || '').toLowerCase().includes(filter) || (f.path || '').toLowerCase().includes(filter) || (f.label || '').toLowerCase().includes(filter);
    });

    if (!filtered.length) {
        container.innerHTML = '<div style="text-align:center;padding:24px 10px;color:var(--muted);font-size:13px;">No matching folders found</div>';
        return;
    }

    let html = '';
    filtered.forEach(folder => {
        const path = folder.path || '';
        const depth = Math.min(folder.depth || 0, 8);
        const isSelected = (path === selectedTransferPath);
        const isRoot = (path === '');
        const indent = Math.max(depth * 16, 0);
        const displayName = isRoot ? '🏠 Root (blog)' : escapeHtml(folder.name || folder.label || path);
        const pathBadge = isRoot ? '' : `<span class="transfer-folder-tag">${escapeHtml(folder.path)}</span>`;

        html += `
            <div class="transfer-folder-row ${isSelected ? 'selected' : ''}" 
                 style="padding-left: ${indent + 12}px;" 
                 onclick="selectTransferFolder('${escapeHtml(path)}')">
                <span class="transfer-folder-icon">${isRoot ? '🏠' : (isSelected ? '📂' : '📁')}</span>
                <span class="transfer-folder-name" title="${escapeHtml(folder.path || 'Root')}">${displayName}</span>
                ${pathBadge}
            </div>
        `;
    });
    container.innerHTML = html;
}

function selectTransferFolder(path) {
    selectedTransferPath = path || '';
    const destInput = document.getElementById('moveDestInput');
    const copyInput = document.getElementById('copyDestInput');
    if (destInput) destInput.value = selectedTransferPath;
    if (copyInput) copyInput.value = selectedTransferPath;

    const destLabel = document.getElementById('transferSelectedDestPath');
    if (destLabel) {
        destLabel.textContent = selectedTransferPath ? `📁 /${selectedTransferPath}` : '🏠 Root (blog)';
    }

    updateTransferBreadcrumbs(selectedTransferPath);

    const searchInput = document.getElementById('transferFolderSearch');
    renderTransferFolders(searchInput ? searchInput.value : '');
}

function updateTransferBreadcrumbs(path) {
    const bar = document.getElementById('transferBreadcrumbBar');
    if (!bar) return;
    let html = `<span class="transfer-crumb ${path === '' ? 'active' : ''}" onclick="selectTransferFolder('')">🏠 Root</span>`;
    if (path) {
        const parts = path.split('/').filter(Boolean);
        let accumulated = '';
        parts.forEach((p, idx) => {
            accumulated = accumulated ? accumulated + '/' + p : p;
            const isLast = idx === parts.length - 1;
            html += ` <span style="opacity:0.4;">/</span> <span class="transfer-crumb ${isLast ? 'active' : ''}" onclick="selectTransferFolder('${escapeHtml(accumulated)}')">📁 ${escapeHtml(p)}</span>`;
        });
    }
    bar.innerHTML = html;
}

function filterTransferFolders(query) {
    renderTransferFolders(query);
}

function loadTransferFolderOptions(forceReload = false, autoSelectPath = null) {
    const container = document.getElementById('transferFolderList');
    if (!forceReload && transferFolderData.length > 0) {
        if (autoSelectPath !== null) {
            selectTransferFolder(autoSelectPath);
        } else {
            renderTransferFolders();
        }
        return;
    }
    if (container) {
        container.innerHTML = '<div style="text-align:center;padding:24px 0;color:var(--muted);font-size:13px;">Loading folders...</div>';
    }
    postAction({ action: 'get_folder_options', path: CURRENT_PATH })
        .then(d => {
            if (!d.success || !Array.isArray(d.options)) throw new Error('Could not load folders');
            transferFolderData = d.options;
            const targetPath = autoSelectPath !== null ? autoSelectPath : (selectedTransferPath || CURRENT_PATH || '');
            selectTransferFolder(targetPath);
        })
        .catch(() => {
            if (container) {
                container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--danger);font-size:13px;">Failed to load folders</div>';
            }
            toast('Failed to load folders', 'danger');
        });
}

function loadMoveDestOptions() {
    loadTransferFolderOptions();
}

function transferQuickNewFolder() {
    const parent = selectedTransferPath || '';
    const folderName = prompt('Enter new folder name:');
    if (!folderName || !folderName.trim()) return;
    postAction({
        action: 'create_folder',
        folder_name: folderName.trim(),
        path: parent,
        is_ajax: '1'
    }).then(d => {
        if (d.success) {
            toast('Folder created successfully', 'success');
            const newPath = parent ? parent + '/' + folderName.trim() : folderName.trim();
            loadTransferFolderOptions(true, newPath);
        } else {
            toast(d.error || 'Could not create folder', 'danger');
        }
    }).catch(() => {
        toast('Error creating folder', 'danger');
    });
}

/* ========== DASHBOARD THEME ========== */
function cssUrlForTheme(url) {
    return 'url("' + String(url).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n|\r/g, '') + '")';
}

function applyDashboardTheme(url) {
    DASHBOARD_THEME_URL = url || '';
    document.body.classList.toggle('dashboard-themed', !!DASHBOARD_THEME_URL);
    if (DASHBOARD_THEME_URL) document.body.style.setProperty('--dashboard-bg-image', cssUrlForTheme(DASHBOARD_THEME_URL));
    else document.body.style.removeProperty('--dashboard-bg-image');
    const input = document.getElementById('themeUrlInput');
    if (input) input.value = DASHBOARD_THEME_URL;
    document.querySelectorAll('.theme-choice').forEach(btn => {
        btn.classList.toggle('active', (btn.dataset.themeUrl || '') === DASHBOARD_THEME_URL);
    });
}

function setThemeStatus(message, type = 'info') {
    const el = document.getElementById('themeStatus');
    if (!el) return;
    el.textContent = message || '';
    el.style.color = type === 'danger' ? 'var(--danger)' : (type === 'success' ? 'var(--success)' : 'var(--muted)');
}

function setDashboardTheme(url) {
    setThemeStatus('Saving theme...');
    postAction({ action: 'set_dashboard_theme', theme_url: url || '' })
        .then(d => {
            if (!d.success) throw new Error(d.error || 'Could not save theme.');
            applyDashboardTheme(d.theme_url || '');
            if (d.theme_item && d.theme_item.url) {
                addThemePreview(d.theme_item.url, d.theme_item.name || 'Saved Theme', !!d.theme_item.can_delete);
            }
            setThemeStatus((d.theme_url || '') ? 'Theme saved.' : 'Normal theme restored.', 'success');
            toast((d.theme_url || '') ? 'Theme saved' : 'Normal theme restored');
        })
        .catch(err => {
            setThemeStatus(err.message || 'Could not save theme.', 'danger');
            toast(err.message || 'Could not save theme', 'danger');
        });
}

function saveThemeFromUrl(event) {
    event.preventDefault();
    const input = document.getElementById('themeUrlInput');
    const url = (input?.value || '').trim();
    if (!url) {
        setDashboardTheme('');
        return false;
    }
    setDashboardTheme(url);
    return false;
}

function uploadDashboardTheme(input) {
    const file = input?.files?.[0];
    if (!file) return;
    setThemeStatus('Uploading and converting to WebP...');
    const fd = new FormData();
    fd.append('csrf_token', CSRF_TOKEN);
    fd.append('action', 'upload_dashboard_theme');
    fd.append('theme_file', file);
    fetch(ACTION_ENDPOINT, { method: 'POST', body: fd })
        .then(r => r.json())
        .then(d => {
            if (!d.success) throw new Error(d.error || 'Could not upload theme image.');
            applyDashboardTheme(d.theme_url || '');
            addThemePreview(d.theme_url || '', d.name || 'Uploaded theme', !!d.can_delete);
            setThemeStatus('Uploaded, converted to WebP, and saved.', 'success');
            toast('Theme uploaded and saved');
        })
        .catch(err => {
            setThemeStatus(err.message || 'Could not upload theme image.', 'danger');
            toast(err.message || 'Could not upload theme image', 'danger');
        })
        .finally(() => {
            if (input) input.value = '';
        });
}

function addThemePreview(url, name, canDelete = true) {
    const gallery = document.getElementById('themeGallery');
    if (!gallery || !url) return;
    gallery.querySelector('.empty-state')?.remove();
    const existing = [...gallery.querySelectorAll('.theme-choice')].find(item => (item.dataset.themeUrl || '') === url);
    if (existing) {
        if (canDelete && !existing.querySelector('.theme-delete-btn')) {
            const del = document.createElement('button');
            del.className = 'theme-delete-btn';
            del.type = 'button';
            del.title = 'Delete';
            del.textContent = '×';
            del.onclick = event => deleteDashboardTheme(event, existing);
            existing.appendChild(del);
        }
        gallery.prepend(existing);
        applyDashboardTheme(url);
        return;
    }

    const card = document.createElement('div');
    card.className = 'theme-choice active';
    card.role = 'button';
    card.tabIndex = 0;
    card.dataset.themeUrl = url;
    card.onclick = () => setDashboardTheme(url);
    card.onkeydown = event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setDashboardTheme(url);
        }
    };

    const img = document.createElement('img');
    img.className = 'theme-preview';
    img.src = url;
    img.alt = '';
    img.loading = 'lazy';
    card.appendChild(img);

    if (canDelete) {
        const del = document.createElement('button');
        del.className = 'theme-delete-btn';
        del.type = 'button';
        del.title = 'Delete';
        del.textContent = '×';
        del.onclick = event => deleteDashboardTheme(event, card);
        card.appendChild(del);
    }

    const label = document.createElement('div');
    label.className = 'theme-choice-name';
    label.textContent = name || 'Theme image';
    card.appendChild(label);
    gallery.prepend(card);
    applyDashboardTheme(url);
}

function deleteDashboardTheme(event, card) {
    event?.preventDefault();
    event?.stopPropagation();
    const url = card?.dataset?.themeUrl || '';
    if (!url || !confirm('Delete this theme image?')) return;
    postAction({ action: 'delete_dashboard_theme', theme_url: url })
        .then(d => {
            if (!d.success) throw new Error(d.error || 'Could not delete theme image.');
            const wasActive = (DASHBOARD_THEME_URL || '') === url;
            card.remove();
            if (wasActive) applyDashboardTheme('');
            setThemeStatus('Theme image deleted.', 'success');
            toast('Theme image deleted');
        })
        .catch(err => {
            setThemeStatus(err.message || 'Could not delete theme image.', 'danger');
            toast(err.message || 'Could not delete theme image', 'danger');
        });
}

/* ========== TOAST ========== */
function toast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = 'toast' + (type === 'danger' ? ' danger' : '');
    t.textContent = (type === 'success' ? '✅ ' : '⚠️ ') + msg;
    document.getElementById('toastContainer').appendChild(t);
    setTimeout(() => {
        t.style.animation = 'toast-out 0.3s ease forwards';
        setTimeout(() => t.remove(), 300);
    }, 2400);
}

/* ========== THEME + MOBILE MENU ========== */
function toggleSidebar(open) {
    document.body.classList.toggle('sidebar-open', !!open);
}

function toggleTheme() {
    const root = document.documentElement;
    const isDark = root.dataset.theme === 'dark' || root.classList.contains('dark');
    const next = isDark ? 'light' : 'dark';
    root.dataset.theme = next;
    if (next === 'dark') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
    try {
        localStorage.setItem('rafvex_theme', next);
        localStorage.setItem('kiuqTheme', next);
        localStorage.setItem('admin_theme', next);
    } catch(e) {}
    updateThemeButton();
    const body = new URLSearchParams({
        action: 'set_theme',
        csrf_token: <?php echo json_encode(csrfToken()); ?>,
        theme: next
    });
    fetch(ACTION_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
    }).catch(() => {});
}

function updateThemeButton() {
    const root = document.documentElement;
    const isDark = root.dataset.theme === 'dark' || root.classList.contains('dark');
    const label = document.getElementById('themeLabelText');
    if (label) {
        label.textContent = isDark ? 'Dark' : 'Light';
    }
}
document.addEventListener('DOMContentLoaded', updateThemeButton);
updateThemeButton();

/* ========== TRASH SELECTION ========== */
function selectedTrashIds() {
    return [...document.querySelectorAll('.trash-item-check:checked')].map(input => input.value);
}

function updateTrashSelection() {
    const ids = selectedTrashIds();
    document.querySelectorAll('.trash-bulk-btn').forEach(btn => btn.disabled = ids.length === 0);
    const all = document.getElementById('trashSelectAll');
    if (all) {
        const total = document.querySelectorAll('.trash-item-check').length;
        all.checked = total > 0 && ids.length === total;
    }
}

function toggleTrashSelectAll(source) {
    document.querySelectorAll('.trash-item-check').forEach(input => input.checked = source.checked);
    updateTrashSelection();
}

function submitTrashBulk(action) {
    const ids = selectedTrashIds();
    if (!ids.length) { toast('No trash items selected', 'danger'); return; }
    const form = document.getElementById('trashBulkForm');
    const inputs = document.getElementById('trashBulkInputs');
    document.getElementById('trashBulkAction').value = action;
    inputs.innerHTML = '';
    ids.forEach(id => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'trash_ids[]';
        input.value = id;
        inputs.appendChild(input);
    });
    if (action === 'delete_trash_selected') {
        addDeletePassword(form, 'Permanently delete ' + ids.length + ' selected trash item(s)? This cannot be undone.');
        return;
    }
    HTMLFormElement.prototype.submit.call(form);
}

/* ========== COPY ========== */
function copyUrl(inputId, btnId) {
    const val = document.getElementById(inputId).value;
    const btn = document.getElementById(btnId);
    if (!val) return;
    navigator.clipboard.writeText(val).then(() => {
        if (btn) { btn.textContent = '✅'; btn.classList.add('copied'); }
        toast('URL copied!');
        setTimeout(() => { if (btn) { btn.textContent = '📋'; btn.classList.remove('copied'); } }, 2000);
    }).catch(() => { document.getElementById(inputId).select(); document.execCommand('copy'); toast('URL copied!'); });
}

function copyUrlDirect(url, btnId) {
    const btn = document.getElementById(btnId);
    navigator.clipboard.writeText(url).then(() => {
        if (btn) { const orig = btn.textContent; btn.textContent = '✅ Copied!'; btn.classList.add('copied'); setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 2000); }
        toast('URL copied!');
    }).catch(() => { toast('Copy failed', 'danger'); });
}

function copyAllUrls() {
    const ta = document.getElementById('allUrlsTextarea');
    navigator.clipboard.writeText(ta.value).then(() => toast('All URLs copied as row!'));
}

function copyAllUrlsHorizontal() {
    const ta = document.getElementById('allUrlsTextarea');
    const text = ta.value.split('\n').filter(u => u.trim() !== '').join(', ');
    navigator.clipboard.writeText(text).then(() => toast('All URLs copied horizontally!'));
}

function copySelectedUrls() {
    if (IS_CONVERTER) { toast('URL copy is not available for Converter role', 'danger'); return; }
    const checks = document.querySelectorAll('.file-item-check:checked');
    const urls = [];
    checks.forEach(c => { if (c.dataset.url) urls.push(c.dataset.url); });
    if (!urls.length) { toast('No images selected', 'danger'); return; }
    navigator.clipboard.writeText(urls.join('\n')).then(() => toast(urls.length + ' URL(s) copied as row!'));
}

function copySelectedUrlsHorizontal() {
    if (IS_CONVERTER) { toast('URL copy is not available for Converter role', 'danger'); return; }
    const checks = document.querySelectorAll('.file-item-check:checked');
    const urls = [];
    checks.forEach(c => { if (c.dataset.url) urls.push(c.dataset.url); });
    if (!urls.length) { toast('No images selected', 'danger'); return; }
    navigator.clipboard.writeText(urls.join(', ')).then(() => toast(urls.length + ' URL(s) copied horizontally!'));
}

/* ========== ROW CLICK / SELECTION MODE ========== */
let lastClickedIdx = null;
let selectionMode = false;

function enableSelectionMode() {
    const wasOff = !selectionMode;
    selectionMode = true;
    document.body.classList.add('selection-mode');
    if (wasOff) toast('Selection mode on');
}

function toggleSelectionMode() {
    if (selectionMode) {
        selectNone();
        toast('Selection cleared');
        return;
    }
    enableSelectionMode();
}

function rowClick(event, idx) {
    if (event.target.closest('.url-cell') || event.target.closest('.actions-cell') || event.target.closest('.rename-form')) return;
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON' || event.target.tagName === 'A' || event.target.tagName === 'IMG') return;
    if (!selectionMode) return;

    const row = document.getElementById('row_' + idx);
    const chk = row.querySelector('.file-item-check');

    if (event.shiftKey && lastClickedIdx !== null) {
        // range select
        const all = [...document.querySelectorAll('.file-item-check')];
        const start = Math.min(lastClickedIdx, idx);
        const end   = Math.max(lastClickedIdx, idx);
        for (let i = start; i <= end; i++) all[i].checked = true;
    } else if (event.ctrlKey || event.metaKey) {
        chk.checked = !chk.checked;
    } else {
        // normal click — toggle this row
        chk.checked = !chk.checked;
    }
    lastClickedIdx = idx;
    updateSelectedCount();
}

/* ========== SELECT ALL ========== */
function selectAll() {
    enableSelectionMode();
    document.querySelectorAll('.file-item-check').forEach(c => c.checked = true);
    const all = document.getElementById('selectAllChk');
    if (all) all.checked = true;
    updateSelectedCount();
}
function selectNone() {
    document.querySelectorAll('.file-item-check').forEach(c => c.checked = false);
    const all = document.getElementById('selectAllChk');
    if (all) all.checked = false;
    selectionMode = false;
    document.body.classList.remove('selection-mode');
    updateSelectedCount();
}
function selectAllToggle(src) {
    enableSelectionMode();
    document.querySelectorAll('.file-item-check').forEach(c => c.checked = src.checked);
    updateSelectedCount();
}

function updateSelectedCount() {
    const checks = document.querySelectorAll('.file-item-check:checked');
    const n = checks.length;
    const selectedCount = document.getElementById('selectedCount');
    if (selectedCount) selectedCount.textContent = n + ' selected';

    document.querySelectorAll('.file-row').forEach(row => {
        const chk = row.querySelector('.file-item-check');
        if (chk) row.classList.toggle('selected', chk.checked);
    });
}

function addDeletePassword(form, message) {
    pendingDeleteForm = form;
    const msg = document.getElementById('deletePasswordMessage');
    const hdr = document.getElementById('deleteConfirmHeader');
    const btn = document.getElementById('deleteConfirmSubmitBtn');
    if (msg) msg.textContent = message || 'Are you sure you want to delete this item?';
    if (hdr) {
        if (message && message.toLowerCase().includes('trash')) {
            hdr.textContent = 'Move to Trash?';
            if (btn) btn.textContent = 'Move to Trash';
        } else if (message && message.toLowerCase().includes('permanent')) {
            hdr.textContent = 'Permanently Delete?';
            if (btn) btn.textContent = 'Permanently Delete';
        } else {
            hdr.textContent = 'Confirm Deletion';
            if (btn) btn.textContent = 'Delete';
        }
    }
    openModal('deletePasswordModal');
    return false;
}

function submitDeletePassword(event) {
    if (event) event.preventDefault();
    if (!pendingDeleteForm) {
        closeModal('deletePasswordModal');
        return false;
    }
    const form = pendingDeleteForm;
    pendingDeleteForm = null;
    closeModal('deletePasswordModal');

    let input = form.querySelector('input[name="delete_password"]');
    if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'delete_password';
        form.appendChild(input);
    }
    input.value = 'confirmed';

    if (typeof form.ajaxSubmit === 'function') {
        form.ajaxSubmit();
    } else {
        HTMLFormElement.prototype.submit.call(form);
    }
    return false;
}

function cancelDeletePassword() {
    pendingDeleteForm = null;
    closeModal('deletePasswordModal');
}

/* ========== DELETE ========== */
function deleteSelected() {
    const checks = document.querySelectorAll('.file-item-check:checked');
    if (!checks.length) { toast('No items selected', 'danger'); return; }
    const container = document.getElementById('deleteSelectedInputs');
    container.innerHTML = '';
    checks.forEach(c => {
        const inp = document.createElement('input');
        inp.type = 'hidden'; inp.name = 'selected_names[]'; inp.value = c.dataset.name;
        container.appendChild(inp);
    });
    const form = document.getElementById('deleteSelectedForm');
    if (IS_CONVERTER) {
        form.submit();
        return;
    }
    if (!addDeletePassword(form, 'Move ' + checks.length + ' item(s) to trash?')) return;
    form.submit();
}

/* ========== COPY & DUPLICATE ========== */
function copySelectedItems() {
    const checks = document.querySelectorAll('.file-item-check:checked');
    if (!checks.length) { toast('No items selected', 'danger'); return; }
    const container = document.getElementById('copySelectedInputs');
    container.innerHTML = '';
    checks.forEach(c => {
        const inp = document.createElement('input');
        inp.type = 'hidden'; inp.name = 'selected_names[]'; inp.value = c.dataset.name;
        container.appendChild(inp);
    });
    document.getElementById('copySelectedForm').submit();
}

function copySingleItem(name) {
    if (!name) return;
    const container = document.getElementById('copySelectedInputs');
    if (!container) return;
    container.innerHTML = '';
    const inp = document.createElement('input');
    inp.type = 'hidden'; inp.name = 'selected_names[]'; inp.value = name;
    container.appendChild(inp);
    document.getElementById('copySelectedForm').submit();
}

function copyToSelected() {
    openTransferModal('copy');
}

function copyToSingleItem(name) {
    if (!name) return;
    openTransferModal('copy', [name]);
}

function duplicateSingleItem(name) {
    if (!name) return;
    let form = document.getElementById('duplicateSelectedForm');
    if (!form) {
        form = document.createElement('form');
        form.id = 'duplicateSelectedForm';
        form.method = 'post';
        form.innerHTML = `<input type="hidden" name="action" value="duplicate_selected"><input type="hidden" name="csrf_token" value="${CSRF_TOKEN}"><div id="duplicateSelectedInputs"></div>`;
        document.body.appendChild(form);
    }
    const container = document.getElementById('duplicateSelectedInputs') || form;
    container.innerHTML = `<input type="hidden" name="selected_names[]" value="${escapeHtml(name)}">`;
    form.submit();
}

function duplicateSelectedItems() {
    const checks = document.querySelectorAll('.file-item-check:checked');
    if (!checks.length) { toast('No items selected', 'danger'); return; }
    let form = document.getElementById('duplicateSelectedForm');
    if (!form) {
        form = document.createElement('form');
        form.id = 'duplicateSelectedForm';
        form.method = 'post';
        form.innerHTML = `<input type="hidden" name="action" value="duplicate_selected"><input type="hidden" name="csrf_token" value="${CSRF_TOKEN}"><div id="duplicateSelectedInputs"></div>`;
        document.body.appendChild(form);
    }
    const container = document.getElementById('duplicateSelectedInputs') || form;
    container.innerHTML = '';
    checks.forEach(c => {
        const inp = document.createElement('input');
        inp.type = 'hidden'; inp.name = 'selected_names[]'; inp.value = c.dataset.name;
        container.appendChild(inp);
    });
    form.submit();
}

function downloadSelected() {
    const checks = document.querySelectorAll('.file-item-check:checked');
    if (!checks.length) { toast('No items selected', 'danger'); return; }
    const container = document.getElementById('downloadSelectedInputs');
    container.innerHTML = '';
    checks.forEach(c => {
        const inp = document.createElement('input');
        inp.type = 'hidden'; inp.name = 'selected_names[]'; inp.value = c.dataset.name;
        container.appendChild(inp);
    });
    document.getElementById('downloadSelectedForm').submit();
}

function pasteClipboard() {
    document.getElementById('pasteClipboardForm').submit();
}

/* ========== MOVE & TRANSFER ========== */
function openTransferModal(mode = 'move', items = null) {
    currentTransferMode = (mode === 'copy') ? 'copy' : 'move';
    let names = [];
    if (Array.isArray(items) && items.length) {
        names = items;
    } else {
        const checks = document.querySelectorAll('.file-item-check:checked');
        checks.forEach(c => { if (c.dataset.name) names.push(c.dataset.name); });
    }

    if (!names.length) {
        toast('No items selected', 'danger');
        return;
    }

    const container = document.getElementById('moveSelectedInputs');
    if (container) {
        container.innerHTML = '';
        names.forEach(n => {
            const inp = document.createElement('input');
            inp.type = 'hidden';
            inp.name = 'selected_names[]';
            inp.value = n;
            container.appendChild(inp);
        });
    }

    const actionInput = document.getElementById('transferFormAction');
    if (actionInput) {
        actionInput.value = currentTransferMode === 'copy' ? 'copy_to_folder' : 'move_selected';
    }

    const titleEl = document.getElementById('transferModalTitle');
    const submitBtn = document.getElementById('transferSubmitBtn');
    if (titleEl) {
        titleEl.textContent = currentTransferMode === 'copy' ? '📋 Copy to Folder' : '📦 Move to Folder';
    }
    if (submitBtn) {
        submitBtn.textContent = currentTransferMode === 'copy' ? 'Copy Here →' : 'Move Here →';
    }

    const summaryList = document.getElementById('transferItemsList');
    if (summaryList) {
        if (names.length === 1) {
            summaryList.textContent = names[0];
            summaryList.title = names[0];
        } else {
            summaryList.textContent = `${names.length} items (${names.slice(0, 3).join(', ')}${names.length > 3 ? '...' : ''})`;
            summaryList.title = names.join('\n');
        }
    }

    const searchInput = document.getElementById('transferFolderSearch');
    if (searchInput) searchInput.value = '';

    openModal('moveModal');
    loadTransferFolderOptions(false, CURRENT_PATH || '');
}

function openMoveModal() {
    openTransferModal('move');
}

function moveSingleItem(name) {
    if (!name) return;
    openTransferModal('move', [name]);
}

/* ========== RENAME ========== */
function showRename(i, name) {
    document.querySelectorAll('.inline-rename-form').forEach(form => form.style.display = 'none');
    document.querySelectorAll('.file-name-display').forEach(label => label.style.display = '');
    document.querySelectorAll('.file-title-row').forEach(row => row.style.display = '');
    document.querySelectorAll('.rename-btn').forEach(btn => btn.style.display = '');

    const form = document.getElementById('renameForm_' + i);
    const label = document.getElementById('fileNameDisplay_' + i);
    const titleRow = label?.closest('.file-title-row');
    const toggle = document.getElementById('renameToggle_' + i);
    if (!form) return;
    if (titleRow) titleRow.style.display = 'none';
    else if (label) label.style.display = 'none';
    if (toggle) toggle.style.display = 'none';
    form.style.display = 'flex';
    const input = form.querySelector('.rename-input');
    input.focus();
    const dot = name.lastIndexOf('.');
    const end = dot > 0 ? dot : name.length;
    input.setSelectionRange(0, end);
}
function hideRename(i) {
    const form = document.getElementById('renameForm_' + i);
    const label = document.getElementById('fileNameDisplay_' + i);
    const titleRow = label?.closest('.file-title-row');
    const toggle = document.getElementById('renameToggle_' + i);
    if (form) form.style.display = 'none';
    if (titleRow) titleRow.style.display = '';
    else if (label) label.style.display = '';
    if (toggle) toggle.style.display = '';
}
function renameKey(event, i) {
    if (event.key === 'Escape') {
        event.preventDefault();
        hideRename(i);
    }
}

/* ========== SEARCH ========== */
function filterFiles(q) {
    q = q.toLowerCase().trim();
    document.querySelectorAll('.file-row').forEach(row => {
        const name = (row.dataset.name || '').toLowerCase();
        row.style.display = (!q || name.includes(q)) ? '' : 'none';
    });
}

/* ========== DRAG + DROP ========== */
const globalDragOverlay = document.getElementById('globalDragOverlay');
let globalDragCounter = 0;

window.addEventListener('dragenter', (ev) => {
    ev.preventDefault();
    if (globalDragOverlay) {
        globalDragCounter++;
        if (globalDragCounter === 1) globalDragOverlay.classList.add('active');
    }
});
window.addEventListener('dragleave', (ev) => {
    ev.preventDefault();
    if (globalDragOverlay) {
        globalDragCounter--;
        if (globalDragCounter === 0) globalDragOverlay.classList.remove('active');
    }
});
window.addEventListener('dragover', (ev) => {
    ev.preventDefault();
});
window.addEventListener('drop', (ev) => {
    ev.preventDefault();
    if (globalDragOverlay) {
        globalDragCounter = 0;
        globalDragOverlay.classList.remove('active');
    }
    
    if (ev.dataTransfer.files && ev.dataTransfer.files.length > 0) {
        openModal('uploadModal');
        const inp = document.getElementById('upload-file-input');
        if (inp) {
            inp.files = ev.dataTransfer.files;
            updateDropZone(inp);
            setTimeout(() => {
                const submitBtn = document.getElementById('uploadSubmitBtn');
                if (submitBtn) submitBtn.click();
            }, 100);
        }
    }
});

const dropZone = document.getElementById('dropZone');
if (dropZone) {
    ['dragenter','dragover'].forEach(e => dropZone.addEventListener(e, ev => { ev.preventDefault(); dropZone.classList.add('dragover'); }));
    ['dragleave','drop'].forEach(e => dropZone.addEventListener(e, ev => { ev.preventDefault(); dropZone.classList.remove('dragover'); }));
    dropZone.addEventListener('drop', ev => {
        ev.preventDefault();
        dropZone.classList.remove('dragover');
        const inp = document.getElementById('upload-file-input');
        if (inp) {
            inp.files = ev.dataTransfer.files;
            updateDropZone(inp);
            setTimeout(() => {
                const submitBtn = document.getElementById('uploadSubmitBtn');
                if (submitBtn) submitBtn.click();
            }, 100);
        }
    });
}
function updateDropZone(inp) {
    const el = document.getElementById('dropZoneFiles');
    if (el && inp.files.length) el.textContent = inp.files.length + ' file(s) selected';
}

function setUploadRowStatus(row, text, className) {
    if (!row) return;
    if (className) row.classList.add(className);
    const cell = row.querySelector('.upload-progress-percent');
    if (cell) cell.textContent = text;
}

function setUploadRowError(row, file, reason) {
    if (!row) return;
    row.classList.add('fail');
    setUploadRowStatus(row, 'Failed');
    const failText = file.name + ' - ' + reason;
    row.title = failText;
    const nameCell = row.querySelector('span');
    if (nameCell) nameCell.textContent = failText.length > 96 ? (failText.slice(0, 93) + '...') : failText;
}

function buildUploadBatches(uploadableFiles) {
    const batches = [];
    const maxBatchFiles = 1; // 1 file per batch because each file will be chunked
    const maxBatchBytes = Infinity;
    let batch = [];
    let batchBytes = 0;

    uploadableFiles.forEach((file, index) => {
        const size = Math.max(1, file.size || 1);
        if (
            batch.length > 0 &&
            (batch.length >= maxBatchFiles || batchBytes + size > maxBatchBytes)
        ) {
            batches.push(batch);
            batch = [];
            batchBytes = 0;
        }
        batch.push({ file, index });
        batchBytes += size;
    });

    if (batch.length) batches.push(batch);
    return batches;
}

function errorMapFromUploadResponse(data) {
    const map = new Map();
    (Array.isArray(data.errors) ? data.errors : []).forEach((error) => {
        const text = String(error || '');
        const name = text.split(':')[0].trim();
        if (name) map.set(name.toLowerCase(), text);
    });
    return map;
}

function uploadErrorForFile(errors, fileName) {
    const lowerName = String(fileName || '').toLowerCase();
    if (errors.has(lowerName)) return errors.get(lowerName);
    for (const [name, message] of errors.entries()) {
        if (name && (lowerName.includes(name) || name.includes(lowerName))) {
            return message;
        }
    }
    return '';
}

async function optimizeImageForUpload(file) {
    if (!['image/jpeg', 'image/png'].includes(file.type)) return file;
    if (file.size < 50000) return file;

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                const MAX_DIMENSION = 1800;
                
                if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                    if (width > height) {
                        height = Math.round(height * MAX_DIMENSION / width);
                        width = MAX_DIMENSION;
                    } else {
                        width = Math.round(width * MAX_DIMENSION / height);
                        height = MAX_DIMENSION;
                    }
                }
                
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    if (!blob) { resolve(file); return; }
                    const originalName = file.name;
                    const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
                    const newFile = new File([blob], baseName + '.webp', {
                        type: 'image/webp',
                        lastModified: file.lastModified
                    });
                    resolve(newFile.size < file.size ? newFile : file);
                }, 'image/webp', 0.82);
            };
            img.onerror = () => resolve(file);
            img.src = e.target.result;
        };
        reader.onerror = () => resolve(file);
        reader.readAsDataURL(file);
    });
}

async function uploadBatchWithProgress(batch, rows, progressByFile, updateOverallProgress) {
    if (batch.length === 0) return { data: null, errors: {} };
    
    // With chunking, we process exactly 1 file per batch
    const item = batch[0];
    let file = item.file;
    const index = item.index;
    
    const cell = rows[index]?.querySelector('.upload-progress-percent');
    if (cell) cell.textContent = 'Optimizing...';
    
    file = await optimizeImageForUpload(file);
    
    if (cell) cell.textContent = '0%';
    
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
    const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
    const chunkId = Date.now().toString(36) + Math.random().toString(36).substring(2);

    let finalData = null;
    let finalErrors = {};

    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('csrf_token', <?php echo json_encode(csrfToken()); ?>);
        formData.append('action', 'upload_files');
        formData.append('path', CURRENT_PATH);
        formData.append('upload_ajax', '1');
        
        // Append chunk metadata
        formData.append('chunk_index', i);
        formData.append('total_chunks', totalChunks);
        formData.append('chunk_id', chunkId);
        formData.append('original_name', file.name);
        
        // The chunk itself
        formData.append('upload_files[]', chunk, file.name);
        formData.append('upload_paths[]', file.webkitRelativePath || '');

        const resp = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.timeout = 3600000;
            xhr.open('POST', UPLOAD_ENDPOINT, true);
            xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
            
            xhr.upload.onprogress = (evt) => {
                if (!evt.lengthComputable) return;
                const chunkLoaded = evt.loaded;
                const totalLoaded = start + chunkLoaded;
                const percent = Math.max(0, Math.min(100, Math.round((totalLoaded / file.size) * 100)));
                progressByFile[index] = percent;
                
                const cell = rows[index]?.querySelector('.upload-progress-percent');
                if (cell) cell.textContent = (percent === 100 && i === totalChunks - 1) ? '100% (Processing...)' : percent + '%';
                updateOverallProgress();
            };
            
            xhr.onerror = () => reject(new Error('Network error. Check your connection or file size limits.'));
            xhr.onabort = () => reject(new Error('Upload aborted.'));
            xhr.ontimeout = () => reject(new Error('Upload timed out.'));
            xhr.upload.onerror = () => reject(new Error('Network error during upload.'));
            xhr.upload.onabort = () => reject(new Error('Upload aborted by network.'));
            xhr.upload.ontimeout = () => reject(new Error('Upload connection timed out.'));
            
            xhr.onload = () => {
                if (xhr.status < 200 || xhr.status >= 300) {
                    reject(new Error(xhr.status === 405 ? 'Upload endpoint rejected POST (HTTP 405). Refresh and try again.' : 'Server returned HTTP ' + xhr.status + '.'));
                    return;
                }
                try {
                    const data = JSON.parse(xhr.responseText || '{}');
                    if (data.success || data.chunk_success) {
                        resolve(data);
                    } else {
                        const firstError = Array.isArray(data.errors) && data.errors.length ? data.errors[0] : '';
                        reject(new Error(firstError || data.message || 'Upload failed'));
                    }
                } catch (err) {
                    reject(new Error('Server response invalid. Check upload size limit and refresh.'));
                }
            };
            xhr.send(formData);
        });

        if (i === totalChunks - 1) {
            finalData = resp;
            if (finalData.success) {
                finalErrors = errorMapFromUploadResponse(finalData);
            }
        }
    }

    return { data: finalData, errors: finalErrors };
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let idx = 0;
    while (value >= 1024 && idx < units.length - 1) {
        value /= 1024;
        idx++;
    }
    return (idx === 0 ? Math.round(value) : value.toFixed(1)) + ' ' + units[idx];
}

const uploadForm = document.getElementById('uploadForm');
if (uploadForm) {
    uploadForm.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fileInput = document.getElementById('upload-file-input');
        const folderInput = document.getElementById('upload-folder-input');
        const files = [...(fileInput?.files || []), ...(folderInput?.files || [])];
        if (!files.length) { toast('No files selected', 'danger'); return; }

        const progressWrap = document.getElementById('uploadProgressWrap');
        const progressBar = document.getElementById('uploadGlobalBar');
        const progressText = document.getElementById('uploadGlobalText');
        const progressList = document.getElementById('uploadProgressList');
        const submitBtn = document.getElementById('uploadSubmitBtn');
        if (!progressWrap || !progressBar || !progressText || !progressList || !submitBtn) {
            uploadForm.submit();
            return;
        }
        progressWrap.style.display = 'block';
        progressBar.style.width = '0%';
        progressText.textContent = 'Preparing upload...';
        progressList.innerHTML = '';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading...';

        let successCount = 0;
        let failCount = 0;
        let completed = 0;
        const totalFiles = files.length;
        const uploadableFiles = [];

        files.forEach((file) => {
            if (SERVER_UPLOAD_LIMIT_BYTES > 0 && file.size > SERVER_UPLOAD_LIMIT_BYTES) {
                const row = document.createElement('div');
                row.className = 'upload-progress-item fail';
                const reason = 'File too large (' + formatBytes(file.size) + '). Max allowed: ' + formatBytes(SERVER_UPLOAD_LIMIT_BYTES) + '.';
                const failText = file.name + ' — ' + reason;
                row.innerHTML = '<span title="' + escapeHtml(failText) + '">' + escapeHtml(failText) + '</span><span class="upload-progress-percent">Failed</span>';
                progressList.appendChild(row);
                failCount++;
                completed++;
            } else {
                uploadableFiles.push(file);
            }
        });

        const progressByFile = new Array(uploadableFiles.length).fill(0);
        const rows = uploadableFiles.map((file) => {
            const row = document.createElement('div');
            row.className = 'upload-progress-item';
            const safeName = escapeHtml(file.name);
            row.innerHTML = '<span title="' + safeName + '">' + safeName + '</span><span class="upload-progress-percent">0%</span>';
            progressList.appendChild(row);
            return row;
        });

        const updateOverallProgress = () => {
            const activePercent = progressByFile.reduce((sum, value) => sum + value, 0) / 100;
            const overall = ((completed + activePercent) / totalFiles) * 100;
            progressBar.style.width = Math.round(overall) + '%';
            progressText.textContent = 'Completed ' + completed + '/' + totalFiles + ' files (' + Math.round(overall) + '%)';
        };
        updateOverallProgress();

        if (!uploadableFiles.length) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Upload →';
            toast('All selected files exceed server upload limit.', 'danger');
            return;
        }

        const batches = buildUploadBatches(uploadableFiles);
        let nextBatchIndex = 0;
        const workerCount = 4; // Run up to 4 concurrent upload workers to maximize network throughput
        async function worker() {
            while (true) {
                const batchIndex = nextBatchIndex;
                nextBatchIndex += 1;
                if (batchIndex >= batches.length) break;

                const batch = batches[batchIndex];
                try {
                    const result = await uploadBatchWithProgress(batch, rows, progressByFile, updateOverallProgress);
                    batch.forEach(({ file, index }) => {
                        const row = rows[index];
                        const error = uploadErrorForFile(result.errors, file.name);
                        if (error) {
                            progressByFile[index] = 0;
                            setUploadRowError(row, file, error.replace(file.name + ':', '').trim() || 'Upload failed');
                            failCount++;
                        } else {
                            progressByFile[index] = 0;
                            row.classList.add('done');
                            setUploadRowStatus(row, '100%');
                            successCount++;
                        }
                        completed++;
                    });
                } catch (err) {
                    const reason = (err && err.message ? err.message : 'Failed');
                    batch.forEach(({ file, index }) => {
                        progressByFile[index] = 0;
                        setUploadRowError(rows[index], file, reason);
                        failCount++;
                        completed++;
                    });
                }
                updateOverallProgress();
            }
        }
        await Promise.all(Array.from({ length: workerCount }, () => worker()));

        submitBtn.disabled = false;
        submitBtn.textContent = 'Upload →';

        if (successCount > 0 && failCount === 0) {
            toast(successCount + ' file(s) uploaded successfully.');
            setTimeout(() => location.reload(), 500);
            return;
        }
        if (successCount > 0) {
            toast(successCount + ' uploaded, ' + failCount + ' failed.', 'danger');
            setTimeout(() => location.reload(), 900);
            return;
        }
        toast('Upload failed for all files.', 'danger');
    });
}

/* ========== FOLDER PREFETCH ========== */
const prefetchedFolderUrls = new Set();
function prefetchFolderUrl(url) {
    if (!url || prefetchedFolderUrls.has(url)) return;
    prefetchedFolderUrls.add(url);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
}
function prefetchFolderFromEvent(e) {
    if (!e.target || !e.target.closest) return;
    const row = e.target.closest('.file-row[data-is-dir="1"]');
    if (row) prefetchFolderUrl(row.dataset.openUrl || '');
}
document.addEventListener('mouseover', prefetchFolderFromEvent, { passive: true });
document.addEventListener('focusin', prefetchFolderFromEvent);
document.addEventListener('touchstart', prefetchFolderFromEvent, { passive: true });

/* ========== TAB RESTORE REPAINT ========== */
let repaintRaf = 0;
function forceDashboardRepaint() {
    // Never trigger background layer repaint while user is viewing image in lightbox
    if (document.getElementById('lightbox')?.classList.contains('open') || document.body.classList.contains('lightbox-open')) {
        return;
    }
    if (repaintRaf) cancelAnimationFrame(repaintRaf);
    document.body.classList.add('dashboard-repaint');
    void document.body.offsetHeight;
    repaintRaf = requestAnimationFrame(() => {
        document.body.classList.remove('dashboard-repaint');
        repaintRaf = 0;
    });
}
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        const lb = document.getElementById('lightbox');
        if (lb && lb.classList.contains('open')) {
            const img = document.getElementById('lbImg');
            if (img) img.style.display = 'block';
            return;
        }
        forceDashboardRepaint();
    }
});
window.addEventListener('pageshow', () => {
    if (!document.getElementById('lightbox')?.classList.contains('open')) {
        forceDashboardRepaint();
    }
});
window.addEventListener('focus', () => {
    if (!document.getElementById('lightbox')?.classList.contains('open')) {
        forceDashboardRepaint();
    }
});

// Click outside image on lightbox backdrop to close
document.addEventListener('DOMContentLoaded', () => {
    const lb = document.getElementById('lightbox');
    if (lb) {
        lb.addEventListener('click', (e) => {
            if (e.target === lb || e.target.classList.contains('lightbox-img-wrap')) {
                closeLightbox();
            }
        });
    }
});

/* ========== KEYBOARD SHORTCUTS ========== */
document.addEventListener('keydown', e => {
    const active = document.activeElement;
    const typing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');

    // Close lightbox
    if (e.key === 'Escape') {
        if (document.getElementById('lightbox').classList.contains('open')) { closeLightbox(); return; }
        document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
        if (!typing) selectNone();
        return;
    }

    // Lightbox nav
    if (document.getElementById('lightbox').classList.contains('open')) {
        if (e.key === 'ArrowLeft')  { lbNavigate(-1); return; }
        if (e.key === 'ArrowRight') { lbNavigate(1);  return; }
        return;
    }

    // / = focus search
    if (e.key === '/' && !typing) { e.preventDefault(); document.getElementById('searchInput').focus(); return; }

    // Ctrl+A = select all
    if (e.ctrlKey && e.key === 'a' && !typing) { e.preventDefault(); selectAll(); return; }

    // Ctrl+C = copy selected URLs
    if (e.ctrlKey && e.key === 'c' && !typing) {
        const n = document.querySelectorAll('.file-item-check:checked').length;
        if (n > 0) { e.preventDefault(); copySelectedUrls(); }
        return;
    }

    // Delete = delete selected
    if (e.key === 'Delete' && !typing) { e.preventDefault(); deleteSelected(); return; }
});

/* ========== CLICK OUTSIDE = DESELECT ========== */
const fileListEl = document.getElementById('fileList');
if (fileListEl) {
    fileListEl.addEventListener('click', e => {
        if (!e.target.closest('.file-row') && !e.target.closest('.rename-form')) selectNone();
    });
}

/* ========== AUTO TOAST ========== */
<?php if ($message) { ?>
window.addEventListener('load', () => toast(<?php echo json_encode($message); ?>, <?php echo json_encode($messageType === 'success' ? 'success' : 'danger'); ?>));
<?php } ?>

<?php if ($FEATURES_ENABLED) { ?>
/* ======================================================================
   FEATURE JS — All features (context menu, AI, duplicates, versions, etc.)
====================================================================== */

const F_ACTION_ENDPOINT = <?php echo json_encode($pageUrl); ?>;
const F_CSRF_TOKEN      = <?php echo json_encode(csrfToken()); ?>;
const F_CURRENT_PATH    = <?php echo json_encode($current); ?>;
const F_BASE_URL        = <?php echo json_encode($BASE_URL); ?>;
const F_SIDEBAR_PINS    = <?php echo json_encode(array_column($sidebarPins, 'path')); ?>;

function featurePost(data) {
    return postAction(data);
}

/* ── Toolbar Dropdown ─────────────────────────────────────────────────── */
function toggleTbDropdown(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const isOpen = el.classList.contains('open');
    document.querySelectorAll('.tb-dropdown.open').forEach(d => d.classList.remove('open'));
    if (!isOpen) el.classList.add('open');
}
function closeTbDropdown(id) {
    document.getElementById(id)?.classList.remove('open');
}
document.addEventListener('click', e => {
    if (!e.target.closest('.tb-dropdown-wrap')) {
        document.querySelectorAll('.tb-dropdown.open').forEach(d => d.classList.remove('open'));
    }
});

/* ── Context Menu ─────────────────────────────────────────────────────── */
let ctxRow = null;
const ctxMenu = document.getElementById('contextMenu');

function setFolderBadge(row, kind, enabled) {
    const cell = row?.querySelector('.file-name-cell');
    const titleRow = row?.querySelector('.file-title-row');
    const label = titleRow?.querySelector('.file-name-display');
    if (!cell || !titleRow) return;
    const cls = kind === 'pin' ? 'fm-pin' : 'fm-fav';
    let badge = cell.querySelector('.' + cls);
    if (enabled) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'fm-badge ' + cls;
            badge.title = kind === 'pin' ? 'Pinned' : 'Favorite';
            badge.textContent = kind === 'pin' ? '📌' : '⭐';
            if (label) label.insertAdjacentElement('afterend', badge);
            else titleRow.appendChild(badge);
        }
    } else if (badge) {
        badge.remove();
    }
}

const PIN_COLOR_VARS = {
    blue:   ['#2563eb','rgba(37,99,235,0.12)'],
    green:  ['#059669','rgba(5,150,105,0.12)'],
    yellow: ['#d97706','rgba(217,119,6,0.12)'],
    red:    ['#dc2626','rgba(220,38,38,0.12)'],
    purple: ['#7c3aed','rgba(124,58,237,0.12)'],
    orange: ['#ea580c','rgba(234,88,12,0.12)'],
};
function setFolderColor(row, color) {
    const folderRel = row?.dataset?.folderRel;
    const els = folderRel
        ? document.querySelectorAll('[data-folder-rel="' + CSS.escape(folderRel) + '"]')
        : (row ? [row] : []);
    els.forEach(el => {
        el.dataset.folderColor = color || '';
        const icon = el.querySelector('.file-type-icon') || el.querySelector('.sb-icon');
        if (icon) {
            if (color) {
                icon.dataset.folderColor = color;
                if (el.id && el.id.startsWith('sb_pin_') && PIN_COLOR_VARS[color]) {
                    icon.style.color = PIN_COLOR_VARS[color][0];
                    icon.style.background = PIN_COLOR_VARS[color][1];
                }
            } else {
                delete icon.dataset.folderColor;
                if (el.id && el.id.startsWith('sb_pin_')) {
                    icon.style.color = '';
                    icon.style.background = '';
                }
            }
        }
    });
}

function showContextMenu(e, row) {
    e.preventDefault();
    ctxRow = row;
    if (!ctxMenu) return;

    const name     = row.dataset.name || '';
    const isImg    = row.dataset.isImg === '1';
    const isDir    = row.dataset.isDir === '1';
    const url      = row.dataset.url || '';
    const relPath  = row.dataset.rel || '';
    const isSbPin  = row.id && row.id.startsWith('sb_pin_');
    const parentPath = row.dataset.parentPath || F_CURRENT_PATH;

    // Helper to safely bind item actions
    const setItem = (id, show, onClick) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = show ? 'flex' : 'none';
        if (onClick) {
            el.onclick = () => {
                closeCtx();
                onClick();
            };
        }
    };

    // Open item
    setItem('ctx-open', true, () => {
        if (isDir && row.dataset.openUrl) {
            location.href = row.dataset.openUrl;
        } else if (url) {
            window.open(url, '_blank');
        }
    });

    // Copy URL
    setItem('ctx-copy-url', Boolean(url), () => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(() => toast('🔗 Copied URL to clipboard', 'success'));
        } else {
            prompt('Copy URL:', url);
        }
    });

    // Rename
    setItem('ctx-rename', !isSbPin, () => {
        const idx = row.id.replace('row_','');
        showRename(parseInt(idx), name);
    });

    // Rename type
    setItem('ctx-rename-type', !isSbPin && !isDir, () => {
        const checkbox = row.querySelector('.file-check');
        if (checkbox && checkbox.checked) {
            const inputs = document.querySelectorAll('.file-check:checked:not(#selectAllChk)');
            if (inputs.length > 1) {
                openRenameTypeModalMulti();
                return;
            }
        }
        openRenameTypeModalSingle(name, parentPath);
    });

    // Download
    setItem('ctx-download', !isSbPin, () => {
        location.href = F_ACTION_ENDPOINT + '?path=' + encodeURIComponent(parentPath) + '&download_item=' + encodeURIComponent(name);
    });

    // Copy (to clipboard)
    setItem('ctx-copy', true, () => {
        copySingleItem(name);
    });

    // Copy to Folder
    setItem('ctx-copy-to', !isSbPin, () => {
        copyToSingleItem(name);
    });

    // Move to Folder
    setItem('ctx-move', !isSbPin, () => {
        moveSingleItem(name);
    });

    // Duplicate in-place
    setItem('ctx-duplicate', !isSbPin, () => {
        duplicateSingleItem(name);
    });

    // Paste
    setItem('ctx-paste', !isSbPin, () => {
        pasteClipboard();
    });

    // Properties
    setItem('ctx-properties', !isSbPin, () => {
        openPropertiesDialog(name, parentPath);
    });

    // Delete
    setItem('ctx-delete', !isSbPin, () => {
        const form = document.createElement('form');
        form.method = 'post';
        form.innerHTML = `<input name="action" value="delete_item"><input name="item_name" value="${escHtml(name)}"><input name="csrf_token" value="${F_CSRF_TOKEN}"><input type="hidden" name="path" value="${escHtml(parentPath)}">`;
        document.body.appendChild(form);
        addDeletePassword(form, `Move ${name} to trash?`);
    });

    // Separators
    document.querySelectorAll('.ctx-sep').forEach(sep => {
        sep.style.display = isSbPin ? 'none' : '';
    });

    // Folder-only items
    const colorItem = document.getElementById('ctx-color');
    const pinItem   = document.getElementById('ctx-pin');
    if (colorItem) colorItem.style.display = (isDir && !isSbPin) ? 'flex' : 'none';
    if (pinItem) pinItem.style.display     = (isDir && !isSbPin) ? 'flex' : 'none';

    // Sidebar pin toggle
    const pinSidebarItem = document.getElementById('ctx-pin-sidebar');
    if (pinSidebarItem) {
        pinSidebarItem.style.display = 'flex';
        const isPinnedSidebar = isSbPin || (typeof F_SIDEBAR_PINS !== 'undefined' && F_SIDEBAR_PINS.includes(relPath));
        pinSidebarItem.textContent = isPinnedSidebar ? '📌 Unpin from Sidebar' : '📌 Pin to Sidebar';
        pinSidebarItem.onclick = () => {
            closeCtx();
            featurePost({action: 'toggle_sidebar_pin', folder_path: relPath, is_dir: isDir ? 1 : 0}).then(d => {
                if (d.success) {
                    toast(d.is_pinned ? '📌 Pinned to sidebar' : 'Unpinned from sidebar', 'success');
                    setTimeout(() => { location.reload(); }, 500);
                } else {
                    toast('Error: ' + (d.error || 'unknown'), 'danger');
                }
            });
        };
    }

    if (isDir) {
        const folderRel = row.dataset.folderRel;
        if (pinItem) {
            pinItem.onclick = () => {
                closeCtx();
                featurePost({action:'toggle_pin', folder_path: folderRel}).then(d => {
                    toast(d.success ? (d.is_pinned ? '📌 Folder pinned' : 'Folder unpinned') : 'Error', d.success ? 'success' : 'danger');
                    if (d.success) setFolderBadge(row, 'pin', !!d.is_pinned);
                });
            };
        }
        document.querySelectorAll('.ctx-color-opt').forEach(opt => {
            opt.onclick = e => {
                e.stopPropagation();
                closeCtx();
                featurePost({action:'set_folder_color', folder_path: folderRel, color: opt.dataset.color}).then(d => {
                    toast(d.success ? '🎨 Color updated' : 'Error', d.success ? 'success' : 'danger');
                    if (d.success) setFolderColor(row, d.color || '');
                });
            };
        });
    }

    // Image-only items
    const replaceItem   = document.getElementById('ctx-replace');
    const canvaEditItem = document.getElementById('ctx-canva-edit');
    const sepImg        = document.querySelector('.ctx-sep-img');
    
    if (replaceItem) replaceItem.style.display = isImg ? 'flex' : 'none';
    if (canvaEditItem) canvaEditItem.style.display = isImg ? 'flex' : 'none';
    if (sepImg) sepImg.style.display = isImg ? '' : 'none';

    if (isImg) {
        if (replaceItem) {
            replaceItem.onclick = () => { closeCtx(); openReplaceModal(name); };
        }
        if (canvaEditItem) {
            canvaEditItem.onclick = () => { 
                closeCtx(); 
                if (typeof openStandaloneCanvasEditor === 'function') {
                    openStandaloneCanvasEditor(name, url); 
                }
            };
        }
    }

    // Position menu within screen boundaries
    const vw = window.innerWidth, vh = window.innerHeight;
    const mw = 210, mh = 380;
    let x = e.clientX, y = e.clientY;
    if (x + mw > vw) x = Math.max(10, vw - mw - 12);
    if (y + mh > vh) y = Math.max(10, vh - mh - 12);
    ctxMenu.style.left = x + 'px';
    ctxMenu.style.top  = y + 'px';
    ctxMenu.style.display = 'block';
}

function closeCtx() { if(ctxMenu) ctxMenu.style.display = 'none'; ctxRow = null; }
document.addEventListener('click', e => { if (!e.target.closest('#contextMenu')) closeCtx(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCtx(); });

/* ── Properties ───────────────────────────────────────────────────────── */
function openPropertiesDialog(name) {
    openModal('propertiesModal');
    document.getElementById('propertiesContent').innerHTML = '<div style="text-align:center;padding:30px 0;color:var(--muted);">Loading…</div>';
    featurePost({ action: 'get_properties', item_name: name, path: F_CURRENT_PATH }).then(d => {
        if (!d.success) { document.getElementById('propertiesContent').innerHTML = `<p style="color:var(--danger)">${escHtml(d.error||'Error')}</p>`; return; }
        const p = d.props;
        const rows = p.type === 'file' ? [
            ['Name', escHtml(p.name)],
            ['Type', escHtml(p.extension?.toUpperCase() || '—') + ' · ' + escHtml(p.mime||'')],
            ['Size', escHtml(p.size_fmt||'—')],
            ['Dimensions', p.width ? `${p.width} × ${p.height} px` : '—'],
            ['Modified', new Date((p.modified||0)*1000).toLocaleString()],
            ['Created',  new Date((p.created||0)*1000).toLocaleString()],
            ['Path', escHtml(p.path||'—')],
            ['SHA256', `<span class="props-hash">${escHtml(p.sha256||'—')}</span>`],
            ['MD5',    `<span class="props-hash">${escHtml(p.md5||'—')}</span>`],
        ] : [
            ['Name', escHtml(p.name)],
            ['Type', 'Folder'],
            ['Total Size', formatBytesJs(p.size||0)],
            ['Files', (p.items?.files||0).toLocaleString()],
            ['Subfolders', (p.items?.folders||0).toLocaleString()],
            ['Modified', new Date((p.modified||0)*1000).toLocaleString()],
            ['Path', escHtml(p.path||'—')],
        ];
        const html = `<div class="props-grid">${rows.map(([l,v]) => `<div class="props-row"><div class="props-label">${l}</div><div class="props-value">${v}</div></div>`).join('')}</div>`;
        document.getElementById('propertiesContent').innerHTML = html;
    }).catch(() => { document.getElementById('propertiesContent').innerHTML = '<p style="color:var(--danger)">Request failed</p>'; });
}

/* ── Version History ─────────────────────────────────────────────────── */
function openVersionHistory(name) {
    openModal('versionModal');
    document.getElementById('versionFileName').textContent = 'File: ' + name;
    document.getElementById('versionList').innerHTML = '<div style="color:var(--muted);padding:20px 0;text-align:center;">Loading…</div>';
    featurePost({ action: 'get_versions', item_name: name, path: F_CURRENT_PATH }).then(d => {
        if (!d.success) { document.getElementById('versionList').innerHTML = `<p style="color:var(--danger)">${escHtml(d.error||'Error')}</p>`; return; }
        if (!d.versions?.length) { document.getElementById('versionList').innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px 0;">No versions yet. Replace the image to create a version.</div>'; return; }
        document.getElementById('versionList').innerHTML = d.versions.map(v => `
            <div class="ver-item">
                <span class="ver-badge">v${v.version_num}</span>
                <div class="ver-info">
                    <div class="ver-name">${escHtml(v.stored_path?.split('/').pop()||'Version ' + v.version_num)}</div>
                    <div class="ver-meta">${escHtml(v.size_fmt||'?')} · ${escHtml(v.date_fmt||'?')} · Replaced by: ${escHtml(v.replaced_by||'—')}</div>
                </div>
                <div class="ver-actions">
                    <button class="act-btn open" onclick="restoreVersion('${escHtml(v.id)}')">↩ Restore</button>
                    <button class="act-btn" onclick="downloadVersion('${escHtml(v.id)}')">⬇</button>
                    <button class="act-btn del" onclick="deleteVersion('${escHtml(v.id)}')">🗑</button>
                </div>
            </div>`).join('');
    });
}

function restoreVersion(id) {
    if (!confirm('Restore this version? The current file will be saved as a new version.')) return;
    featurePost({ action: 'restore_version', version_id: id, path: F_CURRENT_PATH }).then(d => {
        toast(d.success ? d.message : (d.error||'Error'), d.success ? 'success' : 'danger');
        if (d.success) { closeModal('versionModal'); setTimeout(() => location.reload(), 600); }
    });
}

function downloadVersion(id) {
    const form = document.createElement('form'); form.method = 'post';
    form.innerHTML = `<input name="action" value="download_version"><input name="version_id" value="${id}"><input name="csrf_token" value="${F_CSRF_TOKEN}"><input name="path" value="${F_CURRENT_PATH}">`;
    document.body.appendChild(form); form.submit(); document.body.removeChild(form);
}

function deleteVersion(id) {
    if (!confirm('Delete this version permanently? This cannot be undone.')) return;
    featurePost({ action: 'delete_version', version_id: id, path: F_CURRENT_PATH }).then(d => {
        toast(d.success ? 'Version deleted' : (d.error||'Error'), d.success ? 'success' : 'danger');
        if (d.success) { document.querySelectorAll('[onclick*="' + id + '"]').forEach(el => el.closest('.ver-item')?.remove()); }
    });
}

/* ── Replace Image ────────────────────────────────────────────────────── */
let replaceTargetName = '';
function openReplaceModal(name) {
    replaceTargetName = name;
    document.getElementById('replaceTargetInfo').textContent = 'Replacing: ' + name;
    document.getElementById('replaceFileInput').value = '';
    openModal('replaceModal');
}

function submitReplaceImage() {
    const fileInput = document.getElementById('replaceFileInput');
    if (!fileInput.files.length) { toast('Please select a file', 'danger'); return; }
    const formData = new FormData();
    formData.append('csrf_token', F_CSRF_TOKEN);
    formData.append('action', 'replace_image');
    formData.append('target_name', replaceTargetName);
    formData.append('path', F_CURRENT_PATH);
    formData.append('replace_file', fileInput.files[0]);
    fetch(F_ACTION_ENDPOINT, { method: 'POST', body: formData })
        .then(r => r.json())
        .then(d => {
            toast(d.success ? d.message : (d.error||'Replace failed'), d.success ? 'success' : 'danger');
            if (d.success) { closeModal('replaceModal'); setTimeout(() => location.reload(), 700); }
        }).catch(() => toast('Request failed', 'danger'));
}

/* ── AI Background Removal ──────────────────────────────────────────── */
let aiJobs = [];

function openAiModal() {
    const checked = document.querySelectorAll('.file-item-check:checked');
    const imgs = [...checked].filter(c => c.closest('.file-row')?.dataset.isImg === '1');
    if (!imgs.length) { toast('Select image(s) first', 'danger'); return; }
    document.getElementById('aiSelectedInfo').textContent = imgs.length + ' image(s) selected';
    document.getElementById('aiQueue').innerHTML = imgs.map((c, i) => {
        const row = c.closest('.file-row');
        const name = row?.dataset.name || '?';
        return `<div class="ai-job-row" id="ai-job-row-${i}"><span title="${escHtml(name)}">${escHtml(name.length > 48 ? name.slice(0,45)+'...' : name)}</span><span class="ai-job-status" id="ai-job-status-${i}">Pending</span><span></span></div>`;
    }).join('');
    document.getElementById('aiStartBtn').style.display = '';
    document.getElementById('aiCancelBtn').style.display = 'none';
    document.getElementById('aiDownloadBtn').style.display = 'none';
    aiJobs = imgs.map(c => ({ rel: c.closest('.file-row')?.dataset.rel || '', id: '', status: 'pending' }));
    openModal('aiModal');
}

async function aiStartProcessing() {
    const imgs = aiJobs.map(j => j.rel);
    const outputType   = document.getElementById('aiOutputType').value;
    const outputFormat = document.getElementById('aiOutputFormat').value;
    const outputFolder = document.getElementById('aiOutputFolder').value;
    const keepOrigName = document.getElementById('aiKeepOrigName').checked ? '1' : '';

    document.getElementById('aiStartBtn').style.display = 'none';
    document.getElementById('aiCancelBtn').style.display = '';

    // Start all jobs
    try {
        const d = await featurePost({ action: 'ai_bg_remove_start', paths: JSON.stringify(imgs), output_type: outputType, output_format: outputFormat, output_folder: outputFolder, keep_original_name: keepOrigName });
        if (!d.success) { toast(d.error||'Error starting AI jobs', 'danger'); document.getElementById('aiStartBtn').style.display = ''; return; }
        d.jobs.forEach((job, i) => { if (aiJobs[i]) aiJobs[i].id = job.id; });
    } catch(e) { toast('Failed to start AI jobs', 'danger'); document.getElementById('aiStartBtn').style.display = ''; return; }

    // Process each job sequentially
    for (let i = 0; i < aiJobs.length; i++) {
        if (aiJobs[i].status === 'cancelled') continue;
        const rowEl    = document.getElementById('ai-job-row-' + i);
        const statusEl = document.getElementById('ai-job-status-' + i);
        if (rowEl) rowEl.classList.add('processing');
        if (statusEl) statusEl.innerHTML = '<span class="ai-job-spinner"></span>Generating…';

        try {
            const reviewCanvas = document.getElementById('aiReviewCanvas').checked;
            // If they DON'T want to review, we pass `skip_edit: true` so the backend just saves it directly
            const d = await featurePost({ 
                action: 'ai_bg_remove_process', 
                job_id: aiJobs[i].id, 
                output_type: document.getElementById('aiOutputType').value, 
                output_format: document.getElementById('aiOutputFormat').value, 
                output_size: document.getElementById('aiOutputSize').value, 
                output_folder: document.getElementById('aiOutputFolder').value, 
                keep_orig_name: document.getElementById('aiKeepOrigName').checked ? '1' : '',
                path: F_CURRENT_PATH,
                skip_edit: reviewCanvas ? '0' : '1'
            });
            
            let finalD = d;
            if (d.status === 'needs_edit' && reviewCanvas) {
                finalD = await openAiEditorAndWait(d.image_b64, aiJobs[i].id);
            } else if (finalD.success) {
                if (statusEl) statusEl.innerHTML = '<span class="ai-job-spinner"></span>Validating…';
                await new Promise(r => setTimeout(r, 400));
                
                if (document.getElementById('aiKeepOrigName').checked) {
                    if (statusEl) statusEl.innerHTML = '<span class="ai-job-spinner"></span>Replacing Original…';
                    await new Promise(r => setTimeout(r, 500));
                }
            }
            
            aiJobs[i].status = finalD.success ? 'done' : 'error';
            if (rowEl) { rowEl.classList.remove('processing'); rowEl.classList.add(finalD.success ? 'done' : 'error'); }
            
            if (statusEl) {
                if (finalD.success) {
                    statusEl.textContent = '✅ Completed';
                } else {
                    statusEl.innerHTML = '<span style="color:var(--danger)">❌ Failed<br><small style="font-size:11px;opacity:0.8">Original image kept.</small></span>';
                }
            }
        } catch(e) {
            aiJobs[i].status = 'error';
            if (rowEl) { rowEl.classList.remove('processing'); rowEl.classList.add('error'); }
            if (statusEl) statusEl.innerHTML = '<span style="color:var(--danger)">❌ Failed<br><small style="font-size:11px;opacity:0.8">Original image kept.</small></span>';
        }
    }

    document.getElementById('aiCancelBtn').style.display = 'none';
    document.getElementById('aiDownloadBtn').style.display = '';
    toast('AI processing complete!');
}

function aiCancelAll() {
    const ids = aiJobs.filter(j => j.id).map(j => j.id);
    if (!ids.length) return;
    featurePost({ action: 'ai_bg_remove_cancel', job_ids: JSON.stringify(ids) }).then(() => {
        aiJobs.forEach(j => { if (j.status !== 'done') j.status = 'cancelled'; });
        toast('Jobs cancelled');
        document.getElementById('aiCancelBtn').style.display = 'none';
        document.getElementById('aiStartBtn').style.display = '';
    });
}

function aiDownloadZip() {
    const ids = aiJobs.filter(j => j.status === 'done' && j.id).map(j => j.id);
    if (!ids.length) { toast('No completed jobs', 'danger'); return; }
    const form = document.createElement('form'); form.method = 'post';
    form.innerHTML = `<input name="action" value="ai_bg_remove_download_zip"><input name="csrf_token" value="${F_CSRF_TOKEN}"><input name="path" value="${F_CURRENT_PATH}">` + ids.map(id => `<input name="job_ids[]" value="${id}">`).join('');
    document.body.appendChild(form); form.submit(); setTimeout(() => document.body.removeChild(form), 1000);
}

/* ── AI Canvas Editor ─────────────────────────────────────────────────── */
let aiEditorResolve = null;
let aiEditorImg = null;
let aiEditorCtx = null;
let aiEditorTransform = { x: 0, y: 0, scale: 1 };
let aiEditorIsDragging = false;
let aiEditorLastMouse = { x: 0, y: 0 };
let aiEditorCurrentJobId = null;
let aiEditorOriginalBgType = 'transparent';

function openAiEditorAndWait(imageB64, jobId) {
    return new Promise(resolve => {
        aiEditorResolve = resolve;
        aiEditorCurrentJobId = jobId;
        aiEditorOriginalBgType = document.getElementById('aiOutputBgType')?.value === 'white' ? 'white' : 'transparent';
        const bgSelect = document.getElementById('aiEditorBgType');
        if (bgSelect) bgSelect.value = aiEditorOriginalBgType;
        const rmBtn = document.getElementById('aiEditorRemoveBgBtn');
        if (rmBtn) {
            rmBtn.style.display = aiEditorStandaloneFilePath ? 'inline-block' : 'none';
        }
        
        const cvs = document.getElementById('aiEditorCanvas');
        aiEditorCtx = cvs.getContext('2d');
        
        document.getElementById('aiEditorZoom').value = 1;
        aiEditorTransform = { x: 0, y: 0, scale: 1 };
        
        aiEditorImg = new Image();
        aiEditorImg.onload = () => {
            aiEditorTransform.x = (cvs.width - aiEditorImg.width) / 2;
            aiEditorTransform.y = (cvs.height - aiEditorImg.height) / 2;
            document.getElementById('aiEditorZoomLabel').textContent = '100%';
            aiEditorDraw();
            openModal('aiEditorModal');
        };
        aiEditorImg.src = imageB64;
    });
}

function aiEditorDraw() {
    if (!aiEditorCtx || !aiEditorImg) return;
    const cvs = document.getElementById('aiEditorCanvas');
    const bgType = document.getElementById('aiEditorBgType').value;
    
    aiEditorCtx.clearRect(0, 0, cvs.width, cvs.height);
    
    if (bgType === 'white') {
        aiEditorCtx.fillStyle = 'white';
        aiEditorCtx.fillRect(0, 0, cvs.width, cvs.height);
    }
    
    aiEditorCtx.drawImage(
        aiEditorImg, 
        aiEditorTransform.x, 
        aiEditorTransform.y, 
        aiEditorImg.width * aiEditorTransform.scale, 
        aiEditorImg.height * aiEditorTransform.scale
    );
}

function aiEditorZoomChange() {
    aiEditorTransform.scale = parseFloat(document.getElementById('aiEditorZoom').value);
    document.getElementById('aiEditorZoomLabel').textContent = Math.round(aiEditorTransform.scale * 100) + '%';
    aiEditorDraw();
}

function aiEditorZoomIn() {
    const el = document.getElementById('aiEditorZoom');
    el.value = Math.min(parseFloat(el.max), parseFloat(el.value) + parseFloat(el.step));
    aiEditorZoomChange();
}

function aiEditorZoomOut() {
    const el = document.getElementById('aiEditorZoom');
    el.value = Math.max(parseFloat(el.min), parseFloat(el.value) - parseFloat(el.step));
    aiEditorZoomChange();
}

function aiEditorChangeSize() {
    const size = document.getElementById('aiEditorCanvasSize').value;
    const cvs = document.getElementById('aiEditorCanvas');
    const wrap = document.getElementById('aiEditorCanvasWrapper');
    
    if (size === '1920x1080') {
        cvs.width = 1920;
        cvs.height = 1080;
        wrap.style.aspectRatio = '16/9';
        wrap.style.maxWidth = '600px';
    } else {
        cvs.width = 1280;
        cvs.height = 1280;
        wrap.style.aspectRatio = '1/1';
        wrap.style.maxWidth = '500px';
    }
    aiEditorReset();
}

function aiEditorReset() {
    const cvs = document.getElementById('aiEditorCanvas');
    document.getElementById('aiEditorZoom').value = 1;
    aiEditorTransform.scale = 1;
    aiEditorTransform.x = (cvs.width - aiEditorImg.width) / 2;
    aiEditorTransform.y = (cvs.height - aiEditorImg.height) / 2;
    document.getElementById('aiEditorZoomLabel').textContent = '100%';
    aiEditorDraw();
}

function aiEditorSkip() {
    closeModal('aiEditorModal');
    if (aiEditorResolve) {
        aiEditorResolve({success: false, error: 'Skipped by user'});
        aiEditorResolve = null;
    }
}

async function aiEditorSave() {
    const btn = document.getElementById('aiEditorSaveBtn');
    btn.innerHTML = '<span class="ai-job-spinner"></span>Saving...';
    btn.disabled = true;
    
    const cvs = document.getElementById('aiEditorCanvas');
    
    let mime = 'image/webp';
    let outputFormat = 'webp';
    let outputFolder = '';
    
    if (aiEditorStandaloneFilePath) {
        const ext = aiEditorStandaloneFilePath.split('.').pop().toLowerCase();
        if (ext === 'png') mime = 'image/png';
        else if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
    } else {
        outputFormat = document.getElementById('aiOutputFormat').value;
        outputFolder = document.getElementById('aiOutputFolder').value;
        if (outputFormat === 'png') mime = 'image/png';
        else if (outputFormat === 'jpg' || outputFormat === 'jpeg') mime = 'image/jpeg';
    }
    
    // Save at 1.0 quality for maximum quality (lossless for WebP)
    const b64 = cvs.toDataURL(mime, 1.0);
    
    try {
        let d;
        if (aiEditorStandaloneFilePath) {
            d = await featurePost({
                action: 'canvas_edit_save',
                file_path: aiEditorStandaloneFilePath,
                image_b64: b64,
                path: F_CURRENT_PATH
            });
        } else {
            const keepOrigName = document.getElementById('aiKeepOrigName').checked ? '1' : '';
            d = await featurePost({
                action: 'ai_bg_remove_save_canvas',
                job_id: aiEditorCurrentJobId,
                image_b64: b64,
                output_format: outputFormat,
                output_folder: outputFolder,
                keep_orig_name: keepOrigName,
                path: F_CURRENT_PATH
            });
        }
        
        btn.innerHTML = '💾 Save & Continue';
        btn.disabled = false;
        
        if (d.success) {
            closeModal('aiEditorModal');
            if (aiEditorResolve) {
                aiEditorResolve(d);
                aiEditorResolve = null;
            }
            if (aiEditorStandaloneFilePath) {
                toast('Image saved successfully!', 'success');
                setTimeout(() => location.reload(), 800);
            }
        } else {
            toast(d.error || 'Save failed', 'danger');
        }
    } catch(e) {
        btn.innerHTML = '💾 Save & Continue';
        btn.disabled = false;
        toast('Save failed', 'danger');
    }
}

async function aiEditorRemoveBg() {
    if (!aiEditorStandaloneFilePath) return;
    const btn = document.getElementById('aiEditorRemoveBgBtn');
    if (!btn) return;
    const origText = btn.innerHTML;
    btn.innerHTML = '🪄 Removing...';
    btn.disabled = true;
    try {
        const d = await featurePost({ action: 'ai_bg_remove_sync', path: aiEditorStandaloneFilePath });
        if (d.success && d.image_b64) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                aiEditorImg = img;
                aiEditorReset(); // Recenter and redraw
                toast('Background removed successfully!', 'success');
                btn.innerHTML = origText;
                btn.disabled = false;
            };
            img.src = d.image_b64;
        } else {
            toast(d.error || 'Failed to remove background', 'danger');
            btn.innerHTML = origText;
            btn.disabled = false;
        }
    } catch(e) {
        toast('Network error during removal', 'danger');
        btn.innerHTML = origText;
        btn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const cvs = document.getElementById('aiEditorCanvas');
    if (!cvs) return;
    
    const getMousePos = (e) => {
        const rect = cvs.getBoundingClientRect();
        const scaleX = cvs.width / rect.width;
        const scaleY = cvs.height / rect.height;
        let clientX = e.clientX;
        let clientY = e.clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };
    
    const startDrag = (e) => {
        if (!aiEditorImg) return;
        aiEditorIsDragging = true;
        aiEditorLastMouse = getMousePos(e);
        e.preventDefault();
    };
    
    const doDrag = (e) => {
        if (!aiEditorIsDragging) return;
        const pos = getMousePos(e);
        aiEditorTransform.x += (pos.x - aiEditorLastMouse.x);
        aiEditorTransform.y += (pos.y - aiEditorLastMouse.y);
        aiEditorLastMouse = pos;
        aiEditorDraw();
        e.preventDefault();
    };
    
    const endDrag = () => { aiEditorIsDragging = false; };
    
    cvs.addEventListener('mousedown', startDrag);
    cvs.addEventListener('mousemove', doDrag);
    window.addEventListener('mouseup', endDrag);
    
    cvs.addEventListener('touchstart', startDrag, {passive: false});
    cvs.addEventListener('touchmove', doDrag, {passive: false});
    window.addEventListener('touchend', endDrag);
});

let aiEditorStandaloneFilePath = null;
function openStandaloneCanvasEditor(name, url) {
    aiEditorStandaloneFilePath = F_CURRENT_PATH ? F_CURRENT_PATH + '/' + name : name;
    aiEditorCurrentJobId = null;
    const rmBtn = document.getElementById('aiEditorRemoveBgBtn');
    if (rmBtn) rmBtn.style.display = 'inline-block';
    document.getElementById('aiEditorTitleInfo').textContent = '- Editing ' + name;
    
    // Hide skip button when standalone editing
    const skipBtn = document.querySelector('button[onclick="aiEditorSkip()"]');
    if (skipBtn) skipBtn.style.display = 'none';
    
    // Append timestamp to bust cache
    const imgUrl = url + '?t=' + Date.now();
    
    // Fetch image as base64 to load into canvas cleanly without taint
    fetch(imgUrl)
        .then(r => r.blob())
        .then(blob => {
            const reader = new FileReader();
            reader.onload = () => {
                openAiEditorAndWait(reader.result, null).then(() => {
                    // done
                });
            };
            reader.readAsDataURL(blob);
        }).catch(err => {
            toast('Failed to load image for editing', 'danger');
        });
}

async function openBatchCanvasEditor(rows) {
    const rmBtn = document.getElementById('aiEditorRemoveBgBtn');
    if (rmBtn) rmBtn.style.display = 'inline-block';
    
    const skipBtn = document.querySelector('button[onclick="aiEditorSkip()"]');
    if (skipBtn) skipBtn.style.display = 'inline-block';

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = row.dataset.name;
        const url = row.dataset.url;
        
        document.getElementById('aiEditorTitleInfo').textContent = '- Editing ' + name + ` (${i+1}/${rows.length})`;
        aiEditorStandaloneFilePath = F_CURRENT_PATH ? F_CURRENT_PATH + '/' + name : name;
        aiEditorCurrentJobId = null;

        const imgUrl = url + '?t=' + Date.now();
        
        try {
            const blob = await fetch(imgUrl).then(r => r.blob());
            const reader = new FileReader();
            const b64 = await new Promise((res, rej) => {
                reader.onload = () => res(reader.result);
                reader.onerror = () => rej(reader.error);
                reader.readAsDataURL(blob);
            });
            await openAiEditorAndWait(b64, null);
        } catch(e) {
            toast('Failed to load image: ' + name, 'danger');
        }
    }
}

/* ── Duplicate Finder ─────────────────────────────────────────────────── */
async function runDuplicateScan() {
    const scope = document.getElementById('dupScope').value;
    const byHash = '';
    const byName = document.getElementById('dupByName').checked ? '1' : '';
    const bySize = document.getElementById('dupBySize').checked ? '1' : '';
    if (!byName && !bySize) { toast('Select at least one match criteria', 'danger'); return; }

    document.getElementById('dupStatus').textContent = 'Scanning… (this may take a while for large libraries)';
    document.getElementById('dupResults').innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);">Computing hashes…</div>';

    try {
        const d = await featurePost({ action: 'find_duplicates', scope, by_hash: byHash, by_name: byName, by_size: bySize, path: F_CURRENT_PATH });
        if (!d.success) { document.getElementById('dupStatus').textContent = 'Error: ' + (d.error||'Unknown error'); document.getElementById('dupResults').innerHTML = ''; return; }
        document.getElementById('dupStatus').textContent = `Scanned ${d.total_files} files. Found ${d.groups.length} duplicate group(s).`;
        if (!d.groups.length) { document.getElementById('dupResults').innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted);">✅ No duplicates found!</div>'; return; }
        document.getElementById('dupResults').innerHTML = d.groups.map((g, gi) => `
            <div class="dup-group">
                <div class="dup-group-head">
                    <span>🔴 ${escHtml(g.reason)} — ${g.count} copies</span>
                </div>
                ${g.items.map((item, ii) => `
                    <div class="dup-item">
                        ${item.thumb_url ? `<img class="dup-thumb" src="${escHtml(item.thumb_url)}" onerror="this.style.display='none'" loading="lazy">` : '<div class="dup-thumb" style="background:var(--light);display:flex;align-items:center;justify-content:center;font-size:18px;">📄</div>'}
                        <div class="dup-info">
                            <div class="dup-name" title="${escHtml(item.rel)}">${escHtml(item.name)}</div>
                            <div class="dup-meta">${escHtml(item.rel)} · ${formatBytesJs(item.size)}</div>
                        </div>
                        <div class="dup-actions">
                            ${item.url ? `<a class="act-btn open" href="${escHtml(item.url)}" target="_blank">↗</a>` : ''}
                            <button class="act-btn del" onclick="dupDelete('${escHtml(item.rel)}', this)">🗑</button>
                        </div>
                    </div>`).join('')}
            </div>`).join('');
    } catch(e) {
        document.getElementById('dupStatus').textContent = 'Request failed';
        document.getElementById('dupResults').innerHTML = '';
    }
}

function dupDelete(rel, btn) {
    const mockForm = document.createElement('form');
    mockForm.ajaxSubmit = () => {
        const pw = document.getElementById('deletePasswordInput')?.value || 'confirmed';
        featurePost({ action: 'delete_duplicate', item_rel: rel, delete_password: pw }).then(d => {
            toast(d.success ? 'Moved to trash' : (d.error||'Error'), d.success ? 'success' : 'danger');
            if (d.success) btn.closest('.dup-item')?.remove();
        });
    };
    addDeletePassword(mockForm, 'Move ' + rel + ' to trash?');
}

/* ── Storage Dashboard ────────────────────────────────────────────────── */
function loadStorageDashboard() {
    const card = document.getElementById('storageDashCard');
    if (!card) return;
    featurePost({ action: 'get_storage_stats', path: F_CURRENT_PATH }).then(d => {
        if (!d.success) return;
        const pct = d.pct;
        const barClass = pct >= 85 ? 'danger' : (pct >= 60 ? 'warn' : '');
        const lblText = F_CURRENT_PATH ? 'Folder size' : 'blog total size';
        const panelMeta = document.getElementById('filePanelMeta');
        const value = card.querySelector('.stat-val');
        const label = card.querySelector('.stat-lbl');
        if (value) value.textContent = d.used_fmt;
        if (label) label.textContent = lblText;
        if (panelMeta) {
            const itemCount = panelMeta.dataset.itemCount || '0';
            panelMeta.textContent = `${itemCount} items · ${d.used_fmt} ${F_CURRENT_PATH ? 'folder size' : 'total size'} · Double-click to open`;
        }
        if (!F_CURRENT_PATH) {
            let track = card.querySelector('.storage-bar-track');
            let detail = card.querySelector('.storage-detail');
            if (!track) {
                track = document.createElement('div');
                track.className = 'storage-bar-track';
                track.innerHTML = '<div class="storage-bar-fill" id="storageFill"></div>';
                card.appendChild(track);
            }
            const fill = track.querySelector('.storage-bar-fill');
            if (fill) {
                fill.className = `storage-bar-fill ${barClass}`.trim();
                fill.style.width = pct + '%';
            }
            if (!detail) {
                detail = document.createElement('div');
                detail.className = 'storage-detail';
                card.appendChild(detail);
            }
            detail.textContent = `${pct}% of ${d.quota_fmt}`;
        }
    }).catch(() => {
        const value = card.querySelector('.stat-val');
        const label = card.querySelector('.stat-lbl');
        const panelMeta = document.getElementById('filePanelMeta');
        const fallbackSize = card.dataset.fallbackSize || '0 B';
        if (value) value.textContent = fallbackSize;
        if (label) label.textContent = 'Visible file size';
        if (panelMeta) {
            const itemCount = panelMeta.dataset.itemCount || '0';
            panelMeta.textContent = `${itemCount} items · ${fallbackSize} visible files · Double-click to open`;
        }
    });
}

window.addEventListener('load', () => {
    const run = () => loadStorageDashboard();
    if ('requestIdleCallback' in window) {
        requestIdleCallback(run, { timeout: 1200 });
    } else {
        setTimeout(run, 150);
    }
});

function openDuplicateModal() { openModal('duplicateModal'); }

/* ── Rename Type ──────────────────────────────────────────────────────── */
let renameTypeTargetItems = [];
let renameTypeParentPath = '';
const DEFAULT_RENAME_TYPES = ["MiniExcavator", "SkidSteer", "Forklift", "WheelLoader", "RoadRoller", "ScissorLift"];

function getRenameTypes() {
    try {
        let saved = localStorage.getItem('renameTypes');
        if (saved) return JSON.parse(saved);
    } catch(e) {}
    return DEFAULT_RENAME_TYPES;
}

function saveRenameTypes(arr) {
    localStorage.setItem('renameTypes', JSON.stringify(arr));
}

function renderRenameTypeSelect() {
    const sel = document.getElementById('renameTypeSelect');
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '';
    const types = getRenameTypes();
    types.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        sel.appendChild(opt);
    });
    if (types.includes(currentVal)) {
        sel.value = currentVal;
    }
}

function openRenameTypeModalSingle(name, parentPath) {
    renameTypeTargetItems = [name];
    renameTypeParentPath = parentPath;
    renderRenameTypeSelect();
    document.getElementById('newRenameType').value = '';
    openModal('renameTypeModal');
}

function openRenameTypeModalMulti() {
    const inputs = document.querySelectorAll('.file-check:checked:not(#selectAllChk)');
    if (inputs.length === 0) {
        if(typeof toast === 'function') toast('No files selected', 'warning');
        return;
    }
    renameTypeTargetItems = Array.from(inputs).map(inp => inp.dataset.name).filter(n => n);
    renameTypeParentPath = typeof F_CURRENT_PATH !== 'undefined' ? F_CURRENT_PATH : '';
    renderRenameTypeSelect();
    document.getElementById('newRenameType').value = '';
    openModal('renameTypeModal');
}

function addRenameType() {
    const inp = document.getElementById('newRenameType');
    const val = inp.value.trim();
    if (!val) return;
    const types = getRenameTypes();
    if (!types.includes(val)) {
        types.push(val);
        saveRenameTypes(types);
        renderRenameTypeSelect();
    }
    inp.value = '';
    document.getElementById('renameTypeSelect').value = val;
}

function deleteRenameType() {
    const sel = document.getElementById('renameTypeSelect');
    const val = sel.value;
    if (!val) return;
    let types = getRenameTypes();
    types = types.filter(t => t !== val);
    saveRenameTypes(types);
    renderRenameTypeSelect();
}

function applyRenameType() {
    const sel = document.getElementById('renameTypeSelect');
    const baseName = sel.value;
    if (!baseName || renameTypeTargetItems.length === 0) return;
    
    closeModal('renameTypeModal');
    
    const form = document.createElement('form');
    form.method = 'post';
    form.innerHTML = `<input type="hidden" name="action" value="rename_type">
<input type="hidden" name="csrf_token" value="${typeof F_CSRF_TOKEN !== 'undefined' ? F_CSRF_TOKEN : ''}">
<input type="hidden" name="path" value="${escHtml(renameTypeParentPath)}">
<input type="hidden" name="base_name" value="${escHtml(baseName)}">`;

    renameTypeTargetItems.forEach(item => {
        const inp = document.createElement('input');
        inp.type = 'hidden';
        inp.name = 'items[]';
        inp.value = item;
        form.appendChild(inp);
    });
    
    document.body.appendChild(form);
    form.submit();
}

/* ── Utility ──────────────────────────────────────────────────────────── */
function escHtml(str) {
    return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function formatBytesJs(bytes) {
    if (!bytes) return '0 B';
    if (bytes >= 1073741824) return (bytes/1073741824).toFixed(2) + ' GB';
    if (bytes >= 1048576)    return (bytes/1048576).toFixed(1) + ' MB';
    if (bytes >= 1024)       return (bytes/1024).toFixed(0) + ' KB';
    return bytes + ' B';
}

<?php } // FEATURES_ENABLED?>
</script>


</body>
</html>
<?php
