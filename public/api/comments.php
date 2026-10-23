<?php
declare(strict_types=1);

// =========================================================================
// StoneKrusher CMS - Blog Comments API (Authenticated & Guest Submissions)
// =========================================================================

if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('X-Content-Type-Options: nosniff');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Session-Token, X-CSRF-Token, X-Google-Token');
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/security.php';
require_once __DIR__ . '/db.php';

if (class_exists('Security')) {
    Security::sendSecurityHeaders();
}

$pdo = get_cms_pdo();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function send_json(int $status, array $payload): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function get_client_ip(): string {
    return $_SERVER['HTTP_CF_CONNECTING_IP']
        ?? $_SERVER['HTTP_X_FORWARDED_FOR']
        ?? $_SERVER['REMOTE_ADDR']
        ?? '127.0.0.1';
}

function ensure_comments_table($pdo): void {
    if (!$pdo) return;
    try {
        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        $isMysql = ($driver === 'mysql');

        $pdo->exec("CREATE TABLE IF NOT EXISTS blog_comments (
            id VARCHAR(64) PRIMARY KEY,
            post_slug VARCHAR(255) NOT NULL,
            uid VARCHAR(128) NULL,
            display_name VARCHAR(100) NOT NULL,
            author_email VARCHAR(255) NULL,
            public_email VARCHAR(255) NULL,
            email_verified INT DEFAULT 0,
            is_guest INT DEFAULT 1,
            photo_url TEXT NULL,
            content TEXT NOT NULL,
            moderation_status VARCHAR(50) DEFAULT 'Approved',
            ip_address VARCHAR(45) NULL,
            user_agent VARCHAR(255) NULL,
            created_at BIGINT NOT NULL,
            updated_at BIGINT NOT NULL
        )");

        // Fetch existing columns to dynamically add missing ones on older databases
        $existingCols = [];
        if ($isMysql) {
            $q = $pdo->query("SHOW COLUMNS FROM blog_comments");
            while ($row = $q->fetch(PDO::FETCH_ASSOC)) {
                $existingCols[] = strtolower($row['Field']);
            }
        } else {
            $q = $pdo->query("PRAGMA table_info(blog_comments)");
            while ($row = $q->fetch(PDO::FETCH_ASSOC)) {
                $existingCols[] = strtolower($row['name']);
            }
        }

        $neededCols = [
            'post_slug' => "VARCHAR(255) NOT NULL DEFAULT ''",
            'uid' => "VARCHAR(128) NULL",
            'display_name' => "VARCHAR(100) NOT NULL DEFAULT 'Guest'",
            'author_email' => "VARCHAR(255) NULL",
            'public_email' => "VARCHAR(255) NULL",
            'email_verified' => "INT DEFAULT 0",
            'is_guest' => "INT DEFAULT 1",
            'photo_url' => "TEXT NULL",
            'content' => "TEXT NULL",
            'moderation_status' => "VARCHAR(50) DEFAULT 'Approved'",
            'ip_address' => "VARCHAR(45) NULL",
            'user_agent' => "VARCHAR(255) NULL",
            'created_at' => "BIGINT NOT NULL DEFAULT 0",
            'updated_at' => "BIGINT NOT NULL DEFAULT 0"
        ];

        foreach ($neededCols as $col => $definition) {
            if (!in_array(strtolower($col), $existingCols, true)) {
                try {
                    $pdo->exec("ALTER TABLE blog_comments ADD COLUMN {$col} {$definition}");
                } catch (Exception $alterEx) {
                    // Column already added
                }
            }
        }
    } catch (Exception $e) {
        error_log("Failed to ensure blog_comments table: " . $e->getMessage());
    }
}

if ($pdo) {
    ensure_comments_table($pdo);
}

