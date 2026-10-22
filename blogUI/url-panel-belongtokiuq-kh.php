<?php
@ini_set("memory_limit", "512M");
@ini_set("max_execution_time", "90");
if (!ob_get_level() && !headers_sent() && extension_loaded("zlib") && !ini_get("zlib.output_compression")) { ob_start("ob_gzhandler"); }
$isHttps = (!empty($_SERVER["HTTPS"]) && $_SERVER["HTTPS"] !== "off")
    || (isset($_SERVER["HTTP_X_FORWARDED_PROTO"]) && strtolower($_SERVER["HTTP_X_FORWARDED_PROTO"]) === "https")
    || (isset($_SERVER["HTTP_X_FORWARDED_SSL"]) && strtolower($_SERVER["HTTP_X_FORWARDED_SSL"]) === "on")
    || (isset($_SERVER["HTTP_CF_VISITOR"]) && strpos($_SERVER["HTTP_CF_VISITOR"], "https") !== false)
    || (isset($_SERVER["SERVER_PORT"]) && (int)$_SERVER["SERVER_PORT"] === 443);
$secureCookie = $isHttps;
session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "secure" => $secureCookie,
    "httponly" => true,
    "samesite" => "Strict",
]);
ini_set("session.use_strict_mode", "1");
session_start();

// Use the exact PHP self path to ensure POST requests do not hit extensionless 405 Method Not Allowed errors
$pageUrl = $_SERVER["PHP_SELF"];

/*
|--------------------------------------------------------------------------
| CONFIG
|--------------------------------------------------------------------------
*/

$ADMIN_USER = "admin@kiuq.kiuq";
$ADMIN_PASS_HASH = '$2y$12$QEarLyHf0rz/6VrPvLyvQug1zqhhWFkLZsGhcabu4nSDI2as/426S';
$DELETE_PASS_HASH = '$2y$12$SSR.q2dXmK49Rn/H9gaFOenTdql8BqlzsTwVabA05aSiKMzQZC7a.';
$MAX_LOGIN_ATTEMPTS = 5;
$IMAGE_MAX_DIMENSION = 1800;
$WEBP_QUALITY = 82;
$APP_TIMEZONE = "Asia/Phnom_Penh";
$AUTO_LOGOUT_SECONDS = 12 * 60 * 60;

date_default_timezone_set($APP_TIMEZONE);

$ROOT_FOLDER = "ebay";
$CONVERTER_ROOT_FOLDER = "img-webp-converter";
$BASE_DIR = __DIR__ . "/" . $ROOT_FOLDER;
$APP_ASSETS_DIR = __DIR__ . "/app-assets";
$TRASH_DIR = __DIR__ . "/.trash";
$TRASH_META_FILE = __DIR__ . "/.trash_index.json";
$SECURITY_FILE = __DIR__ . "/.security.json";
$USERS_FILE = __DIR__ . "/.users.json";
$APP_SETTINGS_FILE = __DIR__ . "/.app_settings.json";
$LOGIN_ACTIVITY_FILE = __DIR__ . "/.login_activity.json";
$THEME_LIBRARY_FILE = __DIR__ . "/.theme_images.json";

/*
|--------------------------------------------------------------------------
| FEATURE MODULES (Additive only — do not modify existing logic above)
|--------------------------------------------------------------------------
*/
$FEATURES_DIR = __DIR__ . "/features";
if (is_dir($FEATURES_DIR)) {
    $featureFiles = ['config.php','feature_db.php','folder_meta.php','properties.php',
                     'duplicate_finder.php','image_replace.php','version_history.php',
                     'ai_bg_remove.php','sorting.php','storage_dashboard.php', 'file_converter.php'];
    foreach ($featureFiles as $ff) {
        $ffPath = $FEATURES_DIR . '/' . $ff;
        if (is_file($ffPath)) require_once $ffPath;
    }
}
$FEATURES_ENABLED = is_dir($FEATURES_DIR) && function_exists('feature_db');

$scriptBasePath = rtrim(str_replace("\\", "/", dirname($_SERVER["SCRIPT_NAME"] ?? "")), "/");
$requestScheme = $secureCookie ? "https" : "http";
$httpHost = $_SERVER["HTTP_HOST"] ?? "localhost";
$basePathPrefix = ($scriptBasePath === "" || $scriptBasePath === ".") ? "" : $scriptBasePath;

// Build correct public URLs even when app is in /img/, /tools/img/, etc.
$BASE_URL = $requestScheme . "://" . $httpHost . $basePathPrefix . "/" . rawurlencode($ROOT_FOLDER);
// Root-relative asset URL avoids mixed content, protocol issues, or domain mismatches across all environments
$APP_ASSETS_URL = $basePathPrefix !== "" ? $basePathPrefix . "/app-assets" : "/app-assets";

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
$AUTO_BACKUP_ENABLED   = true;
$BACKUP_SYSTEM_LIB_CANDIDATES = [
    __DIR__ . "/backup/lib.php",
    dirname(__DIR__) . "/backup/lib.php",
];

$videoExtensions = [
    "mp4", "webm", "mov", "mkv", "avi", "wmv", "flv", "m4v", "3gp",
    "ogv", "ogg", "ts", "mts", "m2ts", "vob", "mpg", "mpeg", "asf", "rm", "rmvb"
];

function isVideoFile($filename): bool
{
    global $videoExtensions;
    $ext = strtolower(pathinfo((string)$filename, PATHINFO_EXTENSION));
    $list = !empty($videoExtensions) ? $videoExtensions : [
        "mp4", "webm", "mov", "mkv", "avi", "wmv", "flv", "m4v", "3gp",
        "ogv", "ogg", "ts", "mts", "m2ts", "vob", "mpg", "mpeg", "asf", "rm", "rmvb"
    ];
    return in_array($ext, $list, true);
}

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
        if (is_string($candidate) && $candidate !== "" && is_file($candidate)) {
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

    if (!$AUTO_BACKUP_ENABLED) {
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
            if ($candidate !== "" && is_file($candidate)) {
                if (isVideoFile($candidate)) continue;
                $filtered[$candidate] = true;
            }
        }
        if ($filtered !== []) {
            bs_autoBackupFiles(array_keys($filtered), 'auto_upload from ImageHost');
        }
    } catch (Throwable $e) {
        // Never crash ImageHost because of a backup failure.
        error_log('[ImageHost auto-backup] ' . $e->getMessage());
    }
}

/**
 * Auto-backup absolute targets (files or folders), preserving folder entries
 * so deleted folders can be restored too.
 */
function imghost_autoBackupTargets(array $absoluteTargets): void
{
    global $AUTO_BACKUP_ENABLED;

    if (!$AUTO_BACKUP_ENABLED) {
        return;
    }

    // Filter out video files — backup is image & asset only
    $filteredTargets = [];
    foreach ($absoluteTargets as $tgt) {
        $tgtStr = (string) $tgt;
        if ($tgtStr !== "" && is_file($tgtStr) && isVideoFile($tgtStr)) {
            continue;
        }
        $filteredTargets[] = $tgt;
    }
    if (empty($filteredTargets)) {
        return;
    }

    $backupLib = imghost_resolveBackupLib();
    if ($backupLib === null) {
        return;
    }

    try {
        require_once $backupLib;
        if (function_exists('bs_autoBackupAbsoluteTargets')) {
            bs_autoBackupAbsoluteTargets($filteredTargets, 'auto_upload from ImageHost');
        } else {
            // Backward compatibility fallback: files only.
            $files = imghost_collectFilesForBackup($filteredTargets);
            if (!empty($files)) {
                bs_autoBackupFiles($files, 'auto_upload from ImageHost');
            }
        }
    } catch (Throwable $e) {
        error_log('[ImageHost auto-backup-targets] ' . $e->getMessage());
    }
}

/**
 * Collect all files under one or more targets for a pre-delete snapshot.
 * This guarantees files remain recoverable even after deletion from live.
 *
 * @param array<int,string> $targets
 * @return array<int,string>
 */
function imghost_collectFilesForBackup(array $targets): array
{
    $files = [];

    foreach ($targets as $target) {
        $target = (string) $target;
        if ($target === "" || !file_exists($target) || is_link($target)) {
            continue;
        }

        if (is_file($target)) {
            if (!isVideoFile($target)) {
                $files[$target] = true;
            }
            continue;
        }

        if (!is_dir($target)) {
            continue;
        }

        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($target, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::LEAVES_ONLY
        );
        foreach ($it as $info) {
            if ($info->isLink() || !$info->isFile()) {
                continue;
            }
            if (isVideoFile($info->getPathname())) {
                continue;
            }
            $files[$info->getPathname()] = true;
        }
    }

    return array_keys($files);
}

$allowedExtensions = array_merge([
    "jpg", "jpeg", "png", "webp", "gif", "svg", "avif", "jfif", "bmp", "ico", "tiff", "tif", "heic", "heif", "zip",
    "html", "txt", "css", "js", "json", "php"
], $videoExtensions);

$codeExtensions = ["html", "css", "js", "json", "php", "txt"];

/*
|--------------------------------------------------------------------------
| BASIC SETUP
|--------------------------------------------------------------------------
*/

if (!is_dir($BASE_DIR)) {
    mkdir($BASE_DIR, 0755, true);
}
if (!is_dir($TRASH_DIR)) {
    mkdir($TRASH_DIR, 0755, true);
}
if (!is_dir($APP_ASSETS_DIR)) {
    mkdir($APP_ASSETS_DIR, 0755, true);
}

function csrfToken() {
    if (empty($_SESSION["csrf_token"])) {
        $_SESSION["csrf_token"] = bin2hex(random_bytes(32));
    }
    return $_SESSION["csrf_token"];
}

function csrfField() {
    return '<input type="hidden" name="csrf_token" value="' . htmlspecialchars(csrfToken(), ENT_QUOTES, "UTF-8") . '">';
}

function validCsrf($token) {
    return is_string($token) && hash_equals($_SESSION["csrf_token"] ?? "", $token);
}

function readJsonFile($file, $default = []) {
    if (!is_file($file)) return $default;
    $raw = file_get_contents($file);
    $data = json_decode($raw, true);
    return is_array($data) ? $data : $default;
}

function writeJsonFile($file, $data) {
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);
}

function getSecureIndexHtml() {
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
  <span>© 2026 KiuQ.com. All rights reserved.</span>
  <span>ALL UNAUTHORIZED ACCESS IS MONITORED AND PROSECUTED</span>
</footer>

</body>
</html>
HTML;
}

function isSystemManagedFile($name) {
    $base = basename((string)$name);
    return in_array($base, ["index.html", ".security.json"], true);
}

function shouldHideFromFileManager($name) {
    $base = basename((string)$name);
    return isSystemManagedFile($base)
        || in_array($base, [".versions", ".trash", ".DS_Store"], true)
        || str_starts_with($base, "._")
        || str_starts_with($base, ".tmp_")
        || str_starts_with($base, ".webm_job_");
}

function ensureSecureIndexFile($dir) {
    if (!is_dir($dir) || !is_writable($dir)) return;
    $indexFile = rtrim($dir, "/") . "/index.html";
    if (!is_file($indexFile)) {
        @file_put_contents($indexFile, getSecureIndexHtml(), LOCK_EX);
    }
}

function cleanPath($path) {
    $path = str_replace("\\", "/", $path);
    $path = str_replace("\0", "", $path);
    $path = trim($path, "/");
    $parts = explode("/", $path);
    $safe = [];
    foreach ($parts as $part) {
        if ($part === "" || $part === "." || $part === "..") continue;
        $part = preg_replace('/[\x00-\x1F\x7F]/u', "", $part) ?? $part;
        if ($part !== "") $safe[] = $part;
    }
    return implode("/", $safe);
}

function cleanName($name) {
    $name = preg_replace("/[^\p{L}\p{N}\p{M}._\- ()\[\]]/u", "", basename($name));
    return trim($name);
}

function cleanExistingName($name) {
    $name = str_replace(["\0", "/", "\\"], "", (string)$name);
    $name = preg_replace('/[\x00-\x1F\x7F]/u', "", $name) ?? $name;
    return ($name === "." || $name === "..") ? "" : $name;
}

function cleanBaseName($name) {
    $base = pathinfo(basename($name), PATHINFO_FILENAME);
    $base = preg_replace("/[^\p{L}\p{N}\p{M}._\- ()\[\]]/u", "", $base);
    return trim($base) !== "" ? $base : "image";
}

function cleanInput($val) {
    return trim(strip_tags((string)$val));
}

function safeFullPath($baseDir, $relativePath = "") {
    $relativePath = cleanPath($relativePath);
    $fullPath = $baseDir . ($relativePath ? "/" . $relativePath : "");
    $baseReal = realpath($baseDir);
    $targetReal = realpath($fullPath);
    if ($baseReal !== false && $targetReal !== false && $targetReal !== $baseReal && strpos($targetReal, $baseReal . DIRECTORY_SEPARATOR) !== 0) {
        die("Invalid path.");
    }
    return $fullPath;
}

function deleteFolder($dir) {
    if (!is_dir($dir)) return;
    foreach (scandir($dir) as $item) {
        if ($item === "." || $item === "..") continue;
        $path = $dir . "/" . $item;
        if (is_dir($path)) deleteFolder($path);
        else unlink($path);
    }
    rmdir($dir);
}

function getFolderTotalSize(string $dir): int {
    static $memCache = [];
    $real = realpath($dir);
    if (!$real || !is_dir($real)) return 0;
    if (isset($memCache[$real])) return $memCache[$real];

    $cacheKey = md5($real);
    $cacheFile = sys_get_temp_dir() . '/kiuq_fsize_' . $cacheKey . '.cache';
    $dirMtime = (int)@filemtime($real);

    if (is_file($cacheFile)) {
        $c = @file_get_contents($cacheFile);
        if ($c !== false) {
            $parts = explode(':', $c, 2);
            if (count($parts) === 2 && (int)$parts[0] >= $dirMtime && (time() - (int)$parts[0] < 300)) {
                $memCache[$real] = (int)$parts[1];
                return (int)$parts[1];
            }
        }
    }

    $size = 0;
    try {
        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($real, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::LEAVES_ONLY
        );
        foreach ($it as $file) {
            if ($file->isFile()) {
                $size += (int)$file->getSize();
            }
        }
    } catch (\Throwable $e) {
        $size = 0;
        foreach (scandir($real) as $item) {
            if ($item === "." || $item === "..") continue;
            $path = $real . "/" . $item;
            if (is_dir($path)) $size += getFolderTotalSize($path);
            elseif (is_file($path)) $size += (int)@filesize($path);
        }
    }

    $memCache[$real] = $size;
    @file_put_contents($cacheFile, time() . ':' . $size, LOCK_EX);
    return $size;
}

function folderSize($dir) {
    return getFolderTotalSize((string)$dir);
}

function folderOptions($baseDir, $rootRelative = "", $rootLabel = "ebay / root") {
    $rootRelative = cleanPath($rootRelative);
    $options = [["path" => $rootRelative, "label" => $rootLabel]];
    $scan = function($relative) use (&$scan, &$options, $baseDir) {
        $dir = safeFullPath($baseDir, $relative);
        if (!is_dir($dir)) return;
        $names = array_diff(scandir($dir), [".", ".."]);
        natcasesort($names);
        foreach ($names as $name) {
            if (shouldHideFromFileManager($name)) continue;
            $path = $dir . "/" . $name;
            if (!is_dir($path)) continue;
            $childRelative = $relative ? $relative . "/" . $name : $name;
            $options[] = ["path" => cleanPath($childRelative), "label" => $childRelative];
            $scan($childRelative);
        }
    };
    $scan($rootRelative);
    return $options;
}

function relativePathInRoot($relativePath, $rootRelative) {
    $path = cleanPath($relativePath);
    $root = cleanPath($rootRelative);
    if ($root === "") return true;
    return $path === $root || strpos($path . "/", $root . "/") === 0;
}

function uniqueDestinationPath($dir, $name) {
    $name = cleanName($name);
    $candidate = $dir . "/" . $name;
    if (!file_exists($candidate)) return $candidate;

    $ext = pathinfo($name, PATHINFO_EXTENSION);
    $base = $ext ? substr($name, 0, -(strlen($ext) + 1)) : $name;
    $suffix = 1;
    do {
        $copyName = $base . " copy" . ($suffix > 1 ? " " . $suffix : "") . ($ext ? "." . $ext : "");
        $candidate = $dir . "/" . $copyName;
        $suffix++;
    } while (file_exists($candidate));
    return $candidate;
}

function copyFolder($src, $dst) {
    if (!is_dir($src)) return false;
    if (!is_dir($dst) && !mkdir($dst, 0755, true)) return false;
    ensureSecureIndexFile($dst);
    foreach (scandir($src) as $item) {
        if ($item === "." || $item === "..") continue;
        if (shouldHideFromFileManager($item)) continue;
        $from = $src . "/" . $item;
        $to = $dst . "/" . $item;
        if (is_dir($from)) {
            if (!copyFolder($from, $to)) return false;
        } elseif (is_file($from)) {
            if (!copy($from, $to)) return false;
        }
    }
    return true;
}

function sanitizeDownloadFilename($name, $fallback = "download") {
    $name = trim((string)$name);
    $name = str_replace(["\r", "\n"], "", $name);
    $name = preg_replace('/[^a-zA-Z0-9._\- ]/', "", $name);
    $name = trim($name);
    return $name !== "" ? $name : $fallback;
}

function streamDownloadFile($filePath, $downloadName, $deleteAfter = false) {
    if (!is_file($filePath)) return false;
    if (ob_get_level()) {
        while (ob_get_level()) ob_end_clean();
    }
    $downloadName = sanitizeDownloadFilename($downloadName, basename($filePath));
    header("Content-Description: File Transfer");
    header("Content-Type: application/octet-stream");
    header('Content-Disposition: attachment; filename="' . str_replace('"', '', $downloadName) . '"');
    header("Content-Length: " . filesize($filePath));
    header("Cache-Control: private, max-age=0, must-revalidate");
    header("Pragma: public");
    readfile($filePath);
    if ($deleteAfter) @unlink($filePath);
    exit;
}

function addPathToZipArchive($zip, $sourcePath, $zipPath) {
    $zipPath = str_replace("\\", "/", trim((string)$zipPath, "/"));
    if ($zipPath === "") $zipPath = basename($sourcePath);
    if (shouldHideFromFileManager(basename($sourcePath))) return;
    if (is_file($sourcePath)) {
        $zip->addFile($sourcePath, $zipPath);
        return;
    }
    if (!is_dir($sourcePath)) return;
    $zip->addEmptyDir($zipPath);
    foreach (scandir($sourcePath) as $item) {
        if ($item === "." || $item === "..") continue;
        if (shouldHideFromFileManager($item)) continue;
        $childPath = $sourcePath . "/" . $item;
        $childZipPath = $zipPath . "/" . $item;
        if (is_dir($childPath)) {
            addPathToZipArchive($zip, $childPath, $childZipPath);
        } elseif (is_file($childPath)) {
            $zip->addFile($childPath, $childZipPath);
        }
    }
}

function streamZipDownloadFromMap($pathMap, $archiveName) {
    if (!class_exists("ZipArchive")) return false;
    $tempFile = tempnam(sys_get_temp_dir(), "imghost_zip_");
    if ($tempFile === false) return false;
    $zipFile = $tempFile . ".zip";
    @rename($tempFile, $zipFile);
    if (is_file($tempFile)) @unlink($tempFile);

    $zip = new ZipArchive();
    if ($zip->open($zipFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        if (is_file($zipFile)) @unlink($zipFile);
        return false;
    }
    foreach ($pathMap as $absPath => $entryName) {
        addPathToZipArchive($zip, $absPath, $entryName);
    }
    $zip->close();
    streamDownloadFile($zipFile, sanitizeDownloadFilename($archiveName, "download.zip"), true);
    return true;
}

function loadTrashIndex() {
    global $TRASH_META_FILE;
    $data = readJsonFile($TRASH_META_FILE, ["items" => []]);
    if (!isset($data["items"]) || !is_array($data["items"])) $data["items"] = [];
    return $data;
}

function saveTrashIndex($data) {
    global $TRASH_META_FILE;
    writeJsonFile($TRASH_META_FILE, $data);
}

function normalizeRestoredPath($path, $mtime = 0) {
    if (!file_exists($path) || is_link($path)) return;
    $mtime = (int)$mtime;
    if (is_file($path)) {
        @chmod($path, 0644);
        if ($mtime > 0) @touch($path, $mtime);
        return;
    }
    if (!is_dir($path)) return;
    @chmod($path, 0755);
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );
    foreach ($it as $info) {
        if ($info->isLink()) continue;
        if ($info->isDir()) @chmod($info->getPathname(), 0755);
        elseif ($info->isFile()) @chmod($info->getPathname(), 0644);
    }
}

function trashItem($target, $relativePath) {
    global $TRASH_DIR;
    if (!file_exists($target)) return false;
    $trash = loadTrashIndex();
    $id = bin2hex(random_bytes(12));
    $trashName = date("Ymd_His") . "_" . $id . "_" . cleanName(basename($relativePath));
    $trashPath = $TRASH_DIR . "/" . $trashName;
    if (!rename($target, $trashPath)) return false;
    $isTrashDir = is_dir($trashPath);
    $isTrashFile = is_file($trashPath);

    $trash["items"][$id] = [
        "id" => $id,
        "original_relative" => cleanPath($relativePath),
        "trash_name" => $trashName,
        "deleted_at" => time(),
        "type" => $isTrashDir ? "folder" : "file",
        "size" => $isTrashDir ? folderSize($trashPath) : ($isTrashFile ? filesize($trashPath) : 0),
        "mtime" => file_exists($trashPath) ? (int)filemtime($trashPath) : 0,
        "hash" => $isTrashFile ? (string)@hash_file("sha256", $trashPath) : "",
    ];
    saveTrashIndex($trash);
    return true;
}

function restoreTrashItem($id) {
    global $BASE_DIR, $TRASH_DIR;
    $trash = loadTrashIndex();
    if (empty($trash["items"][$id])) return false;
    $item = $trash["items"][$id];
    $trashPath = $TRASH_DIR . "/" . cleanName($item["trash_name"] ?? "");
    if (!file_exists($trashPath)) {
        unset($trash["items"][$id]);
        saveTrashIndex($trash);
        return false;
    }

    $relative = cleanPath($item["original_relative"] ?? "");
    $restorePath = safeFullPath($BASE_DIR, $relative);
    $parent = dirname($restorePath);
    if (!is_dir($parent)) mkdir($parent, 0755, true);
    if (file_exists($restorePath)) $restorePath = uniqueDestinationPath($parent, basename($restorePath));
    clearstatcache(true);
    if (!rename($trashPath, $restorePath)) return false;
    normalizeRestoredPath($restorePath, (int)($item["mtime"] ?? 0));
    if (is_file($restorePath) && !empty($item["hash"])) {
        $restoredHash = @hash_file("sha256", $restorePath);
        if (!is_string($restoredHash) || !hash_equals((string)$item["hash"], $restoredHash)) {
            error_log("[ImageHost restore] Hash mismatch after restoring " . $restorePath);
        }
    }

    unset($trash["items"][$id]);
    saveTrashIndex($trash);
    return true;
}

function permanentlyDeleteTrashItem($id) {
    global $TRASH_DIR;
    $trash = loadTrashIndex();
    if (empty($trash["items"][$id])) return false;
    $item = $trash["items"][$id];
    $trashPath = $TRASH_DIR . "/" . cleanName($item["trash_name"] ?? "");
    if (is_dir($trashPath)) deleteFolder($trashPath);
    elseif (is_file($trashPath)) unlink($trashPath);
    unset($trash["items"][$id]);
    saveTrashIndex($trash);
    return true;
}

function isImageFile($filename) {
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    return in_array($ext, ["jpg", "jpeg", "png", "webp", "gif", "svg", "avif", "jfif", "bmp", "ico", "tiff", "tif", "heic", "heif"], true);
}

function isWebpConvertibleImage($filename) {
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    return in_array($ext, ["jpg", "jpeg", "png", "avif", "jfif", "bmp"], true);
}

function imageResourceFromFile($path, $ext) {
    $ext = strtolower($ext);
    if (($ext === "jpg" || $ext === "jpeg") && function_exists("imagecreatefromjpeg")) {
        $im = @imagecreatefromjpeg($path);
        if ($im) return $im;
    }
    if ($ext === "png" && function_exists("imagecreatefrompng")) {
        $im = @imagecreatefrompng($path);
        if ($im) return $im;
    }
    if ($ext === "webp" && function_exists("imagecreatefromwebp")) {
        $im = @imagecreatefromwebp($path);
        if ($im) return $im;
    }
    if ($ext === "avif" && function_exists("imagecreatefromavif")) {
        $im = @imagecreatefromavif($path);
        if ($im) return $im;
    }
    if (function_exists("imagecreatefromstring")) {
        $raw = @file_get_contents($path);
        if ($raw !== false) {
            $im = @imagecreatefromstring($raw);
            if ($im) return $im;
        }
    }
    return false;
}

