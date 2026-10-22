<?php
// =========================================================
// StoneKrusher CMS - Enterprise Security & Session Manager
// =========================================================

require_once __DIR__ . '/db.php';

class Security {
    private static $csrfSecretKey = 'sk_csrf_salt_k98q21#m!z9';

    /**
     * Send standard modern security headers
     */
    public static function sendSecurityHeaders() {
        if (headers_sent()) return;
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: SAMEORIGIN');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
        header("Content-Security-Policy: default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:;");
    }

    /**
     * Resolve verified client IP with trusted proxy safety
     */
    public static function getClientIp() {
        $remoteAddr = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';

        // Check if behind Cloudflare or trusted reverse proxy
        if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
            $cfIp = trim($_SERVER['HTTP_CF_CONNECTING_IP']);
            if (filter_var($cfIp, FILTER_VALIDATE_IP)) {
                return $cfIp;
            }
        }

        // For X-Forwarded-For, only accept if REMOTE_ADDR is private/local loopback
        $isLocalOrProxy = filter_var(
            $remoteAddr,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
        ) === false;

        if ($isLocalOrProxy && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
            $firstIp = trim($ips[0]);
            if (filter_var($firstIp, FILTER_VALIDATE_IP)) {
                return $firstIp;
            }
        }

        return filter_var($remoteAddr, FILTER_VALIDATE_IP) ? $remoteAddr : '127.0.0.1';
    }

    /**
     * Fetch the active block row for an IP address (null when not blocked)
     */
    public static function getIpBlock($ip) {
        $pdo = get_cms_pdo();
        if (!$pdo) return null;

        $now = time();
        $stmt = $pdo->prepare("SELECT * FROM cms_security_blocks WHERE type = 'ip' AND target = ? AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at DESC");
        $stmt->execute([$ip, $now]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /**
     * Check if an IP address is blocked
     */
    public static function isIpBlocked($ip) {
        return self::getIpBlock($ip) !== null;
    }

    /**
     * Number of failed sign-ins from this device (IP) that count toward an automatic block.
     * The counter restarts after a successful sign-in, after a block was applied
     * and after an administrator lifts a block.
     */
    public static function countIpFailedLogins($ip) {
        $pdo = get_cms_pdo();
        if (!$pdo) return 0;

        $bound = time() - 86400; // 24 hour rolling window

        $stmt = $pdo->prepare("SELECT MAX(created_at) FROM cms_login_attempts WHERE ip_address = ? AND success = 1");
        $stmt->execute([$ip]);
        $bound = max($bound, (int)$stmt->fetchColumn());

        $stmt = $pdo->prepare("SELECT MAX(created_at) FROM cms_security_blocks WHERE type = 'ip' AND target = ?");
        $stmt->execute([$ip]);
        $bound = max($bound, (int)$stmt->fetchColumn());

        $stmt = $pdo->prepare("SELECT MAX(created_at) FROM cms_audit_logs WHERE action = 'security.ip_unblocked' AND details_json LIKE ?");
        $stmt->execute(['%"target":' . json_encode($ip) . '%']);
        $bound = max($bound, (int)$stmt->fetchColumn());

        $stmt = $pdo->prepare("SELECT COUNT(*) FROM cms_login_attempts WHERE ip_address = ? AND success = 0 AND created_at > ?");
        $stmt->execute([$ip, $bound]);
        return (int)$stmt->fetchColumn();
    }

    /**
     * Failed sign-ins from one device that trigger an automatic IP block (default 10)
     */
    public static function getIpBlockThreshold() {
        $n = (int)self::getSetting('ip_block_failed_logins', 10);
        return $n >= 3 ? $n : 10;
    }

    /**
     * Automatically block a device after too many failed sign-ins.
     * Duration comes from the `ip_block_hours` setting (default 24, 0 = until an admin lifts it).
     */
    public static function blockIpAutomatically($ip, $failedCount) {
        $pdo = get_cms_pdo();
        if (!$pdo) return null;

        $now = time();
        $hours = (int)self::getSetting('ip_block_hours', 24);
        $expiresAt = $hours > 0 ? $now + ($hours * 3600) : null;
        $id = 'blk-' . bin2hex(random_bytes(8));

        $stmt = $pdo->prepare("INSERT INTO cms_security_blocks (id, type, target, reason, created_by, expires_at, created_at) VALUES (?, 'ip', ?, ?, 'system', ?, ?)");
        $stmt->execute([$id, $ip, "Automatic block: {$failedCount} consecutive failed sign-in attempts", $expiresAt, $now]);

        self::logAudit(null, 'security.ip_auto_blocked', 'block', $id, [
            'target' => $ip,
            'failed_attempts' => $failedCount,
            'expires_at' => $expiresAt
        ]);

        return $expiresAt;
    }

    /**
     * Output the JSON body shown to a blocked device and stop the request
     */
    public static function denyBlockedIp($ip) {
        $block = self::getIpBlock($ip);
        $until = $block && !empty($block['expires_at']) ? (int)$block['expires_at'] : null;
        http_response_code(403);
        echo json_encode([
            'error' => 'This device has been blocked after too many failed sign-in attempts.',
            'blocked' => true,
            'blocked_until' => $until,
            'retry_after' => $until ? max(0, $until - time()) : null,
            'attempts_limit' => self::getIpBlockThreshold(),
            'permanent' => $block ? empty($block['expires_at']) : false
        ]);
        exit;
    }

    /**
     * Progressive rate-limiting and delay to slow brute force
     */
    public static function checkRateLimit($ip) {
        $pdo = get_cms_pdo();
        if (!$pdo) return true;

        $window = time() - (15 * 60); // 15 minute window
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM cms_login_attempts WHERE ip_address = ? AND success = 0 AND created_at > ?");
        $stmt->execute([$ip, $window]);
        $failedCount = (int)$stmt->fetchColumn();

        if ($failedCount >= 30) {
            // High automated burst from single IP: temporary block
            http_response_code(429);
            echo json_encode(['error' => 'Too many login requests. Please try again later.']);
            exit;
        }

        if ($failedCount > 5) {
            // Progressive micro-delay (50ms to 500ms)
            $delayMicroseconds = min(500000, ($failedCount - 5) * 50000);
            usleep($delayMicroseconds);
        }

        return true;
    }

    /**
     * Check CMS setting value
     */
    public static function getSetting($key, $default = null) {
        $pdo = get_cms_pdo();
        if (!$pdo) return $default;

        $stmt = $pdo->prepare("SELECT setting_value FROM cms_settings WHERE setting_key = ?");
        $stmt->execute([$key]);
        $val = $stmt->fetchColumn();
        return ($val !== false) ? $val : $default;
    }

    /**
     * Google OAuth Web Client ID (public value). Priority: CMS setting, constant, environment.
     */
    public static function getGoogleClientId() {
        $id = trim((string)self::getSetting('google_client_id', ''));
        if ($id === '' && defined('GOOGLE_CLIENT_ID')) {
            $id = trim((string)GOOGLE_CLIENT_ID);
        }
        if ($id === '') {
            $id = trim((string)(getenv('GOOGLE_CLIENT_ID') ?: ''));
        }
        return self::isValidGoogleClientId($id) ? $id : '';
    }

    public static function isValidGoogleClientId($id) {
        return is_string($id) && (bool)preg_match('/^[0-9A-Za-z._-]+\.apps\.googleusercontent\.com$/', $id);
    }

    /**
     * Validate the claims of a Google ID token (after Google has verified the signature).
     * Returns null when valid, otherwise a short machine-readable failure reason.
     */
    public static function validateGoogleClaims($claims, $clientId, $now = null) {
        $now = $now ?? time();
        if (!is_array($claims)) return 'invalid_claims';
        if ($clientId === '' || ($claims['aud'] ?? '') !== $clientId) return 'audience_mismatch';
        if (!in_array($claims['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true)) return 'issuer_mismatch';
        if ((int)($claims['exp'] ?? 0) <= $now) return 'token_expired';
        $verified = $claims['email_verified'] ?? false;
        if (!($verified === true || $verified === 'true' || $verified === 1 || $verified === '1')) return 'email_not_verified';
        if (empty($claims['sub']) || empty($claims['email']) || !filter_var($claims['email'], FILTER_VALIDATE_EMAIL)) return 'missing_identity';
        return null;
    }

    /**
     * Ask Google to verify an ID token's signature and return its claims (null on failure).
     */
    public static function fetchGoogleTokenClaims($idToken) {
        if (!is_string($idToken) || $idToken === '' || strlen($idToken) > 4096 || !preg_match('/^[A-Za-z0-9._-]+$/', $idToken)) {
            return null;
        }
        $url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode($idToken);
        $body = false;

        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 8,
                CURLOPT_CONNECTTIMEOUT => 5,
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_SSL_VERIFYHOST => 2
            ]);
            $body = curl_exec($ch);
            $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            if ($status !== 200) $body = false;
        } else {
            $context = stream_context_create(['http' => ['timeout' => 8, 'ignore_errors' => false]]);
            $body = @file_get_contents($url, false, $context);
        }

        if ($body === false || $body === '') return null;
        $claims = json_decode($body, true);
        return is_array($claims) ? $claims : null;
    }

    /**
     * Record a login attempt and apply lockout policy.
     * For failed attempts returns ['blocked' => bool, 'remaining' => int, 'limit' => int, 'blocked_until' => ?int]
     * so the caller can tell the user how many tries are left before the device is blocked.
     */
    public static function recordLoginAttempt($identifier, $ip, $userAgent, $success, $failureReason = null, $userRow = null) {
        $pdo = get_cms_pdo();
        if (!$pdo) return null;

        $now = time();
        $attemptId = 'att-' . bin2hex(random_bytes(16));

        $stmt = $pdo->prepare("INSERT INTO cms_login_attempts (id, identifier, ip_address, user_agent, success, failure_reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $attemptId,
            substr($identifier, 0, 255),
            $ip,
            substr($userAgent, 0, 500),
            $success ? 1 : 0,
            $failureReason,
            $now
        ]);

        if ($success && $userRow) {
            // Reset failed counter
            $resetStmt = $pdo->prepare("UPDATE cms_users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = ?, updated_at = ? WHERE id = ?");
            $resetStmt->execute([$now, $now, $userRow['id']]);

            self::logAudit($userRow['id'], 'user.login_success', 'user', $userRow['id'], ['ip' => $ip]);
        } elseif (!$success && $userRow) {
            $maxFailed = (int)self::getSetting('max_failed_logins', 10);
            $lockoutMinutes = (int)self::getSetting('lockout_duration_minutes', 15);
            $newAttempts = ($userRow['failed_login_attempts'] ?? 0) + 1;

            if ($newAttempts >= $maxFailed) {
                $lockedUntil = $now + ($lockoutMinutes * 60);
                $lockStmt = $pdo->prepare("UPDATE cms_users SET failed_login_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?");
                $lockStmt->execute([$newAttempts, $lockedUntil, $now, $userRow['id']]);

                self::logAudit($userRow['id'], 'security.account_locked', 'user', $userRow['id'], [
                    'ip' => $ip,
                    'failed_attempts' => $newAttempts,
                    'lockout_duration_minutes' => $lockoutMinutes,
                    'locked_until' => $lockedUntil
                ]);
            } else {
                $upStmt = $pdo->prepare("UPDATE cms_users SET failed_login_attempts = ?, updated_at = ? WHERE id = ?");
                $upStmt->execute([$newAttempts, $now, $userRow['id']]);
            }

            self::logAudit(null, 'security.login_failed', 'auth', $identifier, [
                'ip' => $ip,
                'reason' => $failureReason,
                'user_id' => $userRow['id']
            ]);
        } else {
            self::logAudit(null, 'security.login_failed_unknown_user', 'auth', $identifier, [
                'ip' => $ip,
                'reason' => $failureReason
            ]);
        }

        if ($success) return null;

        // Device-level defense: block this IP once it reaches the failed-login threshold
        $limit = self::getIpBlockThreshold();
        $failedCount = self::countIpFailedLogins($ip);
        if ($failedCount >= $limit) {
            $expiresAt = self::blockIpAutomatically($ip, $failedCount);
            return ['blocked' => true, 'remaining' => 0, 'limit' => $limit, 'blocked_until' => $expiresAt];
        }
        return ['blocked' => false, 'remaining' => $limit - $failedCount, 'limit' => $limit, 'blocked_until' => null];
    }

    /**
     * Create an authenticated session
     */
    public static function createSession($user, $ip, $userAgent, $remember = false) {
        $pdo = get_cms_pdo();
        if (!$pdo) return null;

        $token = bin2hex(random_bytes(32)); // 64 hex characters
        $now = time();
        $hours = $remember ? (30 * 24) : (int)self::getSetting('session_lifetime_hours', 8);
        $expiresAt = $now + ($hours * 3600);

        $stmt = $pdo->prepare("INSERT INTO cms_sessions (id, user_id, ip_address, user_agent, last_activity, expires_at, is_revoked, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)");
        $stmt->execute([
            $token,
            $user['id'],
            $ip,
            substr($userAgent, 0, 500),
            $now,
            $expiresAt,
            $now
        ]);

        $csrfToken = self::generateCsrfToken($token);

        // Set HttpOnly cookie if headers not yet sent
        if (!headers_sent()) {
            $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['SERVER_PORT'] ?? '') == 443;
            setcookie('cms_token', $token, [
                'expires' => $expiresAt,
                'path' => '/',
                'domain' => '',
                'secure' => $isHttps,
                'httponly' => true,
                'samesite' => 'Lax'
            ]);
        }

        return [
            'token' => $token,
            'csrf_token' => $csrfToken,
            'expires_at' => $expiresAt,
            'user' => [
                'id' => $user['id'],
                'username' => $user['username'],
                'email' => $user['email'],
                'full_name' => $user['full_name'],
                'role' => $user['role'],
                'status' => $user['status'],
                'google_email' => $user['google_email'] ?? null,
                'google_linked_at' => $user['google_linked_at'] ?? null,
                'is_google_linked' => !empty($user['google_id']) || !empty($user['google_email'])
            ]
        ];
    }

    /**
     * Generate CSRF token tied to session
     */
    public static function generateCsrfToken($sessionToken) {
        return hash_hmac('sha256', $sessionToken, self::$csrfSecretKey);
    }

    /**
     * Validate session and load current user + permissions
     */
    public static function getCurrentUser() {
        $pdo = get_cms_pdo();
        if (!$pdo) return null;

        $token = null;
        if (!empty($_COOKIE['cms_token'])) {
            $token = $_COOKIE['cms_token'];
        } elseif (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
            if (preg_match('/Bearer\s+(\S+)/i', $_SERVER['HTTP_AUTHORIZATION'], $matches)) {
                $token = $matches[1];
            }
        } elseif (!empty($_SERVER['HTTP_X_CMS_TOKEN'])) {
            $token = $_SERVER['HTTP_X_CMS_TOKEN'];
        }

        if (!$token || strlen($token) !== 64) {
            return null;
        }

        $now = time();
        $stmt = $pdo->prepare("SELECT s.*, u.username, u.email, u.full_name, u.role, u.status, u.locked_until,
                                       u.google_id, u.google_email, u.google_linked_at
                               FROM cms_sessions s
                               JOIN cms_users u ON s.user_id = u.id
                               WHERE s.id = ? AND s.is_revoked = 0 AND s.expires_at > ?");
        $stmt->execute([$token, $now]);
        $row = $stmt->fetch();

        if (!$row) {
            return null;
        }

        // Check if user account is disabled or locked
        if ($row['status'] !== 'active') {
            return null;
        }
        if (!empty($row['locked_until']) && $row['locked_until'] > $now) {
            return null;
        }

        // Idle timeout check (2 hours)
        $idleWindow = 2 * 3600;
        if (($now - $row['last_activity']) > $idleWindow) {
            // Expire session
            $pdo->prepare("UPDATE cms_sessions SET is_revoked = 1 WHERE id = ?")->execute([$token]);
            return null;
        }

        // Update last activity
        $pdo->prepare("UPDATE cms_sessions SET last_activity = ? WHERE id = ?")->execute([$now, $token]);

        // Load permissions for role
        $roleStmt = $pdo->prepare("SELECT permissions, display_name FROM cms_roles WHERE name = ?");
        $roleStmt->execute([$row['role']]);
        $roleData = $roleStmt->fetch();
        $permissions = [];
        if ($roleData && !empty($roleData['permissions'])) {
            $permissions = json_decode($roleData['permissions'], true) ?: [];
        }

        return [
            'session_id' => $token,
            'csrf_token' => self::generateCsrfToken($token),
            'id' => $row['user_id'],
            'username' => $row['username'],
            'email' => $row['email'],
            'full_name' => $row['full_name'],
            'role' => $row['role'],
            'role_display' => $roleData['display_name'] ?? $row['role'],
            'permissions' => $permissions,
            'google_email' => $row['google_email'] ?? null,
            'google_linked_at' => $row['google_linked_at'] ?? null,
            'is_google_linked' => !empty($row['google_id']) || !empty($row['google_email'])
        ];
    }

    /**
     * Check if user has specific permission
     */
    public static function hasPermission($user, $requiredPermission) {
        if (!$user) return false;
        if ($user['role'] === 'super_admin') return true;

        $perms = $user['permissions'] ?? [];
        if (in_array('*', $perms)) return true;
        if (in_array($requiredPermission, $perms)) return true;

        // Check wildcard category like posts.*
        $parts = explode('.', $requiredPermission);
        if (count($parts) === 2) {
            $wildcard = $parts[0] . '.*';
            if (in_array($wildcard, $perms)) return true;
        }

        return false;
    }

    /**
     * Require permission or return 403 Forbidden
     */
    public static function requirePermission($user, $requiredPermission) {
        if (!self::hasPermission($user, $requiredPermission)) {
            http_response_code(403);
            echo json_encode(['error' => "Forbidden: Missing permission [{$requiredPermission}]"]);
            exit;
        }
    }

    /**
     * Require valid session or return 401 Unauthorized
     */
    public static function requireAuth() {
        $user = self::getCurrentUser();
        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized. Please log in.']);
            exit;
        }
        return $user;
    }

    /**
     * Validate CSRF token for state-changing requests (POST, PUT, DELETE, PATCH)
     */
    public static function validateCsrf($currentUser) {
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        if (in_array($method, ['GET', 'HEAD', 'OPTIONS'])) {
            return true;
        }

        $headerCsrf = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (empty($headerCsrf) && !empty($_POST['_csrf'])) {
            $headerCsrf = $_POST['_csrf'];
        }

        $expectedCsrf = $currentUser['csrf_token'] ?? '';

        if (empty($headerCsrf) || !hash_equals($expectedCsrf, $headerCsrf)) {
            http_response_code(403);
            echo json_encode(['error' => 'Invalid or missing CSRF token']);
            exit;
        }

        return true;
    }

    /**
     * Audit log recorder
     */
    public static function logAudit($userId, $action, $resourceType, $resourceId, $details = null) {
        $pdo = get_cms_pdo();
        if (!$pdo) return;

        $id = 'aud-' . bin2hex(random_bytes(16));
        $now = time();
        $ip = self::getClientIp();
        $detailsJson = $details ? json_encode($details, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : null;

        $stmt = $pdo->prepare("INSERT INTO cms_audit_logs (id, user_id, action, resource_type, resource_id, details_json, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $id,
            $userId,
            $action,
            $resourceType,
            (string)$resourceId,
            $detailsJson,
            $ip,
            $now
        ]);
    }
}
