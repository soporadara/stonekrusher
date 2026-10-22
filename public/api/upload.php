<?php
// =========================================================
// StoneKrusher CMS - Secure Media Upload Handler
// =========================================================

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/security.php';

Security::sendSecurityHeaders();

$currentUser = Security::requireAuth();
Security::requirePermission($currentUser, 'media.upload');
Security::validateCsrf($currentUser);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'No file uploaded or upload error occurred.']);
    exit;
}

$file = $_FILES['file'];
$maxBytes = 15 * 1024 * 1024; // 15 MB max

if ($file['size'] > $maxBytes) {
    http_response_code(400);
    echo json_encode(['error' => 'File size exceeds 15MB limit.']);
    exit;
}

// Verify actual MIME type using finfo_file (never trust client header)
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

$allowedMimes = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
    'image/gif' => 'gif',
    'image/svg+xml' => 'svg'
];

if (!isset($allowedMimes[$mimeType])) {
    http_response_code(400);
    echo json_encode(['error' => "Disallowed file type: [{$mimeType}]. Only JPEG, PNG, WebP, GIF, and SVG images are permitted."]);
    exit;
}

// For SVG, ensure no embedded executable javascript or script tags
if ($mimeType === 'image/svg+xml') {
    $svgContent = file_get_contents($file['tmp_name']);
    if (preg_match('/<script|javascript:|onload=|onerror=/i', $svgContent)) {
        http_response_code(400);
        echo json_encode(['error' => 'SVG file contains potentially dangerous script content and was rejected.']);
        exit;
    }
}

$ext = $allowedMimes[$mimeType];
$safeFilename = 'img_' . date('Ymd_His') . '_' . bin2hex(random_bytes(6)) . '.' . $ext;

$uploadDir = dirname(__DIR__) . '/uploads';
if (!is_dir($uploadDir)) {
    @mkdir($uploadDir, 0755, true);
}

// Protect upload directory against PHP execution via .htaccess
$htaccessPath = $uploadDir . '/.htaccess';
if (!file_exists($htaccessPath)) {
    $htaccessContent = "# Protect upload directory from script execution\n"
                     . "Options -ExecCGI\n"
                     . "RemoveHandler .php .phtml .php3 .php4 .php5 .php7 .php8 .phps .cgi .pl\n"
                     . "SetHandler default-handler\n"
                     . "<FilesMatch \"\\.(php|phtml|php[0-9]|phps|cgi|pl|sh|py)$\">\n"
                     . "    Order Allow,Deny\n"
                     . "    Deny from all\n"
                     . "</FilesMatch>\n";
    @file_put_contents($htaccessPath, $htaccessContent);
}

$destination = $uploadDir . '/' . $safeFilename;
if (!move_uploaded_file($file['tmp_name'], $destination)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to store uploaded file on server.']);
    exit;
}

// Get image dimensions if raster image
$dimensions = '';
if ($mimeType !== 'image/svg+xml') {
    $imgInfo = @getimagesize($destination);
    if ($imgInfo) {
        $dimensions = $imgInfo[0] . 'x' . $imgInfo[1];
    }
}

$publicUrl = '/uploads/' . $safeFilename;
$mediaId = 'med-' . bin2hex(random_bytes(12));
$now = time();
$altText = trim($_POST['alt_text'] ?? pathinfo($file['name'], PATHINFO_FILENAME));

$pdo = get_cms_pdo();
$stmt = $pdo->prepare("INSERT INTO cms_media (id, filename, original_name, filepath, mime_type, file_size, dimensions, alt_text, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
$stmt->execute([
    $mediaId,
    $safeFilename,
    $file['name'],
    $publicUrl,
    $mimeType,
    $file['size'],
    $dimensions,
    $altText,
    $currentUser['id'],
    $now
]);

Security::logAudit($currentUser['id'], 'media.uploaded', 'media', $mediaId, [
    'filename' => $safeFilename,
    'size' => $file['size'],
    'mime' => $mimeType
]);

echo json_encode([
    'success' => true,
    'media_id' => $mediaId,
    'filename' => $safeFilename,
    'url' => $publicUrl,
    'dimensions' => $dimensions,
    'file_size' => $file['size'],
    'mime_type' => $mimeType,
    'alt_text' => $altText
]);