function saveOptimizedWebp($sourcePath, $destinationPath, $ext) {
    global $IMAGE_MAX_DIMENSION, $WEBP_QUALITY;
    if (!function_exists("imagewebp")) return false;
    if (!canAttemptImageOptimization($sourcePath)) return false;
    $info = @getimagesize($sourcePath);
    if (!$info || empty($info[0]) || empty($info[1])) return false;

    $width = (int)$info[0];
    $height = (int)$info[1];
    $ratio = min(1, $IMAGE_MAX_DIMENSION / max($width, $height));

    if (strtolower($ext) === 'webp' && $ratio == 1) {
        if (@copy($sourcePath, $destinationPath)) return true;
    }

    $src = imageResourceFromFile($sourcePath, $ext);
    if (!$src) return false;

    if ($ratio < 1) {
        $newWidth = max(1, (int)round($width * $ratio));
        $newHeight = max(1, (int)round($height * $ratio));
        $out = imagecreatetruecolor($newWidth, $newHeight);
        if (!$out) {
            imagedestroy($src);
            return false;
        }
        imagealphablending($out, false);
        imagesavealpha($out, true);
        $transparent = imagecolorallocatealpha($out, 0, 0, 0, 127);
        imagefilledrectangle($out, 0, 0, $newWidth, $newHeight, $transparent);
        imagecopyresampled($out, $src, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
        imagepalettetotruecolor($out);
        imagealphablending($out, false);
        imagesavealpha($out, true);
        $saved = imagewebp($out, $destinationPath, $WEBP_QUALITY);
        imagedestroy($out);
    } else {
        imagepalettetotruecolor($src);
        imagealphablending($src, false);
        imagesavealpha($src, true);
        $saved = imagewebp($src, $destinationPath, $WEBP_QUALITY);
    }

    imagedestroy($src);
    if (!$saved || !is_file($destinationPath) || !@getimagesize($destinationPath)) {
        if (is_file($destinationPath)) @unlink($destinationPath);
        return false;
    }
    return true;
}

function saveGdImageResource($image, $filePath, $format, $quality = 85) {
    $format = strtolower($format);
    if ($format === 'jpg') $format = 'jpeg';
    $dir = dirname($filePath);
    if (!is_dir($dir)) @mkdir($dir, 0755, true);

    if ($format === 'webp' && function_exists('imagewebp')) {
        imagepalettetotruecolor($image);
        imagealphablending($image, false);
        imagesavealpha($image, true);
        return @imagewebp($image, $filePath, max(10, min(100, (int)$quality)));
    } elseif ($format === 'png' && function_exists('imagepng')) {
        imagealphablending($image, false);
        imagesavealpha($image, true);
        $pngLevel = max(0, min(9, (int)round((100 - $quality) / 11)));
        return @imagepng($image, $filePath, $pngLevel);
    } elseif ($format === 'jpeg' && function_exists('imagejpeg')) {
        $bg = imagecreatetruecolor(imagesx($image), imagesy($image));
        $white = imagecolorallocate($bg, 255, 255, 255);
        imagefilledrectangle($bg, 0, 0, imagesx($image), imagesy($image), $white);
        imagecopy($bg, $image, 0, 0, 0, 0, imagesx($image), imagesy($image));
        $res = @imagejpeg($bg, $filePath, max(10, min(100, (int)$quality)));
        @imagedestroy($bg);
        return $res;
    } elseif ($format === 'gif' && function_exists('imagegif')) {
        return @imagegif($image, $filePath);
    } elseif ($format === 'avif' && function_exists('imageavif')) {
        imagepalettetotruecolor($image);
        imagealphablending($image, false);
        imagesavealpha($image, true);
        return @imageavif($image, $filePath, max(10, min(100, (int)$quality)));
    }
    return false;
}

function scaleGdImage($srcImg, $newWidth, $newHeight) {
    $origW = imagesx($srcImg);
    $origH = imagesy($srcImg);
    $newImg = imagecreatetruecolor($newWidth, $newHeight);
    if (!$newImg) return false;
    imagealphablending($newImg, false);
    imagesavealpha($newImg, true);
    $transparent = imagecolorallocatealpha($newImg, 0, 0, 0, 127);
    imagefilledrectangle($newImg, 0, 0, $newWidth, $newHeight, $transparent);
    imagecopyresampled($newImg, $srcImg, 0, 0, 0, 0, $newWidth, $newHeight, $origW, $origH);
    return $newImg;
}

function processImageResize($sourcePath, $destinationPath, $options = []) {
    @set_time_limit(120);
    if (!file_exists($sourcePath) || filesize($sourcePath) === 0) return false;

    $srcExt = strtolower(pathinfo($sourcePath, PATHINFO_EXTENSION));
    $outExt = strtolower($options['format'] ?? 'original');
    if ($outExt === 'original' || empty($outExt)) {
        $outExt = $srcExt;
    }

    $mode = $options['mode'] ?? 'filesize'; // 'filesize', 'dimensions', 'percentage'
    $origImg = imageResourceFromFile($sourcePath, $srcExt);
    if (!$origImg) return false;

    $origW = imagesx($origImg);
    $origH = imagesy($origImg);
    $origSize = filesize($sourcePath);

    $tempDest = $destinationPath . '.tmp_resize_' . uniqid() . '.' . $outExt;

    if ($mode === 'filesize') {
        $targetAmount = floatval($options['target_size'] ?? 5);
        if ($targetAmount <= 0) $targetAmount = 5;
        $unit = strtoupper(trim($options['size_unit'] ?? 'MB'));
        $targetBytes = ($unit === 'KB') ? round($targetAmount * 1024) : round($targetAmount * 1048576);

        // If source is already smaller or equal, and same format, and no dimension restrictions:
        if ($origSize <= $targetBytes && $outExt === $srcExt) {
            @imagedestroy($origImg);
            if ($sourcePath !== $destinationPath) {
                return @copy($sourcePath, $destinationPath);
            }
            return true;
        }

        $tempTrial = $tempDest . '.trial';
        $bestSaved = false;
        $bestSize = 0;
        $isLossy = in_array($outExt, ['webp', 'jpeg', 'jpg', 'avif'], true);

        if ($isLossy) {
            // Check max quality (100) first to preserve maximum visual fidelity
            if (saveGdImageResource($origImg, $tempTrial, $outExt, 100)) {
                $curSize = (int)@filesize($tempTrial);
                if ($curSize > 0 && $curSize <= $targetBytes) {
                    @rename($tempTrial, $tempDest);
                    $bestSize = $curSize;
                    $bestSaved = true;
                }
            }

            // If quality 100 exceeds targetBytes, binary search quality [20..99] to find the highest quality <= targetBytes
            if (!$bestSaved) {
                $lowQ = 20;
                $highQ = 99;

                while ($lowQ <= $highQ) {
                    $midQ = (int)floor(($lowQ + $highQ) / 2);
                    if (saveGdImageResource($origImg, $tempTrial, $outExt, $midQ)) {
                        $curSize = (int)@filesize($tempTrial);
                        if ($curSize > 0 && $curSize <= $targetBytes) {
                            // Fits under target! Record as candidate and test higher quality to get even closer to target
                            @copy($tempTrial, $tempDest);
                            $bestSize = $curSize;
                            $bestSaved = true;
                            $lowQ = $midQ + 1;
                        } else {
                            // Too large, try lower quality
                            $highQ = $midQ - 1;
                        }
                    } else {
                        $highQ = $midQ - 1;
                    }
                }
            }

            // If even quality 20 at original resolution exceeds targetBytes, downscale dimensions proportionally
            if (!$bestSaved) {
                $sampleSize = $origSize;
                if (saveGdImageResource($origImg, $tempTrial, $outExt, 30)) {
                    $sampleSize = max(1, (int)@filesize($tempTrial));
                }
                $scaleFactor = min(0.95, max(0.1, sqrt($targetBytes / $sampleSize) * 0.98));
                $newW = max(10, (int)round($origW * $scaleFactor));
                $newH = max(10, (int)round($origH * $scaleFactor));
                $scaledImg = scaleGdImage($origImg, $newW, $newH);

                if ($scaledImg) {
                    $lowQ = 35;
                    $highQ = 98;
                    while ($lowQ <= $highQ) {
                        $midQ = (int)floor(($lowQ + $highQ) / 2);
                        if (saveGdImageResource($scaledImg, $tempTrial, $outExt, $midQ)) {
                            $curSize = (int)@filesize($tempTrial);
                            if ($curSize > 0 && $curSize <= $targetBytes) {
                                @copy($tempTrial, $tempDest);
                                $bestSize = $curSize;
                                $bestSaved = true;
                                $lowQ = $midQ + 1;
                            } else {
                                $highQ = $midQ - 1;
                            }
                        } else {
                            $highQ = $midQ - 1;
                        }
                    }
                    @imagedestroy($scaledImg);
                }
            }
        } else {
            // Lossless formats (PNG, GIF): binary search dimension scale [0.08..0.98]
            $lowScale = 0.08;
            $highScale = 0.98;

            while (($highScale - $lowScale) > 0.03) {
                $midScale = ($lowScale + $highScale) / 2.0;
                $newW = max(10, (int)round($origW * $midScale));
                $newH = max(10, (int)round($origH * $midScale));
                $scaledImg = scaleGdImage($origImg, $newW, $newH);
                if (!$scaledImg) {
                    $highScale = $midScale - 0.05;
                    continue;
                }

                if (saveGdImageResource($scaledImg, $tempTrial, $outExt, 85)) {
                    $curSize = (int)@filesize($tempTrial);
                    if ($curSize > 0 && $curSize <= $targetBytes) {
                        @copy($tempTrial, $tempDest);
                        $bestSize = $curSize;
                        $bestSaved = true;
                        $lowScale = $midScale; // try larger scale to get closer to target
                    } else {
                        $highScale = $midScale; // try smaller scale
                    }
                }
                @imagedestroy($scaledImg);
            }
        }

        if (file_exists($tempTrial)) @unlink($tempTrial);
        @imagedestroy($origImg);

        if ($bestSaved && file_exists($tempDest) && filesize($tempDest) > 0) {
            @rename($tempDest, $destinationPath);
            @chmod($destinationPath, 0644);
            return true;
        }
        if (file_exists($tempDest)) @unlink($tempDest);
        return false;

    } elseif ($mode === 'dimensions') {
        $targetW = max(1, intval($options['width'] ?? 0));
        $targetH = max(1, intval($options['height'] ?? 0));
        $maintainRatio = !empty($options['maintain_ratio']);
        $quality = max(20, min(100, intval($options['quality'] ?? 88)));

        if ($targetW <= 0 && $targetH <= 0) {
            $targetW = $origW;
            $targetH = $origH;
        } elseif ($targetW <= 0) {
            $targetW = max(1, (int)round($origW * ($targetH / $origH)));
        } elseif ($targetH <= 0) {
            $targetH = max(1, (int)round($origH * ($targetW / $origW)));
        } elseif ($maintainRatio) {
            $ratio = min($targetW / $origW, $targetH / $origH);
            $targetW = max(1, (int)round($origW * $ratio));
            $targetH = max(1, (int)round($origH * $ratio));
        }

        $scaledImg = scaleGdImage($origImg, $targetW, $targetH);
        @imagedestroy($origImg);
        if (!$scaledImg) return false;

        $saved = saveGdImageResource($scaledImg, $tempDest, $outExt, $quality);
        @imagedestroy($scaledImg);

        if ($saved && file_exists($tempDest) && filesize($tempDest) > 0) {
            @rename($tempDest, $destinationPath);
            @chmod($destinationPath, 0644);
            return true;
        }
        if (file_exists($tempDest)) @unlink($tempDest);
        return false;

    } elseif ($mode === 'percentage') {
        $percent = max(5, min(200, intval($options['percentage'] ?? 50)));
        $quality = max(20, min(100, intval($options['quality'] ?? 88)));
        $scale = $percent / 100.0;
        $targetW = max(1, (int)round($origW * $scale));
        $targetH = max(1, (int)round($origH * $scale));

        $scaledImg = scaleGdImage($origImg, $targetW, $targetH);
        @imagedestroy($origImg);
        if (!$scaledImg) return false;

        $saved = saveGdImageResource($scaledImg, $tempDest, $outExt, $quality);
        @imagedestroy($scaledImg);

        if ($saved && file_exists($tempDest) && filesize($tempDest) > 0) {
            @rename($tempDest, $destinationPath);
            @chmod($destinationPath, 0644);
            return true;
        }
        if (file_exists($tempDest)) @unlink($tempDest);
        return false;
    }

    @imagedestroy($origImg);
    return false;
}

function executeCommandSafe($cmd, &$output = null, &$returnCode = null, $timeoutSeconds = 0) {
    $output = [];
    $returnCode = 1;
    if (function_exists('proc_open')) {
        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w']
        ];
        $process = @proc_open($cmd, $descriptors, $pipes);
        if (is_resource($process)) {
            @fclose($pipes[0]);
            stream_set_blocking($pipes[1], false);
            stream_set_blocking($pipes[2], false);

            $stdout = '';
            $stderr = '';
            $startTime = microtime(true);
            $timedOut = false;

            while (true) {
                $read = [$pipes[1], $pipes[2]];
                $write = null;
                $except = null;
                $numChanged = @stream_select($read, $write, $except, 0, 50000);

                if ($numChanged > 0) {
                    foreach ($read as $r) {
                        $chunk = fread($r, 8192);
                        if ($chunk !== false && strlen($chunk) > 0) {
                            if ($r === $pipes[1]) {
                                $stdout .= $chunk;
                            } else {
                                $stderr .= $chunk;
                            }
                        }
                    }
                }

                $status = @proc_get_status($process);
                if (!$status || !$status['running']) {
                    while (($chunk = fread($pipes[1], 8192)) !== false && strlen($chunk) > 0) {
                        $stdout .= $chunk;
                    }
                    while (($chunk = fread($pipes[2], 8192)) !== false && strlen($chunk) > 0) {
                        $stderr .= $chunk;
                    }
                    break;
                }

                if ($timeoutSeconds > 0 && (microtime(true) - $startTime) > $timeoutSeconds) {
                    $timedOut = true;
                    @proc_terminate($process, 9);
                    break;
                }
            }

            @fclose($pipes[1]);
            @fclose($pipes[2]);
            $returnCode = $timedOut ? 124 : @proc_close($process);

            $combined = trim($stdout . "\n" . $stderr);
            if ($combined !== '') {
                $output = explode("\n", $combined);
            }
            return (!$timedOut && $returnCode === 0);
        }
    }
    if (function_exists('exec')) {
        @exec($cmd, $output, $returnCode);
        return ($returnCode === 0);
    }
    if (function_exists('shell_exec')) {
        $res = @shell_exec($cmd);
        if ($res !== null) {
            $output = explode("\n", trim($res));
            $returnCode = 0;
            return true;
        }
    }
    return false;
}

function findFfmpegBinary() {
    static $cachedFfmpeg = null;
    if ($cachedFfmpeg !== null) return $cachedFfmpeg;

    $candidates = [
        __DIR__ . "/bin/ffmpeg",
        dirname(__DIR__) . "/bin/ffmpeg",
        "/home/u768808434/domains/miniexcavator.org/public_html/img/bin/ffmpeg",
        "/home/u768808434/bin/ffmpeg",
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        "/usr/bin/ffmpeg",
        "/bin/ffmpeg",
    ];

    foreach ($candidates as $candidate) {
        if (@is_file($candidate) && @is_executable($candidate)) {
            $cachedFfmpeg = $candidate;
            return $cachedFfmpeg;
        }
    }

    $out = [];
    $ret = 1;
    if (executeCommandSafe("which ffmpeg 2>/dev/null", $out, $ret) && !empty($out)) {
        $which = trim($out[0]);
        if ($which !== "" && @is_file($which) && @is_executable($which)) {
            $cachedFfmpeg = $which;
            return $cachedFfmpeg;
        }
    }

    $cachedFfmpeg = false;
    return false;
}

function getVideoProbeInfo($sourcePath) {
    $ffmpeg = findFfmpegBinary();
    if (!$ffmpeg || !file_exists($sourcePath) || filesize($sourcePath) === 0) {
        return ['duration' => 0, 'bitrate' => 0, 'width' => 0, 'height' => 0];
    }
    $src = escapeshellarg($sourcePath);
    $out = [];
    $ret = 1;
    // Fast metadata probe without decoding frames: takes ~50ms
    executeCommandSafe("{$ffmpeg} -i {$src} 2>&1", $out, $ret, 10);
    $text = implode("\n", $out);

    $duration = 0.0;
    if (preg_match('/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i', $text, $m)) {
        $duration = ((int)$m[1] * 3600) + ((int)$m[2] * 60) + (float)$m[3];
    }

    $bitrate = 0;
    if (preg_match('/bitrate:\s*(\d+)\s*kb\/s/i', $text, $m)) {
        $bitrate = (int)$m[1];
    } elseif ($duration > 0) {
        $bytes = filesize($sourcePath);
        $bitrate = (int)round(($bytes * 8) / ($duration * 1000));
    }

    $width = 0;
    $height = 0;
    if (preg_match('/Video:.*,\s*(\d{2,5})x(\d{2,5})/i', $text, $m)) {
        $width = (int)$m[1];
        $height = (int)$m[2];
    }

    return [
        'duration' => $duration,
        'bitrate' => $bitrate,
        'width' => $width,
        'height' => $height
    ];
}

function optimizeMp4Faststart($filePath) {
    $ffmpeg = findFfmpegBinary();
    if (!$ffmpeg || !file_exists($filePath) || filesize($filePath) === 0) return false;
    
    $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    if (!in_array($ext, ['mp4', 'm4v'], true)) return false;

    $tempDest = $filePath . '.fast.mp4';
    $src = escapeshellarg($filePath);
    $dest = escapeshellarg($tempDest);

    // Fast copy mode: relocates 'moov' atom to beginning for instant streaming in ~0.2s without re-encoding!
    $cmd = "{$ffmpeg} -y -i {$src} -c copy -movflags +faststart {$dest} 2>&1";
    $out = [];
    $ret = 1;
    if (executeCommandSafe($cmd, $out, $ret, 30) && file_exists($tempDest) && filesize($tempDest) > 0) {
        @rename($tempDest, $filePath);
        @chmod($filePath, 0644);
        return true;
    }
    if (file_exists($tempDest)) @unlink($tempDest);
    return false;
}

function saveOptimizedWebm($sourcePath, $destinationPath, $maxExecutionSeconds = 180) {
    return false;
}

function storeUploadedTempFile($tmpName, $destination) {
    if (is_uploaded_file($tmpName) && @move_uploaded_file($tmpName, $destination)) return true;
    if (@rename($tmpName, $destination)) return true;
    if (@copy($tmpName, $destination)) {
        @unlink($tmpName);
        return true;
    }
    return false;
}

function triggerBackgroundWebmConvert($sourcePath) {
    return false;
}

function iniSizeToBytes($val) {
    $val = trim((string)$val);
    if ($val === "" || $val === "-1") return -1;
    $num = (float)$val;
    $unit = strtolower(substr($val, -1));
    if ($unit === "g") return (int)round($num * 1024 * 1024 * 1024);
    if ($unit === "m") return (int)round($num * 1024 * 1024);
    if ($unit === "k") return (int)round($num * 1024);
    return (int)$num;
}

function hasEnoughMemoryBudget($requiredBytes) {
    $limit = iniSizeToBytes(ini_get("memory_limit"));
    if ($limit < 0) return true;
    $remaining = $limit - memory_get_usage(true);
    return $remaining > $requiredBytes;
}

function canAttemptImageOptimization($sourcePath) {
    $info = @getimagesize($sourcePath);
    if (!$info || empty($info[0]) || empty($info[1])) return false;
    $width = (int)$info[0];
    $height = (int)$info[1];
    $pixels = max(1, $width) * max(1, $height);
    $required = (int)($pixels * 10) + (16 * 1024 * 1024);
    return hasEnoughMemoryBudget($required);
}

function uploadErrorMessage($code) {
    switch ((int)$code) {
        case UPLOAD_ERR_INI_SIZE:
            return "File is larger than server upload limit (upload_max_filesize).";
        case UPLOAD_ERR_FORM_SIZE:
            return "File is larger than allowed by form size limit.";
        case UPLOAD_ERR_PARTIAL:
            return "File was only partially uploaded.";
        case UPLOAD_ERR_NO_FILE:
            return "No file was uploaded.";
        case UPLOAD_ERR_NO_TMP_DIR:
            return "Server missing temporary upload folder.";
        case UPLOAD_ERR_CANT_WRITE:
            return "Server cannot write file to disk.";
        case UPLOAD_ERR_EXTENSION:
            return "Upload blocked by server extension.";
        default:
            return "Upload failed due to an unknown server error.";
    }
}

function isCodeFile($filename) {
    global $codeExtensions;
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    return in_array($ext, $codeExtensions);
}

function publicUrl($baseUrl, $relativePath) {
    $relativePath = cleanPath($relativePath);
    $parts = explode("/", $relativePath);
    $encoded = array_map("rawurlencode", $parts);
    return $baseUrl . "/" . implode("/", $encoded);
}

function versionedImageUrl($url, $mtime = 0, $size = 0, $changedAt = 0) {
    $version = (int)$mtime . "-" . (int)$size;
    return $url . (strpos($url, "?") === false ? "?" : "&") . "v=" . rawurlencode($version);
}

function handleThumbnailRequest() {
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }
    // Images are already compressed: drop the gzip output buffer so thumbnails stream straight out (less CPU, faster first byte).
    while (ob_get_level() > 0) { @ob_end_clean(); }
    global $BASE_DIR, $APP_ASSETS_DIR, $APP_ASSETS_URL, $isWebsiteTeam;
    $reqPath = cleanPath($_GET['path'] ?? ($_GET['f'] ?? ''));
    if ($reqPath === '') {
        http_response_code(400);
        exit('Missing image path');
    }
    $width = isset($_GET['w']) ? max(60, min(800, (int)$_GET['w'])) : 360;
    $quality = 82;

    $sourcePath = $isWebsiteTeam ? safeFullPath($BASE_DIR . "/../ebay", $reqPath) : safeFullPath($BASE_DIR, $reqPath);
    if (!is_file($sourcePath) || !isImageFile($sourcePath)) {
        http_response_code(404);
        exit('Image not found');
    }

    $mtime = (int)@filemtime($sourcePath);
    $cacheFile = md5($reqPath . '_' . $mtime . '_' . $width) . '.webp';
    $cacheDir = $APP_ASSETS_DIR . '/cache/thumbs';
    $cachePath = $cacheDir . '/' . $cacheFile;

    // Check primary cache
    if (is_file($cachePath) && filesize($cachePath) > 0) {
        $etag = '"' . md5($cacheFile) . '"';
        header('Content-Type: image/webp');
        header('Cache-Control: public, max-age=31536000, immutable');
        header('ETag: ' . $etag);
        if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH']) === $etag) {
            http_response_code(304);
            exit;
        }
        header('Content-Length: ' . filesize($cachePath));
        readfile($cachePath);
        exit;
    }

    $ext = strtolower(pathinfo($sourcePath, PATHINFO_EXTENSION));
    if ($ext === 'svg') {
        header('Content-Type: image/svg+xml');
        header('Cache-Control: public, max-age=31536000, immutable');
        readfile($sourcePath);
        exit;
    }

    // Try creating cache dir
    if (!is_dir($cacheDir)) @mkdir($cacheDir, 0777, true);
    if (!is_dir($cacheDir) || !is_writable($cacheDir)) {
        $cacheDir = sys_get_temp_dir() . '/kiuq_thumbs';
        if (!is_dir($cacheDir)) @mkdir($cacheDir, 0777, true);
        $cachePath = $cacheDir . '/' . $cacheFile;
    }

    // Check temp cache too
    if (is_file($cachePath) && filesize($cachePath) > 0) {
        $etag = '"' . md5($cacheFile) . '"';
        header('Content-Type: image/webp');
        header('Cache-Control: public, max-age=31536000, immutable');
        header('ETag: ' . $etag);
        if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH']) === $etag) {
            http_response_code(304);
            exit;
        }
        header('Content-Length: ' . filesize($cachePath));
        readfile($cachePath);
        exit;
    }

    $src = imageResourceFromFile($sourcePath, $ext);
    if (!$src) {
        $mime = image_type_to_mime_type(@exif_imagetype($sourcePath) ?: IMAGETYPE_JPEG);
        header('Content-Type: ' . $mime);
        header('Cache-Control: public, max-age=86400');
        readfile($sourcePath);
        exit;
    }

    $origW = imagesx($src);
    $origH = imagesy($src);

    if ($origW > $width) {
        $newW = $width;
        $newH = max(1, (int)round(($origH / $origW) * $width));
        $canvas = imagecreatetruecolor($newW, $newH);
        if ($canvas) {
            imagealphablending($canvas, false);
            imagesavealpha($canvas, true);
            $transparent = imagecolorallocatealpha($canvas, 0, 0, 0, 127);
            imagefilledrectangle($canvas, 0, 0, $newW, $newH, $transparent);
            imagecopyresampled($canvas, $src, 0, 0, 0, 0, $newW, $newH, $origW, $origH);
            @imagedestroy($src);
            $src = $canvas;
        }
    }

    imagepalettetotruecolor($src);
    imagealphablending($src, false);
    imagesavealpha($src, true);

    if (function_exists('imagewebp')) {
        @imagewebp($src, $cachePath, $quality);
        @imagedestroy($src);
        if (is_file($cachePath) && filesize($cachePath) > 0) {
            $etag = '"' . md5($cacheFile) . '"';
            header('Content-Type: image/webp');
            header('Cache-Control: public, max-age=31536000, immutable');
            header('ETag: ' . $etag);
            header('Content-Length: ' . filesize($cachePath));
            readfile($cachePath);
            exit;
        }
    } elseif (function_exists('imagejpeg')) {
        @imagejpeg($src, $cachePath, 80);
        @imagedestroy($src);
        if (is_file($cachePath) && filesize($cachePath) > 0) {
            header('Content-Type: image/jpeg');
            header('Cache-Control: public, max-age=31536000, immutable');
            header('Content-Length: ' . filesize($cachePath));
            readfile($cachePath);
            exit;
        }
    }

    if (is_resource($src) || $src instanceof GdImage) @imagedestroy($src);
    readfile($sourcePath);
    exit;
}

/**
 * Flush the response to the browser and keep running (works on PHP-FPM and LiteSpeed). Returns true if supported.
 */
function kiuq_finish_request() {
    while (ob_get_level() > 0) { @ob_end_flush(); }
    if (function_exists('fastcgi_finish_request')) { @fastcgi_finish_request(); return true; }
    if (function_exists('litespeed_finish_request')) { @litespeed_finish_request(); return true; }
    return false;
}

function getThumbnailUrl($relative, $absPath = '', $mtime = 0, $width = 360) {
    static $thumbCache = [];
    $cacheKey = $relative . '|' . (int)$mtime . '|' . (int)$width;
    if (isset($thumbCache[$cacheKey])) {
        return $thumbCache[$cacheKey];
    }
    global $APP_ASSETS_DIR, $APP_ASSETS_URL, $pageUrl;
    $cleanRel = cleanPath((string)$relative);
    $cacheFile = md5($cleanRel . '_' . (int)$mtime . '_' . (int)$width) . '.webp';
    $cachePath = $APP_ASSETS_DIR . '/cache/thumbs/' . $cacheFile;
    if (is_file($cachePath) && filesize($cachePath) > 0) {
        $result = $APP_ASSETS_URL . '/cache/thumbs/' . rawurlencode($cacheFile);
    } else {
        global $BASE_URL;
        $srcExt = strtolower(pathinfo($cleanRel, PATHINFO_EXTENSION));
        $srcSize = ($absPath !== '' && is_file($absPath)) ? (int)@filesize($absPath) : 0;
        if ($srcSize > 0 && $srcSize <= 160 * 1024 && in_array($srcExt, ['webp', 'jpg', 'jpeg', 'png', 'gif', 'avif', 'svg'], true) && !empty($BASE_URL)) {
            // Already tiny: let the web server hand out the file directly (static + cached) instead of waking PHP for a thumbnail
            $result = versionedImageUrl(publicUrl($BASE_URL, $cleanRel), $mtime, $srcSize);
        } else {
            $result = $pageUrl . '?action=thumb&path=' . urlencode($cleanRel) . '&w=' . (int)$width . '&v=' . (int)$mtime;
            if ($absPath !== '' && is_file($absPath)) kiuqQueueThumbBuild($absPath, $cachePath, $width);
        }
    }
    $thumbCache[$cacheKey] = $result;
    return $result;
}

/**
 * Thumbnails that are missing are built right after the page has been sent to the browser,
 * so the next visit (and the images further down the list) are served as static files.
 */
function kiuqQueueThumbBuild($absPath, $cachePath, $width) {
    static $registered = false;
    global $kiuqThumbQueue;
    if (!is_array($kiuqThumbQueue)) $kiuqThumbQueue = [];
    if (count($kiuqThumbQueue) >= 40) return;
    $kiuqThumbQueue[] = [$absPath, $cachePath, (int)$width];
    if (!$registered) {
        $registered = true;
        register_shutdown_function('kiuqRunThumbQueue');
    }
}

function kiuqRunThumbQueue() {
    global $kiuqThumbQueue;
    if (empty($kiuqThumbQueue) || !function_exists('imagewebp')) return;
    if (!kiuq_finish_request()) return;
    @ignore_user_abort(true);
    @set_time_limit(60);
    foreach ($kiuqThumbQueue as $job) {
        list($src, $dest, $w) = $job;
        try {
            if (is_file($dest) && filesize($dest) > 0) continue;
            $ext = strtolower(pathinfo($src, PATHINFO_EXTENSION));
            if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'avif'], true)) continue;
            if (!canAttemptImageOptimization($src)) continue;
            $dir = dirname($dest);
            if (!is_dir($dir)) @mkdir($dir, 0777, true);
            if (!is_dir($dir) || !is_writable($dir)) continue;
            $im = imageResourceFromFile($src, $ext);
            if (!$im) continue;
            $ow = imagesx($im);
            $oh = imagesy($im);
            if ($ow > $w) {
                $nh = max(1, (int)round(($oh / $ow) * $w));
                $canvas = imagecreatetruecolor($w, $nh);
                if ($canvas) {
                    imagealphablending($canvas, false);
                    imagesavealpha($canvas, true);
                    imagefilledrectangle($canvas, 0, 0, $w, $nh, imagecolorallocatealpha($canvas, 0, 0, 0, 127));
                    imagecopyresampled($canvas, $im, 0, 0, 0, 0, $w, $nh, $ow, $oh);
                    imagedestroy($im);
                    $im = $canvas;
                }
            }
            imagepalettetotruecolor($im);
            imagealphablending($im, false);
            imagesavealpha($im, true);
            $tmp = $dest . '.' . getmypid() . '.tmp';
            @imagewebp($im, $tmp, 82);
            imagedestroy($im);
            if (is_file($tmp) && filesize($tmp) > 0) {
                if (!@rename($tmp, $dest)) @unlink($tmp);
            } else {
                @unlink($tmp);
            }
        } catch (\Throwable $e) {}
    }
}

function verifyAdminPassword($password) {
    global $ADMIN_PASS_HASH;
    return is_string($password) && password_verify($password, $ADMIN_PASS_HASH);
}

function verifyDeletePassword($password) {
    global $DELETE_PASS_HASH;
    return is_string($password) && password_verify($password, $DELETE_PASS_HASH);
}

function loginDeviceId() {
    global $secureCookie;
    $cookieName = "kiuq_device";
    $id = $_COOKIE[$cookieName] ?? "";
    if (!is_string($id) || !preg_match("/^[a-f0-9]{32}$/", $id)) {
        $id = bin2hex(random_bytes(16));
        setcookie($cookieName, $id, [
            "expires" => time() + 31536000,
            "path" => "/",
            "secure" => $secureCookie,
            "httponly" => true,
            "samesite" => "Strict",
        ]);
        $_COOKIE[$cookieName] = $id;
    }
    return $id;
}

function loginIdentity() {
    $ip = $_SERVER["REMOTE_ADDR"] ?? "unknown";
    $ua = substr($_SERVER["HTTP_USER_AGENT"] ?? "unknown", 0, 180);
    $deviceId = loginDeviceId();
    return [
        "device_key" => hash("sha256", $deviceId),
        "fingerprint" => hash("sha256", $ip . "|" . $ua),
        "ip" => $ip,
        "user_agent" => $ua,
    ];
}

function loadSecurityData() {
    global $SECURITY_FILE;
    static $cache = null;
    if ($cache !== null) return $cache;
    $data = readJsonFile($SECURITY_FILE, ["attempts" => [], "banned" => []]);
    if (!isset($data["attempts"]) || !is_array($data["attempts"])) $data["attempts"] = [];
    if (!isset($data["banned"]) || !is_array($data["banned"])) $data["banned"] = [];
    $cache = $data;
    return $data;
}

function saveSecurityData($data) {
    global $SECURITY_FILE;
    writeJsonFile($SECURITY_FILE, $data);
}

function defaultAppSettings() {
    return [
        "app_name" => "File Manager-KiuQ",
        "dashboard_logo_url" => "",
        "favicon_url" => "",
        "dashboard_theme_url" => "",
        "footer_name" => "KiuQ.com",
    ];
}

function loadAppSettings() {
    global $APP_SETTINGS_FILE;
    static $cache = null;
    if ($cache !== null) return $cache;
    $cache = array_merge(defaultAppSettings(), readJsonFile($APP_SETTINGS_FILE, []));
    return $cache;
}

function saveAppSettings($settings) {
    global $APP_SETTINGS_FILE;
    writeJsonFile($APP_SETTINGS_FILE, array_merge(defaultAppSettings(), $settings));
}

