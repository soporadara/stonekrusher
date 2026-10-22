<?php

/**
 * AI Background Removal Handler
 * ==============================
 * Integrates with Bria AI API for background removal.
 * Supports: transparent PNG and white background PNG/JPG output.
 * Queue-based processing with per-job status tracking.
 */

declare(strict_types=1);

if (! defined('FEATURE_DB_PATH')) {
    require_once __DIR__.'/config.php';
}
require_once __DIR__.'/feature_db.php';

function ai_bg_remove_handle(string $action, array $post, string $baseDir, string $currentDir, string $current, string $userId, string $baseUrl, callable $autoBackup): void
{
    header('Content-Type: application/json');

    if (! FEATURE_AI_BG_REMOVE) {
        echo json_encode(['success' => false, 'error' => 'AI feature is disabled']);
        exit;
    }

    if (BRIA_API_KEY === 'YOUR_BRIA_API_KEY_HERE') {
        echo json_encode(['success' => false, 'error' => 'Bria AI API key not configured. Please set it in features/config.php']);
        exit;
    }

    $db = feature_db();
    if (! $db) {
        echo json_encode(['success' => false, 'error' => 'Feature DB unavailable']);
        exit;
    }

    if ($action === 'ai_bg_remove_start') {
        $paths = $post['paths'] ?? [];
        if (is_string($paths)) {
            $paths = json_decode($paths, true) ?: [];
        }
        $outputType = in_array($post['output_type'] ?? '', ['transparent', 'white'], true) ? $post['output_type'] : 'transparent';
        $outputFormat = in_array($post['output_format'] ?? '', ['png', 'jpg', 'webp'], true) ? $post['output_format'] : 'webp';
        $outputFolder = trim($post['output_folder'] ?? '');
        $keepOrigName = ! empty($post['keep_original_name']);
        $createFolder = ! empty($post['create_folder']);

        if (! is_array($paths) || empty($paths)) {
            echo json_encode(['success' => false, 'error' => 'No images selected']);
            exit;
        }

        $jobIds = [];
        foreach ($paths as $rel) {
            $rel = trim((string) $rel, '/');
            $rel = str_replace(['..', "\0"], '', $rel);
            $absPath = $baseDir.'/'.$rel;
            if (! is_file($absPath)) {
                continue;
            }

            $ext = strtolower(pathinfo($rel, PATHINFO_EXTENSION));
            if (! in_array($ext, ['jpg', 'jpeg', 'png', 'webp'], true)) {
                continue;
            }

            $jobId = bin2hex(random_bytes(12));
            try {
                $db->prepare('INSERT INTO ai_jobs(id, user_id, source_path, output_type, status, result_path, error, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?)')
                    ->execute([$jobId, $userId, $rel, $outputType, 'pending', '', '', time(), time()]);
                $jobIds[] = [
                    'id' => $jobId,
                    'source_path' => $rel,
                    'name' => basename($rel),
                    'status' => 'pending',
                ];
            } catch (Throwable $e) {
                error_log('[AI Job] '.$e->getMessage());
            }
        }

        echo json_encode([
            'success' => true,
            'jobs' => $jobIds,
            'output_type' => $outputType,
            'output_format' => $outputFormat,
            'output_folder' => $outputFolder,
            'keep_orig_name' => $keepOrigName,
        ]);
        exit;
    }

    if ($action === 'ai_bg_remove_sync') {
        $pathRel = $post['path'] ?? '';
        if (! $pathRel) {
            echo json_encode(['success' => false, 'error' => 'No path provided']);
            exit;
        }

        $absPath = false;
        if (function_exists('safeFullPath')) {
            $absPath = safeFullPath($baseDir, $pathRel);
        } else {
            $absPath = realpath($baseDir.'/'.ltrim($pathRel, '/'));
            if ($absPath === false || strpos($absPath, realpath($baseDir)) !== 0) {
                $absPath = false;
            }
        }

        if (! $absPath || ! is_file($absPath)) {
            echo json_encode(['success' => false, 'error' => 'File not found or access denied']);
            exit;
        }

        $result = ai_call_bria($absPath, BRIA_API_KEY, BRIA_API_ENDPOINT);

        if (! $result['success']) {
            echo json_encode(['success' => false, 'error' => $result['error'] ?? 'Unknown API error']);
            exit;
        }

        $b64 = base64_encode($result['image_data']);
        echo json_encode(['success' => true, 'image_b64' => 'data:image/png;base64,'.$b64]);
        exit;
    }

    if ($action === 'ai_bg_remove_process') {
        $jobId = preg_replace('/[^a-f0-9]/', '', $post['job_id'] ?? '');
        if (! $jobId) {
            echo json_encode(['success' => false, 'error' => 'Invalid job ID']);
            exit;
        }

        try {
            $stmt = $db->prepare('SELECT * FROM ai_jobs WHERE id=? AND user_id=?');
            $stmt->execute([$jobId, $userId]);
            $job = $stmt->fetch();
        } catch (Throwable $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            exit;
        }

        if (! $job) {
            echo json_encode(['success' => false, 'error' => 'Job not found']);
            exit;
        }
        if ($job['status'] === 'done') {
            echo json_encode(['success' => true, 'status' => 'done', 'result_path' => $job['result_path']]);
            exit;
        }
        if ($job['status'] === 'cancelled') {
            echo json_encode(['success' => false, 'status' => 'cancelled', 'error' => 'Job was cancelled']);
            exit;
        }

        $outputType = $job['output_type'];
        $outputFormat = $post['output_format'] ?? 'webp';
        $outputSize = $post['output_size'] ?? '';
        $outputFolder = trim($post['output_folder'] ?? '');
        $keepOrigName = ! empty($post['keep_orig_name']);

        $sourcePath = $baseDir.'/'.$job['source_path'];
        if (! is_file($sourcePath)) {
            $db->prepare("UPDATE ai_jobs SET status='error', error=?, updated_at=? WHERE id=?")->execute(['Source file not found', time(), $jobId]);
            echo json_encode(['success' => false, 'status' => 'error', 'error' => 'Source file not found']);
            exit;
        }

        // Mark processing
        $db->prepare("UPDATE ai_jobs SET status='processing', updated_at=? WHERE id=?")->execute([time(), $jobId]);

        // Call Bria API
        $result = ai_call_bria($sourcePath, BRIA_API_KEY, BRIA_API_ENDPOINT);

        if (! $result['success']) {
            $db->prepare("UPDATE ai_jobs SET status='error', error=?, updated_at=? WHERE id=?")->execute([$result['error'], time(), $jobId]);
            echo json_encode(['success' => false, 'status' => 'error', 'error' => $result['error']]);
            exit;
        }

        // Save transparent PNG from Bria temporarily
        $tmpPng = tempnam(sys_get_temp_dir(), 'bria_').'.png';
        file_put_contents($tmpPng, $result['image_data']);

        // If skip_edit is passed, save directly and mark done
        if (! empty($post['skip_edit'])) {
            $sourceDirRelative = dirname($job['source_path']);
            if ($sourceDirRelative === '.') {
                $sourceDirRelative = '';
            }

            $outRelDir = ($sourceDirRelative ? $sourceDirRelative.'/' : '').($outputFolder ?: '.');
            $outRelDir = rtrim(str_replace('//', '/', $outRelDir), '/');
            if ($outRelDir === '') {
                $outRelDir = '.';
            }

            $targetFolder = $baseDir.'/'.$outRelDir;
            if (! is_dir($targetFolder)) {
                @mkdir($targetFolder, 0755, true);
                if (function_exists('getSecureIndexHtml')) {
                    @file_put_contents($targetFolder.'/index.html', getSecureIndexHtml());
                }
            }

            $origName = pathinfo($job['source_path'], PATHINFO_FILENAME);
            $newName = $keepOrigName ? $origName.'.'.$outputFormat : 'ai_'.time().'_'.rand(100, 999).'.'.$outputFormat;

            $tempName = 'temp_ai_'.uniqid().'.'.$outputFormat;
            $tempPath = $targetFolder.'/'.$tempName;

            if (! ai_process_output_image($tmpPng, $tempPath, $outputFormat, $outputType, $outputSize)) {
                @unlink($tmpPng);
                @unlink($tempPath);
                $db->prepare("UPDATE ai_jobs SET status='error', error=?, updated_at=? WHERE id=?")->execute(['Failed to process output image', time(), $jobId]);
                error_log("[AI BG Removal] Original: {$origName} | Generated: {$tempName} | Validation: Failed | Original Deleted: No | Generated Renamed: No | Status: Failed | Error: Failed to process output image");
                echo json_encode(['success' => false, 'error' => 'Failed to process output image']);
                exit;
            }

            @unlink($tmpPng);

            // Validation passed. Now handle original replacement.
            $finalPath = $targetFolder.'/'.$newName;
            $sourcePath = $baseDir.'/'.$job['source_path'];

            if ($keepOrigName && is_file($sourcePath)) {
                @unlink($sourcePath);
            }

            // Move temp to final
            rename($tempPath, $finalPath);

            $relPath = $outRelDir.'/'.$newName;

            $originalDeleted = 'No';
            if ($keepOrigName && is_file($sourcePath)) {
                @unlink($sourcePath);
                $originalDeleted = 'Yes';
            }

            // Move temp to final
            rename($tempPath, $finalPath);
            $generatedRenamed = 'Yes';

            $db->prepare("UPDATE ai_jobs SET status='done', result_path=?, updated_at=? WHERE id=?")->execute([$relPath, time(), $jobId]);

            error_log("[AI BG Removal] Original: {$origName} | Generated: {$newName} | Validation: Passed | Original Deleted: {$originalDeleted} | Generated Renamed: {$generatedRenamed} | Status: Success");

            echo json_encode([
                'success' => true,
                'status' => 'done',
                'job_id' => $jobId,
                'result_path' => $relPath,
            ]);
            exit;
        }

        // Otherwise return Base64 to frontend for the Canvas Editor
        $b64 = 'data:image/png;base64,'.base64_encode(file_get_contents($tmpPng));
        @unlink($tmpPng);

        // Update status to needs_edit
        $db->prepare("UPDATE ai_jobs SET status='needs_edit', updated_at=? WHERE id=?")->execute([time(), $jobId]);

        echo json_encode([
            'success' => true,
            'status' => 'needs_edit',
            'job_id' => $jobId,
            'image_b64' => $b64,
        ]);
        exit;
    }

    if ($action === 'ai_bg_remove_save_canvas') {
        $jobId = preg_replace('/[^a-f0-9]/', '', $post['job_id'] ?? '');
        $b64Data = $post['image_b64'] ?? '';

        if (! $jobId || empty($b64Data)) {
            echo json_encode(['success' => false, 'error' => 'Invalid data']);
            exit;
        }

        try {
            $stmt = $db->prepare('SELECT * FROM ai_jobs WHERE id=? AND user_id=?');
            $stmt->execute([$jobId, $userId]);
            $job = $stmt->fetch();
        } catch (Throwable $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            exit;
        }

        if (! $job) {
            echo json_encode(['success' => false, 'error' => 'Job not found']);
            exit;
        }

        $outputType = $job['output_type'];
        $outputFormat = $post['output_format'] ?? 'webp';
        $outputFolder = trim($post['output_folder'] ?? '');
        $keepOrigName = ! empty($post['keep_orig_name']);

        $sourceDirRelative = dirname($job['source_path']);
        if ($sourceDirRelative === '.') {
            $sourceDirRelative = '';
        }

        $outRelDir = ($sourceDirRelative ? $sourceDirRelative.'/' : '').($outputFolder ?: '.');
        $outRelDir = rtrim(str_replace('//', '/', $outRelDir), '/');
        if ($outRelDir === '') {
            $outRelDir = '.';
        }
        $outAbsDir = $baseDir.'/'.$outRelDir;
        if (! is_dir($outAbsDir)) {
            @mkdir($outAbsDir, 0755, true);
        }

        $baseName = pathinfo($job['source_path'], PATHINFO_FILENAME);
        if ($keepOrigName) {
            $outName = $baseName.'.'.$outputFormat;
        } else {
            $suffix = $outputType === 'white' ? '_white_bg' : '_no_bg';
            $outName = $baseName.$suffix.'.'.$outputFormat;
        }

        $outAbsPath = $outAbsDir.'/'.$outName;
        $outRelPath = $outRelDir.'/'.$outName;

        // Decode Base64
        if (strpos($b64Data, ',') !== false) {
            $b64Data = explode(',', $b64Data)[1];
        }
        $imgData = base64_decode($b64Data);
        if ($imgData === false) {
            echo json_encode(['success' => false, 'error' => 'Invalid image data']);
            exit;
        }

        $tempName = 'temp_ai_'.uniqid().'.tmp';
        $tempPath = $outAbsDir.'/'.$tempName;

        if (file_put_contents($tempPath, $imgData) === false) {
            $db->prepare("UPDATE ai_jobs SET status='error', error=?, updated_at=? WHERE id=?")->execute(['Could not save final image', time(), $jobId]);
            error_log("[AI BG Removal] Original: {$baseName} | Generated: {$tempName} | Validation: Failed | Original Deleted: No | Generated Renamed: No | Status: Failed | Error: Could not save temporary generated image");
            echo json_encode(['success' => false, 'error' => 'Could not save temporary generated image']);
            exit;
        }

        $originalDeleted = 'No';
        $sourcePath = $baseDir.'/'.$job['source_path'];
        if ($keepOrigName && is_file($sourcePath)) {
            @unlink($sourcePath);
            $originalDeleted = 'Yes';
        }

        rename($tempPath, $outAbsPath);
        $generatedRenamed = 'Yes';
        @chmod($outAbsPath, 0644);
        ($autoBackup)([$outAbsPath]);

        $db->prepare("UPDATE ai_jobs SET status='done', result_path=?, updated_at=? WHERE id=?")->execute([$outRelPath, time(), $jobId]);

        error_log("[AI BG Removal] Original: {$baseName} | Generated: {$outName} | Validation: Passed | Original Deleted: {$originalDeleted} | Generated Renamed: {$generatedRenamed} | Status: Success");

        echo json_encode([
            'success' => true,
            'status' => 'done',
            'result_path' => $outRelPath,
            'result_name' => $outName,
        ]);
        exit;
    }

    if ($action === 'canvas_edit_save') {
        $filePath = $post['file_path'] ?? '';
        $b64Data = $post['image_b64'] ?? '';

        if (empty($filePath) || empty($b64Data)) {
            echo json_encode(['success' => false, 'error' => 'Invalid data']);
            exit;
        }

        if (preg_match('/^data:image\/(\w+);base64,/', $b64Data, $matches)) {
            $b64Data = substr($b64Data, strpos($b64Data, ',') + 1);
            $decoded = base64_decode($b64Data);
            if ($decoded === false) {
                echo json_encode(['success' => false, 'error' => 'Base64 decode failed']);
                exit;
            }

            // Target path
            $targetDir = $currentDir ?: $baseDir;
            $targetPath = $targetDir.'/'.basename($filePath);

            if ($autoBackupFn && is_callable($autoBackupFn) && is_file($targetPath)) {
                $autoBackupFn($targetPath);
            }

            file_put_contents($targetPath, $decoded);
            echo json_encode(['success' => true]);
            exit;
        }

        echo json_encode(['success' => false, 'error' => 'Invalid image format']);
        exit;
    }

    if ($action === 'ai_bg_remove_status') {
        $ids = $post['job_ids'] ?? [];
        if (is_string($ids)) {
            $ids = json_decode($ids, true) ?: [];
        }
        if (! is_array($ids)) {
            $ids = [];
        }
        $ids = array_filter(array_map(fn ($id) => preg_replace('/[^a-f0-9]/', '', (string) $id), $ids));
        if (empty($ids)) {
            echo json_encode(['success' => true, 'jobs' => []]);
            exit;
        }

        try {
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $stmt = $db->prepare("SELECT id, status, result_path, error, source_path, updated_at FROM ai_jobs WHERE id IN ($placeholders) AND user_id=?");
            $stmt->execute(array_merge(array_values($ids), [$userId]));
            $jobs = $stmt->fetchAll();
            echo json_encode(['success' => true, 'jobs' => $jobs]);
        } catch (Throwable $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'ai_bg_remove_cancel') {
        $ids = $post['job_ids'] ?? [];
        if (is_string($ids)) {
            $ids = json_decode($ids, true) ?: [];
        }
        if (! is_array($ids)) {
            $ids = [];
        }
        $count = 0;
        foreach ($ids as $id) {
            $id = preg_replace('/[^a-f0-9]/', '', (string) $id);
            try {
                $result = $db->prepare("UPDATE ai_jobs SET status='cancelled', updated_at=? WHERE id=? AND user_id=? AND status IN ('pending','processing')")->execute([time(), $id, $userId]);
                $count += $result;
            } catch (Throwable $e) {
            }
        }
        echo json_encode(['success' => true, 'cancelled' => $count]);
        exit;
    }

    if ($action === 'ai_bg_remove_download_zip') {
        $ids = $post['job_ids'] ?? [];
        if (is_string($ids)) {
            $ids = json_decode($ids, true) ?: [];
        }
        if (! is_array($ids)) {
            $ids = [];
        }
        $ids = array_filter(array_map(fn ($id) => preg_replace('/[^a-f0-9]/', '', (string) $id), $ids));

        if (empty($ids) || ! class_exists('ZipArchive')) {
            echo json_encode(['success' => false, 'error' => 'ZIP unavailable or no jobs provided']);
            exit;
        }

        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $db->prepare("SELECT * FROM ai_jobs WHERE id IN ($placeholders) AND user_id=? AND status='done'");
        $stmt->execute(array_merge(array_values($ids), [$userId]));
        $jobs = $stmt->fetchAll();

        if (empty($jobs)) {
            echo json_encode(['success' => false, 'error' => 'No completed jobs found']);
            exit;
        }

        $tmpZip = tempnam(sys_get_temp_dir(), 'ai_bg_').'.zip';
        $zip = new ZipArchive;
        if ($zip->open($tmpZip, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            echo json_encode(['success' => false, 'error' => 'Could not create ZIP']);
            exit;
        }

        foreach ($jobs as $job) {
            $absPath = $baseDir.'/'.$job['result_path'];
            if (is_file($absPath)) {
                $zip->addFile($absPath, basename($absPath));
            }
        }
        $zip->close();

        while (ob_get_level()) {
            ob_end_clean();
        }
        $zipName = 'ai_bg_removed_'.date('Ymd_His').'.zip';
        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="'.$zipName.'"');
        header('Content-Length: '.filesize($tmpZip));
        readfile($tmpZip);
        @unlink($tmpZip);
        exit;
    }

    echo json_encode(['success' => false, 'error' => 'Unknown action']);
    exit;
}

function ai_call_bria(string $imagePath, string $apiKey, string $endpoint): array
{
    if (! function_exists('curl_init')) {
        return ['success' => false, 'error' => 'cURL not available on this server'];
    }

    $imageData = @file_get_contents($imagePath);
    if ($imageData === false) {
        return ['success' => false, 'error' => 'Could not read source image'];
    }

    $boundary = bin2hex(random_bytes(16));
    $ext = strtolower(pathinfo($imagePath, PATHINFO_EXTENSION));

    // Bria API typically requires PNG or JPG. If it's WebP, convert it to PNG first.
    if ($ext === 'webp' || $ext === 'gif' || $ext === 'bmp') {
        $img = @imagecreatefromstring($imageData);
        if ($img) {
            ob_start();
            imagepng($img);
            $imageData = ob_get_clean();
            imagedestroy($img);
            $ext = 'png';
        }
    }

    $mimeMap = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];
    $mime = $mimeMap[$ext] ?? 'image/jpeg';

    $body = "--{$boundary}\r\n";
    $body .= "Content-Disposition: form-data; name=\"file\"; filename=\"image.{$ext}\"\r\n";
    $body .= "Content-Type: {$mime}\r\n\r\n";
    $body .= $imageData."\r\n";
    $body .= "--{$boundary}--\r\n";

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HTTPHEADER => [
            'api_token: '.$apiKey,
            'Content-Type: multipart/form-data; boundary='.$boundary,
            'Accept: application/json',
        ],
        CURLOPT_TIMEOUT => 120,
        CURLOPT_CONNECTTIMEOUT => 15,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($curlErr) {
        return ['success' => false, 'error' => 'Network error: '.$curlErr];
    }
    if ($httpCode !== 200) {
        $errMsg = '';
        $decoded = @json_decode((string) $response, true);
        if (is_array($decoded)) {
            $errMsg = $decoded['error'] ?? $decoded['message'] ?? '';
        }

        return ['success' => false, 'error' => "Bria API error (HTTP {$httpCode})".($errMsg ? ": {$errMsg}" : '')];
    }

    // Bria returns JSON with result_url OR raw image binary
    $decoded = @json_decode((string) $response, true);
    if (is_array($decoded) && ! empty($decoded['result_url'])) {
        // Fetch the result image
        $imgData = @file_get_contents($decoded['result_url']);
        if ($imgData === false) {
            return ['success' => false, 'error' => 'Could not download result from Bria'];
        }

        return ['success' => true, 'image_data' => $imgData];
    }

    // Raw binary PNG response
    if (strlen((string) $response) > 100) {
        return ['success' => true, 'image_data' => $response];
    }

    return ['success' => false, 'error' => 'Unexpected response from Bria API'];
}

function ai_process_output_image(string $pngPath, string $outPath, string $format, string $type, string $size = ''): bool
{
    if (! function_exists('imagecreatefrompng')) {
        return false;
    }

    $src = @imagecreatefrompng($pngPath);
    if (! $src) {
        return false;
    }

    $w = imagesx($src);
    $h = imagesy($src);

    $outW = $w;
    $outH = $h;

    if ($size && strpos($size, 'x') !== false) {
        $parts = explode('x', $size);
        $outW = (int) $parts[0];
        $outH = (int) $parts[1];
    }

    if ($outW <= 0) {
        $outW = $w;
    }
    if ($outH <= 0) {
        $outH = $h;
    }

    $canvas = imagecreatetruecolor($outW, $outH);
    if (! $canvas) {
        imagedestroy($src);

        return false;
    }

    if ($type === 'white') {
        $white = imagecolorallocate($canvas, 255, 255, 255);
        imagefill($canvas, 0, 0, $white);
        imagealphablending($canvas, true);
    } else {
        imagealphablending($canvas, false);
        imagesavealpha($canvas, true);
        $transparent = imagecolorallocatealpha($canvas, 0, 0, 0, 127);
        imagefill($canvas, 0, 0, $transparent);
    }

    // Scale and center the source image to fit inside the new canvas size
    if ($w > 0 && $h > 0) {
        $scale = min($outW / $w, $outH / $h);
        $newW = (int) round($w * $scale);
        $newH = (int) round($h * $scale);
        $dstX = (int) round(($outW - $newW) / 2);
        $dstY = (int) round(($outH - $newH) / 2);

        imagecopyresampled($canvas, $src, $dstX, $dstY, 0, 0, $newW, $newH, $w, $h);
    }

    imagedestroy($src);

    if ($format === 'jpg' || $format === 'jpeg') {
        $result = @imagejpeg($canvas, $outPath, 100);
    } elseif ($format === 'webp' && function_exists('imagewebp')) {
        $result = @imagewebp($canvas, $outPath, defined('IMG_WEBP_LOSSLESS') ? IMG_WEBP_LOSSLESS : 100);
    } else {
        $result = @imagepng($canvas, $outPath, 7);
    }

    imagedestroy($canvas);

    return (bool) $result;
}