// -------------------------------------------------------------------------
// GET: Fetch Approved Comments for a Blog Post
// -------------------------------------------------------------------------
if ($method === 'GET') {
    $slug = trim((string)($_GET['slug'] ?? ($_GET['post_slug'] ?? '')));
    if ($slug === '') {
        send_json(400, ['success' => false, 'error' => 'Missing blog post slug.']);
    }

    if (!$pdo) {
        send_json(200, ['success' => true, 'comments' => []]);
    }

    try {
        $stmt = $pdo->prepare("
            SELECT id, post_slug, uid, display_name, author_email, public_email,
                   email_verified, is_guest, photo_url, content, moderation_status, created_at
            FROM blog_comments
            WHERE post_slug = ? AND moderation_status = 'Approved'
            ORDER BY created_at DESC
        ");
        $stmt->execute([$slug]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $comments = [];
        foreach ($rows as $row) {
            $isPublicEmail = !empty($row['public_email']);
            $emailToExpose = $isPublicEmail ? (string)$row['public_email'] : null;
            $formattedDate = date('M j, Y', (int)$row['created_at']);

            $comments[] = [
                'id' => (string)$row['id'],
                'commentId' => (string)$row['id'],
                'blogSlug' => (string)$row['post_slug'],
                'postId' => (string)$row['post_slug'],
                'uid' => $row['uid'] ? (string)$row['uid'] : null,
                'authorName' => (string)$row['display_name'],
                'displayName' => (string)$row['display_name'],
                'authorEmail' => $emailToExpose,
                'publicEmail' => $emailToExpose,
                'showPublicEmail' => $isPublicEmail,
                'emailVerified' => (bool)$row['email_verified'],
                'isGuest' => (bool)$row['is_guest'],
                'avatar' => $row['photo_url'] ? (string)$row['photo_url'] : null,
                'photoURL' => $row['photo_url'] ? (string)$row['photo_url'] : null,
                'content' => (string)$row['content'],
                'text' => (string)$row['content'],
                'date' => $formattedDate,
                'createdAt' => date('c', (int)$row['created_at']),
                'status' => (string)$row['moderation_status'],
                'moderationStatus' => (string)$row['moderation_status']
            ];
        }

        send_json(200, ['success' => true, 'comments' => $comments]);
    } catch (Exception $e) {
        send_json(200, ['success' => true, 'comments' => []]);
    }
}

// -------------------------------------------------------------------------
// POST: Submit a New Comment (Authenticated or Guest)
// -------------------------------------------------------------------------
if ($method === 'POST') {
    $rawBody = file_get_contents('php://input');
    $payload = json_decode($rawBody, true) ?: $_POST;

    // 1. Anti-Spam: Honeypot field check
    $honeypot = trim((string)($payload['website_hp'] ?? ($payload['hp_field'] ?? '')));
    if ($honeypot !== '') {
        // Silently discard spam bot submissions with a fake success
        send_json(200, ['success' => true, 'message' => 'Comment received.']);
    }

    // 2. Client IP Rate Limiting (Min 5 seconds between posts, max 5 posts per 5 minutes)
    $ip = get_client_ip();
    $now = time();

    if ($pdo) {
        try {
            // Check last submission time from this IP
            $stmtLast = $pdo->prepare("SELECT created_at FROM blog_comments WHERE ip_address = ? ORDER BY created_at DESC LIMIT 1");
            $stmtLast->execute([$ip]);
            $lastTime = $stmtLast->fetchColumn();
            if ($lastTime && ($now - (int)$lastTime) < 5) {
                send_json(429, ['success' => false, 'error' => 'Please wait a few seconds before posting another comment.']);
            }

            // Check submission rate in last 5 minutes
            $fiveMinAgo = $now - 300;
            $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM blog_comments WHERE ip_address = ? AND created_at >= ?");
            $stmtCount->execute([$ip, $fiveMinAgo]);
            $recentCount = (int)$stmtCount->fetchColumn();
            if ($recentCount >= 6) {
                send_json(429, ['success' => false, 'error' => 'Too many comments submitted from your device. Please try again in 5 minutes.']);
            }
        } catch (Exception $e) {
            // Proceed if rate limit query fails
        }
    }

    // 3. Validate Inputs
    $slug = trim((string)($payload['post_slug'] ?? ($payload['blogSlug'] ?? ($payload['postId'] ?? ''))));
    $content = trim((string)($payload['content'] ?? ($payload['text'] ?? '')));
    $displayName = trim((string)($payload['display_name'] ?? ($payload['authorName'] ?? '')));
    $authorEmail = trim((string)($payload['email'] ?? ($payload['authorEmail'] ?? '')));
    $showPublicEmail = !empty($payload['show_public_email']) || !empty($payload['showPublicEmail']);
    $googleCredential = trim((string)($payload['google_credential'] ?? ($payload['googleCredential'] ?? '')));

    if ($slug === '') {
        send_json(400, ['success' => false, 'error' => 'Missing blog post slug.']);
    }

    if ($content === '') {
        send_json(400, ['success' => false, 'error' => 'Comment text cannot be empty.']);
    }

    if (mb_strlen($content) > 3000) {
        send_json(400, ['success' => false, 'error' => 'Comment text exceeds maximum length of 3000 characters.']);
    }

    // Sanitize content against XSS / HTML injection
    $sanitizedContent = htmlspecialchars($content, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

    // 4. Identity & Verification Resolution
    $uid = null;
    $emailVerified = false;
    $isGuest = true;
    $photoUrl = null;

    // A. Check CMS Super Admin / Staff Session
    $cmsUser = null;
    if (class_exists('Security')) {
        $cmsUser = Security::getCurrentUser();
    }
    if ($cmsUser) {
        $uid = 'cms-' . ($cmsUser['id'] ?? 'staff');
        $displayName = $cmsUser['full_name'] ?: ($cmsUser['username'] ?: 'Staff');
        $authorEmail = $cmsUser['email'] ?? '';
        $emailVerified = true;
        $isGuest = false;
        $photoUrl = $cmsUser['avatar'] ?? null;
    }

    // B. Check Google Identity Services token (1-Click Google Sign-in)
    if (!$cmsUser && $googleCredential !== '') {
        $claims = null;
        if (class_exists('Security')) {
            $claims = Security::fetchGoogleTokenClaims($googleCredential);
            $clientId = Security::getGoogleClientId();
            $claimError = Security::validateGoogleClaims($claims, $clientId);
            if ($claimError !== null && $claimError !== 'audience_mismatch') {
                $claims = null;
            }
        }
        if (!$claims) {
            $url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode($googleCredential);
            $ctx = stream_context_create(['http' => ['timeout' => 5, 'ignore_errors' => true]]);
            $body = @file_get_contents($url, false, $ctx);
            if ($body) {
                $claims = json_decode($body, true);
            }
        }

        if ($claims && !empty($claims['email']) && ($claims['email_verified'] === 'true' || $claims['email_verified'] === true)) {
            $uid = 'google-' . ($claims['sub'] ?? md5($claims['email']));
            $displayName = trim((string)($claims['name'] ?? ($claims['given_name'] ?? $displayName)));
            $authorEmail = strtolower(trim((string)$claims['email']));
            $emailVerified = true;
            $isGuest = false;
            $photoUrl = $claims['picture'] ?? null;
        }
    }

    // C. Guest Commenter Fallback (No forcing login or account registration)
    if ($isGuest) {
        // Defaults to "Guest" if no display name entered
        if ($displayName === '') {
            $displayName = 'Guest';
        } else {
            $displayName = htmlspecialchars(mb_substr($displayName, 0, 50), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        }

        // Anti-Impersonation Safeguard: Guests cannot claim official administrative titles
        $lowerName = strtolower($displayName);
        $reservedNames = ['admin', 'administrator', 'konstructz support', 'moderator', 'system staff', 'stonekrusher staff'];
        foreach ($reservedNames as $resName) {
            if ($lowerName === $resName || str_contains($lowerName, 'administrator')) {
                $displayName = 'Guest (' . htmlspecialchars($displayName, ENT_QUOTES, 'UTF-8') . ')';
                break;
            }
        }

        // Validate optional guest email format if provided
        if ($authorEmail !== '') {
            if (!filter_var($authorEmail, FILTER_VALIDATE_EMAIL)) {
                send_json(422, ['success' => false, 'error' => 'The optional email address provided has an invalid format.']);
            }
            $cleanEmail = strtolower($authorEmail);
            $parts = explode('@', $cleanEmail);
            $domain = $parts[1] ?? '';
            $reservedEmails = ['admin@stonekrusher.com', 'admin@cwqv.com', 'sales@cwqv.com', 'admin@happymachinery.com'];
            if (in_array($cleanEmail, $reservedEmails, true)) {
                send_json(403, ['success' => false, 'error' => 'Official team email addresses cannot be used in guest comments without authentication.']);
            }
            $authorEmail = $cleanEmail;
        } else {
            $authorEmail = null;
        }

        $emailVerified = false;
        $photoUrl = null;
        if (!empty($input['photo_url']) && is_string($input['photo_url'])) {
            $candidatePhoto = trim($input['photo_url']);
            if (str_starts_with($candidatePhoto, 'data:image/svg+xml') || str_starts_with($candidatePhoto, 'https://')) {
                $photoUrl = $candidatePhoto;
            }
        }
        $uid = null;
    }

    $publicEmail = ($showPublicEmail && !empty($authorEmail)) ? $authorEmail : null;
    $commentId = 'c-' . round(microtime(true) * 1000) . '-' . bin2hex(random_bytes(3));
    $userAgent = mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 250);

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO blog_comments (
                    id, post_slug, uid, display_name, author_email, public_email,
                    email_verified, is_guest, photo_url, content, moderation_status,
                    ip_address, user_agent, created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Approved', ?, ?, ?, ?
                )
            ");
            $stmt->execute([
                $commentId,
                $slug,
                $uid,
                $displayName,
                $authorEmail,
                $publicEmail,
                $emailVerified ? 1 : 0,
                $isGuest ? 1 : 0,
                $photoUrl,
                $sanitizedContent,
                $ip,
                $userAgent,
                $now,
                $now
            ]);
        } catch (Exception $e) {
            // In case DB insert fails, log and proceed with JSON response
            error_log('Comment DB insert error: ' . $e->getMessage());
        }
    }

    $createdDate = date('M j, Y', $now);
    $responseComment = [
        'id' => $commentId,
        'commentId' => $commentId,
        'blogSlug' => $slug,
        'postId' => $slug,
        'uid' => $uid,
        'authorName' => $displayName,
        'displayName' => $displayName,
        'authorEmail' => $publicEmail,
        'publicEmail' => $publicEmail,
        'showPublicEmail' => !empty($publicEmail),
        'emailVerified' => $emailVerified,
        'isGuest' => $isGuest,
        'avatar' => $photoUrl,
        'photoURL' => $photoUrl,
        'content' => $sanitizedContent,
        'text' => $sanitizedContent,
        'date' => $createdDate,
        'createdAt' => date('c', $now),
        'status' => 'Approved',
        'moderationStatus' => 'Approved'
    ];

    send_json(201, [
        'success' => true,
        'message' => 'Comment published successfully.',
        'comment' => $responseComment
    ]);
}

send_json(405, ['success' => false, 'error' => 'Method not allowed.']);