function saveUploadedAppAsset($field, $prefix) {
    global $APP_ASSETS_DIR, $APP_ASSETS_URL;
    if (empty($_FILES[$field]) || ($_FILES[$field]["error"] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return ["ok" => true, "url" => ""];
    }
    if (($_FILES[$field]["error"] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK || !is_uploaded_file($_FILES[$field]["tmp_name"] ?? "")) {
        return ["ok" => false, "error" => "Could not upload " . str_replace("_", " ", $field) . "."];
    }

    $originalName = cleanName($_FILES[$field]["name"] ?? "");
    $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    $allowed = ["jpg", "jpeg", "png", "webp", "gif", "ico", "avif"];
    if (!in_array($ext, $allowed, true)) {
        return ["ok" => false, "error" => "Logo and favicon uploads must be JPG, PNG, WebP, GIF, or ICO files."];
    }

    if ($ext !== "ico" && !@getimagesize($_FILES[$field]["tmp_name"])) {
        return ["ok" => false, "error" => "Uploaded branding file is not a valid image."];
    }

    $filename = $prefix . "-" . date("YmdHis") . "-" . bin2hex(random_bytes(4)) . "." . $ext;
    $destination = $APP_ASSETS_DIR . "/" . $filename;
    if (!move_uploaded_file($_FILES[$field]["tmp_name"], $destination)) {
        return ["ok" => false, "error" => "Could not save uploaded branding file."];
    }

    return ["ok" => true, "url" => $APP_ASSETS_URL . "/" . rawurlencode($filename)];
}

function profileAssetUrl($filename) {
    global $requestScheme, $httpHost, $scriptBasePath;
    return $requestScheme . "://" . $httpHost . (($scriptBasePath === "" || $scriptBasePath === ".") ? "/profileimg/" : $scriptBasePath . "/profileimg/") . rawurlencode($filename);
}

function cssUrlValue($url) {
    return str_replace(["\\", "\"", "\n", "\r"], ["\\\\", "\\\"", "", ""], (string)$url);
}

function loadThemeLibrary() {
    global $THEME_LIBRARY_FILE;
    $data = readJsonFile($THEME_LIBRARY_FILE, ["items" => []]);
    if (!isset($data["items"]) || !is_array($data["items"])) $data["items"] = [];
    $seen = [];
    $items = [];
    foreach ($data["items"] as $item) {
        $url = trim((string)($item["url"] ?? ""));
        if ($url === "" || !filter_var($url, FILTER_VALIDATE_URL) || isset($seen[$url])) continue;
        $seen[$url] = true;
        $items[] = [
            "name" => trim((string)($item["name"] ?? "")) ?: "Saved Theme",
            "url" => $url,
            "mtime" => (int)($item["mtime"] ?? 0),
        ];
    }
    return ["items" => $items];
}

function saveThemeLibrary($data) {
    global $THEME_LIBRARY_FILE;
    writeJsonFile($THEME_LIBRARY_FILE, ["items" => array_values($data["items"] ?? [])]);
}

function themeNameFromUrl($url) {
    $host = parse_url($url, PHP_URL_HOST);
    $path = parse_url($url, PHP_URL_PATH);
    $base = $path ? cleanBaseName(basename($path)) : "";
    $label = $base !== "image" ? $base : ($host ?: "Saved Theme");
    $label = str_replace(["-", "_"], " ", $label);
    return ucwords(trim($label)) ?: "Saved Theme";
}

function defaultDashboardThemePresets() {
    return [
        [
            "name" => "Aurora Mountain Peak",
            "filename" => "preset-aurora.jpg",
        ],
        [
            "name" => "Cyberpunk Metropolis",
            "filename" => "preset-cyberpunk.jpg",
        ],
        [
            "name" => "Deep Cosmic Nebula",
            "filename" => "preset-cosmic.jpg",
        ],
        [
            "name" => "Sunset Ocean Horizon",
            "filename" => "preset-sunset.jpg",
        ],
    ];
}

function defaultDashboardThemeUrls() {
    $urls = [];
    foreach (defaultDashboardThemePresets() as $preset) {
        $urls[] = profileAssetUrl($preset["filename"]);
    }
    return $urls;
}

function shouldSaveDashboardThemeUrlToLibrary($url) {
    $url = trim((string)$url);
    if ($url === "" || !filter_var($url, FILTER_VALIDATE_URL)) return false;
    if (in_array($url, defaultDashboardThemeUrls(), true)) return false;
    $path = parse_url($url, PHP_URL_PATH);
    $name = $path ? basename(rawurldecode($path)) : "";
    if (str_starts_with($name, "preset-")) return false;
    return !str_starts_with($name, "dashboard-theme-");
}

function saveDashboardThemeUrlToLibrary($url) {
    $url = trim((string)$url);
    if (!shouldSaveDashboardThemeUrlToLibrary($url)) return null;
    $library = loadThemeLibrary();
    foreach ($library["items"] as &$item) {
        if (($item["url"] ?? "") === $url) {
            $item["mtime"] = time();
            $item["name"] = trim((string)($item["name"] ?? "")) ?: themeNameFromUrl($url);
            $savedItem = $item;
            unset($item);
            saveThemeLibrary($library);
            return $savedItem;
        }
    }
    unset($item);
    $item = ["name" => themeNameFromUrl($url), "url" => $url, "mtime" => time()];
    array_unshift($library["items"], $item);
    saveThemeLibrary($library);
    return $item;
}

function listDashboardThemeImages() {
    $profileDir = __DIR__ . "/profileimg";
    $allowed = ["jpg", "jpeg", "png", "webp", "gif", "avif"];
    $defaultImages = [];
    foreach (defaultDashboardThemePresets() as $preset) {
        $filePath = $profileDir . "/" . $preset["filename"];
        $defaultImages[] = [
            "name" => $preset["name"],
            "url" => profileAssetUrl($preset["filename"]),
            "mtime" => is_file($filePath) ? (int)@filemtime($filePath) : 0,
            "can_delete" => false,
        ];
    }
    $items = [];
    $libraryItems = [];
    foreach (loadThemeLibrary()["items"] as $item) {
        $libraryItems[] = [
            "name" => $item["name"],
            "url" => $item["url"],
            "mtime" => (int)($item["mtime"] ?? 0),
            "can_delete" => true,
        ];
    }
    if (!is_dir($profileDir)) return array_merge($defaultImages, $libraryItems);

    foreach (scandir($profileDir) as $name) {
        if ($name === "." || $name === ".." || str_starts_with($name, ".")) continue;
        if (str_starts_with($name, "preset-")) continue; // built-in presets listed above
        $path = $profileDir . "/" . $name;
        if (!is_file($path)) continue;
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if (!in_array($ext, $allowed, true)) continue;
        $items[] = [
            "name" => $name,
            "url" => profileAssetUrl($name),
            "mtime" => (int)@filemtime($path),
            "can_delete" => str_starts_with($name, "dashboard-theme-"),
        ];
    }

    usort($items, fn($a, $b) => ($b["mtime"] ?? 0) <=> ($a["mtime"] ?? 0));
    usort($libraryItems, fn($a, $b) => ($b["mtime"] ?? 0) <=> ($a["mtime"] ?? 0));
    return array_merge($defaultImages, $libraryItems, $items);
}

function saveUploadedDashboardThemeImage($field) {
    if (empty($_FILES[$field]) || ($_FILES[$field]["error"] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return ["ok" => false, "error" => "Choose an image first."];
    }
    if (($_FILES[$field]["error"] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK || !is_uploaded_file($_FILES[$field]["tmp_name"] ?? "")) {
        return ["ok" => false, "error" => "Could not upload theme image."];
    }

    $tmp = $_FILES[$field]["tmp_name"];
    $info = @getimagesize($tmp);
    if (!$info || empty($info["mime"])) {
        return ["ok" => false, "error" => "Uploaded theme file is not a valid image."];
    }

    $profileDir = __DIR__ . "/profileimg";
    if (!is_dir($profileDir)) mkdir($profileDir, 0777, true);

    $img = null;
    $mime = (string)$info["mime"];
    if ($mime === "image/jpeg" && function_exists("imagecreatefromjpeg")) $img = @imagecreatefromjpeg($tmp);
    elseif ($mime === "image/png" && function_exists("imagecreatefrompng")) $img = @imagecreatefrompng($tmp);
    elseif ($mime === "image/webp" && function_exists("imagecreatefromwebp")) $img = @imagecreatefromwebp($tmp);
    elseif ($mime === "image/gif" && function_exists("imagecreatefromgif")) $img = @imagecreatefromgif($tmp);
    elseif (($mime === "image/avif" || $mime === "image/x-avif") && function_exists("imagecreatefromavif")) $img = @imagecreatefromavif($tmp);

    $saved = false;
    $fileName = "";
    $dest = "";

    if ($img && function_exists("imagewebp")) {
        $width = imagesx($img);
        $height = imagesy($img);
        $maxDim = 2560;
        if ($width > $maxDim || $height > $maxDim) {
            $ratio = min($maxDim / $width, $maxDim / $height);
            $newW = (int)round($width * $ratio);
            $newH = (int)round($height * $ratio);
            $resized = imagecreatetruecolor($newW, $newH);
            imagealphablending($resized, false);
            imagesavealpha($resized, true);
            imagecopyresampled($resized, $img, 0, 0, 0, 0, $newW, $newH, $width, $height);
            imagedestroy($img);
            $img = $resized;
        }
        imagepalettetotruecolor($img);
        imagealphablending($img, true);
        imagesavealpha($img, true);
        $fileName = "dashboard-theme-" . date("YmdHis") . "-" . bin2hex(random_bytes(4)) . ".webp";
        $dest = $profileDir . "/" . $fileName;
        $saved = imagewebp($img, $dest, 90);
        imagedestroy($img);
    } else {
        $ext = strtolower(pathinfo($_FILES[$field]["name"] ?? "image.jpg", PATHINFO_EXTENSION));
        if (!in_array($ext, ["jpg", "jpeg", "png", "webp", "gif", "avif"], true)) $ext = "jpg";
        $fileName = "dashboard-theme-" . date("YmdHis") . "-" . bin2hex(random_bytes(4)) . "." . $ext;
        $dest = $profileDir . "/" . $fileName;
        $saved = move_uploaded_file($tmp, $dest);
    }

    if (!$saved || !is_file($dest)) {
        if (is_file($dest)) @unlink($dest);
        return ["ok" => false, "error" => "Could not save theme image."];
    }

    @chmod($dest, 0644);
    return ["ok" => true, "url" => profileAssetUrl($fileName), "name" => $fileName];
}

function saveCurrentUserDashboardTheme($userId, $themeUrl) {
    $data = loadUsers();
    $saved = false;
    foreach ($data["users"] as &$row) {
        if (($row["id"] ?? "") === $userId) {
            $row["dashboard_theme_url"] = $themeUrl;
            $row["updated_at"] = time();
            $saved = true;
            break;
        }
    }
    unset($row);
    if ($saved) saveUsers($data);
    return $saved;
}

function clearDashboardThemeUrlForUsers($themeUrl) {
    $themeUrl = trim((string)$themeUrl);
    if ($themeUrl === "") return;
    $data = loadUsers();
    $changed = false;
    foreach ($data["users"] as &$row) {
        if (($row["dashboard_theme_url"] ?? "") === $themeUrl) {
            $row["dashboard_theme_url"] = "";
            $row["updated_at"] = time();
            $changed = true;
        }
    }
    unset($row);
    if ($changed) saveUsers($data);
}

function deleteDashboardThemeImage($themeUrl) {
    $themeUrl = trim((string)$themeUrl);
    if ($themeUrl === "" || !filter_var($themeUrl, FILTER_VALIDATE_URL)) {
        return ["success" => false, "error" => "Theme image not found."];
    }

    $library = loadThemeLibrary();
    $kept = [];
    $removed = false;
    foreach ($library["items"] as $item) {
        if (($item["url"] ?? "") === $themeUrl) {
            $removed = true;
            continue;
        }
        $kept[] = $item;
    }
    if ($removed) {
        $library["items"] = $kept;
        saveThemeLibrary($library);
        clearDashboardThemeUrlForUsers($themeUrl);
        return ["success" => true];
    }

    $profileDir = realpath(__DIR__ . "/profileimg");
    if ($profileDir) {
        $path = parse_url($themeUrl, PHP_URL_PATH);
        $name = $path ? basename(rawurldecode($path)) : "";
        if ($name !== "" && str_starts_with($name, "dashboard-theme-")) {
            $file = $profileDir . DIRECTORY_SEPARATOR . cleanExistingName($name);
            $real = realpath($file);
            if ($real && strpos($real, $profileDir . DIRECTORY_SEPARATOR) === 0 && is_file($real)) {
                @unlink($real);
                clearDashboardThemeUrlForUsers($themeUrl);
                return ["success" => true];
            }
        }
    }

    return ["success" => false, "error" => "Default theme images cannot be deleted."];
}

function defaultUsers() {
    global $ADMIN_USER, $ADMIN_PASS_HASH;
    return [
        "users" => [
            [
                "id" => "main-admin",
                "username" => $ADMIN_USER,
                "password_hash" => $ADMIN_PASS_HASH,
                "role" => "admin",
                "status" => "active",
                "display_name" => "Main Admin",
                "avatar_url" => "",
                "theme" => "light",
                "dashboard_theme_url" => "",
                "is_main_admin" => true,
                "can_view_login_activity" => true,
                "created_at" => time(),
                "updated_at" => time(),
            ],
        ],
    ];
}

function allowedUserRoles() {
    return ["admin", "staff", "converter", "website_team"];
}

function normalizeUserRole($role) {
    $role = strtolower((string)$role);
    return in_array($role, allowedUserRoles(), true) ? $role : "staff";
}

function roleLabel($role) {
    $labels = [
        "admin" => "Admin",
        "staff" => "Staff",
        "converter" => "Converter",
        "website_team" => "Website Team",
    ];
    $role = normalizeUserRole($role);
    return $labels[$role] ?? "Staff";
}

function loadUsers() {
    global $USERS_FILE;
    static $cache = null;
    if ($cache !== null) return $cache;
    $data = readJsonFile($USERS_FILE, defaultUsers());
    if (empty($data["users"]) || !is_array($data["users"])) $data = defaultUsers();
    $hasMain = false;
    $needsSave = false;
    foreach ($data["users"] as &$user) {
        if (!isset($user["id"])) { $user["id"] = bin2hex(random_bytes(8)); $needsSave = true; }
        $user["role"] = normalizeUserRole($user["role"] ?? "staff");
        $user["status"] = ($user["status"] ?? "active") === "frozen" ? "frozen" : "active";
        $user["display_name"] = trim($user["display_name"] ?? "") ?: ($user["username"] ?? "User");
        $user["avatar_url"] = trim($user["avatar_url"] ?? "");
        $user["theme"] = in_array($user["theme"] ?? "light", ["light", "dark", "system"], true) ? $user["theme"] : "light";
        $user["dashboard_theme_url"] = trim($user["dashboard_theme_url"] ?? "");
        $dUrl = $user["dashboard_theme_url"];
        if ($dUrl !== "" && !(filter_var($dUrl, FILTER_VALIDATE_URL) || str_starts_with($dUrl, "/") || str_starts_with($dUrl, "profileimg/") || str_contains($dUrl, "preset-") || str_starts_with($dUrl, "data:"))) {
            $user["dashboard_theme_url"] = "";
        }
        $user["can_view_login_activity"] = (bool)($user["can_view_login_activity"] ?? true);
        $user["is_main_admin"] = (bool)($user["is_main_admin"] ?? false);
        if ($user["is_main_admin"]) $hasMain = true;
    }
    unset($user);
    if (!$hasMain && !empty($data["users"][0])) {
        $data["users"][0]["role"] = "admin";
        $data["users"][0]["is_main_admin"] = true;
        $data["users"][0]["status"] = "active";
        $needsSave = true;
    }
    if ($needsSave) {
        saveUsers($data);
    }
    $cache = $data;
    return $data;
}

function saveUsers($data) {
    global $USERS_FILE;
    writeJsonFile($USERS_FILE, $data);
}

function findUserByUsername($username) {
    $username = strtolower(trim($username));
    foreach (loadUsers()["users"] as $user) {
        if (strtolower($user["username"] ?? "") === $username) return $user;
    }
    return null;
}

function findUserById($id) {
    foreach (loadUsers()["users"] as $user) {
        if (($user["id"] ?? "") === $id) return $user;
    }
    return null;
}

function currentUser() {
    if (!empty($_SESSION["user_id"])) {
        $user = findUserById($_SESSION["user_id"]);
        if ($user && ($user["status"] ?? "active") === "active") return $user;
    }
    if (!empty($_SESSION["admin_logged_in"])) {
        foreach (loadUsers()["users"] as $user) {
            if (!empty($user["is_main_admin"])) {
                $_SESSION["user_id"] = $user["id"];
                return $user;
            }
        }
    }
    return null;
}

function isAdminUser($user) {
    return is_array($user) && ($user["role"] ?? "staff") === "admin";
}

function isSuperAdminUser($user) {
    return is_array($user) && (!empty($user["is_main_admin"]) || ($user["role"] ?? "") === "super_admin");
}

function isWebsiteTeamUser($user) {
    return is_array($user) && ($user["role"] ?? "staff") === "website_team";
}

function isConverterUser($user) {
    return is_array($user) && ($user["role"] ?? "staff") === "converter";
}

function userInitials($user) {
    $name = trim($user["display_name"] ?? $user["username"] ?? "U");
    $parts = preg_split("/\s+/", $name);
    $out = "";
    foreach (array_slice($parts, 0, 2) as $part) $out .= strtoupper(substr($part, 0, 1));
    return $out ?: "U";
}

function recordLoginActivity($username, $status, $user = null) {
    global $LOGIN_ACTIVITY_FILE;
    $data = readJsonFile($LOGIN_ACTIVITY_FILE, ["items" => []]);
    if (empty($data["items"]) || !is_array($data["items"])) $data["items"] = [];
    array_unshift($data["items"], [
        "id" => bin2hex(random_bytes(8)),
        "user_id" => $user["id"] ?? "",
        "username" => substr((string)$username, 0, 120),
        "ip" => $_SERVER["REMOTE_ADDR"] ?? "",
        "user_agent" => substr($_SERVER["HTTP_USER_AGENT"] ?? "", 0, 240),
        "status" => $status,
        "created_at" => time(),
    ]);
    $data["items"] = array_slice($data["items"], 0, 500);
    writeJsonFile($LOGIN_ACTIVITY_FILE, $data);
}

function loadLoginActivity() {
    global $LOGIN_ACTIVITY_FILE;
    $data = readJsonFile($LOGIN_ACTIVITY_FILE, ["items" => []]);
    return is_array($data["items"] ?? null) ? $data["items"] : [];
}

function redirectWithMessage($mode, $message, $type = "success") {
    $url = $GLOBALS["pageUrl"];
    if ($mode) $url .= "?" . $mode . "=1";
    else $url .= "?path=" . urlencode($_GET["path"] ?? "");
    $url .= (strpos($url, "?") !== false ? "&" : "?") . "msg=" . urlencode($message) . "&msgtype=" . urlencode($type);
    header("Location: " . $url);
    exit;
}

function findBanId($security, $identity) {
    foreach ($security["banned"] as $banId => $ban) {
        if (($ban["device_key"] ?? "") === $identity["device_key"]) return $banId;
        if (($ban["fingerprint"] ?? "") === $identity["fingerprint"]) return $banId;
    }
    return "";
}

function clearLoginAttempts(&$security, $identity) {
    unset($security["attempts"][$identity["fingerprint"]]);
}

function registerLoginFailure(&$security, $identity, $username) {
    global $MAX_LOGIN_ATTEMPTS;
    $key = $identity["fingerprint"];
    $attempt = $security["attempts"][$key] ?? ["count" => 0];
    $attempt["count"] = (int)($attempt["count"] ?? 0) + 1;
    $attempt["last_at"] = time();
    $attempt["ip"] = $identity["ip"];
    $attempt["user_agent"] = $identity["user_agent"];
    $attempt["username"] = substr($username, 0, 80);
    $security["attempts"][$key] = $attempt;

    if ($attempt["count"] >= $MAX_LOGIN_ATTEMPTS) {
        $banId = bin2hex(random_bytes(8));
        $security["banned"][$banId] = [
            "id" => $banId,
            "device_key" => $identity["device_key"],
            "fingerprint" => $identity["fingerprint"],
            "ip" => $identity["ip"],
            "user_agent" => $identity["user_agent"],
            "username" => substr($username, 0, 80),
            "banned_at" => time(),
            "reason" => $MAX_LOGIN_ATTEMPTS . " failed login attempts",
        ];
        unset($security["attempts"][$key]);
        return ["banned" => true, "remaining" => 0];
    }

    return ["banned" => false, "remaining" => max(0, $MAX_LOGIN_ATTEMPTS - $attempt["count"])];
}

function formatSize($bytes) {
    if ($bytes >= 1073741824) return round($bytes / 1073741824, 2) . " GB";
    if ($bytes >= 1048576) return round($bytes / 1048576, 2) . " MB";
    if ($bytes >= 1024) return round($bytes / 1024, 2) . " KB";
    return $bytes . " B";
}

function parentPath($current) {
    if (!$current) return "";
    $parts = explode("/", $current);
    array_pop($parts);
    return implode("/", $parts);
}

function getFileIcon($filename, $isDir = false) {
    if ($isDir) return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" opacity=".95"/></svg>';
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    if (in_array($ext, ["jpg","jpeg","png","webp","gif","svg","avif"])) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="m21 15-5-5L5 21"/></svg>';
    if (isVideoFile($filename)) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="20" height="16" rx="3"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor"/></svg>';
    if (in_array($ext, ["html","css","js","json","php"])) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>';
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

if (isset($_POST["login"])) {
    $username = $_POST["username"] ?? "";
    $password = $_POST["password"] ?? "";
    $loginUser = findUserByUsername($username);
    if (!validCsrf($_POST["csrf_token"] ?? "")) {
        $loginError = "Security token expired. Refresh and try again.";
    } elseif ($currentBanId) {
        $loginError = "This device is banned after too many failed login attempts. Ask an admin to unban it.";
    } elseif ($loginUser && ($loginUser["status"] ?? "active") === "frozen") {
        recordLoginActivity($username, "failed", $loginUser);
        $loginError = "This account is frozen. Please contact an administrator.";
    } elseif ($loginUser && password_verify($password, $loginUser["password_hash"] ?? "")) {
        clearLoginAttempts($securityData, $loginIdentity);
        saveSecurityData($securityData);
        recordLoginActivity($username, "success", $loginUser);
        session_regenerate_id(true);
        $_SESSION["user_id"] = $loginUser["id"];
        $_SESSION["admin_logged_in"] = isAdminUser($loginUser);
        $_SESSION["last_activity"] = time();
        header("Location: " . $pageUrl);
        exit;
    } else {
        recordLoginActivity($username, "failed", $loginUser);
        $failure = registerLoginFailure($securityData, $loginIdentity, $username);
        saveSecurityData($securityData);
        $loginError = $failure["banned"]
            ? "Too many failed logins. This device is now banned."
            : "Wrong username or password. " . $failure["remaining"] . " attempt(s) left.";
    }
} elseif ($currentBanId) {
    $loginError = "This device is banned after too many failed login attempts. Ask an admin to unban it.";
}

if (isset($_GET["logout"])) {
    session_destroy();
    header("Location: " . $pageUrl);
    exit;
}

if ((!empty($_SESSION["user_id"]) || !empty($_SESSION["admin_logged_in"])) && !empty($_SESSION["last_activity"]) && (time() - (int)$_SESSION["last_activity"]) > $AUTO_LOGOUT_SECONDS) {
    session_unset();
    session_destroy();
    header("Location: " . $pageUrl . "?timeout=1");
    exit;
}

if (isset($_GET["timeout"])) {
    $loginError = "You were logged out after 12 hours of inactivity. Please sign in again.";
}

$currentUser = currentUser();
if (!$currentUser) {
    if ((isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST') && (isset($_POST['action']) || (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false) || (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest'))) {
        if (ob_get_length()) @ob_clean();
        header("Content-Type: application/json");
        echo json_encode(["success" => false, "message" => "Your session has expired. Please sign in again.", "session_expired" => true]);
        exit;
    }
?>
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<title><?php echo htmlspecialchars($appSettings["app_name"]); ?> - Login</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<?php if (!empty($appSettings["favicon_url"])): ?><link rel="icon" href="<?php echo htmlspecialchars($appSettings["favicon_url"]); ?>"><?php endif; ?>
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
                    <?php if (!empty($appSettings["dashboard_logo_url"])): ?>
                        <img class="login-logo-img" src="<?php echo htmlspecialchars($appSettings["dashboard_logo_url"]); ?>" alt="<?php echo htmlspecialchars($appSettings["app_name"]); ?>">
                    <?php else: ?>
                        <span class="logo-inner-icon">FM</span>
                    <?php endif; ?>
                </div>
                <div class="float-badge badge-top">⚡ Fast</div>
                <div class="float-badge badge-btm">🔐 Secure</div>
            </div>
        </div>

        <h1 class="login-title"><?php echo htmlspecialchars($appSettings["app_name"]); ?></h1>
        <p class="login-sub"><span class="login-sub-dot"></span> Private Image Hosting Server <span class="login-sub-dot"></span></p>

        <?php if (!empty($loginError)): ?>
            <div class="error-box">⚠️ <?php echo htmlspecialchars($loginError); ?></div>
        <?php endif; ?>

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


$isAdmin = isAdminUser($currentUser);
$isSuperAdmin = isSuperAdminUser($currentUser);
$isConverter = isConverterUser($currentUser);
$isWebsiteTeam = isWebsiteTeamUser($currentUser);
$websiteTeamFolder = "Website-Team";
$websiteTeamRootRelative = cleanPath($websiteTeamFolder);
$websiteTeamRootDir = safeFullPath($BASE_DIR, $websiteTeamRootRelative);
if ($isWebsiteTeam && !is_dir($websiteTeamRootDir)) {
    mkdir($websiteTeamRootDir, 0755, true);
}
$converterRootRelative = cleanPath($CONVERTER_ROOT_FOLDER);
$converterRootDir = safeFullPath($BASE_DIR, $converterRootRelative);
if (!is_dir($converterRootDir)) {
    mkdir($converterRootDir, 0755, true);
}

$requestedPath = isset($_GET["path"]) ? cleanPath($_GET["path"]) : "";
if (
    ($_SERVER["REQUEST_METHOD"] ?? "GET") === "POST"
    && isset($_POST["path"])
) {
    $requestedPath = cleanPath($_POST["path"]);
}
$current = $requestedPath;
if ($isConverter) {
    if ($current === "" || ($current !== $converterRootRelative && strpos($current . "/", $converterRootRelative . "/") !== 0)) {
        $current = $converterRootRelative;
    }
}
if ($isWebsiteTeam) {
    if ($current === "" || ($current !== $websiteTeamRootRelative && strpos($current . "/", $websiteTeamRootRelative . "/") !== 0)) {
        $current = $websiteTeamRootRelative;
    }
}
$currentDir = safeFullPath($BASE_DIR, $current);
if (!is_dir($currentDir)) {
    if ($isConverter) {
        $current = $converterRootRelative;
        $currentDir = $converterRootDir;
    } elseif ($isWebsiteTeam) {
        $current = $websiteTeamRootRelative;
        $currentDir = $websiteTeamRootDir;
    } else {
        $current = "";
        $currentDir = $BASE_DIR;
    }
}

$trashMode = isset($_GET["trash"]) && $_GET["trash"] === "1";
$usersMode = isset($_GET["users"]) && $_GET["users"] === "1";
$activityMode = isset($_GET["activity"]) && $_GET["activity"] === "1";
$profileMode = isset($_GET["profile"]) && $_GET["profile"] === "1";
$settingsMode = isset($_GET["settings"]) && $_GET["settings"] === "1";
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
$_SESSION["last_activity"] = time();

// Release session lock immediately for all GET requests (including PJAX folder navigation and thumbnails)
// and read-only POST AJAX requests. This unlocks 100% concurrent parallel execution without request serialization!
if (session_status() === PHP_SESSION_ACTIVE) {
    if ($_SERVER["REQUEST_METHOD"] === "GET" || (isset($_POST['action']) && in_array($_POST['action'], ['get_storage_stats', 'find_duplicates', 'get_versions', 'ai_bg_remove_status', 'check_webm_status', 'get_folder_options', 'get_properties'], true))) {
        session_write_close();
    }
}
$baseReturnUrl = $pageUrl . "?path=" . urlencode($current);
$homePath = $isConverter ? $converterRootRelative : ($isWebsiteTeam ? $websiteTeamRootRelative : "");
$homeUrl = $pageUrl . "?path=" . urlencode($homePath);

if (isset($_GET["action"]) && $_GET["action"] === "thumb") {
    handleThumbnailRequest();
    exit;
}

if (isset($_GET["action"]) && $_GET["action"] === "convert_download") {
    if (function_exists('file_converter_handle')) {
        file_converter_handle('convert_download', $_GET, [], $BASE_DIR, $currentDir, $current, $currentUser['id'] ?? '', $BASE_URL);
        exit;
    }
}

if (isset($_GET["download_item"])) {
    $itemName = cleanExistingName($_GET["download_item"]);
    $itemPath = $itemName ? ($currentDir . "/" . $itemName) : "";
    if ($itemName && isSystemManagedFile($itemName)) {
        header("Location: " . $baseReturnUrl . "&msg=" . urlencode("System file is hidden.") . "&msgtype=warning");
        exit;
    }
    if ($itemName && is_file($itemPath)) {
        streamDownloadFile($itemPath, $itemName);
    }
    if ($itemName && is_dir($itemPath)) {
        $archiveName = sanitizeDownloadFilename($itemName . "-" . date("Ymd-His") . ".zip", "folder.zip");
        if (!streamZipDownloadFromMap([$itemPath => $itemName], $archiveName)) {
            header("Location: " . $baseReturnUrl . "&msg=" . urlencode("ZIP download is unavailable on this server.") . "&msgtype=error");
            exit;
        }
    }
    header("Location: " . $baseReturnUrl . "&msg=" . urlencode("Item not found for download.") . "&msgtype=warning");
    exit;
}

if (isset($_GET["trash_preview"])) {
    $trashId = cleanExistingName($_GET["trash_preview"]);
    $trashData = loadTrashIndex();
    if (!empty($trashData["items"][$trashId])) {
        $item = $trashData["items"][$trashId];
        $trashFile = $TRASH_DIR . "/" . cleanName($item["trash_name"] ?? "");
        if (is_file($trashFile)) {
            $ext = strtolower(pathinfo($item["original_relative"] ?? "", PATHINFO_EXTENSION));
            $mimes = [
                'jpg'  => 'image/jpeg',
                'jpeg' => 'image/jpeg',
                'png'  => 'image/png',
                'webp' => 'image/webp',
                'gif'  => 'image/gif',
                'svg'  => 'image/svg+xml',
                'avif' => 'image/avif',
                'mp4'  => 'video/mp4',
                'webm' => 'video/webm',
                'mov'  => 'video/quicktime',
                'm4v'  => 'video/mp4',
                'ogg'  => 'video/ogg',
            ];
            $mime = $mimes[$ext] ?? 'application/octet-stream';
            if (session_status() === PHP_SESSION_ACTIVE) {
                session_write_close();
            }
            while (ob_get_level() > 0) {
                @ob_end_clean();
            }

            // Fast path: small cached webp thumbnail for trash list rows (?w=360)
            if (isset($_GET['w']) && in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'avif'], true) && function_exists('imagewebp')) {
                $tw = max(60, min(800, (int)$_GET['w']));
                $tMtime = (int)@filemtime($trashFile);
                $tCacheDir = $APP_ASSETS_DIR . '/cache/thumbs';
                if (!is_dir($tCacheDir)) @mkdir($tCacheDir, 0777, true);
                if (!is_dir($tCacheDir) || !is_writable($tCacheDir)) {
                    $tCacheDir = sys_get_temp_dir() . '/kiuq_thumbs';
                    if (!is_dir($tCacheDir)) @mkdir($tCacheDir, 0777, true);
                }
                $tCacheFile = md5('trash_' . $trashId . '_' . $tMtime . '_' . $tw) . '.webp';
                $tCachePath = $tCacheDir . '/' . $tCacheFile;
                if (!(is_file($tCachePath) && filesize($tCachePath) > 0) && canAttemptImageOptimization($trashFile)) {
                    $tSrc = imageResourceFromFile($trashFile, $ext);
                    if ($tSrc) {
                        $tW = imagesx($tSrc);
                        $tH = imagesy($tSrc);
                        if ($tW > $tw) {
                            $nH = max(1, (int)round(($tH / $tW) * $tw));
                            $canvas = imagecreatetruecolor($tw, $nH);
                            if ($canvas) {
                                imagealphablending($canvas, false);
                                imagesavealpha($canvas, true);
                                imagefilledrectangle($canvas, 0, 0, $tw, $nH, imagecolorallocatealpha($canvas, 0, 0, 0, 127));
                                imagecopyresampled($canvas, $tSrc, 0, 0, 0, 0, $tw, $nH, $tW, $tH);
                                imagedestroy($tSrc);
                                $tSrc = $canvas;
                            }
                        }
                        imagepalettetotruecolor($tSrc);
                        imagealphablending($tSrc, false);
                        imagesavealpha($tSrc, true);
                        @imagewebp($tSrc, $tCachePath, 78);
                        imagedestroy($tSrc);
                    }
                }
                if (is_file($tCachePath) && filesize($tCachePath) > 0) {
                    $tEtag = '"' . md5($tCacheFile) . '"';
                    header('Content-Type: image/webp');
                    header('Cache-Control: private, max-age=31536000, immutable');
                    header('ETag: ' . $tEtag);
                    if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH']) === $tEtag) {
                        http_response_code(304);
                        exit;
                    }
                    header('Content-Length: ' . filesize($tCachePath));
                    readfile($tCachePath);
                    exit;
                }
            }
            $size = filesize($trashFile);
            header("Content-Type: " . $mime);
            header("Accept-Ranges: bytes");
            header("Cache-Control: private, max-age=86400");

            if (isset($_SERVER['HTTP_RANGE'])) {
                if (preg_match('/bytes=\h*(\d+)-(\d*)[\D.*]?/i', $_SERVER['HTTP_RANGE'], $matches)) {
                    $start = intval($matches[1]);
                    $end = !empty($matches[2]) ? intval($matches[2]) : ($size - 1);
                    if ($start > $end || $start >= $size || $end >= $size) {
                        http_response_code(416);
                        header("Content-Range: bytes */" . $size);
                        exit;
                    }
                    http_response_code(206);
                    header("Content-Range: bytes " . $start . "-" . $end . "/" . $size);
                    header("Content-Length: " . ($end - $start + 1));
                    $fp = fopen($trashFile, 'rb');
                    fseek($fp, $start);
                    $chunk = 1024 * 64;
                    while (!feof($fp) && ($pos = ftell($fp)) <= $end) {
                        if ($pos + $chunk > $end) {
                            $chunk = $end - $pos + 1;
                        }
                        echo fread($fp, $chunk);
                        flush();
                    }
                    fclose($fp);
                    exit;
                }
            }
            header("Content-Length: " . $size);
            readfile($trashFile);
            exit;
        }
    }
    http_response_code(404);
    exit("Preview not found");
}

/*
|--------------------------------------------------------------------------
| ACTIONS
|--------------------------------------------------------------------------
*/

$message = "";
$messageType = "success";

if ($_SERVER["REQUEST_METHOD"] === "POST" && isset($_POST["action"])) {
    $action = $_POST["action"];
    $fileMutatingActions = [
        "upload_files", "create_folder", "create_file", "resize_images",
        "rename_item", "rename_type", "delete_item", "delete_selected",
        "move_selected", "copy_selected", "paste_clipboard", "restore_trash_item",
        "restore_trash_selected", "delete_trash_item", "delete_trash_selected",
        "empty_trash", "replace_image", "delete_duplicate"
    ];
    if (in_array($action, $fileMutatingActions, true) && function_exists('storage_dashboard_invalidate_cache')) {
        storage_dashboard_invalidate_cache();
    }
    $uploadAjaxRequest = isset($_POST["upload_ajax"]) && $_POST["upload_ajax"] === "1";
    if ($action === "upload_files") {
        session_write_close(); // Unlock session immediately for true parallel uploads
    }
    $redirectToTrash = $trashMode || in_array($action, ["restore_trash_item", "delete_trash_item", "empty_trash", "restore_trash_selected", "delete_trash_selected"], true);
    $redirectOverride = "";
    $adminOnlyActions = ["unban_device", "save_app_settings", "clear_login_activity", "create_user", "set_user_role", "change_user_password", "change_username", "admin_edit_user", "freeze_user", "unfreeze_user", "delete_user", "update_user_permissions"];
    $adminFileActions = ["create_file", "edit_file"];
    $converterAllowedActions = ["set_theme", "set_dashboard_theme", "upload_dashboard_theme", "delete_dashboard_theme", "get_folder_options", "get_storage_stats", "create_folder", "upload_files", "delete_item", "delete_selected", "download_selected", "resize_images", "convert_upload_file", "convert_init_job", "convert_process_step", "convert_finish_job", "convert_download", "rename_item", "rename_type", "move_selected", "copy_selected", "paste_clipboard", "replace_image", "get_properties"];

    $isAjaxAction = $uploadAjaxRequest || ($action === "resize_images") || in_array($action, [
        "get_folder_options", "set_dashboard_theme", "upload_dashboard_theme", "delete_dashboard_theme",
        "check_webm_status", "convert_video_webm", "get_properties", "find_duplicates", "replace_image",
        "get_storage_stats", "delete_duplicate", "convert_upload_file", "convert_init_job", "convert_process_step", "convert_finish_job", "convert_download"
    ], true) || (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false)
       || (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest');

    if (!validCsrf($_POST["csrf_token"] ?? "")) {
        if ($isAjaxAction) {
            if (ob_get_length()) @ob_clean();
            header("Content-Type: application/json");
            echo json_encode([
                "success" => false,
                "uploaded" => 0,
                "optimized" => 0,
                "failed" => 1,
                "message" => "Security token expired. Please refresh the page and try again.",
                "errors" => ["Security token expired."],
            ]);
            exit;
        }
        $message = "Security token expired. Refresh and try again.";
        $messageType = "error";
    } elseif (in_array($action, $adminOnlyActions, true) && !$isAdmin) {
        if ($isAjaxAction) {
            if (ob_get_length()) @ob_clean();
            header("Content-Type: application/json");
            echo json_encode(["success" => false, "message" => "Admin permission is required.", "error" => "Admin permission required."]);
            exit;
        }
        $message = "Admin permission is required.";
        $messageType = "error";
    } elseif (in_array($action, $adminFileActions, true) && !$isAdmin && !$isWebsiteTeam) {
        if ($isAjaxAction) {
            if (ob_get_length()) @ob_clean();
            header("Content-Type: application/json");
            echo json_encode(["success" => false, "message" => "Admin permission is required.", "error" => "Admin permission required."]);
            exit;
        }
        $message = "Admin permission is required.";
        $messageType = "error";
    } elseif ($isConverter && !in_array($action, $converterAllowedActions, true)) {
        if ($isAjaxAction) {
            if (ob_get_length()) @ob_clean();
            header("Content-Type: application/json");
            echo json_encode([
                "success" => false,
                "uploaded" => 0,
                "optimized" => 0,
                "failed" => 1,
                "message" => "This action is not allowed for Converter role.",
                "errors" => ["Action not allowed for Converter role."],
            ]);
            exit;
        }
        $message = "This action is not allowed for Converter role.";
        $messageType = "error";
    } elseif ($action === "set_theme") {
        $theme = in_array($_POST["theme"] ?? "light", ["light", "dark", "system"], true) ? $_POST["theme"] : "light";
        $data = loadUsers();
        foreach ($data["users"] as &$row) {
            if (($row["id"] ?? "") === ($currentUser["id"] ?? "")) {
                $row["theme"] = $theme;
                $row["updated_at"] = time();
                break;
            }
        }
        unset($row);
        saveUsers($data);
        header("Content-Type: application/json");
        echo json_encode(["success" => true]);
        exit;
    } elseif ($action === "get_folder_options") {
        $options = $isConverter
            ? folderOptions($BASE_DIR, $converterRootRelative, $CONVERTER_ROOT_FOLDER . " / root")
            : ($isWebsiteTeam
            ? folderOptions($BASE_DIR, $websiteTeamRootRelative, $websiteTeamFolder . " / root")
            : folderOptions($BASE_DIR));
        header("Content-Type: application/json");
        echo json_encode(["success" => true, "options" => $options]);
        exit;
    } elseif ($action === "set_dashboard_theme") {
        $themeUrl = trim($_POST["theme_url"] ?? "");
        $isValidTheme = ($themeUrl === "" || filter_var($themeUrl, FILTER_VALIDATE_URL) || str_starts_with($themeUrl, "/") || str_starts_with($themeUrl, "profileimg/") || str_contains($themeUrl, "preset-"));
        if (!$isValidTheme) {
            header("Content-Type: application/json");
            echo json_encode(["success" => false, "error" => "Enter a valid image URL."]);
            exit;
        }
        if (!saveCurrentUserDashboardTheme($currentUser["id"] ?? "", $themeUrl)) {
            header("Content-Type: application/json");
            echo json_encode(["success" => false, "error" => "Could not save theme for this user."]);
            exit;
        }
        $savedTheme = $themeUrl !== "" ? saveDashboardThemeUrlToLibrary($themeUrl) : null;
        header("Content-Type: application/json");
        echo json_encode([
            "success" => true,
            "theme_url" => $themeUrl,
            "theme_item" => $savedTheme ? [
                "name" => $savedTheme["name"] ?? "Saved Theme",
                "url" => $savedTheme["url"] ?? $themeUrl,
                "can_delete" => true,
            ] : null,
        ]);
        exit;
    } elseif ($action === "upload_dashboard_theme") {
        $upload = saveUploadedDashboardThemeImage("theme_file");
        if (!$upload["ok"]) {
            header("Content-Type: application/json");
            echo json_encode(["success" => false, "error" => $upload["error"] ?? "Could not upload theme image."]);
            exit;
        }
        if (!saveCurrentUserDashboardTheme($currentUser["id"] ?? "", $upload["url"])) {
            header("Content-Type: application/json");
            echo json_encode(["success" => false, "error" => "Could not save theme for this user."]);
            exit;
        }
        header("Content-Type: application/json");
        echo json_encode(["success" => true, "theme_url" => $upload["url"], "name" => $upload["name"] ?? "", "can_delete" => true]);
        exit;
    } elseif ($action === "delete_dashboard_theme") {
        $deleteResult = deleteDashboardThemeImage($_POST["theme_url"] ?? "");
        header("Content-Type: application/json");
        echo json_encode($deleteResult);
        exit;
    } elseif ($action === "save_profile") {
        $displayName = trim($_POST["display_name"] ?? "");
        $avatarUrl = trim($_POST["avatar_url"] ?? "");
        $uploadError = false;

        if (isset($_FILES["profile_img"]) && $_FILES["profile_img"]["error"] === UPLOAD_ERR_OK) {
            $tmp = $_FILES["profile_img"]["tmp_name"];
            $size = getimagesize($tmp);
            if ($size !== false) {
                $mime = $size["mime"];
                $ext = "";
                $img = null;
                if ($mime === "image/jpeg") { $img = @imagecreatefromjpeg($tmp); $ext = ".webp"; }
                elseif ($mime === "image/png") { $img = @imagecreatefrompng($tmp); $ext = ".webp"; }
                elseif ($mime === "image/webp") { $img = @imagecreatefromwebp($tmp); $ext = ".webp"; }
                elseif ($mime === "image/gif") { $img = @imagecreatefromgif($tmp); $ext = ".webp"; }
                elseif (($mime === "image/avif" || $mime === "image/x-avif") && function_exists("imagecreatefromavif")) { $img = @imagecreatefromavif($tmp); $ext = ".webp"; }

                if ($img) {
                    $profileDir = __DIR__ . "/profileimg";
                    if (!is_dir($profileDir)) mkdir($profileDir, 0777, true);
                    $fileName = preg_replace('/[^a-zA-Z0-9_-]/', '', $currentUser["username"]) . "_" . time() . $ext;
                    $dest = $profileDir . "/" . $fileName;
                    
                    imagepalettetotruecolor($img);
                    if (imagewebp($img, $dest, 90)) {
                        $avatarUrl = $requestScheme . "://" . $httpHost . (($scriptBasePath === "" || $scriptBasePath === ".") ? "/profileimg/" : $scriptBasePath . "/profileimg/") . $fileName;
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
            $message = "Failed to upload or convert image.";
            $messageType = "error";
        } elseif ($displayName === "" || ($avatarUrl !== "" && !filter_var($avatarUrl, FILTER_VALIDATE_URL))) {
            $message = "Enter a display name and a valid image URL.";
            $messageType = "error";
        } else {
            $data = loadUsers();
            foreach ($data["users"] as &$row) {
                if (($row["id"] ?? "") === ($currentUser["id"] ?? "")) {
                    $row["display_name"] = substr($displayName, 0, 120);
                    $row["avatar_url"] = $avatarUrl;
                    $row["updated_at"] = time();
                    break;
                }
            }
            unset($row);
            saveUsers($data);
            $message = "Profile updated.";
        }
        $redirectOverride = $pageUrl . "?profile=1";
    } elseif ($action === "save_app_settings") {
        $settings = loadAppSettings();
        $settings["app_name"] = trim($_POST["app_name"] ?? "") ?: "File Manager-KiuQ";
        $settings["footer_name"] = trim($_POST["footer_name"] ?? "") ?: "KiuQ.com";
        $logoUrl = trim($_POST["dashboard_logo_url"] ?? "");
        $faviconUrl = trim($_POST["favicon_url"] ?? "");
        $logoUpload = saveUploadedAppAsset("dashboard_logo_file", "dashboard-logo");
        $faviconUpload = saveUploadedAppAsset("favicon_file", "favicon");
        if (($logoUrl !== "" && !filter_var($logoUrl, FILTER_VALIDATE_URL)) || ($faviconUrl !== "" && !filter_var($faviconUrl, FILTER_VALIDATE_URL))) {
            $message = "Enter valid URLs for logo and favicon.";
            $messageType = "error";
        } elseif (!$logoUpload["ok"] || !$faviconUpload["ok"]) {
            $message = $logoUpload["error"] ?? $faviconUpload["error"] ?? "Could not upload branding file.";
            $messageType = "error";
        } else {
            $settings["dashboard_logo_url"] = $logoUpload["url"] ?: $logoUrl;
            $settings["favicon_url"] = $faviconUpload["url"] ?: $faviconUrl;
            saveAppSettings($settings);

            // Save Bria API key to features/config.php if provided
            if (isset($_POST["bria_api_key"])) {
                $briaKey = trim($_POST["bria_api_key"]);
                $configFile = __DIR__ . '/features/config.php';
                if (is_file($configFile)) {
                    $configData = file_get_contents($configFile);
                    $configData = preg_replace("/define\('BRIA_API_KEY',\s*'[^']*'\);/", "define('BRIA_API_KEY', '" . addslashes($briaKey) . "');", $configData);
                    file_put_contents($configFile, $configData);
                }
            }

            $message = "Dashboard settings saved.";
        }
        $redirectOverride = $pageUrl . "?settings=1";
    } elseif ($action === "clear_login_activity") {
        if (!$isAdmin && empty($currentUser["is_main_admin"])) {
            $message = "Only admins can clear login activity.";
            $messageType = "error";
        } else {
            writeJsonFile($LOGIN_ACTIVITY_FILE, ["items" => []]);
            $message = "Login activity history cleared.";
        }
        $redirectOverride = $pageUrl . "?activity=1";
    } elseif ($action === "create_user") {
        $username = strtolower(trim($_POST["new_username"] ?? ""));
        $password = $_POST["new_password"] ?? "";
        $role = normalizeUserRole($_POST["new_role"] ?? "staff");
        $displayName = trim($_POST["new_display_name"] ?? "") ?: $username;
        if (!preg_match("/^[a-z0-9@._-]{3,120}$/", $username) || strlen($password) < 8 || findUserByUsername($username)) {
            $message = "Enter a unique username and password with at least 8 characters.";
            $messageType = "error";
        } else {
            $data = loadUsers();
            $data["users"][] = [
                "id" => bin2hex(random_bytes(8)),
                "username" => $username,
                "password_hash" => password_hash($password, PASSWORD_DEFAULT),
                "role" => $role,
                "status" => "active",
                "display_name" => substr($displayName, 0, 120),
                "avatar_url" => "",
                "theme" => "light",
                "dashboard_theme_url" => "",
                "is_main_admin" => false,
                "can_view_login_activity" => isset($_POST["can_view_login_activity"]),
                "created_at" => time(),
                "updated_at" => time(),
            ];
            saveUsers($data);
            $message = "User created.";
        }
        $redirectOverride = $pageUrl . "?users=1";
    } elseif (in_array($action, ["set_user_role", "change_user_password", "change_username", "admin_edit_user", "freeze_user", "unfreeze_user", "delete_user", "update_user_permissions"], true)) {
        $targetId = preg_replace("/[^a-f0-9\-]/", "", $_POST["user_id"] ?? "");
        $data = loadUsers();
        $foundIndex = null;
        foreach ($data["users"] as $idx => $row) {
            if (($row["id"] ?? "") === $targetId) { $foundIndex = $idx; break; }
        }
        if ($foundIndex === null) {
            $message = "User not found.";
            $messageType = "error";
        } else {
            $target = $data["users"][$foundIndex];
            $protected = !empty($target["is_main_admin"]);
            $isSelf = ($target["id"] ?? "") === ($currentUser["id"] ?? "");

            if ($action === "change_username") {
                if (!$isSuperAdmin) {
                    $message = "Only the super admin can change usernames.";
                    $messageType = "error";
                } else {
                    $newUsername = strtolower(trim($_POST["new_username"] ?? ""));
                    if (!preg_match("/^[a-z0-9@._-]{3,120}$/", $newUsername)) {
                        $message = "Username must be 3–120 characters (letters, numbers, @, ., _, -).";
                        $messageType = "error";
                    } else {
                        $existing = findUserByUsername($newUsername);
                        if ($existing && ($existing["id"] ?? "") !== $targetId) {
                            $message = "Username \"$newUsername\" is already in use.";
                            $messageType = "error";
                        } else {
                            $oldUsername = $data["users"][$foundIndex]["username"] ?? "";
                            $data["users"][$foundIndex]["username"] = $newUsername;
                            if (($data["users"][$foundIndex]["display_name"] ?? "") === $oldUsername) {
                                $data["users"][$foundIndex]["display_name"] = $newUsername;
                            }
                            $data["users"][$foundIndex]["updated_at"] = time();
                            saveUsers($data);
                            $message = "Username changed from \"$oldUsername\" to \"$newUsername\".";
                        }
                    }
                }
            } elseif ($action === "change_user_password") {
                $password = $_POST["password"] ?? "";
                if (strlen($password) < 8) {
                    $message = "Password must be at least 8 characters.";
                    $messageType = "error";
                } elseif ($protected && !$isSelf && !$isSuperAdmin) {
                    $message = "Only the super admin can change this password.";
                    $messageType = "error";
                } else {
                    $data["users"][$foundIndex]["password_hash"] = password_hash($password, PASSWORD_DEFAULT);
                    $data["users"][$foundIndex]["updated_at"] = time();
                    saveUsers($data);
                    $message = "Password changed for " . htmlspecialchars($data["users"][$foundIndex]["username"]) . ".";
                }
            } elseif ($action === "admin_edit_user") {
                if (!$isSuperAdmin) {
                    $message = "Only the super admin can edit user credentials.";
                    $messageType = "error";
                } else {
                    $newUsername = strtolower(trim($_POST["edit_username"] ?? ""));
                    $newPassword = $_POST["edit_password"] ?? "";
                    $newDisplayName = trim($_POST["edit_display_name"] ?? "");
                    $newRole = normalizeUserRole($_POST["edit_role"] ?? ($target["role"] ?? "staff"));

                    $errors = [];
                    if (!preg_match("/^[a-z0-9@._-]{3,120}$/", $newUsername)) {
                        $errors[] = "Username must be 3–120 characters.";
                    } else {
                        $existing = findUserByUsername($newUsername);
                        if ($existing && ($existing["id"] ?? "") !== $targetId) {
                            $errors[] = "Username \"$newUsername\" is already taken.";
                        }
                    }
                    if ($newPassword !== "" && strlen($newPassword) < 8) {
                        $errors[] = "Password must be at least 8 characters.";
                    }

                    if (!empty($errors)) {
                        $message = implode(" ", $errors);
                        $messageType = "error";
                    } else {
                        $oldUsername = $data["users"][$foundIndex]["username"] ?? "";
                        $data["users"][$foundIndex]["username"] = $newUsername;
                        if ($newDisplayName !== "") {
                            $data["users"][$foundIndex]["display_name"] = substr($newDisplayName, 0, 120);
                        } elseif (($data["users"][$foundIndex]["display_name"] ?? "") === $oldUsername) {
                            $data["users"][$foundIndex]["display_name"] = $newUsername;
                        }
                        if ($newPassword !== "") {
                            $data["users"][$foundIndex]["password_hash"] = password_hash($newPassword, PASSWORD_DEFAULT);
                        }
                        if (!$protected && !$isSelf) {
                            $data["users"][$foundIndex]["role"] = $newRole;
                        }
                        $data["users"][$foundIndex]["updated_at"] = time();
                        saveUsers($data);
                        $message = "User credentials updated successfully for \"" . htmlspecialchars($newUsername) . "\".";
                    }
                }
            } elseif ($action === "set_user_role") {
                if ($protected || $isSelf) {
                    $message = "This admin role is protected.";
                    $messageType = "error";
                } else {
                    $role = normalizeUserRole($_POST["role"] ?? "staff");
                    $data["users"][$foundIndex]["role"] = $role;
                    $data["users"][$foundIndex]["updated_at"] = time();
                    saveUsers($data);
                    $message = "Role updated.";
                }
            } elseif ($action === "freeze_user" || $action === "unfreeze_user") {
                if ($protected || $isSelf) {
                    $message = "Protected account cannot be frozen.";
                    $messageType = "error";
                } else {
                    $data["users"][$foundIndex]["status"] = $action === "freeze_user" ? "frozen" : "active";
                    $data["users"][$foundIndex]["updated_at"] = time();
                    saveUsers($data);
                    $message = "User status updated.";
                }
            } elseif ($action === "delete_user") {
                if ($protected || $isSelf) {
                    $message = "Protected account cannot be removed.";
                    $messageType = "error";
                } else {
                    array_splice($data["users"], $foundIndex, 1);
                    saveUsers($data);
                    $message = "User removed.";
                }
            } elseif ($action === "update_user_permissions") {
                $data["users"][$foundIndex]["can_view_login_activity"] = isset($_POST["can_view_login_activity"]);
                $data["users"][$foundIndex]["updated_at"] = time();
                saveUsers($data);
                $message = "Permissions updated.";
            }
        }
        $redirectOverride = $pageUrl . "?users=1";
    } elseif ($action === "unban_device") {
        $banId = preg_replace("/[^a-f0-9]/", "", $_POST["ban_id"] ?? "");
        $securityData = loadSecurityData();
        if ($banId && isset($securityData["banned"][$banId])) {
            unset($securityData["banned"][$banId]);
            saveSecurityData($securityData);
            $message = "Device unbanned.";
        } else {
            $message = "Ban record not found."; $messageType = "warning";
        }
    } elseif ($action === "create_folder") {
        $folderName = cleanName($_POST["folder_name"] ?? "");
        if ($folderName) {
            $newPath = $currentDir . "/" . $folderName;
            if (!is_dir($newPath)) {
                mkdir($newPath, 0755, true);
                ensureSecureIndexFile($newPath);
                $message = "Folder \"$folderName\" created.";
            } else {
                $message = "Folder already exists."; $messageType = "warning";
            }
        }
    } elseif ($action === "create_file") {
        $fileName = cleanName($_POST["file_name"] ?? "");
        $content = $_POST["file_content"] ?? "";
        if ($fileName && isSystemManagedFile($fileName)) {
            $message = "That file name is reserved.";
            $messageType = "warning";
        } elseif ($fileName) {
            $ext = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
            if (in_array($ext, $allowedExtensions)) {
                $newFile = $currentDir . "/" . $fileName;
                if (!file_exists($newFile)) {
                    file_put_contents($newFile, $content);
                    $message = "File \"$fileName\" created.";
                } else { $message = "File already exists."; $messageType = "warning"; }
            }
        }
    } elseif ($action === "upload_files") {
        session_write_close(); // Unlock session to allow parallel upload processing
        $uploaded = 0;
        $optimized = 0;
        $optimizedWebm = 0;
        $fallbackOriginal = 0;
        $failed = 0;
        $uploadedBackupPaths = [];
        $uploadAjax = isset($_POST["upload_ajax"]) && $_POST["upload_ajax"] === "1";
        $uploadNames = $_FILES["upload_files"]["name"] ?? [];
        $uploadTmpNames = $_FILES["upload_files"]["tmp_name"] ?? [];
        $uploadErrors = $_FILES["upload_files"]["error"] ?? [];
        if (!is_array($uploadNames)) {
            $uploadNames = [$uploadNames];
            $uploadTmpNames = [$uploadTmpNames];
            $uploadErrors = [$uploadErrors];
        }
        if (isset($_FILES["upload_folders"]["name"])) {
            $fNames = $_FILES["upload_folders"]["name"];
            $fTmp = $_FILES["upload_folders"]["tmp_name"] ?? [];
            $fErr = $_FILES["upload_folders"]["error"] ?? [];
            if (!is_array($fNames)) {
                $fNames = [$fNames];
                $fTmp = [$fTmp];
                $fErr = [$fErr];
            }
            foreach ($fNames as $fi => $fn) {
                if ((string)$fn !== "") {
                    $uploadNames[] = $fn;
                    $uploadTmpNames[] = $fTmp[$fi] ?? "";
                    $uploadErrors[] = $fErr[$fi] ?? UPLOAD_ERR_NO_FILE;
                }
            }
        }
        $errorDetails = [];
        if (!is_writable($currentDir)) {
            $failed = count(array_filter($uploadNames, fn($name) => (string)$name !== ""));
            $message = "Upload folder is not writable by server.";
            $messageType = "error";
            if ($uploadAjax) {
                if (ob_get_length()) @ob_clean();
                header("Content-Type: application/json");
                echo json_encode([
                    "success" => false,
                    "uploaded" => 0,
                    "optimized" => 0,
                    "failed" => $failed,
                    "message" => $message,
                    "errors" => ["Destination folder is not writable. Check folder permissions."],
                ]);
                exit;
            }
        } elseif (!empty($uploadNames)) {
            foreach ($uploadNames as $index => $name) {
                $rawName = (string)$name;
                if ($rawName === "") continue;
                $fileName = cleanName($rawName);
                if ($fileName === "") {
                    $fileName = "upload-" . ($index + 1);
                }
                $fileError = (int)($uploadErrors[$index] ?? UPLOAD_ERR_NO_FILE);
                if ($fileError !== UPLOAD_ERR_OK) {
                    $failed++;
                    $errorDetails[] = $fileName . ": " . uploadErrorMessage($fileError);
                    continue;
                }
                $tmpName = (string)($uploadTmpNames[$index] ?? "");
                if ($tmpName === "" || (!is_uploaded_file($tmpName) && !is_file($tmpName))) {
                    $failed++;
                    $errorDetails[] = $fileName . ": Temporary upload file is missing.";
                    continue;
                }

                // --- CHUNKING LOGIC ---
                $chunkIndex = isset($_POST['chunk_index']) ? (int)$_POST['chunk_index'] : 0;
                $totalChunks = isset($_POST['total_chunks']) ? (int)$_POST['total_chunks'] : 1;
                $chunkId = preg_replace('/[^a-zA-Z0-9_-]/', '', $_POST['chunk_id'] ?? '');
                $originalName = $_POST['original_name'] ?? '';

                if ($originalName !== "") {
                    $fileName = cleanName($originalName);
                    if ($fileName === "") $fileName = "upload-" . ($index + 1);
                }

                if ($totalChunks > 1 && $chunkId !== '') {
                    $partDir = sys_get_temp_dir() . '/kiuq_chunks_' . $chunkId;
                    if (!is_dir($partDir)) @mkdir($partDir, 0755, true);
                    $partFile = $partDir . '/upload.part';

                    $in = @fopen($tmpName, 'rb');
                    $out = @fopen($partFile, $chunkIndex === 0 ? 'wb' : 'ab');
                    if ($in && $out) {
                        stream_copy_to_stream($in, $out);
                    }
                    if (is_resource($in)) @fclose($in);
                    if (is_resource($out)) @fclose($out);

                    if ($chunkIndex < $totalChunks - 1) {
                        if ($uploadAjax) {
                            if (ob_get_length()) @ob_clean();
                            header("Content-Type: application/json");
                            echo json_encode(["success" => true, "chunk_success" => true]);
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
                    $zip = new ZipArchive();
                    if ($zip->open($tmpName) === true) {
                        $zipFolderName = cleanBaseName($fileName);
                        if ($zipFolderName === "") $zipFolderName = "extracted_zip";
                        $extractDir = uniqueDestinationPath($currentDir, $zipFolderName);
                        
                        if (!is_dir($extractDir)) {
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
                                
                                if (shouldHideFromFileManager($itemName) || strpos($extractedPath, "__MACOSX") !== false) {
                                    if ($itemName !== "index.html" || filesize($extractedPath) !== strlen(getSecureIndexHtml())) {
                                        @unlink($extractedPath);
                                    }
                                    continue;
                                }
                                
                                if (!in_array($itemExt, $allowedExtensions, true)) {
                                    @unlink($extractedPath);
                                    continue;
                                }
                                
                                $convertWebpOption = isset($_POST["convert_webp"])
                                    ? ($_POST["convert_webp"] === "1" || $_POST["convert_webp"] === "true" || $_POST["convert_webp"] === 1)
                                    : (!$isConverter);
                                if ($convertWebpOption && isWebpConvertibleImage($itemName)) {
                                    $webpName = cleanBaseName($itemName) . ".webp";
                                    $webpPath = $item->getPath() . "/" . $webpName;
                                    if (saveOptimizedWebp($extractedPath, $webpPath, $itemExt)) {
                                        @unlink($extractedPath);
                                        $uploadedBackupPaths[$webpPath] = true;
                                        $optimized++;
                                    } else {
                                        $uploadedBackupPaths[$extractedPath] = true;
                                        $fallbackOriginal++;
                                    }
                                } else {
                                    if (!isVideoFile($itemName)) {
                                        $uploadedBackupPaths[$extractedPath] = true;
                                    }
                                }
                            }
                        }
                        ensureSecureIndexFile($extractDir);
                        $uploaded++;
                        continue;
                    } else {
                        $failed++;
                        $errorDetails[] = $fileName . ": Failed to open ZIP archive.";
                        continue;
                    }
                }

                $uploadPaths = $_POST["upload_paths"] ?? [];
                $relativePath = cleanPath((string)($uploadPaths[$index] ?? ""));
                $targetDir = $currentDir;
                if ($relativePath !== "") {
                    $fileName = cleanName(basename($relativePath));
                    $dirPart = cleanPath(dirname($relativePath));
                    if ($dirPart !== "." && $dirPart !== "") {
                        $parts = explode("/", $dirPart);
                        $accum = $currentDir;
                        foreach ($parts as $p) {
                            if ($p !== "") {
                                $accum .= "/" . $p;
                                if (!is_dir($accum)) {
                                    mkdir($accum, 0755, true);
                                    ensureSecureIndexFile($accum);
                                }
                            }
                        }
                        $targetDir = $accum;
                    }
                }

                if (isSystemManagedFile($fileName)) {
                    if ($fileName === "index.html") ensureSecureIndexFile($targetDir);
                    if (is_file($tmpName)) @unlink($tmpName);
                    continue;
                }

                if (!in_array($ext, $allowedExtensions, true)) {
                    $failed++;
                    $errorDetails[] = $fileName . ": File type is not allowed.";
                    continue;
                }

                $convertWebpOption = isset($_POST["convert_webp"])
                    ? ($_POST["convert_webp"] === "1" || $_POST["convert_webp"] === "true" || $_POST["convert_webp"] === 1)
                    : (!$isConverter);
                $triedWebp = false;
                if ($convertWebpOption && isWebpConvertibleImage($fileName)) {
                    $triedWebp = true;
                    $webpName = cleanBaseName($fileName) . ".webp";
                    $webpPath = $targetDir . "/" . $webpName;
                    
                    if (file_exists($webpPath)) {
                        imghost_autoBackupTargets([$webpPath]);
                    }
                    
                    if (saveOptimizedWebp($tmpName, $webpPath, $ext)) {
                        $uploaded++;
                        $optimized++;
                        $uploadedBackupPaths[$webpPath] = true;
                        
                        // Delete the old original extension file if it exists to avoid showing 2 files
                        $oldOriginalPath = $targetDir . "/" . $fileName;
                        if (strtolower($ext) !== 'webp' && file_exists($oldOriginalPath)) {
                            imghost_autoBackupTargets([$oldOriginalPath]);
                            @unlink($oldOriginalPath);
                        }
                        
                        if (isset($partFile) && file_exists($partFile)) {
                            @unlink($partFile);
                            if (isset($partDir) && is_dir($partDir)) @rmdir($partDir);
                        }
                        continue;
                    }
                }

                $destination = $targetDir . "/" . $fileName;
                
                if (file_exists($destination) && !isVideoFile($fileName)) {
                    imghost_autoBackupTargets([$destination]);
                }
                
                if (storeUploadedTempFile($tmpName, $destination)) {
                    @chmod($destination, 0644);
                    $uploaded++;
                    if (!isVideoFile($fileName)) {
                        $uploadedBackupPaths[$destination] = true;
                    }
                    if (isset($partFile) && file_exists($partFile)) {
                        @unlink($partFile);
                        if (isset($partDir) && is_dir($partDir)) @rmdir($partDir);
                    }
                    if ($triedWebp && $ext !== "webp") {
                        $fallbackOriginal++;
                    }

                    continue;
                } else {
                    $failed++;
                    $errorDetails[] = $fileName . ": Server cannot move uploaded file to destination folder.";
                    if (isset($partFile) && file_exists($partFile)) {
                        @unlink($partFile);
                        if (isset($partDir) && is_dir($partDir)) @rmdir($partDir);
                    }
                    continue;
                }
            }
            $message = "$uploaded file(s) uploaded successfully.";
            if ($optimized) $message .= " $optimized image(s) optimized to WebP.";
            if ($fallbackOriginal) $message .= " $fallbackOriginal image(s) saved in original format (WebP conversion unavailable).";
            if ($failed) $message .= " $failed file(s) failed.";
            if ($uploadAjax) {
                if (ob_get_length()) @ob_clean();
                header("Content-Type: application/json");
                echo json_encode([
                    "success" => $uploaded > 0,
                    "uploaded" => $uploaded,
                    "optimized" => $optimized,
                    "fallback_original" => $fallbackOriginal,
                    "failed" => $failed,
                    "message" => $message,
                    "errors" => $errorDetails,
                ]);
                kiuq_finish_request();
                // Run auto-backup in background after response is flushed to client
                if (!empty($uploadedBackupPaths)) {
                    imghost_autoBackup(array_keys($uploadedBackupPaths));
                }
                exit;
            }
            if (!empty($uploadedBackupPaths)) {
                imghost_autoBackup(array_keys($uploadedBackupPaths));
            }
        } elseif ($uploadAjax) {
            if (ob_get_length()) @ob_clean();
            header("Content-Type: application/json");
            echo json_encode([
                "success" => false,
                "uploaded" => 0,
                "optimized" => 0,
                "failed" => 0,
                "message" => "No files were selected.",
            ]);
            exit;
        }
    } elseif ($action === "check_webm_status") {
        // WebM auto-conversion is disabled; clean up any lingering job status files
        $jobFiles = @glob($currentDir . "/.webm_job_*.json");
        if ($jobFiles) {
            foreach ($jobFiles as $jf) @unlink($jf);
        }
        if (ob_get_length()) @ob_clean();
        header("Content-Type: application/json");
        echo json_encode(["success" => true, "jobs" => []]);
        exit;
    } elseif ($action === "convert_video_webm") {
        if (ob_get_length()) @ob_clean();
        header("Content-Type: application/json");
        echo json_encode(["success" => false, "message" => "Video conversion is disabled. Original video format & quality are 100% preserved."]);
        exit;
    } elseif ($action === "resize_images") {
        $files = $_POST["files"] ?? [];
        if (is_string($files)) {
            $decoded = json_decode($files, true);
            if (is_array($decoded)) {
                $files = $decoded;
            } elseif (strpos($files, ',') !== false) {
                $files = array_map('trim', explode(',', $files));
            } elseif (!empty($files)) {
                $files = [$files];
            }
        }
        if (!is_array($files)) {
            $singleFile = cleanExistingName($_POST["file_name"] ?? "");
            $files = $singleFile ? [$singleFile] : [];
        }

        $rawMode = function_exists('cleanInput') ? cleanInput($_POST['resize_mode'] ?? 'filesize') : trim(strip_tags((string)($_POST['resize_mode'] ?? 'filesize')));
        $rawUnit = strtoupper(function_exists('cleanInput') ? cleanInput($_POST['size_unit'] ?? 'MB') : trim(strip_tags((string)($_POST['size_unit'] ?? 'MB'))));
        $rawFormat = strtolower(function_exists('cleanInput') ? cleanInput($_POST['output_format'] ?? 'original') : trim(strip_tags((string)($_POST['output_format'] ?? 'original'))));
        $rawSaveMode = strtolower(function_exists('cleanInput') ? cleanInput($_POST['save_mode'] ?? 'replace') : trim(strip_tags((string)($_POST['save_mode'] ?? 'replace'))));

        $options = [
            'mode'           => in_array($rawMode, ['filesize', 'dimensions', 'percentage'], true) ? $rawMode : 'filesize',
            'target_size'    => max(0.01, floatval($_POST['target_size'] ?? 5)),
            'size_unit'      => ($rawUnit === 'KB') ? 'KB' : 'MB',
            'width'          => max(0, intval($_POST['target_width'] ?? 0)),
            'height'         => max(0, intval($_POST['target_height'] ?? 0)),
            'maintain_ratio' => !empty($_POST['maintain_ratio']),
            'percentage'     => max(5, min(200, intval($_POST['percentage'] ?? 50))),
            'quality'        => max(20, min(100, intval($_POST['quality'] ?? 88))),
            'format'         => in_array($rawFormat, ['original', 'webp', 'jpg', 'jpeg', 'png', 'gif', 'avif'], true) ? $rawFormat : 'original',
            'save_mode'      => ($rawSaveMode === 'copy') ? 'copy' : 'replace',
        ];

        $results = [];
        $successCount = 0;
        $failCount = 0;
        $backupPaths = [];

        foreach ($files as $rawFileName) {
            $fileName = cleanExistingName($rawFileName);
            if (!$fileName) continue;
            $srcPath = $currentDir . "/" . $fileName;
            if (!file_exists($srcPath) || !isImageFile($fileName)) {
                $results[] = [
                    'file' => $fileName,
                    'success' => false,
                    'message' => 'File not found or not an image'
                ];
                $failCount++;
                continue;
            }

            $origSize = filesize($srcPath);
            $ext = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
            $baseName = cleanBaseName($fileName);
            $targetExt = ($options['format'] === 'webp') ? 'webp' : (($options['format'] === 'original' || empty($options['format'])) ? $ext : $options['format']);

            if ($options['save_mode'] === 'copy') {
                $destName = $baseName . '_resized.' . $targetExt;
                $destPath = $currentDir . "/" . $destName;
                $copyNum = 1;
                while (file_exists($destPath)) {
                    $destName = $baseName . '_resized_' . $copyNum . '.' . $targetExt;
                    $destPath = $currentDir . "/" . $destName;
                    $copyNum++;
                }
            } else {
                if ($targetExt !== $ext) {
                    $destName = $baseName . '.' . $targetExt;
                    $destPath = $currentDir . "/" . $destName;
                } else {
                    $destName = $fileName;
                    $destPath = $srcPath;
                }
                $backupPaths[] = $srcPath;
            }

            $ok = processImageResize($srcPath, $destPath, $options);
            if ($ok && file_exists($destPath) && filesize($destPath) > 0) {
                $newSize = filesize($destPath);
                if ($options['save_mode'] === 'replace' && $destPath !== $srcPath && file_exists($srcPath)) {
                    @unlink($srcPath);
                }
                $savings = $origSize > 0 ? round((1 - ($newSize / $origSize)) * 100, 1) : 0;
                $results[] = [
                    'file' => $fileName,
                    'new_name' => $destName,
                    'old_size' => $origSize,
                    'new_size' => $newSize,
                    'old_size_formatted' => formatSize($origSize),
                    'new_size_formatted' => formatSize($newSize),
                    'savings_percent' => $savings,
                    'success' => true
                ];
                $successCount++;
            } else {
                $results[] = [
                    'file' => $fileName,
                    'success' => false,
                    'message' => 'Resize failed or could not process image'
                ];
                $failCount++;
            }
        }

        if (!empty($backupPaths) && function_exists('imghost_autoBackupTargets')) {
            imghost_autoBackupTargets($backupPaths);
        }

        if (ob_get_length()) @ob_clean();
        header("Content-Type: application/json");
        echo json_encode([
            'success' => $successCount > 0,
            'total' => count($files),
            'success_count' => $successCount,
            'fail_count' => $failCount,
            'results' => $results,
            'message' => "Resized $successCount image(s) successfully" . ($failCount > 0 ? " ($failCount failed)" : "") . "."
        ]);
        exit;
    } elseif ($action === "rename_item") {
        $oldName = cleanExistingName($_POST["old_name"] ?? "");
        $newName = cleanName($_POST["new_name"] ?? "");
        if (isSystemManagedFile($oldName)) {
            $message = "System file is hidden.";
            $messageType = "warning";
        } elseif (isSystemManagedFile($newName)) {
            $message = "That file name is reserved.";
            $messageType = "warning";
        } elseif ($oldName && $newName) {
            $oldPath = $currentDir . "/" . $oldName;
            $newPath = $currentDir . "/" . $newName;
            if (file_exists($oldPath) && !file_exists($newPath)) {
                rename($oldPath, $newPath);
                $message = "Renamed to \"$newName\".";
            }
        }
    } elseif ($action === "rename_type") {
        $items = $_POST["items"] ?? [];
        $baseName = cleanName($_POST["base_name"] ?? "");
        if ($baseName && is_array($items) && !empty($items)) {
            $renamedCount = 0;
            foreach ($items as $item) {
                $oldName = cleanExistingName($item);
                if (!$oldName || isSystemManagedFile($oldName)) continue;
                $oldPath = $currentDir . "/" . $oldName;
                if (!file_exists($oldPath) || is_dir($oldPath)) continue;
                $ext = strtolower(pathinfo($oldName, PATHINFO_EXTENSION));
                
                $counter = 1;
                while (true) {
                    $numStr = str_pad($counter, 2, "0", STR_PAD_LEFT);
                    $newName = $baseName . "-" . $numStr . ($ext ? "." . $ext : "");
                    $newPath = $currentDir . "/" . $newName;
                    if ($newPath === $oldPath || !file_exists($newPath)) break;
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
    } elseif ($action === "delete_item") {
        $itemName = cleanExistingName($_POST["item_name"] ?? "");
        if ($itemName && isSystemManagedFile($itemName)) {
            $message = "System file is hidden.";
            $messageType = "warning";
        } elseif ($isConverter && $itemName) {
            $target = $currentDir . "/" . $itemName;
            if (is_dir($target)) {
                deleteFolder($target);
                $message = "Folder deleted.";
            } elseif (is_file($target)) {
                unlink($target);
                $message = "File deleted.";
            } else {
                $message = "Item not found."; $messageType = "warning";
            }
        } elseif (!verifyDeletePassword($_POST["delete_password"] ?? "")) {
            $message = "Delete password is incorrect."; $messageType = "error";
        } elseif ($itemName) {
            $target = $currentDir . "/" . $itemName;
            $relative = $current ? $current . "/" . $itemName : $itemName;
            if (file_exists($target)) {
                imghost_autoBackupTargets([$target]);
            }
            if (trashItem($target, $relative)) {
                $message = "Item moved to trash.";
            }
        }
    } elseif ($action === "delete_selected") {
        $names = $_POST["selected_names"] ?? [];
        $count = 0;
        if ($isConverter) {
            foreach ($names as $n) {
                $n = cleanExistingName($n);
                if (!$n || isSystemManagedFile($n)) continue;
                $target = $currentDir . "/" . $n;
                if (is_dir($target)) {
                    deleteFolder($target);
                    $count++;
                } elseif (is_file($target)) {
                    unlink($target);
                    $count++;
                }
            }
            $message = "$count item(s) deleted.";
        } elseif (!verifyDeletePassword($_POST["delete_password"] ?? "")) {
            $message = "Delete password is incorrect."; $messageType = "error";
        } else {
            $targetsToBackup = [];
            foreach ($names as $n) {
                $n = cleanExistingName($n);
                if (!$n || isSystemManagedFile($n)) continue;
                $target = $currentDir . "/" . $n;
                if (file_exists($target)) {
                    $targetsToBackup[] = $target;
                }
            }
            if (!empty($targetsToBackup)) {
                imghost_autoBackupTargets($targetsToBackup);
            }

            foreach ($names as $n) {
                $n = cleanExistingName($n);
                if (!$n || isSystemManagedFile($n)) continue;
                $target = $currentDir . "/" . $n;
                $relative = $current ? $current . "/" . $n : $n;
                if (trashItem($target, $relative)) $count++;
            }
            $message = "$count item(s) moved to trash.";
        }
    } elseif ($action === "download_selected") {
        $names = $_POST["selected_names"] ?? [];
        $pathMap = [];
        foreach ($names as $n) {
            $n = cleanExistingName($n);
            if (!$n || isSystemManagedFile($n)) continue;
            $src = $currentDir . "/" . $n;
            if (file_exists($src)) $pathMap[$src] = $n;
        }
        if (empty($pathMap)) {
            $message = "No valid items selected for download.";
            $messageType = "warning";
        } else {
            $archiveName = sanitizeDownloadFilename("selected-" . ($current ? str_replace("/", "-", $current) : "root") . "-" . date("Ymd-His") . ".zip", "selected.zip");
            if (!streamZipDownloadFromMap($pathMap, $archiveName)) {
                $message = "ZIP download is unavailable on this server.";
                $messageType = "error";
            }
        }
    } elseif ($action === "move_selected") {
        $names = $_POST["selected_names"] ?? [];
        $dest = cleanPath($_POST["move_destination"] ?? "");
        $destDir = safeFullPath($BASE_DIR, $dest);
        if ($isWebsiteTeam && !relativePathInRoot($dest, $websiteTeamRootRelative)) {
            $message = "Website Team can only move items inside the Website-Team folder.";
            $messageType = "error";
        } elseif (is_dir($destDir)) {
            $count = 0;
            foreach ($names as $n) {
                $n = cleanExistingName($n);
                if (!$n || isSystemManagedFile($n)) continue;
                $src = $currentDir . "/" . $n;
                $dst = $destDir . "/" . $n;
                $srcReal = realpath($src);
                $destReal = realpath($destDir);
                if (is_dir($src) && $srcReal && $destReal && ($destReal === $srcReal || strpos($destReal, $srcReal . DIRECTORY_SEPARATOR) === 0)) {
                    continue;
                }
                if (file_exists($src) && !file_exists($dst)) {
                    rename($src, $dst); $count++;
                }
            }
            $message = "$count item(s) moved.";
        } else { $message = "Destination folder not found."; $messageType = "warning"; }
    } elseif ($action === "copy_selected") {
        $names = $_POST["selected_names"] ?? [];
        $clipboardItems = [];
        foreach ($names as $n) {
            $n = cleanExistingName($n);
            if (!$n || isSystemManagedFile($n)) continue;
            $src = $currentDir . "/" . $n;
            if (file_exists($src)) $clipboardItems[] = $current ? $current . "/" . $n : $n;
        }
        $_SESSION["clipboard"] = [
            "mode" => "copy",
            "items" => $clipboardItems,
            "created_at" => time(),
        ];
        $message = count($clipboardItems) . " item(s) copied. Open a folder and click Paste.";
    } elseif ($action === "paste_clipboard") {
        $clip = $_SESSION["clipboard"] ?? ["items" => []];
        $count = 0;
        $skipped = 0;
        foreach (($clip["items"] ?? []) as $relative) {
            $relative = cleanPath($relative);
            if (!$relative) continue;
            if (isSystemManagedFile(basename($relative))) {
                $skipped++;
                continue;
            }
            if ($isWebsiteTeam && !relativePathInRoot($relative, $websiteTeamRootRelative)) {
                $skipped++;
                continue;
            }
            $src = safeFullPath($BASE_DIR, $relative);
            if (!file_exists($src)) { $skipped++; continue; }
            if (is_dir($src) && ($current === $relative || ($current && strpos($current . "/", $relative . "/") === 0))) {
                $skipped++;
                continue;
            }
            $dst = uniqueDestinationPath($currentDir, basename($relative));
            if (is_dir($src)) {
                if (copyFolder($src, $dst)) $count++;
                else $skipped++;
            } elseif (is_file($src)) {
                if (copy($src, $dst)) $count++;
                else $skipped++;
            }
        }
        $message = "$count item(s) pasted." . ($skipped ? " $skipped skipped." : "");
        if ($count === 0 && $skipped === 0) { $message = "Clipboard is empty."; $messageType = "warning"; }
    } elseif ($action === "restore_trash_item") {
        $trashId = preg_replace("/[^a-f0-9]/", "", $_POST["trash_id"] ?? "");
        $trash = loadTrashIndex();
        $trashRelative = cleanPath($trash["items"][$trashId]["original_relative"] ?? "");
        if ($isWebsiteTeam && !relativePathInRoot($trashRelative, $websiteTeamRootRelative)) {
            $message = "Website Team can only recover items from the Website-Team folder.";
            $messageType = "error";
        } elseif ($trashId && restoreTrashItem($trashId)) {
            $message = "Item recovered from trash.";
        } else {
            $message = "Could not recover item."; $messageType = "warning";
        }
    } elseif ($action === "restore_trash_selected") {
        $ids = $_POST["trash_ids"] ?? [];
        $trash = loadTrashIndex();
        $count = 0;
        foreach ($ids as $trashId) {
            $trashId = preg_replace("/[^a-f0-9]/", "", $trashId);
            $trashRelative = cleanPath($trash["items"][$trashId]["original_relative"] ?? "");
            if ($isWebsiteTeam && !relativePathInRoot($trashRelative, $websiteTeamRootRelative)) continue;
            if ($trashId && restoreTrashItem($trashId)) $count++;
        }
        $message = "$count item(s) recovered from trash.";
    } elseif ($action === "delete_trash_item") {
        $trashId = preg_replace("/[^a-f0-9]/", "", $_POST["trash_id"] ?? "");
        $trash = loadTrashIndex();
        $trashRelative = cleanPath($trash["items"][$trashId]["original_relative"] ?? "");
        if (!verifyDeletePassword($_POST["delete_password"] ?? "")) {
            $message = "Delete password is incorrect."; $messageType = "error";
        } elseif ($isWebsiteTeam && !relativePathInRoot($trashRelative, $websiteTeamRootRelative)) {
            $message = "Website Team can only delete trash from the Website-Team folder.";
            $messageType = "error";
        } elseif ($trashId && permanentlyDeleteTrashItem($trashId)) {
            $message = "Item permanently deleted.";
        } else {
            $message = "Could not delete item."; $messageType = "warning";
        }
    } elseif ($action === "delete_trash_selected") {
        $ids = $_POST["trash_ids"] ?? [];
        $trash = loadTrashIndex();
        $count = 0;
        if (!verifyDeletePassword($_POST["delete_password"] ?? "")) {
            $message = "Delete password is incorrect."; $messageType = "error";
        } else {
            foreach ($ids as $trashId) {
                $trashId = preg_replace("/[^a-f0-9]/", "", $trashId);
                $trashRelative = cleanPath($trash["items"][$trashId]["original_relative"] ?? "");
                if ($isWebsiteTeam && !relativePathInRoot($trashRelative, $websiteTeamRootRelative)) continue;
                if ($trashId && permanentlyDeleteTrashItem($trashId)) $count++;
            }
            $message = "$count trash item(s) permanently deleted.";
        }
    } elseif ($action === "empty_trash") {
        if (!verifyDeletePassword($_POST["delete_password"] ?? "")) {
            $message = "Delete password is incorrect."; $messageType = "error";
        } else {
            $trash = loadTrashIndex();
            $count = 0;
            foreach (array_keys($trash["items"]) as $trashId) {
                $trashRelative = cleanPath($trash["items"][$trashId]["original_relative"] ?? "");
                if ($isWebsiteTeam && !relativePathInRoot($trashRelative, $websiteTeamRootRelative)) continue;
                if (permanentlyDeleteTrashItem($trashId)) $count++;
            }
            $message = "$count trash item(s) permanently deleted.";
        }
    } elseif ($action === "edit_file") {
        $fileName = cleanExistingName($_POST["edit_file_name"] ?? "");
        $content = $_POST["edit_file_content"] ?? "";
        $target = $currentDir . "/" . $fileName;
        if (isSystemManagedFile($fileName)) {
            $message = "System file is hidden.";
            $messageType = "warning";
        } elseif (is_file($target)) {
            file_put_contents($target, $content);
            $message = "File saved.";
        }

    // ════════════════════════════════════════════════════════════════════════
    // FEATURE ACTIONS — Additive only. Do not modify anything above this block
    // ════════════════════════════════════════════════════════════════════════
    } elseif ($FEATURES_ENABLED && in_array($action, [
        'set_folder_color','toggle_favorite','toggle_pin','get_folder_meta_bulk','toggle_sidebar_pin'
    ], true)) {
        // Folder meta actions — return JSON directly
        folder_meta_handle($action, $_POST, $currentUser['id'] ?? '', $BASE_DIR);
        exit;

    } elseif ($FEATURES_ENABLED && $action === 'get_properties') {
        $iName = cleanExistingName($_POST['item_name'] ?? '');
        $iPath = $currentDir . '/' . $iName;
        $iRel  = $current ? $current . '/' . $iName : $iName;
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
        'get_versions','restore_version','delete_version','download_version'
    ], true)) {
        version_history_handle($action, $_POST, $BASE_DIR, $currentDir, $current,
            $currentUser['id'] ?? '', 'cleanExistingName', 'formatSize', 'imghost_autoBackup');
        exit;

    } elseif ($FEATURES_ENABLED && in_array($action, [
        'ai_bg_remove_start','ai_bg_remove_process','ai_bg_remove_status',
        'ai_bg_remove_cancel','ai_bg_remove_download_zip', 'ai_bg_remove_save_canvas', 'canvas_edit_save', 'ai_bg_remove_sync'
    ], true)) {
        ai_bg_remove_handle($action, $_POST, $BASE_DIR, $currentDir, $current,
            $currentUser['id'] ?? '', $BASE_URL, 'imghost_autoBackup');
        exit;

    } elseif ($FEATURES_ENABLED && $action === 'get_storage_stats') {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }
        storage_dashboard_handle($currentDir, defined('STORAGE_QUOTA_BYTES') ? STORAGE_QUOTA_BYTES : 150 * 1024 * 1024 * 1024);
        exit;

    } elseif ($FEATURES_ENABLED && $action === 'delete_duplicate') {
        // Delete a duplicate file (uses same security as delete_item)
        $itemRel = cleanPath($_POST['item_rel'] ?? '');
        if (!$isConverter && !verifyDeletePassword($_POST['delete_password'] ?? '')) {
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
    } elseif (in_array($action, [
        'convert_upload_file', 'convert_init_job', 'convert_process_step', 'convert_finish_job', 'convert_download'
    ], true)) {
        if (function_exists('file_converter_handle')) {
            file_converter_handle($action, $_POST, $_FILES, $BASE_DIR, $currentDir, $current,
                $currentUser['id'] ?? '', $BASE_URL, 'imghost_autoBackup');
        } else {
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'error' => 'File converter module is not available']);
        }
        exit;
    }
    // ════════════════════════════════════════════════════════════════════════

    $redirect = $redirectOverride ?: ($redirectToTrash ? ($pageUrl . "?trash=1") : ($pageUrl . "?path=" . urlencode($current)));
    if ($message) $redirect .= "&msg=" . urlencode($message) . "&msgtype=" . urlencode($messageType);
    header("Location: " . $redirect);
    exit;
}

$message = $_GET["msg"] ?? "";
$messageType = $_GET["msgtype"] ?? "success";

/*
|--------------------------------------------------------------------------
| LOAD FILES
|--------------------------------------------------------------------------
*/

$items = [];
ensureSecureIndexFile($currentDir);
$scanned = @scandir($currentDir);
if (is_array($scanned)) {
    foreach ($scanned as $item) {
        if ($item === "." || $item === "..") continue;
        if (shouldHideFromFileManager($item)) continue;
        $path = $currentDir . "/" . $item;
        $st = @stat($path);
        if (!$st) continue;
        $isDir = ($st['mode'] & 0040000) === 0040000;
        $size = $isDir ? getFolderTotalSize($path) : (int)$st['size'];
        // Never show 0-byte or unfinished webm files in the file manager
        if (!$isDir && $size === 0 && str_ends_with(strtolower($item), '.webm')) {
            continue;
        }
        $mtime = (int)($st['mtime'] ?? 0);
        $ctime = (int)($st['ctime'] ?? $mtime);
        $items[] = [
            "name"     => $item,
            "is_dir"   => $isDir,
            "size"     => $size,
            "mtime"    => $mtime,
            "ctime"    => $ctime,
            "is_image" => !$isDir && isImageFile($item),
            "is_video" => !$isDir && isVideoFile($item),
            "is_code"  => !$isDir && isCodeFile($item),
        ];
    }
}

// ── Advanced Sorting ──────────────────────────────────────────────────────
$allowedSortKeys = ['name_asc','name_desc','newest','oldest','size_asc','size_desc','width','height'];
$sortKey = in_array($_GET['sort'] ?? '', $allowedSortKeys, true) ? $_GET['sort'] : 'name_asc';

if ($FEATURES_ENABLED && function_exists('sorting_sort_items')) {
    $items = sorting_sort_items($items, $sortKey, $currentDir);
} else {
    usort($items, function($a, $b) {
        if ($a["is_dir"] !== $b["is_dir"]) return $a["is_dir"] ? -1 : 1;
        return strcasecmp($a["name"], $b["name"]);
    });
}

// ── Folder Meta (colors, favorites, pins) ─────────────────────────────────
$folderMeta = [];
if ($FEATURES_ENABLED && function_exists('feature_db_get_folder_meta_bulk')) {
    $folderPaths = [];
    foreach ($items as $item) {
        if ($item['is_dir']) {
            $folderPaths[] = $current ? $current . '/' . $item['name'] : $item['name'];
        }
    }
    if (!empty($folderPaths)) {
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
$videoItems = [];
foreach ($items as $item) {
    if (!$item["is_dir"]) {
        $relative = $current ? $current . "/" . $item["name"] : $item["name"];
        if ($item["is_image"]) {
            $imageUrls[] = publicUrl($BASE_URL, $relative);
        } elseif (!empty($item["is_video"])) {
            $videoItems[] = [
                "name" => $item["name"],
                "url"  => publicUrl($BASE_URL, $relative),
                "size" => $item["size"],
                "ext"  => strtolower(pathinfo($item["name"], PATHINFO_EXTENSION)),
            ];
        }
    }
}


$editFile = "";
$editContent = "";
if (isset($_GET["edit"]) && ($isAdmin || $isWebsiteTeam)) {
    $editFile = cleanExistingName($_GET["edit"]);
    $editPath = $currentDir . "/" . $editFile;
    if (isSystemManagedFile($editFile)) {
        $editFile = "";
    } elseif (is_file($editPath)) {
        $editContent = file_get_contents($editPath);
    }
}

$folderCount = 0; $fileCount = 0; $totalSize = 0;
foreach ($items as $item) {
    if ($item["is_dir"]) {
        $folderCount++;
        $totalSize += (int)($item["size"] ?? 0);
    } else {
        $fileCount++;
        $totalSize += (int)($item["size"] ?? 0);
    }
}
$displayTotalSize = $totalSize;
$trashItems = [];
if ($trashMode) {
    $trashData = loadTrashIndex();
    $trashItems = array_values($trashData["items"]);
    if ($isWebsiteTeam) {
        $trashItems = array_values(array_filter($trashItems, function($item) use ($websiteTeamRootRelative) {
            return relativePathInRoot($item["original_relative"] ?? "", $websiteTeamRootRelative);
        }));
    }
    usort($trashItems, function($a, $b) {
        return ($b["deleted_at"] ?? 0) <=> ($a["deleted_at"] ?? 0);
    });
}
$isPjax = (isset($_SERVER['HTTP_X_PJAX']) || (isset($_GET['pjax']) && $_GET['pjax'] === '1'));
$securityData = $isPjax ? ["banned" => []] : loadSecurityData();
$bannedDevices = $securityData["banned"];
$clipboardCount = count($_SESSION["clipboard"]["items"] ?? []);
$folderOptions = [];
$appSettings = loadAppSettings();
$availableThemeImages = $isPjax ? [] : listDashboardThemeImages();
$currentUser = currentUser();
if (!$currentUser) {
    session_destroy();
    header("Location: " . $_SERVER["PHP_SELF"]);
    exit;
}
$isAdmin = isAdminUser($currentUser);
$isSuperAdmin = isSuperAdminUser($currentUser);
$isConverter = isConverterUser($currentUser);
$isWebsiteTeam = isWebsiteTeamUser($currentUser);
$dashboardThemeUrl = "";
if (!empty($_COOKIE["kiuq_dashboard_theme"])) {
    setcookie("kiuq_dashboard_theme", "", time() - 3600, "/");
}
$allUsers = $isPjax ? [] : loadUsers()["users"];
$loginActivities = [];
if (!$isPjax && $activityMode) {
    $loginActivities = loadLoginActivity();
    if (!$isAdmin) {
        $loginActivities = ($currentUser["can_view_login_activity"] ?? true)
            ? array_values(array_filter($loginActivities, fn($row) => ($row["user_id"] ?? "") === ($currentUser["id"] ?? "")))
            : [];
    }
}
$sidebarPins = [];
$sidebarFolderColors = [];
if (!$isPjax && $FEATURES_ENABLED && function_exists('feature_db')) {
    $db = feature_db();
    if ($db) {
        try {
            $stmt = $db->prepare("SELECT path, is_dir FROM sidebar_pins WHERE user_id=? ORDER BY created_at ASC");
            $stmt->execute([$currentUser['id'] ?? '']);
            $sidebarPins = $stmt->fetchAll();

            $pinnedFolderPaths = [];
            foreach ($sidebarPins as $pin) {
                if ($pin['is_dir']) $pinnedFolderPaths[] = $pin['path'];
            }
            if (!empty($pinnedFolderPaths) && function_exists('feature_db_get_folder_meta_bulk')) {
                $rawMeta = feature_db_get_folder_meta_bulk($pinnedFolderPaths, $currentUser['id'] ?? '');
                foreach ($rawMeta as $path => $meta) {
                    if (!empty($meta['color'])) $sidebarFolderColors[$path] = $meta['color'];
                }
            }
        } catch (Throwable $e) {
            error_log('[FeatureDB load_sidebar_pins] ' . $e->getMessage());
        }
    }
}
$preferredTheme = in_array($currentUser["theme"] ?? "light", ["light", "dark", "system"], true) ? $currentUser["theme"] : "light";
$visibleBaseUrl = $isWebsiteTeam ? publicUrl($BASE_URL, $websiteTeamRootRelative) : $BASE_URL;
$uploadMaxFilesizeBytes = iniSizeToBytes(ini_get("upload_max_filesize"));
$postMaxSizeBytes = iniSizeToBytes(ini_get("post_max_size"));
$serverUploadLimitBytes = 0; // 0 = No file size limit! Files of any size supported via streaming chunks.

// Compute safe upload chunk size for client (ensures each chunk is safely below server limits)
$maxServerChunk = 8 * 1024 * 1024;
if ($uploadMaxFilesizeBytes > 0 && $postMaxSizeBytes > 0) {
    $maxServerChunk = min($uploadMaxFilesizeBytes, $postMaxSizeBytes);
} elseif ($uploadMaxFilesizeBytes > 0) {
    $maxServerChunk = $uploadMaxFilesizeBytes;
} elseif ($postMaxSizeBytes > 0) {
    $maxServerChunk = $postMaxSizeBytes;
}
$safeChunkSizeBytes = max(2 * 1024 * 1024, min(8 * 1024 * 1024, (int)floor($maxServerChunk * 0.75)));

// Build image list for lightbox (JS)
$imageList = [];
foreach ($items as $idx => $item) {
    if (!$item["is_dir"] && $item["is_image"]) {
        $relative = $current ? $current . "/" . $item["name"] : $item["name"];
        $publicImageUrl = publicUrl($BASE_URL, $relative);
        $absPath = $currentDir . "/" . $item["name"];
        $thumbUrl = getThumbnailUrl($relative, $absPath, $item["mtime"] ?? 0, 360);
        $imageList[] = [
            "name"       => $item["name"],
            "url"        => versionedImageUrl($publicImageUrl, $item["mtime"] ?? 0, $item["size"] ?? 0, $item["ctime"] ?? 0),
            "thumb"      => $thumbUrl,
            "public_url" => $publicImageUrl,
            "idx"        => $idx,
        ];
    }
}

if (!$isPjax):
?>
<!DOCTYPE html>
<html lang="en" data-theme="<?php echo htmlspecialchars($preferredTheme === "system" ? "light" : $preferredTheme); ?>"<?php echo $dashboardThemeUrl !== '' ? ' class="dashboard-themed"' : ''; ?>>
<head>
<meta charset="UTF-8">
<title><?php echo htmlspecialchars($appSettings["app_name"]); ?> - Dashboard</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<?php if (!empty($appSettings["favicon_url"])): ?><link rel="icon" href="<?php echo htmlspecialchars($appSettings["favicon_url"]); ?>"><?php endif; ?>
<style>
:root, html {
    color-scheme: <?php echo $preferredTheme === 'dark' ? 'dark' : 'light'; ?>;
}
html, body {
    background-color: <?php echo ($preferredTheme === 'dark' || !empty($dashboardThemeUrl)) ? '#0f1626' : '#f4f6fa'; ?>;
    color: var(--text);
}
[data-theme="dark"],
[data-theme="dark"] body {
    color-scheme: dark;
    background-color: #0f1626 !important;
    background: radial-gradient(circle at 50% -10%, #1c2744 0%, #0d1322 100%) !important;
}
[data-theme="light"],
[data-theme="light"] body {
    color-scheme: light;
    background-color: #f4f6fa !important;
    background: #f4f6fa !important;
}
html.dashboard-themed,
html.dashboard-themed body,
body.dashboard-themed,
[data-theme="dark"].dashboard-themed body,
[data-theme="dark"] body.dashboard-themed {
    background-color: #0b0f19 !important;
}
[data-theme="light"].dashboard-themed body,
[data-theme="light"] body.dashboard-themed {
    background-color: #f8fafc !important;
}
</style>
<?php if (!empty($dashboardThemeUrl)): ?>
<link rel="preload" as="image" href="<?php echo htmlspecialchars($dashboardThemeUrl, ENT_QUOTES, 'UTF-8'); ?>" fetchpriority="high">
<?php endif; ?>
<script>
(() => {
    const saved = localStorage.getItem('kiuqTheme') || <?php echo json_encode($preferredTheme); ?>;
    const theme = saved === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : saved;
    document.documentElement.dataset.theme = theme;
    try {
        if (localStorage.getItem('kiuqSidebarCollapsed') === '1' && window.innerWidth >= 900) {
            document.documentElement.classList.add('sidebar-collapsed');
        }
    } catch(e) {}
    try {
        localStorage.removeItem('kiuq_dashboard_theme');
        document.documentElement.classList.remove('dashboard-themed');
        document.documentElement.style.removeProperty('--dashboard-bg-image');
    } catch(e) {}
})();
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<noscript><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet"></noscript>

<link rel="stylesheet" href="<?php echo htmlspecialchars($APP_ASSETS_URL); ?>/css/panel.css?v=<?php echo (int)@filemtime($APP_ASSETS_DIR . '/css/panel.css'); ?>">
<style>
.modal-overlay { display: none; position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.65); align-items: center; justify-content: center; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
.modal-overlay.open { display: flex !important; }
</style>

<?php
$bodyClasses = ['sidebar-collapsed'];
$bodyClassStr = implode(' ', $bodyClasses);
?>
<body class="<?php echo $bodyClassStr; ?>">
<script>
(function() {
    try {
        var saved = localStorage.getItem('kiuq_sidebar_collapsed');
        if (saved === '0') {
            document.body.classList.remove('sidebar-collapsed');
        }
        localStorage.removeItem('kiuq_dashboard_theme');
        document.body.classList.remove('dashboard-themed');
        document.documentElement.classList.remove('dashboard-themed');
        document.body.style.removeProperty('--dashboard-bg-image');
        document.documentElement.style.removeProperty('--dashboard-bg-image');
    } catch(e){}
})();
</script>

<!-- PJAX Progress Bar -->
<div id="pjaxProgressBar"></div>

<!-- Collapsed Sidebar Floating Tooltip -->
<div id="sidebarTooltip"></div>

<!-- Global Drag Overlay -->
<div class="global-drag-overlay" id="globalDragOverlay">
    <div>
        <div style="font-size:54px; margin-bottom:16px;">☁️</div>
        <div>Drop files to review &amp; upload</div>
    </div>
</div>

<!-- Toast -->
<div class="toast-container" id="toastContainer"></div>

<!-- ===== MODALS ===== -->

<!-- Dashboard Theme -->
<?php 
if (is_file(__DIR__ . '/app-includes/modals.php')) require_once __DIR__ . '/app-includes/modals.php';
if (is_file(__DIR__ . '/app-includes/topbar.php')) require_once __DIR__ . '/app-includes/topbar.php';
if (is_file(__DIR__ . '/app-includes/sidebar.php')) require_once __DIR__ . '/app-includes/sidebar.php';
?>
<?php endif; /* end of !$isPjax */ ?>

    <!-- MAIN -->
    <main class="main">

        <!-- Stats -->
        <?php if (!$profileMode && !$settingsMode && !$activityMode && !$usersMode && !$trashMode): ?>
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
                <div class="stat-lbl" id="storageSizeLabel"><?php echo $current ? 'Folder size' : 'ebay total size'; ?></div>
            </div>
        </div>
        <?php endif; ?>

        <?php if ($message): ?>
        <div class="message msg-<?php echo htmlspecialchars($messageType); ?>">
            <?php echo $messageType === 'success' ? '✅' : '⚠️'; ?>
            <?php echo htmlspecialchars($message); ?>
        </div>
        <?php endif; ?>

        <?php if ($profileMode): ?>
        <div class="panel">
            <div class="panel-head">
                <span class="panel-title">👤 Profile</span>
                <span class="panel-meta">Update your dashboard name and avatar</span>
            </div>
            <div style="padding:18px;">
                <div class="admin-grid">
                    <div class="admin-card" style="display:flex;align-items:center;gap:14px;">
                        <span class="avatar-large">
                            <?php if (!empty($currentUser["avatar_url"])): ?><img src="<?php echo htmlspecialchars($currentUser["avatar_url"]); ?>" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;"><?php else: ?><?php echo htmlspecialchars(userInitials($currentUser)); ?><?php endif; ?>
                        </span>
                        <div>
                            <h3 style="margin:0;"><?php echo htmlspecialchars($currentUser["display_name"] ?? $currentUser["username"]); ?></h3>
                            <p style="font-size:12px;color:var(--muted);font-weight:700;margin-top:4px;"><?php echo htmlspecialchars($currentUser["username"]); ?> · <?php echo htmlspecialchars(roleLabel($currentUser["role"] ?? "staff")); ?></p>
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
                                        <?php if (!empty($currentUser["avatar_url"])): ?><img src="<?php echo htmlspecialchars($currentUser["avatar_url"]); ?>" alt="" style="width:100%;height:100%;object-fit:cover;"><?php else: ?><?php echo htmlspecialchars(userInitials($currentUser)); ?><?php endif; ?>
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
                                <input class="form-input" name="display_name" value="<?php echo htmlspecialchars($currentUser["display_name"] ?? ""); ?>" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Profile image URL</label>
                                <input class="form-input" name="avatar_url" type="url" value="<?php echo htmlspecialchars($currentUser["avatar_url"] ?? ""); ?>" placeholder="https://example.com/avatar.png">
                            </div>
                            <button class="form-btn btn-primary" type="submit">Save profile</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>

        <?php elseif ($settingsMode): ?>
            <?php if (!$isAdmin): ?>
                <div class="message msg-error">Admin permission is required.</div>
            <?php else: ?>
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
                                <input class="form-input" name="app_name" value="<?php echo htmlspecialchars($appSettings["app_name"]); ?>" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Dashboard logo URL</label>
                                <input class="form-input" name="dashboard_logo_url" type="url" value="<?php echo htmlspecialchars($appSettings["dashboard_logo_url"]); ?>" placeholder="https://example.com/logo.png">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Upload dashboard logo</label>
                                <input class="form-input" name="dashboard_logo_file" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.ico,image/*">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Browser tab icon / favicon URL</label>
                                <input class="form-input" name="favicon_url" type="url" value="<?php echo htmlspecialchars($appSettings["favicon_url"]); ?>" placeholder="https://example.com/favicon.png">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Upload browser tab icon</label>
                                <input class="form-input" name="favicon_file" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.ico,image/*">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Footer text name</label>
                                <input class="form-input" name="footer_name" value="<?php echo htmlspecialchars($appSettings["footer_name"]); ?>" required>
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
            <?php endif; ?>

        <?php elseif ($activityMode): ?>
            <?php if (!$isAdmin && !($currentUser["can_view_login_activity"] ?? true)): ?>
                <div class="message msg-error">Login activity is not enabled for this account.</div>
            <?php else: ?>
            <div class="panel">
                <div class="panel-head">
                    <span class="panel-title">🧾 Login Activity</span>
                    <div class="panel-head-actions">
                        <span class="panel-meta"><?php echo count($loginActivities); ?> sign-in record(s)</span>
                        <?php if ($isAdmin || !empty($currentUser["is_main_admin"])): ?>
                        <form method="post" class="inline-form" onsubmit="return confirm('Clear all login activity history? This cannot be undone.');">
                            <?php echo csrfField(); ?>
                            <input type="hidden" name="action" value="clear_login_activity">
                            <button class="act-btn del" type="submit">Clear history</button>
                        </form>
                        <?php endif; ?>
                    </div>
                </div>
                <div class="admin-table-wrap">
                    <table class="admin-table">
                        <thead><tr><th>Username</th><th>Device / browser</th><th>IP address</th><th>Date</th><th>Status</th></tr></thead>
                        <tbody>
                            <?php foreach ($loginActivities as $row): ?>
                            <tr>
                                <td><?php echo htmlspecialchars($row["username"] ?? ""); ?></td>
                                <td><?php echo htmlspecialchars($row["user_agent"] ?? ""); ?></td>
                                <td><?php echo htmlspecialchars($row["ip"] ?? ""); ?></td>
                                <td><?php echo date("M d, Y H:i", (int)($row["created_at"] ?? time())); ?></td>
                                <td><span class="status-pill <?php echo htmlspecialchars($row["status"] ?? "failed"); ?>"><?php echo htmlspecialchars($row["status"] ?? "failed"); ?></span></td>
                            </tr>
                            <?php endforeach; ?>
                            <?php if (empty($loginActivities)): ?><tr><td colspan="5">No login activity yet.</td></tr><?php endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>
            <?php endif; ?>

        <?php elseif ($usersMode): ?>
            <?php if (!$isAdmin): ?>
                <div class="message msg-error">Admin permission is required.</div>
            <?php else: ?>
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
                            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; padding-top: 20px; margin-top: 8px; border-top: 1px dashed var(--line);">
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
                    <div class="admin-table-wrap desktop-user-table">
                        <table class="admin-table">
                            <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Login activity</th><th>Password</th><th style="text-align:right;">Actions</th></tr></thead>
                            <tbody>
                                <?php foreach ($allUsers as $row): ?>
                                <?php $protected = !empty($row["is_main_admin"]); $self = ($row["id"] ?? "") === ($currentUser["id"] ?? ""); ?>
                                <tr>
                                    <td>
                                        <div class="user-cell">
                                            <span class="avatar-mini">
                                                <?php if (!empty($row["avatar_url"])): ?><img src="<?php echo htmlspecialchars($row["avatar_url"]); ?>" alt=""><?php else: ?><?php echo htmlspecialchars(userInitials($row)); ?><?php endif; ?>
                                            </span>
                                            <div>
                                                <div style="font-weight:700; color:var(--text); display:flex; align-items:center; gap:6px;">
                                                    <?php echo htmlspecialchars($row["display_name"] ?? $row["username"]); ?>
                                                    <?php if ($protected): ?><span class="user-badge-main">👑 Main Admin</span><?php endif; ?>
                                                    <?php if ($self): ?><span class="user-badge-self">You</span><?php endif; ?>
                                                </div>
                                                <?php if ($isSuperAdmin): ?>
                                                <form method="post" class="admin-cell-form" style="margin-top:4px;" onsubmit="return confirm('Change username for <?php echo htmlspecialchars(addslashes($row['username'])); ?>?');">
                                                    <?php echo csrfField(); ?>
                                                    <input type="hidden" name="action" value="change_username">
                                                    <input type="hidden" name="user_id" value="<?php echo htmlspecialchars($row["id"]); ?>">
                                                    <div style="display:flex; align-items:center; gap:3px;">
                                                        <span style="font-size:11px; color:var(--muted); font-weight:700;">@</span>
                                                        <input class="form-input" name="new_username" type="text" value="<?php echo htmlspecialchars($row["username"]); ?>" pattern="[a-z0-9@._-]{3,120}" title="3-120 lowercase chars: letters, numbers, @, ., _, -" style="width:120px; font-size:12px; padding:3px 8px; height:28px;" required>
                                                        <button class="act-btn open" style="height:28px; padding:3px 8px; font-size:11px;" title="Save Username">Save</button>
                                                    </div>
                                                </form>
                                                <?php else: ?>
                                                <div style="font-size:12px; color:var(--muted);">@<?php echo htmlspecialchars($row["username"]); ?></div>
                                                <?php endif; ?>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <form method="post" class="admin-cell-form">
                                            <?php echo csrfField(); ?><input type="hidden" name="action" value="set_user_role"><input type="hidden" name="user_id" value="<?php echo htmlspecialchars($row["id"]); ?>">
                                            <select class="form-input" name="role" style="min-width:110px;" <?php echo ($protected || $self) ? "disabled" : ""; ?>>
                                                <option value="staff" <?php echo ($row["role"] ?? "") === "staff" ? "selected" : ""; ?>>Staff</option>
                                                <option value="converter" <?php echo ($row["role"] ?? "") === "converter" ? "selected" : ""; ?>>Converter</option>
                                                <option value="website_team" <?php echo ($row["role"] ?? "") === "website_team" ? "selected" : ""; ?>>Website Team</option>
                                                <option value="admin" <?php echo ($row["role"] ?? "") === "admin" ? "selected" : ""; ?>>Admin</option>
                                            </select>
                                            <button class="act-btn open" <?php echo ($protected || $self) ? "disabled" : ""; ?>>Save</button>
                                        </form>
                                    </td>
                                    <td>
                                        <span class="status-pill <?php echo htmlspecialchars($row["status"] ?? "active"); ?>">
                                            <span class="status-dot"></span><?php echo ucfirst(htmlspecialchars($row["status"] ?? "active")); ?>
                                        </span>
                                    </td>
                                    <td>
                                        <form method="post" class="admin-cell-form">
                                            <?php echo csrfField(); ?><input type="hidden" name="action" value="update_user_permissions"><input type="hidden" name="user_id" value="<?php echo htmlspecialchars($row["id"]); ?>">
                                            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12.5px;font-weight:600;">
                                                <input type="checkbox" name="can_view_login_activity" <?php echo !empty($row["can_view_login_activity"]) ? "checked" : ""; ?> style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer;">
                                                Allowed
                                            </label>
                                            <button class="act-btn open">Save</button>
                                        </form>
                                    </td>
                                    <td>
                                        <form method="post" class="admin-cell-form" onsubmit="return confirm('Change password for user <?php echo htmlspecialchars(addslashes($row['username'])); ?>?');">
                                            <?php echo csrfField(); ?><input type="hidden" name="action" value="change_user_password"><input type="hidden" name="user_id" value="<?php echo htmlspecialchars($row["id"]); ?>">
                                            <div style="position:relative; display:flex; align-items:center;">
                                                <input class="form-input" name="password" type="password" minlength="8" placeholder="New password" style="min-width:130px; padding-right:28px;" required <?php echo ($protected && !$isSuperAdmin && !$self) ? "disabled" : ""; ?>>
                                                <button type="button" onclick="const inp=this.previousElementSibling; if(inp.type==='password'){inp.type='text';this.textContent='🙈';}else{inp.type='password';this.textContent='👁️';}" style="position:absolute; right:6px; background:none; border:none; cursor:pointer; font-size:12px; padding:0; color:var(--muted);" title="Toggle visibility">👁️</button>
                                            </div>
                                            <button class="act-btn open" <?php echo ($protected && !$isSuperAdmin && !$self) ? "disabled" : ""; ?>>Change</button>
                                        </form>
                                    </td>
                                    <td class="admin-actions-cell">
                                        <div class="admin-actions">
                                        <?php if ($isSuperAdmin): ?>
                                        <button type="button" class="act-btn open" onclick="openEditUserModal(<?php echo htmlspecialchars(json_encode([
                                            'id' => $row['id'],
                                            'username' => $row['username'],
                                            'display_name' => $row['display_name'] ?? $row['username'],
                                            'role' => $row['role'] ?? 'staff',
                                            'is_main_admin' => !empty($row['is_main_admin']),
                                            'is_self' => $self
                                        ])); ?>)" title="Edit username and password">✏️ Edit</button>
                                        <?php endif; ?>
                                        <form method="post" class="inline-form" onsubmit="return confirm('<?php echo ($row["status"] ?? "active") === "frozen" ? "Unfreeze this user?" : "Freeze this user?"; ?>');">
                                            <?php echo csrfField(); ?><input type="hidden" name="action" value="<?php echo ($row["status"] ?? "active") === "frozen" ? "unfreeze_user" : "freeze_user"; ?>"><input type="hidden" name="user_id" value="<?php echo htmlspecialchars($row["id"]); ?>">
                                            <button class="act-btn" <?php echo ($protected || $self) ? "disabled" : ""; ?>><?php echo ($row["status"] ?? "active") === "frozen" ? "❄️ Unfreeze" : "🔒 Freeze"; ?></button>
                                        </form>
                                        <form method="post" class="inline-form" onsubmit="return confirm('Remove this user? This cannot be undone.');">
                                            <?php echo csrfField(); ?><input type="hidden" name="action" value="delete_user"><input type="hidden" name="user_id" value="<?php echo htmlspecialchars($row["id"]); ?>">
                                            <button class="act-btn del" <?php echo ($protected || $self) ? "disabled" : ""; ?>>🗑️ Remove</button>
                                        </form>
                                        </div>
                                    </td>
                                </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>

                    <div class="mobile-user-cards">
                        <?php foreach ($allUsers as $row): ?>
                        <?php $protected = !empty($row["is_main_admin"]); $self = ($row["id"] ?? "") === ($currentUser["id"] ?? ""); ?>
                        <div class="user-card-item">
                            <div class="user-card-head">
                                <div class="user-card-info">
                                    <span class="avatar-mini">
                                        <?php if (!empty($row["avatar_url"])): ?><img src="<?php echo htmlspecialchars($row["avatar_url"]); ?>" alt=""><?php else: ?><?php echo htmlspecialchars(userInitials($row)); ?><?php endif; ?>
                                    </span>
                                    <div>
                                        <div style="font-weight:700; font-size:14px; color:var(--text); display:flex; align-items:center; gap:6px;">
                                            <?php echo htmlspecialchars($row["display_name"] ?? $row["username"]); ?>
                                            <?php if ($protected): ?><span class="user-badge-main">👑 Main Admin</span><?php endif; ?>
                                            <?php if ($self): ?><span class="user-badge-self">You</span><?php endif; ?>
                                        </div>
                                        <div style="font-size:12px; color:var(--muted);">@<?php echo htmlspecialchars($row["username"]); ?></div>
                                    </div>
                                </div>
                                <span class="status-pill <?php echo htmlspecialchars($row["status"] ?? "active"); ?>">
                                    <span class="status-dot"></span><?php echo ucfirst(htmlspecialchars($row["status"] ?? "active")); ?>
                                </span>
                            </div>

                            <?php if ($isSuperAdmin): ?>
                            <div class="user-card-section">
                                <span class="user-card-label">Username</span>
                                <form method="post" class="admin-cell-form" style="width:100%;" onsubmit="return confirm('Change username to ' + this.new_username.value + '?');">
                                    <?php echo csrfField(); ?><input type="hidden" name="action" value="change_username"><input type="hidden" name="user_id" value="<?php echo htmlspecialchars($row["id"]); ?>">
                                    <input class="form-input" name="new_username" type="text" value="<?php echo htmlspecialchars($row["username"]); ?>" pattern="[a-z0-9@._-]{3,120}" style="flex:1;" required>
                                    <button class="act-btn open">Save</button>
                                </form>
                            </div>
                            <?php endif; ?>

                            <div class="user-card-section">
                                <span class="user-card-label">Role</span>
                                <form method="post" class="admin-cell-form" style="width:100%;">
                                    <?php echo csrfField(); ?><input type="hidden" name="action" value="set_user_role"><input type="hidden" name="user_id" value="<?php echo htmlspecialchars($row["id"]); ?>">
                                    <select class="form-input" name="role" style="flex:1;" <?php echo ($protected || $self) ? "disabled" : ""; ?>>
                                        <option value="staff" <?php echo ($row["role"] ?? "") === "staff" ? "selected" : ""; ?>>Staff</option>
                                        <option value="converter" <?php echo ($row["role"] ?? "") === "converter" ? "selected" : ""; ?>>Converter</option>
                                        <option value="website_team" <?php echo ($row["role"] ?? "") === "website_team" ? "selected" : ""; ?>>Website Team</option>
                                        <option value="admin" <?php echo ($row["role"] ?? "") === "admin" ? "selected" : ""; ?>>Admin</option>
                                    </select>
                                    <button class="act-btn open" <?php echo ($protected || $self) ? "disabled" : ""; ?>>Save</button>
                                </form>
                            </div>

                            <div class="user-card-section">
                                <span class="user-card-label">Login Activity</span>
                                <form method="post" class="admin-cell-form" style="justify-content:space-between; width:100%;">
                                    <?php echo csrfField(); ?><input type="hidden" name="action" value="update_user_permissions"><input type="hidden" name="user_id" value="<?php echo htmlspecialchars($row["id"]); ?>">
                                    <label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;cursor:pointer;">
                                        <input type="checkbox" name="can_view_login_activity" <?php echo !empty($row["can_view_login_activity"]) ? "checked" : ""; ?> style="width:18px;height:18px;accent-color:var(--accent);">
                                        Allowed
                                    </label>
                                    <button class="act-btn open">Save</button>
                                </form>
                            </div>

                            <div class="user-card-section">
                                <span class="user-card-label">Set Password</span>
                                <form method="post" class="admin-cell-form" style="width:100%;" onsubmit="return confirm('Change password for <?php echo htmlspecialchars(addslashes($row['username'])); ?>?');">
                                    <?php echo csrfField(); ?><input type="hidden" name="action" value="change_user_password"><input type="hidden" name="user_id" value="<?php echo htmlspecialchars($row["id"]); ?>">
                                    <div style="position:relative; display:flex; align-items:center; flex:1;">
                                        <input class="form-input" name="password" type="password" minlength="8" placeholder="New password" style="width:100%; padding-right:28px;" required <?php echo ($protected && !$isSuperAdmin && !$self) ? "disabled" : ""; ?>>
                                        <button type="button" onclick="const inp=this.previousElementSibling; if(inp.type==='password'){inp.type='text';this.textContent='🙈';}else{inp.type='password';this.textContent='👁️';}" style="position:absolute; right:6px; background:none; border:none; cursor:pointer; font-size:12px; padding:0; color:var(--muted);" title="Toggle visibility">👁️</button>
                                    </div>
                                    <button class="act-btn open" <?php echo ($protected && !$isSuperAdmin && !$self) ? "disabled" : ""; ?>>Change</button>
                                </form>
                            </div>

                            <div class="user-card-bottom-actions">
                                <?php if ($isSuperAdmin): ?>
                                <button type="button" class="act-btn open" style="width:100%; justify-content:center; margin-bottom:6px;" onclick="openEditUserModal(<?php echo htmlspecialchars(json_encode([
                                    'id' => $row['id'],
                                    'username' => $row['username'],
                                    'display_name' => $row['display_name'] ?? $row['username'],
                                    'role' => $row['role'] ?? 'staff',
                                    'is_main_admin' => !empty($row['is_main_admin']),
                                    'is_self' => $self
                                ])); ?>)">✏️ Edit User Credentials</button>
                                <?php endif; ?>
                                <form method="post" onsubmit="return confirm('<?php echo ($row["status"] ?? "active") === "frozen" ? "Unfreeze this user?" : "Freeze this user?"; ?>');">
                                    <?php echo csrfField(); ?><input type="hidden" name="action" value="<?php echo ($row["status"] ?? "active") === "frozen" ? "unfreeze_user" : "freeze_user"; ?>"><input type="hidden" name="user_id" value="<?php echo htmlspecialchars($row["id"]); ?>">
                                    <button class="act-btn" style="width:100%; justify-content:center;" <?php echo ($protected || $self) ? "disabled" : ""; ?>><?php echo ($row["status"] ?? "active") === "frozen" ? "❄️ Unfreeze" : "🔒 Freeze"; ?></button>
                                </form>
                                <form method="post" onsubmit="return confirm('Remove this user? This cannot be undone.');">
                                    <?php echo csrfField(); ?><input type="hidden" name="action" value="delete_user"><input type="hidden" name="user_id" value="<?php echo htmlspecialchars($row["id"]); ?>">
                                    <button class="act-btn del" style="width:100%; justify-content:center;" <?php echo ($protected || $self) ? "disabled" : ""; ?>>🗑️ Remove</button>
                                </form>
                            </div>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            </div>
            <?php endif; ?>

        <?php elseif ($trashMode): ?>
        <div class="toolbar">
            <span class="tb-label">Trash</span>
            <a class="tb-btn" href="<?php echo $_SERVER["PHP_SELF"]; ?>">← Back to files</a>
            <?php if (!empty($trashItems)): ?>
            <form method="post" class="inline-form" onsubmit="return addDeletePassword(this, 'Permanently delete everything in trash?');">
                <?php echo csrfField(); ?>
                <input type="hidden" name="action" value="empty_trash">
                <button class="tb-btn danger" type="submit">🗑️ Empty Trash</button>
            </form>
            <?php endif; ?>
        </div>

        <div class="panel">
            <div class="panel-head">
                <span class="panel-title">🧺 Trash Bin</span>
                <span class="panel-meta"><?php echo count($trashItems); ?> deleted item(s)</span>
            </div>
            <?php if (!empty($trashItems)): ?>
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
            <?php endif; ?>
            <div class="trash-list">
                <?php if (empty($trashItems)): ?>
                    <div class="empty-state">
                        <div class="es-icon">🧺</div>
                        <h3>Trash is empty</h3>
                        <p>Deleted files and folders will appear here for recovery.</p>
                    </div>
                <?php endif; ?>

                <?php foreach ($trashItems as $trashItem): ?>
                <?php
                    $trashId = $trashItem["id"];
                    $trashOrigPath = $trashItem["original_relative"] ?? "Unknown item";
                    $trashExt = strtolower(pathinfo($trashOrigPath, PATHINFO_EXTENSION));
                    $trashIsDir = ($trashItem["type"] ?? "") === "folder";
                    $trashIsImg = !$trashIsDir && in_array($trashExt, ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif'], true);
                    $trashIsVideo = !$trashIsDir && in_array($trashExt, ['mp4', 'webm', 'mov', 'm4v', 'ogg'], true);
                    $trashPreviewUrl = $pageUrl . "?trash_preview=" . urlencode($trashId);
                ?>
                    <div class="trash-row">
                        <div class="trash-item-main">
                            <input type="checkbox" class="trash-check trash-item-check" value="<?php echo htmlspecialchars($trashId); ?>" onchange="updateTrashSelection()">
                            <div class="trash-preview-cell">
                                <?php if ($trashIsImg): ?>
                                    <div class="trash-thumb-wrap" onclick="openLightboxSingle('<?php echo addslashes($trashPreviewUrl); ?>', '<?php echo addslashes(basename($trashOrigPath)); ?>')" title="Click to view full image">
                                        <img class="trash-thumb-img" src="<?php echo htmlspecialchars($trashPreviewUrl . '&w=360'); ?>" alt="" loading="lazy" decoding="async" onmouseenter="if(!this.dataset.pre){this.dataset.pre=1;(new Image()).src='<?php echo addslashes($trashPreviewUrl); ?>';}" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">
                                        <div class="trash-type-icon" style="display:none;">🖼️</div>
                                    </div>
                                <?php elseif ($trashIsVideo): ?>
                                    <div class="trash-thumb-wrap trash-video-thumb-wrap" onclick="openVideoModal('<?php echo addslashes(basename($trashOrigPath)); ?>', '<?php echo addslashes($trashPreviewUrl); ?>')" title="Click to play video">
                                        <video class="trash-thumb-video" src="<?php echo htmlspecialchars($trashPreviewUrl); ?>#t=0.5" preload="metadata" muted playsinline></video>
                                        <div class="trash-video-play-overlay">
                                            <svg viewBox="0 0 24 24" width="14" height="14" fill="#ffffff"><polygon points="9 6 18 12 9 18 9 6"/></svg>
                                        </div>
                                    </div>
                                <?php elseif ($trashIsDir): ?>
                                    <div class="trash-type-icon trash-folder-icon">📁</div>
                                <?php else: ?>
                                    <div class="trash-type-icon"><?php echo getFileIcon(basename($trashOrigPath), false); ?></div>
                                <?php endif; ?>
                            </div>
                            <div class="trash-details">
                                <div class="trash-name"><?php echo htmlspecialchars($trashOrigPath); ?></div>
                                <div class="trash-meta">
                                    <?php echo htmlspecialchars($trashItem["type"] ?? "item"); ?> ·
                                    <?php echo formatSize((int)($trashItem["size"] ?? 0)); ?> ·
                                    deleted <?php echo date("M d, Y H:i", (int)($trashItem["deleted_at"] ?? time())); ?>
                                </div>
                            </div>
                        </div>
                        <div class="row-actions">
                            <form method="post" class="inline-form">
                                <?php echo csrfField(); ?>
                                <input type="hidden" name="action" value="restore_trash_item">
                                <input type="hidden" name="trash_id" value="<?php echo htmlspecialchars($trashId); ?>">
                                <button class="act-btn open" type="submit">↩ Recover</button>
                            </form>
                            <form method="post" class="inline-form" onsubmit="return addDeletePassword(this, 'Permanently delete this item?');">
                                <?php echo csrfField(); ?>
                                <input type="hidden" name="action" value="delete_trash_item">
                                <input type="hidden" name="trash_id" value="<?php echo htmlspecialchars($trashId); ?>">
                                <button class="act-btn del" type="submit">🗑️ Delete Forever</button>
                            </form>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>
        <?php else: ?>

        <!-- Toolbar -->
        <div class="toolbar sticky-toolbar" id="mainToolbar">
            <span class="tb-label"></span>
            <button class="tb-btn primary" onclick="openModal('uploadModal')">📤 Upload</button>
            <button class="tb-btn" type="button" onclick="openConvertModal()" title="Convert Sony RAW (.arw), AVIF (.avif), or ZIP to JPG/PNG">🔄 Convert</button>
            <button class="tb-btn" onclick="openModal('folderModal')">📁 New Folder</button>
            <?php if ($isAdmin || $isWebsiteTeam): ?>
            <button class="tb-btn" onclick="openModal('fileModal')">📝 New File</button>
            <?php endif; ?>

            <div class="tb-sep"></div>

            <!-- Middle: Image Processing & AI Tools -->
            <?php if ($FEATURES_ENABLED): ?>
            <button class="tb-btn tb-btn-ai" onclick="openAiModal()" title="AI Background Removal">🪄 Remove BG</button>
            <?php endif; ?>
            <button class="tb-btn" id="resizeImageBtn" onclick="openResizeImageModal()" style="font-weight:700; color:#0284c7; border-color:rgba(2,132,199,0.3); background:rgba(2,132,199,0.06);" title="Resize or compress images to target file size (MB/KB) or custom dimensions">📐 Resize image</button>

            <div class="tb-sep"></div>

            <?php if (!$isConverter): ?>
            <button class="tb-btn" onclick="openModal('urlsModal')">🔗 All URLs</button>
            <div class="tb-sep"></div>
            <?php endif; ?>
            <button class="tb-btn" onclick="toggleSelectionMode()">✅ Select</button>
            <button class="tb-btn" onclick="openRenameTypeModalMulti()">🏷️ Rename Type</button>
            <div class="tb-sep"></div>

            <button class="tb-btn" onclick="downloadSelected()">⬇️ Download</button>
            <button class="tb-btn danger" onclick="deleteSelected()">🗑️ Delete</button>
        </div>


        <!-- Pathbar -->
        <div class="pathbar">
            <a class="ph-home" href="<?php echo htmlspecialchars($homeUrl); ?>" title="Root">🏠</a>
            <span class="ph-sep">/</span>
            <?php if ($isConverter): ?>
                <a href="<?php echo $homeUrl; ?>"><?php echo htmlspecialchars($CONVERTER_ROOT_FOLDER); ?></a>
                <?php
                if ($current !== $converterRootRelative) {
                    $subPath = trim(substr($current, strlen($converterRootRelative)), "/");
                    if ($subPath !== "") {
                        $crumb = $converterRootRelative;
                        $subParts = explode("/", $subPath);
                        foreach ($subParts as $i => $part) {
                            $crumb .= "/" . $part;
                            echo '<span class="ph-sep">/</span>';
                            if ($i < count($subParts) - 1) {
                                echo '<a href="' . $pageUrl . "?path=" . urlencode($crumb) . '">' . htmlspecialchars($part) . '</a>';
                            } else {
                                echo '<span class="ph-cur">' . htmlspecialchars($part) . '</span>';
                            }
                        }
                    }
                }
                ?>
            <?php elseif ($isWebsiteTeam): ?>
                <a href="<?php echo $homeUrl; ?>"><?php echo htmlspecialchars($websiteTeamFolder); ?></a>
                <?php
                if ($current !== $websiteTeamRootRelative) {
                    $subPath = trim(substr($current, strlen($websiteTeamRootRelative)), "/");
                    if ($subPath !== "") {
                        $crumb = $websiteTeamRootRelative;
                        $subParts = explode("/", $subPath);
                        foreach ($subParts as $i => $part) {
                            $crumb .= "/" . $part;
                            echo '<span class="ph-sep">/</span>';
                            if ($i < count($subParts) - 1) {
                                echo '<a href="' . $pageUrl . "?path=" . urlencode($crumb) . '">' . htmlspecialchars($part) . '</a>';
                            } else {
                                echo '<span class="ph-cur">' . htmlspecialchars($part) . '</span>';
                            }
                        }
                    }
                }
                ?>
            <?php else: ?>
                <a href="<?php echo $homeUrl; ?>">ebay</a>
                <?php
                if ($current) {
                    $crumb = "";
                    $parts = explode("/", $current);
                    foreach ($parts as $i => $part) {
                        $crumb .= ($crumb ? "/" : "") . $part;
                        echo '<span class="ph-sep">/</span>';
                        if ($i < count($parts) - 1) {
                            echo '<a href="' . $pageUrl . "?path=" . urlencode($crumb) . '">' . htmlspecialchars($part) . '</a>';
                        } else {
                            echo '<span class="ph-cur">' . htmlspecialchars($part) . '</span>';
                        }
                    }
                }
                ?>
            <?php endif; ?>

            <?php if ($current && !($isConverter && $current === $converterRootRelative) && !($isWebsiteTeam && $current === $websiteTeamRootRelative)): ?>
                <a class="ph-back" href="<?php echo $pageUrl . "?path=" . urlencode(parentPath($current)); ?>">← Back</a>
            <?php endif; ?>
        </div>

        <!-- File Table -->
        <div class="panel">
            <div class="panel-head">
                <div class="panel-title-search">
                    <span class="panel-title">📋 Files &amp; Folders</span>
                    <div class="topbar-search">
                        <span class="search-icon">🔍</span>
                        <input type="text" placeholder="Search files… (press /)" id="searchInput" onkeyup="filterFiles(this.value)">
                    </div>
                    <?php if ($FEATURES_ENABLED): ?>
                    <div class="tb-dropdown-wrap" id="sortWrap" style="margin-left: 12px; height: 32px;">
                        <button class="tb-btn" onclick="toggleTbDropdown('sortDropdown')" id="sortBtn" style="height: 100%; border: 1px solid var(--border); box-shadow: none;">
                            <?php
                            $sortLabels = [
                                'name_asc'=>'Name A–Z','name_desc'=>'Name Z–A',
                                'newest'=>'Newest','oldest'=>'Oldest',
                                'size_asc'=>'Size ↑','size_desc'=>'Size ↓'
                            ];
                            echo '⇅ ' . htmlspecialchars($sortLabels[$sortKey] ?? 'Sort');
                            ?> <span class="tb-caret">▾</span>
                        </button>
                        <div class="tb-dropdown" id="sortDropdown" style="right: 0; left: auto; top: calc(100% + 4px);">
                            <?php foreach ($sortLabels as $sk => $sl): ?>
                            <a class="tb-dropdown-item<?php echo $sortKey === $sk ? ' active' : ''; ?>"
                               href="<?php echo $pageUrl . '?path=' . urlencode($current) . '&sort=' . $sk; ?>">
                                <?php echo htmlspecialchars($sl); ?>
                            </a>
                            <?php endforeach; ?>
                        </div>
                    </div>
                    <?php endif; ?>
                </div>
                <?php if (!empty($imageUrls) && !$isConverter): ?>
                    <div class="quick-jump-group" id="headerQuickJumpGroup">
                        <button type="button" class="quick-jump-btn" onclick="scrollToSection('imageUrlsSection')" title="Scroll down to Image URLs (Alt+Down)">
                            <span class="jump-arrow">↓</span>
                            <span>Image URLs</span>
                            <span class="jump-badge"><?php echo count($imageUrls); ?></span>
                        </button>
                        <button type="button" class="quick-jump-btn" onclick="scrollToSection('imagePreviewSection')" title="Scroll down to Image Preview">
                            <span class="jump-arrow">↓</span>
                            <span>Image Preview</span>
                            <span class="jump-badge"><?php echo count($imageUrls); ?></span>
                        </button>
                    </div>
                    <?php endif; ?>
                <span class="panel-meta" id="filePanelMeta" data-item-count="<?php echo (int)count($items); ?>" data-fallback-size="<?php echo htmlspecialchars(formatSize($displayTotalSize)); ?>"><?php echo count($items); ?> items · <?php echo formatSize($displayTotalSize); ?> <?php echo $current ? 'folder size' : 'total size'; ?> · Double-click to open</span>
            </div>

            <div class="table-header-row">
                <div><input type="checkbox" class="file-check" id="selectAllChk" onchange="selectAllToggle(this)" title="Select all (Ctrl+A)"></div>
                <div style="display: flex; align-items: center; gap: 10px;">Name <span class="selected-count" id="selectedCount" style="display:none; margin:0; font-size:11px; padding: 2px 8px; border-radius: 12px;">0 selected</span></div>
                <div>Size / Date</div>
                <div style="text-align:right;">Actions</div>
            </div>

            <div class="file-list" id="fileList">

                <?php if (empty($items)): ?>
                <div class="empty-state">
                    <div class="es-icon">📭</div>
                    <h3>This folder is empty</h3>
                    <p>Upload files or create a new folder to get started.</p>
                </div>
                <?php endif; ?>

                <?php foreach ($items as $index => $item): ?>
                <?php
                $name      = $item["name"];
                $relative  = $current ? $current . "/" . $name : $name;
                $url       = !$item["is_dir"] ? publicUrl($BASE_URL, $relative) : "";
                $absPath   = $currentDir . "/" . $name;
                $thumbUrl  = !$item["is_dir"] && $item["is_image"] ? getThumbnailUrl($relative, $absPath, $item["mtime"] ?? 0, 360) : "";
                $ext       = strtolower(pathinfo($name, PATHINFO_EXTENSION));
                $isImg     = $item["is_image"];
                $isVideo   = !empty($item["is_video"]);
                $isDir     = $item["is_dir"];
                $isCode    = $item["is_code"];
                $iconClass = $isDir ? "fti-folder" : ($isImg ? "fti-image" : ($isVideo ? "fti-video" : ($isCode ? "fti-code" : "fti-other")));
                $folderUrl = $_SERVER["PHP_SELF"] . "?path=" . urlencode($relative);
                $openUrl   = $isDir ? $folderUrl : $url;
                $nameJson = htmlspecialchars(json_encode($name), ENT_QUOTES, "UTF-8");
                $urlJson  = htmlspecialchars(json_encode($url), ENT_QUOTES, "UTF-8");
                $thumbJson = htmlspecialchars(json_encode($thumbUrl), ENT_QUOTES, "UTF-8");
                // For double-click: folders navigate seamlessly, files open or preview
                $dblAction = $isDir
                    ? "if(typeof navigateToFolder==='function'){ navigateToFolder('{$folderUrl}'); } else { location.href='{$folderUrl}'; }"
                    : ($isImg ? "openLightboxByName({$nameJson}, {$urlJson}, {$thumbJson})" : ($isVideo ? "openVideoModal({$nameJson}, {$urlJson})" : "window.open({$urlJson},'_blank')"));
                // Feature: folder meta
                $fm = $FEATURES_ENABLED && $isDir ? ($folderMeta[$name] ?? []) : [];
                $fmColor    = $fm['color'] ?? '';
                $fmIsFav    = !empty($fm['is_favorite']);
                $fmIsPin    = !empty($fm['is_pinned']);
                $fmRelPath  = $current ? $current . '/' . $name : $name;
                ?>

                <div class="file-row"
                    data-name="<?php echo htmlspecialchars($name); ?>"
                    data-url="<?php echo htmlspecialchars($url); ?>"
                    data-open-url="<?php echo htmlspecialchars($openUrl); ?>"
                    data-rel="<?php echo htmlspecialchars($relative); ?>"
                    data-is-img="<?php echo $isImg ? '1' : '0'; ?>"
                    data-is-video="<?php echo $isVideo ? '1' : '0'; ?>"
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
                            data-is-img="<?php echo $isImg ? '1' : '0'; ?>"
                            data-size="<?php echo (int)($item['size'] ?? 0); ?>"
                            onchange="updateSelectedCount()" onclick="event.stopPropagation()">
                    </div>

                    <!-- Name / Thumbnail -->
                    <div class="file-name-cell">
                        <?php if ($isImg): ?>
                            <img class="thumb-img" src="<?php echo htmlspecialchars($thumbUrl); ?>"
                                alt="<?php echo htmlspecialchars($name); ?>"
                                width="38" height="38"
                                loading="lazy"
                                decoding="async"
                                onclick="event.stopPropagation(); openLightboxByName(<?php echo $nameJson; ?>, <?php echo $urlJson; ?>, <?php echo $thumbJson; ?>)"
                                style="cursor:pointer;"
                                onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex'">
                            <div class="file-type-icon fti-image" style="display:none;"><?php echo getFileIcon($name, false); ?></div>
                        <?php elseif ($isVideo): ?>
                            <div class="thumb-video-box"
                                data-video-url="<?php echo htmlspecialchars($url); ?>"
                                data-video-name="<?php echo htmlspecialchars($name); ?>"
                                onclick="event.stopPropagation(); openVideoModal(<?php echo $nameJson; ?>, <?php echo $urlJson; ?>)"
                                title="Click to play video">
                                <img class="thumb-video-poster" style="display:none;" alt="<?php echo htmlspecialchars($name); ?>">
                                <video class="thumb-video-el" src="<?php echo htmlspecialchars($url); ?>"
                                    preload="none" muted playsinline></video>
                                <div class="thumb-video-overlay">
                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="#ffffff"><polygon points="9 6 18 12 9 18 9 6"/></svg>
                                </div>
                            </div>
                            <div class="file-type-icon fti-video" style="display:none;"><?php echo getFileIcon($name, false); ?></div>
                        <?php else: ?>
                            <div class="file-type-icon <?php echo $iconClass; ?>"<?php echo $fmColor ? ' data-folder-color="' . htmlspecialchars($fmColor) . '"' : ''; ?><?php if ($isDir): ?> style="cursor:pointer;" onclick="if(!selectionMode){ event.stopPropagation(); if(typeof navigateToFolder==='function'){ event.preventDefault(); navigateToFolder('<?php echo addslashes($folderUrl); ?>'); } else { location.href='<?php echo addslashes($folderUrl); ?>'; } }" title="Open folder"<?php endif; ?>>
                                <?php echo getFileIcon($name, $isDir); ?>
                            </div>
                        <?php endif; ?>

                        <div class="file-name-info">
                            <div class="file-title-row">
                                <?php if ($isDir): ?>
                                    <a href="<?php echo $folderUrl; ?>" class="file-name-folder file-name-display" style="color:var(--text) !important; text-decoration:none !important; border-bottom:none !important;" id="fileNameDisplay_<?php echo $index; ?>" onclick="if(!selectionMode){ event.stopPropagation(); if(typeof navigateToFolder==='function'){ event.preventDefault(); navigateToFolder('<?php echo addslashes($folderUrl); ?>'); } }">
                                        <?php echo htmlspecialchars($name); ?>
                                    </a>
                                <?php else: ?>
                                    <span class="file-name-span file-name-display" id="fileNameDisplay_<?php echo $index; ?>"><?php echo htmlspecialchars($name); ?></span>
                                <?php endif; ?>
                                <?php if ($fmIsPin): ?><span class="fm-badge fm-pin" title="Pinned">📌</span><?php endif; ?>
                                <?php if ($fmIsFav): ?><span class="fm-badge fm-fav" title="Favorite">⭐</span><?php endif; ?>
                            </div>
                            <form method="post" class="rename-form inline-rename-form" id="renameForm_<?php echo $index; ?>" style="display:none;">
                                <?php echo csrfField(); ?>
                                <input type="hidden" name="action" value="rename_item">
                                <input type="hidden" name="old_name" value="<?php echo htmlspecialchars($name); ?>">
                                <input class="rename-input" name="new_name" value="<?php echo htmlspecialchars($name); ?>" required onkeydown="renameKey(event, <?php echo $index; ?>)">
                                <button type="submit" class="rename-save">Save</button>
                                <button type="button" class="act-btn" onclick="hideRename(<?php echo $index; ?>)" style="font-size:11px;">Cancel</button>
                            </form>
                            <?php if ($isDir): ?>
                                <div class="file-meta">Folder</div>
                            <?php else: ?>
                                <div class="file-meta"><?php echo date("M d, Y", $item["mtime"]); ?></div>
                            <?php endif; ?>
                        </div>
                    </div>

                    <!-- Size -->
                    <div class="size-cell">
                        <?php echo formatSize($item["size"]); ?>
                    </div>

                    <!-- Actions -->
                    <div class="actions-cell" onclick="event.stopPropagation()">
                        <a class="act-btn" href="<?php echo $pageUrl . "?path=" . urlencode($current) . "&download_item=" . urlencode($name); ?>">
                            ⬇ Download
                        </a>
                        <?php if ($isDir): ?>
                            <a class="act-btn open folder-open-link" href="<?php echo $folderUrl; ?>" onclick="if(!selectionMode){ event.preventDefault(); if(typeof navigateToFolder==='function'){ navigateToFolder('<?php echo addslashes($folderUrl); ?>'); } else { location.href='<?php echo addslashes($folderUrl); ?>'; } }">📂 Open</a>
                        <?php elseif ($isVideo): ?>
                            <button type="button" class="act-btn open" style="color:#ec4899; font-weight:700;" onclick="openVideoModal('<?php echo addslashes($name); ?>', '<?php echo addslashes($url); ?>')">▶ Play</button>

                        <?php elseif ($isImg): ?>
                            <a class="act-btn open" href="<?php echo htmlspecialchars($url); ?>" target="_blank">↗ Open</a>
                            <button type="button" class="act-btn" style="color:#0284c7; font-weight:700; border-color:rgba(2,132,199,0.3); background:rgba(2,132,199,0.06);" onclick="openResizeImageModalSingle('<?php echo addslashes($name); ?>', <?php echo (int)($item['size'] ?? 0); ?>)" title="Resize or compress this image">📐 Resize</button>
                        <?php elseif (!$isConverter): ?>
                            <a class="act-btn open" href="<?php echo htmlspecialchars($url); ?>" target="_blank">↗ Open</a>
                        <?php endif; ?>

                        <?php if (!$isConverter): ?>
                        <!-- Rename -->
                        <button class="act-btn rename-btn"
                            onclick="showRename(<?php echo $index; ?>, <?php echo $nameJson; ?>)"
                            id="renameToggle_<?php echo $index; ?>">✏️ Rename</button>



                        <!-- Edit (only for code files) -->
                        <?php if ($isCode && ($isAdmin || $isWebsiteTeam)): ?>
                            <a class="act-btn edit-btn"
                                href="<?php echo $pageUrl . "?path=" . urlencode($current) . "&edit=" . urlencode($name); ?>">
                                📄 Edit
                            </a>
                        <?php endif; ?>
                        <?php else: ?>
                            <!-- Converter role: only download/open-folder/delete -->
                        <?php endif; ?>

                        <!-- Delete -->
                        <form method="post" style="display:inline;" <?php if (!$isConverter): ?>onsubmit="return addDeletePassword(this, 'Move <?php echo htmlspecialchars(addslashes($name)); ?> to trash?');"<?php endif; ?>>
                            <?php echo csrfField(); ?>
                            <input type="hidden" name="action" value="delete_item">
                            <input type="hidden" name="item_name" value="<?php echo htmlspecialchars($name); ?>">
                            <button type="submit" class="act-btn del" title="Delete">🗑️</button>
                        </form>
                    </div>

                </div>
                <?php endforeach; ?>

            </div><!-- /file-list -->
        </div><!-- /panel -->
        <?php if (!empty($imageUrls) && !$isConverter): ?>
        <div class="panel-jump-divider">
            <button type="button" class="panel-jump-divider-btn" onclick="scrollToSection('imageUrlsSection')">
                <span>↓ Scroll down to Image URLs &amp; Previews</span>
            </button>
        </div>
        <?php endif; ?>


        <!-- Image URL List (clean, standard) -->
        <?php if (!empty($imageUrls) && !$isConverter): ?>
        <div class="all-urls-panel" id="imageUrlsSection">
            <div class="panel-head">
                <span class="panel-title">🔗 Image URLs</span>
                <span class="panel-meta"><?php echo count($imageUrls); ?> image(s) · Click any URL to copy</span>
                <div class="panel-head-controls">
                    <button type="button" class="head-jump-pill" onclick="scrollToTopFiles()" title="Scroll back up to Files &amp; Folders">
                        <span>↑ Files</span>
                    </button>
                    <button type="button" class="head-jump-pill" onclick="scrollToSection('imagePreviewSection')" title="Scroll down to Image Preview">
                        <span>↓ Preview</span>
                    </button>
                </div>
            </div>
            <div class="url-list-wrap">
                <?php 
                $maxRenderUrls = 100;
                $renderedUrls = 0;
                $totalUrls = count($imageUrls);
                foreach ($items as $idx => $item): 
                    if (!$item["is_dir"] && $item["is_image"]):
                        $renderedUrls++;
                        if ($renderedUrls > $maxRenderUrls) continue;
                        $relative = $current ? $current . "/" . $item["name"] : $item["name"];
                        $url = publicUrl($BASE_URL, $relative);
                        $thumbUrl = getThumbnailUrl($relative, $currentDir . "/" . $item["name"], $item["mtime"] ?? 0, 120);
                ?>
                    <div class="url-list-item">
                        <span class="url-list-num"><?php echo $idx + 1; ?></span>
                        <img src="<?php echo htmlspecialchars($thumbUrl); ?>" style="width:32px;height:32px;border-radius:8px;object-fit:cover;flex-shrink:0;cursor:pointer;border:1.5px solid var(--line);"
                            onclick="openLightboxByName(<?php echo htmlspecialchars(json_encode($item['name']), ENT_QUOTES, 'UTF-8'); ?>, <?php echo htmlspecialchars(json_encode($url), ENT_QUOTES, 'UTF-8'); ?>, <?php echo htmlspecialchars(json_encode($thumbUrl), ENT_QUOTES, 'UTF-8'); ?>)"
                            loading="lazy"
                            decoding="async"
                            onerror="this.style.visibility='hidden'">
                        <span class="url-list-name" title="<?php echo htmlspecialchars($item['name']); ?>"><?php echo htmlspecialchars($item["name"]); ?></span>
                        <input class="url-list-input" id="lurlinput_<?php echo $idx; ?>"
                            value="<?php echo htmlspecialchars($url); ?>" readonly
                            onclick="this.select()" title="Click to select, then copy">
                        <button class="url-list-btn" id="lurlbtn_<?php echo $idx; ?>"
                            onclick="copyUrlDirect('<?php echo addslashes($url); ?>', 'lurlbtn_<?php echo $idx; ?>')">
                            📋 Copy
                        </button>
                    </div>
                    <?php endif; ?>
                <?php endforeach; ?>
            </div>
            <?php if ($totalUrls > $maxRenderUrls): ?>
            <div style="text-align:center; padding:12px 14px; background:rgba(79,70,229,0.04); border-top:1px dashed var(--line); border-radius:0 0 16px 16px;">
                <span style="font-size:12px; color:var(--muted); font-weight:700;">
                    Showing first <?php echo $maxRenderUrls; ?> of <?php echo $totalUrls; ?> URLs · 
                </span>
                <button type="button" class="act-btn open" onclick="openModal('urlsModal')" style="font-size:12px; font-weight:700; display:inline-flex; margin-left:6px;">
                    🔗 View all <?php echo $totalUrls; ?> in URLs Modal
                </button>
            </div>
            <?php endif; ?>
            <div class="copy-all-bar">
                <button class="form-btn btn-primary" onclick="copyAllUrls()" style="font-size:12.5px;padding:10px 18px;">📋 Copy All URLs</button>
                <button class="form-btn btn-secondary" onclick="copySelectedUrls()" style="font-size:12.5px;padding:10px 18px;">✅ Copy Selected URLs</button>
            </div>
        </div>
        <?php endif; ?>

        <!-- Video URL List -->
        <?php if (!empty($videoItems) && !$isConverter): ?>
        <div class="all-urls-panel video-urls-panel" id="videoUrlsSection" style="margin-top:22px; border-left:4px solid #ec4899;">
            <div class="panel-head">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="panel-title">🎬 Video Direct URLs & Embeds</span>
                    <span style="background:rgba(236,72,153,0.15); color:#ec4899; font-size:11px; font-weight:800; padding:2px 8px; border-radius:6px;"><?php echo count($videoItems); ?> video(s)</span>
                </div>
                <span class="panel-meta">Instant direct stream links · Original video formats & quality 100% preserved</span>
                <div class="panel-head-controls">
                    <button type="button" class="head-jump-pill" onclick="scrollToTopFiles()" title="Scroll back up to Files &amp; Folders">
                        <span>↑ Files</span>
                    </button>
                    <?php if (!empty($imageUrls)): ?>
                    <button type="button" class="head-jump-pill" onclick="scrollToSection('imagePreviewSection')" title="Scroll down to Image Preview">
                        <span>↓ Preview</span>
                    </button>
                    <?php endif; ?>
                </div>
            </div>
            <div class="url-list-wrap">
                <?php foreach ($videoItems as $vIdx => $vItem): ?>
                <div class="url-list-item">
                    <span class="url-list-num" style="background:rgba(236,72,153,0.15); color:#ec4899; font-weight:800;"><?php echo $vIdx + 1; ?></span>
                    <div class="thumb-video-box" style="width:32px; height:32px; border-radius:8px;"
                        data-video-url="<?php echo htmlspecialchars($vItem['url']); ?>"
                        data-video-name="<?php echo htmlspecialchars($vItem['name']); ?>"
                        onclick="openVideoModal('<?php echo addslashes($vItem['name']); ?>', '<?php echo addslashes($vItem['url']); ?>')" title="Play Video">
                        <img class="thumb-video-poster" style="display:none;" alt="<?php echo htmlspecialchars($vItem['name']); ?>">
                        <video class="thumb-video-el" src="<?php echo htmlspecialchars($vItem['url']); ?>" preload="none" muted playsinline></video>
                        <div class="thumb-video-overlay" style="border-radius:8px;">
                            <svg viewBox="0 0 24 24" width="11" height="11" fill="#ffffff"><polygon points="9 6 18 12 9 18 9 6"/></svg>
                        </div>
                    </div>
                    <span class="url-list-name" title="<?php echo htmlspecialchars($vItem['name']); ?>">
                        <?php echo htmlspecialchars($vItem['name']); ?>
                        <span style="font-size:10.5px; color:var(--muted); font-weight:600; margin-left:4px;">(<?php echo formatSize($vItem['size']); ?>)</span>
                    </span>
                    <input class="url-list-input" id="vurlinput_<?php echo $vIdx; ?>"
                        value="<?php echo htmlspecialchars($vItem['url']); ?>" readonly
                        onclick="this.select()" title="Click to select, then copy">
                    <button class="url-list-btn" id="vurlbtn_<?php echo $vIdx; ?>"
                        onclick="copyUrlDirect('<?php echo addslashes($vItem['url']); ?>', 'vurlbtn_<?php echo $vIdx; ?>')">
                        📋 Copy URL
                    </button>
                    <button class="url-list-btn" id="vembedbtn_<?php echo $vIdx; ?>"
                        onclick="copyUrlDirect('&lt;video src=&quot;<?php echo addslashes($vItem['url']); ?>&quot; controls playsinline width=&quot;100%&quot;&gt;&lt;/video&gt;', 'vembedbtn_<?php echo $vIdx; ?>')"
                        style="background:rgba(99,102,241,0.08); color:var(--accent);">
                        &lt;/&gt; Embed
                    </button>
                    <button class="url-list-btn" onclick="openVideoModal('<?php echo addslashes($vItem['name']); ?>', '<?php echo addslashes($vItem['url']); ?>')"
                        style="background:rgba(236,72,153,0.1); color:#ec4899; font-weight:700;">
                        ▶ Play
                    </button>
                </div>
                <?php endforeach; ?>
            </div>
            <div class="copy-all-bar">
                <button class="form-btn btn-primary" onclick="copyAllVideoUrls()" style="font-size:12.5px;padding:10px 18px; background:linear-gradient(135deg,#ec4899,#db2777);">🎬 Copy All Video URLs</button>
                <button class="form-btn btn-secondary" onclick="copyAllVideoEmbeds()" style="font-size:12.5px;padding:10px 18px;">&lt;/&gt; Copy All Embed Codes</button>
            </div>
        </div>

        <!-- Video Preview Grid -->
        <div class="img-grid-panel video-grid-panel" id="videoPreviewSection" style="margin-top:22px; border-left:4px solid #ec4899;">
            <div class="panel-head">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="panel-title">🎬 Video Preview</span>
                    <span style="background:rgba(236,72,153,0.15); color:#ec4899; font-size:11px; font-weight:800; padding:2px 8px; border-radius:6px;"><?php echo count($videoItems); ?> video(s)</span>
                </div>
                <span class="panel-meta">Hover to preview · Click card to play in modal</span>
                <div class="panel-head-controls">
                    <button type="button" class="head-jump-pill" onclick="scrollToTopFiles()" title="Scroll up to top files &amp; folders">
                        <span>↑ Top Files</span>
                    </button>
                </div>
            </div>
            <div class="img-grid">
                <?php foreach ($videoItems as $vgIdx => $vgItem): ?>
                <div class="img-card video-card" onclick="openVideoModal('<?php echo addslashes($vgItem['name']); ?>', '<?php echo addslashes($vgItem['url']); ?>')">
                    <div class="video-card-thumb-wrap" data-video-url="<?php echo htmlspecialchars($vgItem['url']); ?>">
                        <img class="thumb-video-poster" style="display:none;" alt="<?php echo htmlspecialchars($vgItem['name']); ?>">
                        <video class="thumb-video-el" src="<?php echo htmlspecialchars($vgItem['url']); ?>" muted playsinline preload="none"></video>
                        <div class="video-card-badge">▶ PLAY</div>
                    </div>
                    <div class="img-card-info" onclick="event.stopPropagation()">
                        <div class="img-card-name" title="<?php echo htmlspecialchars($vgItem['name']); ?>"><?php echo htmlspecialchars($vgItem['name']); ?></div>
                        <div class="img-card-url">
                            <input class="img-url-input" id="vgurl_<?php echo $vgIdx; ?>"
                                value="<?php echo htmlspecialchars($vgItem['url']); ?>" readonly
                                onclick="this.select()" title="<?php echo htmlspecialchars($vgItem['url']); ?>">
                            <button class="img-url-copy" id="vgcopybtn_<?php echo $vgIdx; ?>"
                                onclick="copyUrlDirect('<?php echo addslashes($vgItem['url']); ?>','vgcopybtn_<?php echo $vgIdx; ?>')"
                                title="Copy Video URL">📋</button>
                            <button class="img-url-copy" id="vgembedbtn_<?php echo $vgIdx; ?>"
                                onclick="copyUrlDirect('&lt;video src=&quot;<?php echo addslashes($vgItem['url']); ?>&quot; controls playsinline width=&quot;100%&quot;&gt;&lt;/video&gt;','vgembedbtn_<?php echo $vgIdx; ?>')"
                                title="Copy HTML5 Embed" style="font-size:10.5px; font-weight:700; color:var(--accent);">&lt;/&gt;</button>
                        </div>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
        <?php endif; ?>

        <!-- Image Preview Grid -->
        <?php if (!empty($imageUrls) && !$isConverter): ?>
        <div class="img-grid-panel" id="imagePreviewSection">
            <div class="panel-head">
                <span class="panel-title">🖼️ Image Preview</span>
                <span class="panel-meta"><?php echo count($imageUrls); ?> image(s) · Double-click for full preview</span>
                <div class="panel-head-controls">
                    <button type="button" class="head-jump-pill" onclick="scrollToSection('imageUrlsSection')" title="Scroll up to Image URLs">
                        <span>↑ URLs</span>
                    </button>
                    <button type="button" class="head-jump-pill" onclick="scrollToTopFiles()" title="Scroll up to top files &amp; folders">
                        <span>↑ Top Files</span>
                    </button>
                </div>
            </div>
            <div class="img-grid">
                <?php
                $maxRenderThumbs = 60;
                $renderedThumbs = 0;
                $totalThumbs = count($imageUrls);
                $imgIdx = 0;
                foreach ($items as $idx => $item):
                    if (!$item["is_dir"] && $item["is_image"]):
                        $renderedThumbs++;
                        if ($renderedThumbs > $maxRenderThumbs) continue;
                        $relative = $current ? $current . "/" . $item["name"] : $item["name"];
                        $url = publicUrl($BASE_URL, $relative);
                        $absPath = $currentDir . "/" . $item["name"];
                        $thumbUrl = getThumbnailUrl($relative, $absPath, $item["mtime"] ?? 0, 360);
                ?>
                <div class="img-card">
                    <img class="img-card-thumb"
                        src="<?php echo htmlspecialchars($thumbUrl); ?>"
                        alt="<?php echo htmlspecialchars($item["name"]); ?>"
                        loading="lazy"
                        decoding="async"
                        onclick="openLightboxByName(<?php echo htmlspecialchars(json_encode($item['name']), ENT_QUOTES, 'UTF-8'); ?>, <?php echo htmlspecialchars(json_encode($url), ENT_QUOTES, 'UTF-8'); ?>, <?php echo htmlspecialchars(json_encode($thumbUrl), ENT_QUOTES, 'UTF-8'); ?>)"
                        onerror="this.src='data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'150\' viewBox=\'0 0 200 150\'><rect fill=\'%23f1f5f9\' width=\'200\' height=\'150\'/><text x=\'100\' y=\'80\' text-anchor=\'middle\' fill=\'%2394a3b8\' font-size=\'13\'>No Preview</text></svg>'">
                    <div class="img-card-info">
                        <div class="img-card-name"><?php echo htmlspecialchars($item["name"]); ?></div>
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
                <?php $imgIdx++; endif; endforeach; ?>
            </div>
            <?php if ($totalThumbs > $maxRenderThumbs): ?>
            <div style="text-align:center; padding:16px 14px; background:rgba(79,70,229,0.04); border-top:1px dashed var(--line); border-radius:0 0 16px 16px;">
                <span style="font-size:12.5px; color:var(--muted); font-weight:700;">
                    Showing first <?php echo $maxRenderThumbs; ?> of <?php echo $totalThumbs; ?> image previews · 
                </span>
                <span style="font-size:12px; color:var(--muted);">All <?php echo $totalThumbs; ?> files are listed in the table above and available in the lightbox viewer.</span>
            </div>
            <?php endif; ?>
        </div>
        <?php endif; ?>

        <?php endif; ?>
        <!-- Floating Quick Navigation Pill (Files, URLs, Previews) -->
        <div class="floating-quick-nav<?php echo (empty($imageUrls) && empty($videoItems)) ? ' hidden' : ''; ?>" id="floatingQuickNav" aria-label="Quick Navigation">
            <div class="fab-sub-pill">
                <button type="button" class="fab-sub-link active" id="fabNavFiles" onclick="event.preventDefault(); event.stopPropagation(); scrollToTopFiles(event); return false;" title="Scroll up to Files &amp; Folders">📁 Files</button>
                <?php if (!empty($imageUrls)): ?>
                <button type="button" class="fab-sub-link" id="fabNavUrls" onclick="event.preventDefault(); event.stopPropagation(); scrollToSection('imageUrlsSection', event); return false;" title="Jump down to Image URLs">🔗 URLs</button>
                <button type="button" class="fab-sub-link" id="fabNavPreviews" onclick="event.preventDefault(); event.stopPropagation(); scrollToSection('imagePreviewSection', event); return false;" title="Jump down to Image Previews">🖼️ Previews</button>
                <?php endif; ?>
                <?php if (!empty($videoItems)): ?>
                <button type="button" class="fab-sub-link" id="fabNavVideos" onclick="event.preventDefault(); event.stopPropagation(); scrollToSection('videoUrlsSection', event); return false;" title="Jump to Videos">🎬 Videos</button>
                <?php endif; ?>
            </div>
        </div>

        <footer class="dashboard-footer">
            Copyright &copy; <?php echo htmlspecialchars($appSettings["footer_name"]); ?> <?php echo date("Y"); ?> All Rights Reserved.
        </footer>
    </main>

<?php if ($isPjax): ?>
    <script id="pjax-meta" type="application/json">
    <?php
    echo json_encode([
        "title" => htmlspecialchars($appSettings["app_name"]) . " - Dashboard",
        "currentPath" => $current,
        "folderCount" => $folderCount,
        "fileCount" => $fileCount,
        "totalSize" => $totalSize,
        "csrfToken" => csrfToken(),
        "imageList" => (count($imageList) <= 200 ? $imageList : []),
        "imageUrls" => $imageUrls,
        "videoItems" => $videoItems,
        "version" => time(),
    ], JSON_UNESCAPED_SLASHES);
    ?>
    </script>
<?php exit; endif; ?>
</div>

<!-- ===== JAVASCRIPT ===== -->
<!-- ===== MODULAR SCRIPTS (High Performance & Caching) ===== -->
<script>
var IMAGE_LIST = <?php echo json_encode(count($imageList) <= 200 ? $imageList : []); ?>;
var CURRENT_PATH = <?php echo json_encode($current); ?>;
var ACTION_ENDPOINT = <?php echo json_encode($pageUrl); ?>;
var UPLOAD_ENDPOINT = ACTION_ENDPOINT;
var SERVER_UPLOAD_LIMIT_BYTES = <?php echo (int)$serverUploadLimitBytes; ?>;
var CHUNK_SIZE_BYTES = <?php echo (int)$safeChunkSizeBytes; ?>;
var IS_CONVERTER = <?php echo $isConverter ? "true" : "false"; ?>;
var IS_SUPER_ADMIN = <?php echo $isSuperAdmin ? "true" : "false"; ?>;
var CSRF_TOKEN = <?php echo json_encode(csrfToken()); ?>;
var DASHBOARD_THEME_URL = "";
var lbCurrentIndex = 0;
<?php if ($message): ?>
window.addEventListener('load', () => toast(<?php echo json_encode($message); ?>, <?php echo json_encode($messageType === 'success' ? 'success' : 'danger'); ?>));
<?php endif; ?>
var F_ACTION_ENDPOINT = <?php echo json_encode($pageUrl); ?>;
var F_CSRF_TOKEN      = <?php echo json_encode(csrfToken()); ?>;
var F_CURRENT_PATH    = <?php echo json_encode($current); ?>;
var F_BASE_URL        = <?php echo json_encode($BASE_URL); ?>;
var F_SIDEBAR_PINS    = <?php echo json_encode(!empty($sidebarPins) ? array_column($sidebarPins, 'path') : []); ?>;

/* Instant UI Fallbacks & Upload Engine - guarantees upload & UI work 100% reliably */
function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    var units = ['B', 'KB', 'MB', 'GB'];
    var value = bytes;
    var idx = 0;
    while (value >= 1024 && idx < units.length - 1) {
        value /= 1024;
        idx++;
    }
    return (idx === 0 ? Math.round(value) : value.toFixed(1)) + ' ' + units[idx];
}

function getSelectedUploadFiles() {
    var fileInp = document.getElementById('upload-file-input');
    var folderInp = document.getElementById('upload-folder-input');
    var dropped = window.__kiuqDroppedFiles || [];
    var list = [];
    if (fileInp && fileInp.files) {
        for (var i = 0; i < fileInp.files.length; i++) list.push(fileInp.files[i]);
    }
    if (folderInp && folderInp.files) {
        for (var j = 0; j < folderInp.files.length; j++) list.push(folderInp.files[j]);
    }
    for (var k = 0; k < dropped.length; k++) list.push(dropped[k]);

    var seen = new Set();
    var unique = [];
    for (var m = 0; m < list.length; m++) {
        var f = list[m];
        if (!f) continue;
        var key = (f.name || '') + '__' + (f.size || 0) + '__' + (f.lastModified || 0) + '__' + (f.webkitRelativePath || '');
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(f);
        }
    }
    return unique;
}

function updateDropZone(inp) {
    var el = document.getElementById('dropZoneFiles');
    if (!el) return;
    var files = getSelectedUploadFiles();
    if (!files || !files.length) {
        el.textContent = '';
        return;
    }
    var totalBytes = 0;
    for (var i = 0; i < files.length; i++) totalBytes += (files[i].size || 0);
    var names = [];
    for (var j = 0; j < Math.min(files.length, 3); j++) {
        names.push(files[j].webkitRelativePath || files[j].name);
    }
    var extra = files.length > 3 ? ' (+' + (files.length - 3) + ' more)' : '';
    el.innerHTML = '<span style="color:var(--accent); font-weight:800;">✓ ' + files.length + ' file(s) selected (' + formatBytes(totalBytes) + '):</span> ' +
                   '<span style="color:var(--muted); font-weight:500;">' + names.join(', ') + extra + '</span>';
}

function openModal(id) {
    if (id === 'uploadModal') {
        var webpCb = document.getElementById('autoWebpCheckbox');
        if (webpCb) webpCb.checked = true;
        var pathInp = document.querySelector('#uploadModal input[name="path"]');
        if (pathInp) {
            var activePath = (typeof CURRENT_PATH !== 'undefined' ? CURRENT_PATH : '')
                          || (typeof F_CURRENT_PATH !== 'undefined' ? F_CURRENT_PATH : '')
                          || (new URLSearchParams(window.location.search).get('path') || '');
            pathInp.value = activePath;
        }
        var pWrap = document.getElementById('uploadProgressWrap');
        if (pWrap) pWrap.style.display = 'none';
        var pBar = document.getElementById('uploadGlobalBar');
        if (pBar) pBar.style.width = '0%';
        var pPct = document.getElementById('uploadGlobalPercent');
        if (pPct) pPct.textContent = '0%';
        var pText = document.getElementById('uploadGlobalText');
        if (pText) pText.textContent = 'Preparing upload...';
        var pList = document.getElementById('uploadProgressList');
        if (pList) pList.innerHTML = '';
        var sBtn = document.getElementById('uploadSubmitBtn');
        if (sBtn) { sBtn.disabled = false; sBtn.textContent = 'Upload →'; }
    }
    var modalEl = document.getElementById(id);
    if (modalEl) {
        modalEl.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
}

async function handleUploadSubmit(e) {
    if (e) {
        try { e.preventDefault(); e.stopPropagation(); } catch(err){}
    }
    var files = getSelectedUploadFiles();
    if (!files.length) {
        if (typeof toast === 'function') {
            toast('Please select at least one file or folder to upload.', 'warning');
        } else {
            alert('Please select at least one file or folder to upload.');
        }
        return false;
    }

    var progressWrap = document.getElementById('uploadProgressWrap');
    var progressBar = document.getElementById('uploadGlobalBar');
    var progressText = document.getElementById('uploadGlobalText');
    var progressPercent = document.getElementById('uploadGlobalPercent');
    var progressList = document.getElementById('uploadProgressList');
    var submitBtn = document.getElementById('uploadSubmitBtn');

    if (progressWrap) progressWrap.style.display = 'block';
    if (progressBar) progressBar.style.width = '0%';
    if (progressPercent) progressPercent.textContent = '0%';
    if (progressText) progressText.textContent = 'Preparing upload (' + files.length + ' files)...';
    if (progressList) progressList.innerHTML = '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading...';
    }

    var progressByFile = new Array(files.length).fill(0);
    var rows = files.map(function(file) {
        var row = document.createElement('div');
        row.className = 'upload-progress-item';
        var dName = file.webkitRelativePath || file.name;
        var sName = escapeHtml(dName);
        row.innerHTML = '<span title="' + sName + '" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;">' +
                        sName + ' <small style="color:var(--muted);font-weight:500;">(' + formatBytes(file.size) + ')</small></span>' +
                        '<span class="upload-progress-percent" style="font-weight:800;font-variant-numeric:tabular-nums;color:var(--accent);">0%</span>';
        if (progressList) progressList.appendChild(row);
        return row;
    });

    var completed = 0;
    var totalFiles = files.length;
    var successCount = 0;
    var failCount = 0;
    var uploadStartTime = Date.now();

    function updateOverallProgress() {
        var activePercent = progressByFile.reduce(function(sum, v) { return sum + v; }, 0) / 100;
        var overall = Math.min(100, Math.round(((completed + activePercent) / totalFiles) * 100));
        if (progressBar) progressBar.style.width = overall + '%';
        if (progressPercent) progressPercent.textContent = overall + '%';

        var elapsed = Math.max(0.2, (Date.now() - uploadStartTime) / 1000);
        var uploadedBytes = 0;
        files.forEach(function(f, idx) {
            uploadedBytes += (f.size * (progressByFile[idx] || 0) / 100);
        });
        var speed = uploadedBytes / elapsed;
        var speedStr = speed > 50000 ? ' • ' + formatBytes(speed) + '/s' : '';
        if (progressText) {
            progressText.textContent = 'Uploaded ' + completed + '/' + totalFiles + ' files (' + overall + '%)' + speedStr;
        }
    }
    updateOverallProgress();

    var batches = [];
    var curBatch = [];
    var curBytes = 0;
    for (var i = 0; i < files.length; i++) {
        var f = files[i];
        var sz = Math.max(1, f.size || 1);
        if (curBatch.length >= 2 || curBytes + sz > 25 * 1024 * 1024) {
            batches.push(curBatch);
            curBatch = [];
            curBytes = 0;
        }
        curBatch.push({ file: f, index: i });
        curBytes += sz;
    }
    if (curBatch.length) batches.push(curBatch);

    var csrf = (typeof CSRF_TOKEN !== 'undefined' ? CSRF_TOKEN : '')
            || (typeof F_CSRF_TOKEN !== 'undefined' ? F_CSRF_TOKEN : '')
            || (document.querySelector('input[name="csrf_token"]')?.value || '');
    var targetPath = (document.querySelector('#uploadModal input[name="path"]')?.value)
                  || (typeof CURRENT_PATH !== 'undefined' ? CURRENT_PATH : '')
                  || (typeof F_CURRENT_PATH !== 'undefined' ? F_CURRENT_PATH : '')
                  || (new URLSearchParams(window.location.search).get('path') || '');
    var autoWebp = document.getElementById('autoWebpCheckbox') ? document.getElementById('autoWebpCheckbox').checked : true;
    var endpoint = (typeof UPLOAD_ENDPOINT !== 'undefined' && UPLOAD_ENDPOINT)
                ? UPLOAD_ENDPOINT
                : (window.location.pathname + window.location.search);

    var nextBatch = 0;
    var concurrency = Math.min(4, batches.length);

    async function runWorker() {
        while (true) {
            var bIdx = nextBatch++;
            if (bIdx >= batches.length) break;
            var batch = batches[bIdx];

            try {
                await new Promise(function(resolve, reject) {
                    var formData = new FormData();
                    formData.append('csrf_token', csrf);
                    formData.append('action', 'upload_files');
                    formData.append('path', targetPath);
                    formData.append('upload_ajax', '1');
                    formData.append('convert_webp', autoWebp ? '1' : '0');

                    batch.forEach(function(item) {
                        formData.append('upload_files[]', item.file, item.file.name);
                        formData.append('upload_paths[]', item.file.webkitRelativePath || '');
                    });

                    var batchTotal = batch.reduce(function(sum, item) { return sum + Math.max(1, item.file.size || 1); }, 0);
                    var xhr = new XMLHttpRequest();
                    xhr.open('POST', endpoint, true);
                    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

                    xhr.upload.onprogress = function(evt) {
                        if (!evt.lengthComputable) return;
                        var loaded = Math.min(batchTotal, evt.loaded);
                        var off = 0;
                        batch.forEach(function(item) {
                            var sz = Math.max(1, item.file.size || 1);
                            var fLoaded = Math.max(0, Math.min(sz, loaded - off));
                            var p = Math.max(0, Math.min(100, Math.round((fLoaded / sz) * 100)));
                            progressByFile[item.index] = p;
                            var cell = rows[item.index]?.querySelector('.upload-progress-percent');
                            if (cell) cell.textContent = p === 100 ? '100% (Saving...)' : p + '%';
                            off += sz;
                        });
                        updateOverallProgress();
                    };

                    xhr.onload = function() {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            try {
                                var data = JSON.parse(xhr.responseText || '{}');
                                if (data.success) {
                                    resolve(data);
                                } else {
                                    var errMsg = (data.errors && data.errors.length) ? data.errors[0] : (data.message || 'Upload rejected');
                                    reject(new Error(errMsg));
                                }
                            } catch(err) {
                                reject(new Error('Invalid response from server.'));
                            }
                        } else {
                            reject(new Error('Server returned HTTP ' + xhr.status));
                        }
                    };

                    xhr.onerror = function() { reject(new Error('Network connection error')); };
                    xhr.ontimeout = function() { reject(new Error('Upload request timed out')); };
                    xhr.send(formData);
                });

                batch.forEach(function(item) {
                    progressByFile[item.index] = 100;
                    var cell = rows[item.index]?.querySelector('.upload-progress-percent');
                    if (cell) {
                        cell.textContent = '100% ✓';
                        cell.style.color = '#10b981';
                    }
                    if (rows[item.index]) rows[item.index].classList.add('done');
                    successCount++;
                    completed++;
                });
            } catch(err) {
                var reason = (err && err.message) ? err.message : 'Upload failed';
                batch.forEach(function(item) {
                    progressByFile[item.index] = 100;
                    var cell = rows[item.index]?.querySelector('.upload-progress-percent');
                    if (cell) {
                        cell.textContent = '❌ ' + reason;
                        cell.style.color = '#ef4444';
                        cell.style.fontSize = '11px';
                    }
                    if (rows[item.index]) rows[item.index].classList.add('fail');
                    failCount++;
                    completed++;
                });
            }
            updateOverallProgress();
        }
    }

    var workers = [];
    for (var w = 0; w < concurrency; w++) workers.push(runWorker());
    await Promise.all(workers);

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Upload →';
    }

    if (successCount > 0 && failCount === 0) {
        if (progressText) progressText.textContent = '✓ All ' + successCount + ' file(s) uploaded successfully!';
        if (typeof toast === 'function') toast(successCount + ' file(s) uploaded successfully!', 'success');
        setTimeout(function() {
            closeModal('uploadModal');
            window.location.reload();
        }, 800);
    } else if (successCount > 0 && failCount > 0) {
        if (progressText) progressText.textContent = successCount + ' uploaded, ' + failCount + ' failed.';
        if (typeof toast === 'function') toast(successCount + ' uploaded, ' + failCount + ' failed.', 'warning');
    } else {
        if (progressText) progressText.textContent = '❌ Upload failed. Review errors above.';
        if (typeof toast === 'function') toast('Upload failed for selected files.', 'danger');
    }

    return false;
}
window.handleUploadSubmit = handleUploadSubmit;

// Scan folder/files from DataTransfer
async function scanDroppedItems(dataTransfer) {
    var files = [];
    var items = dataTransfer.items;
    if (!items || !items.length) {
        return Array.from(dataTransfer.files || []);
    }
    var queue = [];
    for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (typeof it.webkitGetAsEntry === 'function') {
            var entry = it.webkitGetAsEntry();
            if (entry) queue.push({ entry: entry, path: '' });
        } else if (it.kind === 'file') {
            var f = it.getAsFile();
            if (f) files.push(f);
        }
    }
    if (!queue.length) {
        return Array.from(dataTransfer.files || []);
    }
    while (queue.length > 0) {
        var item = queue.shift();
        var entry = item.entry;
        var p = item.path;
        if (entry.isFile) {
            await new Promise(function(resolve) {
                entry.file(function(file) {
                    if (p) {
                        try {
                            Object.defineProperty(file, 'webkitRelativePath', {
                                value: p + file.name,
                                writable: false
                            });
                        } catch(e){}
                    }
                    files.push(file);
                    resolve();
                }, function() { resolve(); });
            });
        } else if (entry.isDirectory) {
            var dirReader = entry.createReader();
            var readEntriesBatch = async function() {
                return new Promise(function(resolve) {
                    dirReader.readEntries(function(entries) { resolve(entries || []); }, function() { resolve([]); });
                });
            };
            var entries = await readEntriesBatch();
            while (entries.length > 0) {
                for (var ci = 0; ci < entries.length; ci++) {
                    queue.push({ entry: entries[ci], path: (p ? p + entry.name + '/' : entry.name + '/') });
                }
                entries = await readEntriesBatch();
            }
        }
    }
    return files;
}

// Wire global window and dropzone listeners for drag & drop
document.addEventListener('DOMContentLoaded', function() {
    var globalOverlay = document.getElementById('globalDragOverlay');
    var dragCounter = 0;

    window.addEventListener('dragenter', function(ev) {
        ev.preventDefault();
        dragCounter++;
        if (dragCounter === 1 && globalOverlay) {
            globalOverlay.classList.add('active');
        }
    });

    window.addEventListener('dragleave', function(ev) {
        ev.preventDefault();
        dragCounter--;
        if (dragCounter <= 0) {
            dragCounter = 0;
            if (globalOverlay) globalOverlay.classList.remove('active');
        }
    });

    window.addEventListener('dragover', function(ev) {
        ev.preventDefault();
    });

    window.addEventListener('drop', async function(ev) {
        ev.preventDefault();
        dragCounter = 0;
        if (globalOverlay) globalOverlay.classList.remove('active');

        if (ev.dataTransfer) {
            var dropped = await scanDroppedItems(ev.dataTransfer);
            if (dropped && dropped.length > 0) {
                openModal('uploadModal');
                window.__kiuqDroppedFiles = dropped;
                updateDropZone();
            }
        }
    });

    var dz = document.getElementById('dropZone');
    if (dz) {
        ['dragenter', 'dragover'].forEach(function(evName) {
            dz.addEventListener(evName, function(ev) {
                ev.preventDefault();
                ev.stopPropagation();
                dz.classList.add('dragover');
            });
        });
        ['dragleave'].forEach(function(evName) {
            dz.addEventListener(evName, function(ev) {
                ev.preventDefault();
                ev.stopPropagation();
                dz.classList.remove('dragover');
            });
        });
        dz.addEventListener('drop', async function(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            dz.classList.remove('dragover');
            if (ev.dataTransfer) {
                var dropped = await scanDroppedItems(ev.dataTransfer);
                if (dropped && dropped.length > 0) {
                    window.__kiuqDroppedFiles = dropped;
                    updateDropZone();
                }
            }
        });
    }
});
function closeModal(id) {
    var modalEl = document.getElementById(id);
    if (modalEl) modalEl.classList.remove('open');
    document.body.style.overflow = '';
}
function toast(msg, type) {
    var tc = document.getElementById('toastContainer');
    if (!tc) return;
    var t = document.createElement('div');
    t.className = 'toast ' + (type || 'info');
    t.textContent = msg;
    tc.appendChild(t);
    setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 3500);
}
function toggleTheme() {
    var root = document.documentElement;
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    root.style.colorScheme = next;
    try { localStorage.setItem('kiuqTheme', next); } catch(e){}
    try {
        var body = new URLSearchParams({ action: 'set_theme', csrf_token: (typeof CSRF_TOKEN !== 'undefined' ? CSRF_TOKEN : ''), theme: next });
        fetch((typeof ACTION_ENDPOINT !== 'undefined' ? ACTION_ENDPOINT : window.location.pathname), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body
        }).catch(function(){});
    } catch(e){}
}
function toggleSidebar(open) {
    var sb = document.getElementById('mainSidebar');
    if (sb) sb.classList.toggle('open', open);
}
function toggleSidebarCollapse(force) {
    var isCollapsed = typeof force === 'boolean' ? force : !document.body.classList.contains('sidebar-collapsed');
    document.body.classList.toggle('sidebar-collapsed', isCollapsed);
    try { localStorage.setItem('kiuq_sidebar_collapsed', isCollapsed ? '1' : '0'); } catch(e){}
}
function toggleProfileDropdown(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    var wrap = document.getElementById('profileDropdownWrap');
    if (wrap) wrap.classList.toggle('open');
}
function closeProfileDropdown() {
    var wrap = document.getElementById('profileDropdownWrap');
    if (wrap) wrap.classList.remove('open');
}
function openConvertModal() {
    openModal('convertModal');
}

/* High-Speed Ultra-Snappy Navigation Core */
/* NOTE: names are prefixed 'inline' on purpose - panel.js declares activeScrollAnim/glideSafetyTimer with let,
   and a duplicate global var would throw a SyntaxError and disable all of panel.js. */
var inlineActiveScrollAnim = null;
var inlineGlideSafetyTimer = null;

function fastGlideScrollTo(targetY, customDuration) {
    if (inlineActiveScrollAnim) {
        cancelAnimationFrame(inlineActiveScrollAnim);
        inlineActiveScrollAnim = null;
    }
    if (inlineGlideSafetyTimer) {
        clearTimeout(inlineGlideSafetyTimer);
        inlineGlideSafetyTimer = null;
    }

    var maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    var clampedTargetY = Math.max(0, Math.min(Math.round(targetY), maxScroll));
    var startY = window.pageYOffset || document.documentElement.scrollTop || 0;
    var distance = clampedTargetY - startY;

    if (Math.abs(distance) < 6) {
        window.scrollTo(0, clampedTargetY);
        return;
    }

    // Ultra-snappy duration: 160ms for short distance, up to 230ms for large jump
    var duration = customDuration || Math.min(230, Math.max(160, Math.round(Math.abs(distance) * 0.07 + 110)));
    var startTime = performance.now();
    var easeOut = function(t) { return 1 - Math.pow(1 - t, 4); };

    document.documentElement.classList.add('is-glide-scrolling');

    function step(now) {
        var elapsed = now - startTime;
        var progress = Math.min(elapsed / duration, 1);
        var nextY = Math.round(startY + (distance * easeOut(progress)));
        window.scrollTo(0, nextY);

        if (progress < 1) {
            inlineActiveScrollAnim = requestAnimationFrame(step);
        } else {
            inlineActiveScrollAnim = null;
            window.scrollTo(0, clampedTargetY);
            document.documentElement.classList.remove('is-glide-scrolling');
        }
    }

    inlineActiveScrollAnim = requestAnimationFrame(step);

    inlineGlideSafetyTimer = setTimeout(function() {
        document.documentElement.classList.remove('is-glide-scrolling');
        inlineGlideSafetyTimer = null;
    }, duration + 80);
}

function smoothScrollTo(targetY, duration) {
    fastGlideScrollTo(targetY, duration);
}

function scrollToSection(sectionId, e) {
    if (e) { try { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); } catch(err){} }
    var el = document.getElementById(sectionId);
    if (!el) {
        if (sectionId === 'imagePreviewSection' || sectionId === 'preview' || sectionId === 'imagePreview') {
            el = document.querySelector('#imagePreviewSection') 
              || document.querySelector('.img-grid-panel:not(.video-grid-panel)')
              || document.querySelector('#videoPreviewSection')
              || document.querySelector('.img-grid-panel');
        } else if (sectionId === 'imageUrlsSection' || sectionId === 'urls' || sectionId === 'imageUrls') {
            el = document.querySelector('#imageUrlsSection')
              || document.querySelector('.all-urls-panel:not(.video-urls-panel)')
              || document.querySelector('#videoUrlsSection')
              || document.querySelector('.all-urls-panel');
        } else if (sectionId === 'videoUrlsSection') {
            el = document.getElementById('videoUrlsSection') || document.getElementById('videoPreviewSection');
        } else if (sectionId === 'videoPreviewSection') {
            el = document.getElementById('videoPreviewSection') || document.querySelector('.video-grid-panel');
        }
    }
    if (!el) return false;

    var yOffset = -76;
    var y = Math.max(0, el.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop) + yOffset);
    fastGlideScrollTo(y);

    el.classList.remove('section-jump-highlight');
    void el.offsetWidth;
    el.classList.add('section-jump-highlight');
    setTimeout(function() { el.classList.remove('section-jump-highlight'); }, 1000);
    return true;
}

