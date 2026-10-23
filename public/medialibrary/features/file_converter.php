<?php
/**
 * File Converter Module (Sony ARW RAW, AVIF & ZIP to JPG/PNG)
 * =============================================================
 * Converts Sony RAW (.arw), AVIF (.avif), and ZIP archives containing
 * these files to pristine JPG or PNG format.
 * 
 * Supports:
 *  - PHP \Imagick extension (Linux/cPanel/Hostinger & macOS)
 *  - PHP GD extension (imagecreatefromavif, imagepng, imagejpeg)
 *  - macOS sips (Apple ImageIO)
 *  - CLI ImageMagick (magick / convert)
 * 
 * Features 4:4:4 chroma subsampling, EXIF orientation correction,
 * lossless PNG, and 100% max quality matching the original.
 */

declare(strict_types=1);

if (!defined('FEATURE_FILE_CONVERTER')) {
    define('FEATURE_FILE_CONVERTER', true);
}

define('CONVERT_TEMP_DIR', __DIR__ . '/.tmp_convert');

/**
 * Ensure temporary directory exists and is secured
 */
function file_converter_ensure_temp_dir(): string {
    $dir = CONVERT_TEMP_DIR;
    if (!is_dir($dir)) {
        @mkdir($dir, 0777, true);
    }
    $htaccess = $dir . '/.htaccess';
    if (!is_file($htaccess)) {
        @file_put_contents($htaccess, "Require all denied\nDeny from all\n");
    }
    return $dir;
}

/**
 * Clean up temporary jobs older than 2 hours
 */
function file_converter_cleanup_old_jobs(int $maxAgeSeconds = 7200): void {
    $dir = CONVERT_TEMP_DIR;
    if (!is_dir($dir)) return;

    $now = time();
    $items = @scandir($dir);
    if (!is_array($items)) return;

    foreach ($items as $item) {
        if ($item === '.' || $item === '..' || $item === '.htaccess') continue;
        $path = $dir . '/' . $item;
        if (is_dir($path) && (strpos($item, 'job_') === 0 || strpos($item, 'upload_') === 0)) {
            $mtime = @filemtime($path) ?: 0;
            if ($now - $mtime > $maxAgeSeconds) {
                file_converter_delete_tree($path);
            }
        } elseif (is_file($path) && (strpos($item, 'converted_') === 0 || strpos($item, 'dl_') === 0)) {
            $mtime = @filemtime($path) ?: 0;
            if ($now - $mtime > $maxAgeSeconds) {
                @unlink($path);
            }
        }
    }
}

/**
 * Recursively delete directory tree
 */
function file_converter_delete_tree(string $dir): bool {
    if (!is_dir($dir)) return false;
    $files = array_diff(scandir($dir) ?: [], ['.', '..']);
    foreach ($files as $file) {
        $p = "$dir/$file";
        is_dir($p) ? file_converter_delete_tree($p) : @unlink($p);
    }
    return @rmdir($dir);
}

/**
 * Sanitize filename
 */
function file_converter_sanitize_name(string $name): string {
    $name = basename($name);
    $name = preg_replace('/[^\w\.\-\(\)\s]/u', '_', $name);
    $name = trim($name);
    return $name ?: 'file_' . time();
}

/**
 * Format bytes into human-readable string
 */
function file_converter_format_size(int $bytes): string {
    if ($bytes <= 0) return '0 B';
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $i = (int)floor(log($bytes, 1024));
    if ($i >= count($units)) $i = count($units) - 1;
    $val = round($bytes / pow(1024, $i), 1);
    return $val . ' ' . $units[$i];
}

/**
 * Generate unique filename in directory if collision exists
 */
function file_converter_unique_filename(string $dir, string $filename): string {
    $info = pathinfo($filename);
    $ext = !empty($info['extension']) ? '.' . $info['extension'] : '';
    $base = $info['filename'];

    $candidate = $filename;
    $counter = 1;
    while (file_exists($dir . '/' . $candidate)) {
        $candidate = $base . '_' . $counter . $ext;
        $counter++;
    }
    return $candidate;
}

