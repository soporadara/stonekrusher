<?php
// =========================================================
// StoneKrusher CMS - Authentication Endpoints
// =========================================================

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/security.php';

Security::sendSecurityHeaders();

$action = $_GET['action'] ?? ($_POST['action'] ?? 'me');
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$ip = Security::getClientIp();
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';

// Check if client IP is banned
if (Security::isIpBlocked($ip)) {
    Security::denyBlockedIp($ip);
}

/**
 * Send a failed-sign-in response that tells the user how many tries remain
 * (or that the device is now blocked after too many failures).
 */
function respond_login_failure($status, $message, $attempt) {
    if (is_array($attempt) && !empty($attempt['blocked'])) {
        Security::denyBlockedIp(Security::getClientIp());
    }
    http_response_code($status);
    $body = ['error' => $message];
    if (is_array($attempt)) {
        $body['attempts_remaining'] = (int)$attempt['remaining'];
        $body['attempts_limit'] = (int)$attempt['limit'];
    }
    echo json_encode($body);
    exit;
}

// Read JSON input if sent
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true) ?: $_POST;

switch ($action) {
    case 'login':
        if ($method !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed.']);
            exit;
        }

        Security::checkRateLimit($ip);

        $identifier = trim($input['identifier'] ?? ($input['username'] ?? ($input['email'] ?? '')));
        $password = (string)($input['password'] ?? '');
        $remember = !empty($input['remember']);

        if (empty($identifier) || empty($password)) {
            http_response_code(400);
            echo json_encode(['error' => 'Username/email and password are required.']);
            exit;
        }

        $pdo = get_cms_pdo();
        $stmt = $pdo->prepare("SELECT * FROM cms_users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)");
        $stmt->execute([$identifier, $identifier]);
        $user = $stmt->fetch();

        $now = time();

        if ($user) {
            // Check if locked
            if (!empty($user['locked_until']) && $user['locked_until'] > $now) {
                $waitMinutes = ceil(($user['locked_until'] - $now) / 60);
                http_response_code(423);
                echo json_encode([
                    'error' => "Account temporarily locked due to consecutive failed attempts. Try again in {$waitMinutes} minute(s)."
                ]);
                exit;
            }

            // Check if active
            if ($user['status'] !== 'active') {
                http_response_code(403);
                echo json_encode([
                    'error' => 'This account has been deactivated. Please contact an administrator.'
                ]);
                exit;
            }

            // Verify password
            if (password_verify($password, $user['password_hash'])) {
                Security::recordLoginAttempt($identifier, $ip, $userAgent, true, null, $user);
                $sessionData = Security::createSession($user, $ip, $userAgent, $remember);

                echo json_encode([
                    'success' => true,
                    'message' => 'Login successful',
                    'token' => $sessionData['token'],
                    'csrf_token' => $sessionData['csrf_token'],
                    'expires_at' => $sessionData['expires_at'],
                    'user' => $sessionData['user']
                ]);
                exit;
            } else {
                // Failed password
                $attempt = Security::recordLoginAttempt($identifier, $ip, $userAgent, false, 'invalid_password', $user);
            }
        } else {
            // User not found - record attempt without revealing non-existence
            $attempt = Security::recordLoginAttempt($identifier, $ip, $userAgent, false, 'user_not_found', null);
        }

        // Generic error to prevent user enumeration
        respond_login_failure(401, 'Invalid email/username or password.', $attempt ?? null);

    case 'google_config':
        // Public: the OAuth Client ID is not a secret and is needed by the browser to render the button.
        $googleClientId = Security::getGoogleClientId();
        echo json_encode([
            'enabled' => $googleClientId !== '',
            'client_id' => $googleClientId
        ]);
        exit;

    case 'google_login':
        if ($method !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed.']);
            exit;
        }

        Security::checkRateLimit($ip);

        $googleClientId = Security::getGoogleClientId();
        if ($googleClientId === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Google sign-in is not configured for this site.']);
            exit;
        }

        $credential = (string)($input['credential'] ?? '');
        $claims = Security::fetchGoogleTokenClaims($credential);
        $claimError = Security::validateGoogleClaims($claims, $googleClientId);

        if ($claimError !== null) {
            $attempt = Security::recordLoginAttempt('google-sign-in', $ip, $userAgent, false, 'google_' . $claimError, null);
            respond_login_failure(401, 'Google sign-in could not be verified. Please try again.', $attempt);
        }

        $googleEmail = strtolower(trim($claims['email']));
        $pdo = get_cms_pdo();
        $stmt = $pdo->prepare("SELECT * FROM cms_users WHERE LOWER(email) = LOWER(?)");
        $stmt->execute([$googleEmail]);
        $user = $stmt->fetch();
        $now = time();

        if (!$user) {
            $attempt = Security::recordLoginAttempt($googleEmail, $ip, $userAgent, false, 'google_no_matching_account', null);
            respond_login_failure(403, 'This Google account is not authorized for the CMS. Ask an administrator to add your email address first.', $attempt);
        }

        if (!empty($user['locked_until']) && $user['locked_until'] > $now) {
            $waitMinutes = ceil(($user['locked_until'] - $now) / 60);
            http_response_code(423);
            echo json_encode([
                'error' => "Account temporarily locked. Try again in {$waitMinutes} minute(s)."
            ]);
            exit;
        }

        if ($user['status'] !== 'active') {
            Security::recordLoginAttempt($googleEmail, $ip, $userAgent, false, 'google_account_inactive', $user);
            http_response_code(403);
            echo json_encode(['error' => 'This account has been deactivated. Please contact an administrator.']);
            exit;
        }

        Security::recordLoginAttempt($googleEmail, $ip, $userAgent, true, null, $user);
        Security::logAudit($user['id'], 'user.login_google', 'user', $user['id'], ['ip' => $ip]);
        $sessionData = Security::createSession($user, $ip, $userAgent, !empty($input['remember']));

        echo json_encode([
            'success' => true,
            'message' => 'Login successful',
            'token' => $sessionData['token'],
            'csrf_token' => $sessionData['csrf_token'],
            'expires_at' => $sessionData['expires_at'],
            'user' => $sessionData['user']
        ]);
        exit;

    case 'me':
        $currentUser = Security::getCurrentUser();
        if (!$currentUser) {
            http_response_code(401);
            echo json_encode([
                'authenticated' => false,
                'user' => null
            ]);
            exit;
        }

        echo json_encode([
            'authenticated' => true,
            'user' => [
                'id' => $currentUser['id'],
                'username' => $currentUser['username'],
                'email' => $currentUser['email'],
                'full_name' => $currentUser['full_name'],
                'role' => $currentUser['role'],
                'role_display' => $currentUser['role_display'],
                'permissions' => $currentUser['permissions']
            ],
            'csrf_token' => $currentUser['csrf_token']
        ]);
        exit;

    case 'logout':
        $currentUser = Security::getCurrentUser();
        if ($currentUser) {
            $pdo = get_cms_pdo();
            $pdo->prepare("UPDATE cms_sessions SET is_revoked = 1 WHERE id = ?")->execute([$currentUser['session_id']]);
            Security::logAudit($currentUser['id'], 'user.logout', 'session', $currentUser['session_id']);
        }

        // Expire cookie
        setcookie('cms_token', '', [
            'expires' => time() - 3600,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax'
        ]);

        echo json_encode([
            'success' => true,
            'message' => 'Logged out successfully.'
        ]);
        exit;

    case 'change_password':
        if ($method !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed.']);
            exit;
        }

        $currentUser = Security::requireAuth();
        Security::validateCsrf($currentUser);

        $currentPass = (string)($input['current_password'] ?? '');
        $newPass = (string)($input['new_password'] ?? '');

        if (strlen($newPass) < 8) {
            http_response_code(400);
            echo json_encode(['error' => 'New password must be at least 8 characters long.']);
            exit;
        }

        $pdo = get_cms_pdo();
        $stmt = $pdo->prepare("SELECT password_hash FROM cms_users WHERE id = ?");
        $stmt->execute([$currentUser['id']]);
        $currentHash = $stmt->fetchColumn();

        if (!password_verify($currentPass, $currentHash)) {
            http_response_code(400);
            echo json_encode(['error' => 'Current password is incorrect.']);
            exit;
        }

        $newHash = password_hash($newPass, PASSWORD_DEFAULT);
        $pdo->prepare("UPDATE cms_users SET password_hash = ?, updated_at = ? WHERE id = ?")->execute([
            $newHash,
            time(),
            $currentUser['id']
        ]);

        // Revoke other sessions
        $pdo->prepare("UPDATE cms_sessions SET is_revoked = 1 WHERE user_id = ? AND id != ?")->execute([
            $currentUser['id'],
            $currentUser['session_id']
        ]);

        Security::logAudit($currentUser['id'], 'user.password_change', 'user', $currentUser['id']);

        echo json_encode([
            'success' => true,
            'message' => 'Password changed successfully.'
        ]);
        exit;

    case 'forgot_password':
        if ($method !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed.']);
            exit;
        }

        $email = trim($input['email'] ?? '');
        $pdo = get_cms_pdo();
        $stmt = $pdo->prepare("SELECT id FROM cms_users WHERE LOWER(email) = LOWER(?) AND status = 'active'");
        $stmt->execute([$email]);
        $uid = $stmt->fetchColumn();

        if ($uid) {
            $token = bin2hex(random_bytes(32));
            $now = time();
            $expiresAt = $now + 3600; // 1 hour

            $pdo->prepare("INSERT INTO cms_password_resets (token, user_id, expires_at, used, created_at) VALUES (?, ?, ?, 0, ?)")
                ->execute([$token, $uid, $expiresAt, $now]);

            Security::logAudit($uid, 'user.password_reset_requested', 'user', $uid, [
                'reset_token_hint' => substr($token, 0, 8) . '...'
            ]);
        }

        // Generic response
        echo json_encode([
            'success' => true,
            'message' => 'If this email is associated with an active account, a password reset link has been dispatched.'
        ]);
        exit;

    case 'reset_password':
        if ($method !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed.']);
            exit;
        }

        $token = trim($input['token'] ?? '');
        $newPass = (string)($input['new_password'] ?? '');

        if (strlen($newPass) < 8) {
            http_response_code(400);
            echo json_encode(['error' => 'Password must be at least 8 characters long.']);
            exit;
        }

        $pdo = get_cms_pdo();
        $now = time();
        $stmt = $pdo->prepare("SELECT user_id FROM cms_password_resets WHERE token = ? AND used = 0 AND expires_at > ?");
        $stmt->execute([$token, $now]);
        $userId = $stmt->fetchColumn();

        if (!$userId) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid or expired password reset link.']);
            exit;
        }

        $newHash = password_hash($newPass, PASSWORD_DEFAULT);
        $pdo->prepare("UPDATE cms_users SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?")
            ->execute([$newHash, $now, $userId]);

        $pdo->prepare("UPDATE cms_password_resets SET used = 1 WHERE token = ?")->execute([$token]);
        $pdo->prepare("UPDATE cms_sessions SET is_revoked = 1 WHERE user_id = ?")->execute([$userId]);

        Security::logAudit($userId, 'user.password_reset_completed', 'user', $userId);

        echo json_encode([
            'success' => true,
            'message' => 'Password has been successfully updated. You may now log in.'
        ]);
        exit;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action specified.']);
        exit;
}