function scrollToTopFiles(e) {
    if (e) { try { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); } catch(err){} }
    var panel = document.querySelector('.panel') || document.querySelector('.stats-row') || document.querySelector('#fileList');
    if (panel) {
        var yOffset = -76;
        var y = Math.max(0, panel.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop) + yOffset);
        fastGlideScrollTo(y);
    } else {
        fastGlideScrollTo(0);
    }
    return false;
}

window.smoothScrollTo = fastGlideScrollTo;
window.fastGlideScrollTo = fastGlideScrollTo;
window.scrollToSection = scrollToSection;
window.scrollToTopFiles = scrollToTopFiles;

/* High-Speed Mouse Wheel & Finger Scroll Acceleration Engine */
(function initFastMouseFingerScroll() {
    if (window.__kiuq_scroll_accelerator_initialized) return;
    window.__kiuq_scroll_accelerator_initialized = true;

    var scrollRaf = null;
    var targetY = window.pageYOffset || document.documentElement.scrollTop || 0;
    var currentY = targetY;
    var lastWheelTime = 0;
    var velocityMultiplier = 1.0;

    function isInsideScrollable(el, deltaY) {
        var cur = el;
        while (cur && cur !== document.body && cur !== document.documentElement) {
            if (cur.classList && (cur.classList.contains('modal-box') || cur.classList.contains('modal-body') || cur.classList.contains('modal-overlay') || cur.classList.contains('profile-dropdown-menu'))) {
                return true;
            }
            if (cur.tagName === 'TEXTAREA' || cur.tagName === 'SELECT') {
                return true;
            }
            var cs = window.getComputedStyle(cur);
            var oy = cs.overflowY;
            if (oy === 'auto' || oy === 'scroll') {
                var canScrollUp = deltaY < 0 && cur.scrollTop > 0;
                var canScrollDown = deltaY > 0 && (cur.scrollTop + cur.clientHeight < cur.scrollHeight);
                if (canScrollUp || canScrollDown) return true;
            }
            cur = cur.parentElement;
        }
        return false;
    }

    function onWheelAccelerate(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        if (!e.deltaY) return;

        if (document.querySelector('.modal-overlay.open') || isInsideScrollable(e.target, e.deltaY)) {
            targetY = window.pageYOffset || document.documentElement.scrollTop || 0;
            return;
        }

        if (inlineActiveScrollAnim) {
            cancelAnimationFrame(inlineActiveScrollAnim);
            inlineActiveScrollAnim = null;
            document.documentElement.classList.remove('is-glide-scrolling');
        }

        var now = performance.now();
        var timeDiff = now - lastWheelTime;
        lastWheelTime = now;

        if (timeDiff < 140) {
            velocityMultiplier = Math.min(1.5, velocityMultiplier + 0.08);
        } else {
            velocityMultiplier = 1.0;
        }

        var isDiscreteWheel = Math.abs(e.deltaY) >= 40 && (e.deltaY % 1 === 0 || e.deltaMode !== 0);
        var baseFactor = isDiscreteWheel ? 1.35 : 1.12;
        var speedBoost = baseFactor * velocityMultiplier;

        var delta = e.deltaY;
        if (e.deltaMode === 1) delta *= 36;
        else if (e.deltaMode === 2) delta *= window.innerHeight;

        var actualY = window.pageYOffset || document.documentElement.scrollTop || 0;
        if (Math.abs(actualY - currentY) > 80 || (delta > 0 && targetY < actualY) || (delta < 0 && targetY > actualY)) {
            currentY = actualY;
            targetY = actualY;
        }

        var maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        targetY = Math.max(0, Math.min(maxScroll, targetY + (delta * speedBoost)));

        e.preventDefault();

        if (!scrollRaf) {
            stepScroll();
        }
    }

    function stepScroll() {
        var diff = targetY - currentY;

        if (Math.abs(diff) > 0.8) {
            currentY += diff * 0.22;
            window.scrollTo(0, Math.round(currentY));
            scrollRaf = requestAnimationFrame(stepScroll);
        } else {
            currentY = targetY;
            window.scrollTo(0, targetY);
            scrollRaf = null;
        }
    }

    if (!window.__kiuqWheelInit) {
        window.__kiuqWheelInit = true;
        window.addEventListener('wheel', onWheelAccelerate, { passive: false });
    }

    window.addEventListener('scroll', function() {
        if (!scrollRaf) {
            currentY = window.pageYOffset || document.documentElement.scrollTop || 0;
            targetY = currentY;
        }
    }, { passive: true });

    window.addEventListener('touchstart', function() {
        if (scrollRaf) {
            cancelAnimationFrame(scrollRaf);
            scrollRaf = null;
        }
        currentY = window.pageYOffset || document.documentElement.scrollTop || 0;
        targetY = currentY;
    }, { passive: true });
})();
</script>
<script src="<?php echo htmlspecialchars($APP_ASSETS_URL); ?>/js/panel.js?v=<?php echo (int)@filemtime($APP_ASSETS_DIR . '/js/panel.js'); ?>"></script>
</body>
</html>
<?php