/**
 * Safely send clean JSON response without any stray PHP notices or HTML
 */
function file_converter_send_json(array $payload): void {
    while (ob_get_level() > 0) {
        @ob_end_clean();
    }
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-cache, no-store, must-revalidate');
    }
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Convert ARW or AVIF file to target format (JPG or PNG) with original maximum quality
 */
function file_converter_convert_file(string $sourcePath, string $outputPath, string $format = 'jpg', int $jpgQuality = 100): array {
    if (!is_file($sourcePath) || filesize($sourcePath) === 0) {
        return ['success' => false, 'error' => 'Source file does not exist or is empty'];
    }

    $format = strtolower($format);
    if ($format !== 'png') {
        $format = 'jpg';
    }

    $outDir = dirname($outputPath);
    if (!is_dir($outDir)) {
        @mkdir($outDir, 0777, true);
    }

    $ext = strtolower(pathinfo($sourcePath, PATHINFO_EXTENSION));
    $qVal = max(60, min(100, $jpgQuality));

    // ──────────────────────────────────────────────────────────────────────────
    // ENGINE 1: PHP \Imagick extension (Hostinger & modern Linux/macOS)
    // Provides pristine color reproduction, 4:4:4 chroma subsampling, and EXIF handling
    // ──────────────────────────────────────────────────────────────────────────
    if (extension_loaded('imagick') && class_exists('\Imagick')) {
        try {
            $im = new \Imagick();
            $im->readImage($sourcePath);

            // Preserve sRGB color space if CMYK or untagged
            try {
                if ($im->getImageColorspace() === \Imagick::COLORSPACE_CMYK) {
                    $im->transformImageColorspace(\Imagick::COLORSPACE_SRGB);
                }
            } catch (\Throwable $e) {}

            // Auto-rotate by EXIF orientation tag
            try {
                $orientation = $im->getImageOrientation();
                switch ($orientation) {
                    case \Imagick::ORIENTATION_BOTTOMRIGHT:
                        $im->rotateImage(new \ImagickPixel('none'), 180);
                        break;
                    case \Imagick::ORIENTATION_RIGHTTOP:
                        $im->rotateImage(new \ImagickPixel('none'), 90);
                        break;
                    case \Imagick::ORIENTATION_LEFTBOTTOM:
                        $im->rotateImage(new \ImagickPixel('none'), -90);
                        break;
                }
                $im->setImageOrientation(\Imagick::ORIENTATION_TOPLEFT);
            } catch (\Throwable $e) {}

            if ($format === 'jpg') {
                $im->setImageFormat('jpeg');
                $im->setImageCompressionQuality($qVal);
                // 4:4:4 sampling: preserve original razor-sharp color edges without subsampling blur
                try {
                    $im->setSamplingFactors(['1x1', '1x1', '1x1']);
                } catch (\Throwable $e) {}

                // Flatten on solid white background in case source image has alpha channel
                try {
                    $im->setImageBackgroundColor('white');
                    $flattened = $im->mergeImageLayers(\Imagick::LAYERMETHOD_FLATTEN);
                    $flattened->writeImage($outputPath);
                    $flattened->clear();
                    $flattened->destroy();
                } catch (\Throwable $e) {
                    $im->writeImage($outputPath);
                }
            } else {
                // Lossless PNG
                $im->setImageFormat('png');
                $im->setImageCompressionQuality(100);
                $im->writeImage($outputPath);
            }

            $im->clear();
            $im->destroy();

            if (is_file($outputPath) && filesize($outputPath) > 0) {
                return [
                    'success' => true,
                    'output_path' => $outputPath,
                    'size' => filesize($outputPath),
                    'format' => $format,
                    'engine' => 'imagick',
                ];
            }
        } catch (\Throwable $e) {
            // If Imagick could not process this format, fall through to next engine
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ENGINE 2: Native PHP GD conversion (AVIF support in PHP 8.1+)
    // ──────────────────────────────────────────────────────────────────────────
    if ($ext === 'avif' && function_exists('imagecreatefromavif')) {
        try {
            $gdImg = @imagecreatefromavif($sourcePath);
            if ($gdImg) {
                // EXIF auto-rotation
                if (function_exists('exif_read_data')) {
                    try {
                        $exif = @exif_read_data($sourcePath);
                        $orientation = $exif['Orientation'] ?? null;
                        if ($orientation === 3) {
                            $rotated = imagerotate($gdImg, 180, 0);
                            if ($rotated) { imagedestroy($gdImg); $gdImg = $rotated; }
                        } elseif ($orientation === 6) {
                            $rotated = imagerotate($gdImg, -90, 0);
                            if ($rotated) { imagedestroy($gdImg); $gdImg = $rotated; }
                        } elseif ($orientation === 8) {
                            $rotated = imagerotate($gdImg, 90, 0);
                            if ($rotated) { imagedestroy($gdImg); $gdImg = $rotated; }
                        }
                    } catch (\Throwable $e) {}
                }

                $w = imagesx($gdImg);
                $h = imagesy($gdImg);
                $saved = false;

                if ($format === 'png' && function_exists('imagepng')) {
                    imagealphablending($gdImg, false);
                    imagesavealpha($gdImg, true);
                    $saved = @imagepng($gdImg, $outputPath, 6);
                } elseif (function_exists('imagejpeg')) {
                    $bg = imagecreatetruecolor($w, $h);
                    $white = imagecolorallocate($bg, 255, 255, 255);
                    imagefilledrectangle($bg, 0, 0, $w, $h, $white);
                    imagecopy($bg, $gdImg, 0, 0, 0, 0, $w, $h);
                    $saved = @imagejpeg($bg, $outputPath, $qVal);
                    @imagedestroy($bg);
                }

                @imagedestroy($gdImg);

                if ($saved && is_file($outputPath) && filesize($outputPath) > 0) {
                    return [
                        'success' => true,
                        'output_path' => $outputPath,
                        'size' => filesize($outputPath),
                        'format' => $format,
                        'engine' => 'gd',
                    ];
                }
            }
        } catch (\Throwable $e) {}
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ENGINE 3: macOS native sips (Apple ImageIO - handles ARW & AVIF natively)
    // ──────────────────────────────────────────────────────────────────────────
    $sipsPath = '/usr/bin/sips';
    if (is_executable($sipsPath) || @file_exists($sipsPath)) {
        if ($format === 'jpg') {
            $sipsOpt = (string)$qVal;
            $cmd = sprintf(
                '%s -s format jpeg -s formatOptions %s %s --out %s 2>&1',
                escapeshellarg($sipsPath),
                $sipsOpt,
                escapeshellarg($sourcePath),
                escapeshellarg($outputPath)
            );
        } else {
            $cmd = sprintf(
                '%s -s format png %s --out %s 2>&1',
                escapeshellarg($sipsPath),
                $sourcePathEsc,
                $outputPathEsc
            );
        }

        $output = [];
        $returnCode = 0;
        @exec($cmd, $output, $returnCode);

        if ($returnCode === 0 && is_file($outputPath) && filesize($outputPath) > 0) {
            return [
                'success' => true,
                'output_path' => $outputPath,
                'size' => filesize($outputPath),
                'format' => $format,
                'engine' => 'sips',
            ];
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ENGINE 4: CLI ImageMagick (convert or magick on Linux / macOS)
    // ──────────────────────────────────────────────────────────────────────────
    $cliCandidates = [
        '/usr/bin/convert',
        '/usr/local/bin/convert',
        '/usr/bin/magick',
        '/usr/local/bin/magick',
        '/opt/homebrew/bin/magick',
        '/opt/homebrew/bin/convert',
    ];
    $foundCli = null;
    foreach ($cliCandidates as $cand) {
        if (@is_executable($cand)) {
            $foundCli = $cand;
            break;
        }
    }

    if (!$foundCli && function_exists('exec')) {
        $whichConv = @trim((string)shell_exec('which convert 2>/dev/null'));
        if ($whichConv && @is_executable($whichConv)) {
            $foundCli = $whichConv;
        } else {
            $whichMag = @trim((string)shell_exec('which magick 2>/dev/null'));
            if ($whichMag && @is_executable($whichMag)) {
                $foundCli = $whichMag;
            }
        }
    }

    if ($foundCli) {
        if ($format === 'jpg') {
            $cmd = sprintf(
                '%s %s -background white -flatten -sampling-factor 4:4:4 -quality %d %s 2>&1',
                escapeshellarg($foundCli),
                escapeshellarg($sourcePath),
                $qVal,
                escapeshellarg($outputPath)
            );
        } else {
            $cmd = sprintf(
                '%s %s -quality 100 %s 2>&1',
                escapeshellarg($foundCli),
                escapeshellarg($sourcePath),
                escapeshellarg($outputPath)
            );
        }

        $output = [];
        $returnCode = 0;
        @exec($cmd, $output, $returnCode);

        if ($returnCode === 0 && is_file($outputPath) && filesize($outputPath) > 0) {
            return [
                'success' => true,
                'output_path' => $outputPath,
                'size' => filesize($outputPath),
                'format' => $format,
                'engine' => 'cli_' . basename($foundCli),
            ];
        }
    }

    return [
        'success' => false,
        'error' => 'Conversion failed. Unable to process ' . strtoupper($ext) . ' file with available image processors.'
    ];
}

function file_converter_convert_arw(string $sourcePath, string $outputPath, string $format = 'jpg', int $jpgQuality = 100): array {
    return file_converter_convert_file($sourcePath, $outputPath, $format, $jpgQuality);
}

/**
 * Main feature handler
 */
function file_converter_handle(
    string $action,
    array $post,
    array $files,
    string $baseDir,
    string $currentDir,
    string $current,
    string $userId,
    string $baseUrl,
    ?callable $autoBackup = null
): void {
    file_converter_cleanup_old_jobs();
    $tempBase = file_converter_ensure_temp_dir();

    // ── Direct Download Streaming ──
    if ($action === 'convert_download') {
        $token = preg_replace('/[^\w\-]/', '', $_GET['token'] ?? ($post['token'] ?? ''));
        $name = file_converter_sanitize_name($_GET['name'] ?? ($post['name'] ?? 'download'));
        if (!$token) {
            http_response_code(400);
            echo 'Invalid download token';
            exit;
        }

        $filePath = $tempBase . '/' . $token;
        if (!is_file($filePath)) {
            $matches = glob($tempBase . '/job_*/' . $token);
            if (!empty($matches) && is_file($matches[0])) {
                $filePath = $matches[0];
            }
        }

        if (!is_file($filePath)) {
            http_response_code(404);
            echo 'File not found or download expired';
            exit;
        }

        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        $mime = 'application/octet-stream';
        if ($ext === 'jpg' || $ext === 'jpeg') $mime = 'image/jpeg';
        elseif ($ext === 'png') $mime = 'image/png';
        elseif ($ext === 'zip') $mime = 'application/zip';

        while (ob_get_level() > 0) {
            @ob_end_clean();
        }

        header('Content-Description: File Transfer');
        header('Content-Type: ' . $mime);
        header('Content-Disposition: attachment; filename="' . $name . '"');
        header('Expires: 0');
        header('Cache-Control: must-revalidate');
        header('Pragma: public');
        header('Content-Length: ' . filesize($filePath));
        @readfile($filePath);
        exit;
    }

    // All subsequent actions respond with JSON. Buffer any potential notices/warnings.
    while (ob_get_level() > 0) {
        @ob_end_clean();
    }
    ob_start();

    try {
        // ── 1. Upload & Convert Single ARW / AVIF File ──
        if ($action === 'convert_upload_file') {
            $uploaded = $files['file'] ?? null;
            $isUploaded = isset($uploaded['tmp_name']) && (is_uploaded_file($uploaded['tmp_name']) || (php_sapi_name() === 'cli' && is_file($uploaded['tmp_name'])));
            if (!$uploaded || !$isUploaded) {
                file_converter_send_json(['success' => false, 'error' => 'No file uploaded or upload error']);
            }

            $origName = $uploaded['name'] ?? 'image';
            $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));

            if (!in_array($ext, ['arw', 'avif'], true)) {
                file_converter_send_json(['success' => false, 'error' => 'Only Sony RAW (.arw) and AVIF (.avif) files are supported for direct conversion. For ZIP archives, upload via ZIP mode.']);
            }

            $targetFormat = strtolower($post['target_format'] ?? 'jpg') === 'png' ? 'png' : 'jpg';
            $jpgQuality = (int)($post['jpg_quality'] ?? 100);
            if ($jpgQuality < 60 || $jpgQuality > 100) $jpgQuality = 100;
            $saveToCurrent = !empty($post['save_to_current']);

            $baseName = pathinfo($origName, PATHINFO_FILENAME);
            $convertedFileName = file_converter_sanitize_name($baseName . '.' . $targetFormat);

            $tempJobId = 'upload_' . bin2hex(random_bytes(8));
            $jobDir = $tempBase . '/' . $tempJobId;
            @mkdir($jobDir, 0777, true);

            $tempSource = $jobDir . '/source.' . $ext;
            $saved = is_uploaded_file($uploaded['tmp_name']) 
                ? move_uploaded_file($uploaded['tmp_name'], $tempSource)
                : (@copy($uploaded['tmp_name'], $tempSource) && @unlink($uploaded['tmp_name']));
            if (!$saved && !is_file($tempSource)) {
                file_converter_delete_tree($jobDir);
                file_converter_send_json(['success' => false, 'error' => 'Failed to save uploaded file on server']);
            }

            $tempOutput = $jobDir . '/' . $convertedFileName;
            $convertResult = file_converter_convert_file($tempSource, $tempOutput, $targetFormat, $jpgQuality);

            if (!$convertResult['success']) {
                file_converter_delete_tree($jobDir);
                file_converter_send_json(['success' => false, 'error' => $convertResult['error'] ?? 'Conversion failed']);
            }

            $fileSize = filesize($tempOutput);
            $savedToLibrary = false;
            $finalName = $convertedFileName;
            $publicUrl = '';

            if ($saveToCurrent && is_dir($currentDir) && is_writable($currentDir)) {
                $finalName = file_converter_unique_filename($currentDir, $convertedFileName);
                $destination = $currentDir . '/' . $finalName;
                if (@copy($tempOutput, $destination)) {
                    $savedToLibrary = true;
                    if ($autoBackup && is_callable($autoBackup)) {
                        try {
                            $backupList = is_array($destination) ? $destination : [(string)$destination];
                            @$autoBackup($backupList);
                        } catch (\Throwable $e) {
                            // Suppress backup exceptions so conversion response is always cleanly returned
                        }
                    }
                    $relPath = $current ? ($current . '/' . $finalName) : $finalName;
                    $publicUrl = rtrim($baseUrl, '/') . '/' . ltrim($relPath, '/');
                }
            }

            // Prepare download token
            $dlToken = bin2hex(random_bytes(12)) . '.' . $targetFormat;
            @copy($tempOutput, $tempBase . '/' . $dlToken);
            file_converter_delete_tree($jobDir);

            file_converter_send_json([
                'success' => true,
                'type' => $ext,
                'original_name' => $origName,
                'converted_name' => $finalName,
                'format' => $targetFormat,
                'size' => $fileSize,
                'size_formatted' => file_converter_format_size($fileSize),
                'saved_to_library' => $savedToLibrary,
                'public_url' => $publicUrl,
                'download_token' => $dlToken,
                'download_url' => '?action=convert_download&token=' . urlencode($dlToken) . '&name=' . urlencode($finalName),
                'engine' => $convertResult['engine'] ?? 'default',
            ]);
        }

        // ── 2. Initialize ZIP Archive Job ──
        if ($action === 'convert_init_job') {
            $uploaded = $files['file'] ?? null;
            $isUploaded = isset($uploaded['tmp_name']) && (is_uploaded_file($uploaded['tmp_name']) || (php_sapi_name() === 'cli' && is_file($uploaded['tmp_name'])));
            if (!$uploaded || !$isUploaded) {
                file_converter_send_json(['success' => false, 'error' => 'No ZIP file uploaded or upload error']);
            }

            $origName = $uploaded['name'] ?? 'archive.zip';
            $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
            if ($ext !== 'zip') {
                file_converter_send_json(['success' => false, 'error' => 'Only .zip archives are allowed in this mode']);
            }

            if (!class_exists('ZipArchive')) {
                file_converter_send_json(['success' => false, 'error' => 'PHP ZipArchive extension is not available on server']);
            }

            $targetFormat = strtolower($post['target_format'] ?? 'jpg') === 'png' ? 'png' : 'jpg';
            $jpgQuality = (int)($post['jpg_quality'] ?? 100);
            if ($jpgQuality < 60 || $jpgQuality > 100) $jpgQuality = 100;
            $saveToCurrent = !empty($post['save_to_current']) ? 1 : 0;

            $jobId = 'job_' . bin2hex(random_bytes(10));
            $jobDir = $tempBase . '/' . $jobId;
            $extractDir = $jobDir . '/extracted';
            $convertedDir = $jobDir . '/converted';

            @mkdir($extractDir, 0777, true);
            @mkdir($convertedDir, 0777, true);

            $zip = new ZipArchive();
            $res = $zip->open($uploaded['tmp_name']);
            if ($res !== true) {
                file_converter_delete_tree($jobDir);
                file_converter_send_json(['success' => false, 'error' => 'Failed to open ZIP archive (code: ' . $res . ')']);
            }

            // Extract with zip-slip prevention
            $arwFiles = [];
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $entryName = $zip->getNameIndex($i);
                if (empty($entryName) || substr($entryName, -1) === '/') continue;

                // Security check: no traversal
                if (strpos($entryName, '..') !== false || strpos($entryName, ':') !== false) continue;

                $entryExt = strtolower(pathinfo($entryName, PATHINFO_EXTENSION));
                if ($entryExt === 'arw' || $entryExt === 'avif') {
                    $extractedTarget = $extractDir . '/' . md5((string)$i) . '_' . basename($entryName);
                    $stream = $zip->getStream($entryName);
                    if ($stream) {
                        $outF = fopen($extractedTarget, 'wb');
                        if ($outF) {
                            stream_copy_to_stream($stream, $outF);
                            fclose($outF);
                            fclose($stream);

                            $arwFiles[] = [
                                'original_name' => basename($entryName),
                                'entry_name' => $entryName,
                                'extracted_path' => $extractedTarget,
                                'size' => filesize($extractedTarget),
                                'ext' => $entryExt,
                            ];
                        }
                    }
                }
            }
            $zip->close();
            @unlink($uploaded['tmp_name']);

            if (empty($arwFiles)) {
                file_converter_delete_tree($jobDir);
                file_converter_send_json(['success' => false, 'error' => 'No Sony RAW (.arw) or AVIF (.avif) files found inside the ZIP archive.']);
            }

            // Save job manifest
            $manifest = [
                'job_id' => $jobId,
                'orig_zip_name' => $origName,
                'target_format' => $targetFormat,
                'jpg_quality' => $jpgQuality,
                'save_to_current' => $saveToCurrent,
                'current_dir' => $currentDir,
                'current' => $current,
                'created_at' => time(),
                'files' => $arwFiles,
                'converted_files' => [],
            ];
            file_put_contents($jobDir . '/manifest.json', json_encode($manifest, JSON_PRETTY_PRINT));

            file_converter_send_json([
                'success' => true,
                'job_id' => $jobId,
                'total_files' => count($arwFiles),
                'files' => array_map(function($f) {
                    return [
                        'name' => $f['original_name'],
                        'size_formatted' => file_converter_format_size($f['size']),
                    ];
                }, $arwFiles),
                'target_format' => $targetFormat,
            ]);
        }

        // ── 3. Step-by-Step Conversion for Job ──
        if ($action === 'convert_process_step') {
            $jobId = preg_replace('/[^\w\-]/', '', $post['job_id'] ?? '');
            $fileIndex = (int)($post['file_index'] ?? -1);

            if (!$jobId) {
                file_converter_send_json(['success' => false, 'error' => 'Missing job ID']);
            }

            $jobDir = $tempBase . '/' . $jobId;
            $manifestFile = $jobDir . '/manifest.json';
            if (!is_file($manifestFile)) {
                file_converter_send_json(['success' => false, 'error' => 'Job session expired or not found']);
            }

            $manifest = json_decode((string)file_get_contents($manifestFile), true);
            if (!$manifest || !isset($manifest['files'][$fileIndex])) {
                file_converter_send_json(['success' => false, 'error' => 'Invalid file index']);
            }

            $fileItem = $manifest['files'][$fileIndex];
            $sourcePath = $fileItem['extracted_path'];
            $origName = $fileItem['original_name'];
            $baseName = pathinfo($origName, PATHINFO_FILENAME);
            $targetFormat = $manifest['target_format'] ?? 'jpg';
            $jpgQuality = (int)($manifest['jpg_quality'] ?? 100);
            $saveToCurrent = !empty($manifest['save_to_current']);
            $destDir = $manifest['current_dir'] ?? $currentDir;
            $currentRel = $manifest['current'] ?? $current;

            $convertedName = file_converter_sanitize_name($baseName . '.' . $targetFormat);
            $convertedPath = $jobDir . '/converted/' . md5((string)$fileIndex) . '_' . $convertedName;

            $t0 = microtime(true);
            $convertResult = file_converter_convert_file($sourcePath, $convertedPath, $targetFormat, $jpgQuality);
            $duration = round(microtime(true) - $t0, 2);

            if (!$convertResult['success']) {
                file_converter_send_json([
                    'success' => false,
                    'file_index' => $fileIndex,
                    'file_name' => $origName,
                    'error' => $convertResult['error'] ?? 'Conversion failed',
                ]);
            }

            $convertedSize = filesize($convertedPath);
            $savedToLibrary = false;
            $libraryName = $convertedName;

            if ($saveToCurrent && is_dir($destDir) && is_writable($destDir)) {
                $libraryName = file_converter_unique_filename($destDir, $convertedName);
                $destination = $destDir . '/' . $libraryName;
                if (@copy($convertedPath, $destination)) {
                    $savedToLibrary = true;
                    if ($autoBackup && is_callable($autoBackup)) {
                        try {
                            $backupList = is_array($destination) ? $destination : [(string)$destination];
                            @$autoBackup($backupList);
                        } catch (\Throwable $e) {
                            // Suppress backup exceptions
                        }
                    }
                }
            }

            // Update manifest
            $convertedRecord = [
                'index' => $fileIndex,
                'original_name' => $origName,
                'converted_name' => $convertedName,
                'library_name' => $libraryName,
                'path' => $convertedPath,
                'size' => $convertedSize,
                'saved' => $savedToLibrary,
                'duration' => $duration,
            ];
            $manifest['converted_files'][$fileIndex] = $convertedRecord;
            file_put_contents($manifestFile, json_encode($manifest, JSON_PRETTY_PRINT));

            // Create individual download token
            $dlToken = bin2hex(random_bytes(10)) . '.' . $targetFormat;
            @copy($convertedPath, $tempBase . '/' . $dlToken);

            file_converter_send_json([
                'success' => true,
                'file_index' => $fileIndex,
                'original_name' => $origName,
                'converted_name' => $convertedName,
                'size_formatted' => file_converter_format_size($convertedSize),
                'duration' => $duration,
                'saved_to_library' => $savedToLibrary,
                'download_url' => '?action=convert_download&token=' . urlencode($dlToken) . '&name=' . urlencode($convertedName),
            ]);
        }

        // ── 4. Finalize Job & Build Download ZIP Bundle ──
        if ($action === 'convert_finish_job') {
            $jobId = preg_replace('/[^\w\-]/', '', $post['job_id'] ?? '');
            if (!$jobId) {
                file_converter_send_json(['success' => false, 'error' => 'Missing job ID']);
            }

            $jobDir = $tempBase . '/' . $jobId;
            $manifestFile = $jobDir . '/manifest.json';
            if (!is_file($manifestFile)) {
                file_converter_send_json(['success' => false, 'error' => 'Job not found']);
            }

            $manifest = json_decode((string)file_get_contents($manifestFile), true);
            $convertedFiles = $manifest['converted_files'] ?? [];

            if (empty($convertedFiles)) {
                file_converter_send_json(['success' => false, 'error' => 'No files were converted in this job']);
            }

            // Clean up extracted RAW source files to free disk space
            if (is_dir($jobDir . '/extracted')) {
                file_converter_delete_tree($jobDir . '/extracted');
            }

            // Build ZIP bundle of converted images
            $bundleZipName = 'converted_' . preg_replace('/\.zip$/i', '', $manifest['orig_zip_name'] ?? 'images') . '_' . date('Ymd_His') . '.zip';
            $bundleZipPath = $jobDir . '/' . $bundleZipName;

            $zip = new ZipArchive();
            if ($zip->open($bundleZipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) === true) {
                $usedNames = [];
                foreach ($convertedFiles as $cf) {
                    if (is_file($cf['path'])) {
                        $entryName = $cf['converted_name'];
                        if (isset($usedNames[$entryName])) {
                            $usedNames[$entryName]++;
                            $entryName = pathinfo($entryName, PATHINFO_FILENAME) . '_' . $usedNames[$entryName] . '.' . pathinfo($entryName, PATHINFO_EXTENSION);
                        } else {
                            $usedNames[$entryName] = 1;
                        }
                        $zip->addFile($cf['path'], $entryName);
                    }
                }
                $zip->close();
            }

            $zipDownloadToken = bin2hex(random_bytes(12)) . '.zip';
            @copy($bundleZipPath, $tempBase . '/' . $zipDownloadToken);

            file_converter_send_json([
                'success' => true,
                'job_id' => $jobId,
                'total_converted' => count($convertedFiles),
                'bundle_zip_name' => $bundleZipName,
                'bundle_zip_size' => file_converter_format_size(filesize($bundleZipPath)),
                'download_bundle_url' => '?action=convert_download&token=' . urlencode($zipDownloadToken) . '&name=' . urlencode($bundleZipName),
            ]);
        }

        file_converter_send_json(['success' => false, 'error' => 'Unknown action: ' . htmlspecialchars($action)]);
    } catch (\Throwable $e) {
        file_converter_send_json([
            'success' => false,
            'error' => 'Server error: ' . $e->getMessage()
        ]);
    }
}
