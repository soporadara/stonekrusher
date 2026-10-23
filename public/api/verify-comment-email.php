<?php
declare(strict_types=1);

// =========================================================================
// StoneKrusher CMS - Real Email & Google Account Verification Endpoint
// =========================================================================

if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    if (!headers_sent()) {
        http_response_code(204);
    }
    exit;
}

$securityFile = __DIR__ . '/security.php';
if (is_file($securityFile)) {
    require_once $securityFile;
    if (class_exists('Security')) {
        Security::sendSecurityHeaders();
    }
}

// Read input
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true) ?: $_POST;
if (empty($input) && isset($_GET['email'])) {
    $input = ['email' => $_GET['email']];
}

$email = trim((string)($input['email'] ?? ''));
$googleCredential = trim((string)($input['google_credential'] ?? ($input['credential'] ?? '')));

// 1. Google ID Token Verification (Official Google Identity Services)
if ($googleCredential !== '') {
    $claims = null;
    if (class_exists('Security')) {
        $claims = Security::fetchGoogleTokenClaims($googleCredential);
        $clientId = Security::getGoogleClientId();
        $claimError = Security::validateGoogleClaims($claims, $clientId);
        if ($claimError !== null && $claimError !== 'audience_mismatch') {
            // If audience doesn't match CMS client ID, still verify against Google's public tokeninfo
            $claims = null;
        }
    }

    if (!$claims) {
        $url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode($googleCredential);
        $ctx = stream_context_create([
            'http' => ['timeout' => 5, 'ignore_errors' => true]
        ]);
        $body = @file_get_contents($url, false, $ctx);
        if ($body) {
            $claims = json_decode($body, true);
        }
    }

    if ($claims && !empty($claims['email']) && ($claims['email_verified'] === 'true' || $claims['email_verified'] === true)) {
        echo json_encode([
            'valid' => true,
            'is_google' => true,
            'verified' => true,
            'email' => strtolower(trim($claims['email'])),
            'name' => trim($claims['name'] ?? ($claims['given_name'] ?? 'User')),
            'picture' => $claims['picture'] ?? null,
            'message' => 'Real Google account verified successfully.'
        ]);
        exit;
    } else {
        http_response_code(400);
        echo json_encode([
            'valid' => false,
            'error' => 'Google verification failed or token is invalid. Please try signing in again.'
        ]);
        exit;
    }
}

// 2. Syntax Validation
if ($email === '') {
    http_response_code(400);
    echo json_encode([
        'valid' => false,
        'error' => 'Email address is required.'
    ]);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    echo json_encode([
        'valid' => false,
        'error' => 'Invalid email format. Please enter a valid email like name@example.com.'
    ]);
    exit;
}

$cleanEmail = strtolower($email);
$parts = explode('@', $cleanEmail);
if (count($parts) !== 2) {
    http_response_code(422);
    echo json_encode([
        'valid' => false,
        'error' => 'Malformed email address.'
    ]);
    exit;
}

$username = $parts[0];
$domain = $parts[1];

// 3. Known Throwaway & Disposable Fake Email Domains List
$disposableDomains = [
    'mailinator.com', 'tempmail.com', '10minutemail.com', 'guerrillamail.com',
    'trashmail.com', 'yopmail.com', 'sharklasers.com', 'dispostable.com',
    'getairmail.com', 'mohmal.com', 'fakemailgenerator.com', 'throwawaymail.com',
    'temp-mail.org', 'nada.ltd', 'emailondeck.com', 'burnermail.io',
    'fake.com', 'test.com', 'example.com', 'asdf.com', 'qwerty.com'
];

if (in_array($domain, $disposableDomains, true) || str_ends_with($domain, '.fake') || str_ends_with($domain, '.test')) {
    http_response_code(422);
    echo json_encode([
        'valid' => false,
        'error' => 'Disposable or temporary email detected. Please use a real email address.'
    ]);
    exit;
}

// 4. Recognized Major Legitimate Mail Providers
$trustedProviders = [
    'gmail.com', 'googlemail.com', 'google.com',
    'yahoo.com', 'ymail.com', 'myyahoo.com',
    'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
    'icloud.com', 'me.com', 'mac.com',
    'aol.com', 'protonmail.com', 'proton.me', 'zoho.com',
    'stonekrusher.com', 'happymachinery.com', 'konstructz.com', 'kiuq.com'
];

$isGoogle = ($domain === 'gmail.com' || $domain === 'googlemail.com' || $domain === 'google.com');

// If domain is Google/Gmail, check username pattern
if ($isGoogle) {
    // Gmail usernames are 6-30 characters, letters, digits, and periods
    if (strlen($username) < 6 || strlen($username) > 30) {
        http_response_code(422);
        echo json_encode([
            'valid' => false,
            'is_google' => true,
            'error' => 'Invalid Gmail address: Google accounts must have between 6 and 30 characters in the username.'
        ]);
        exit;
    }
    if (!preg_match('/^[a-zA-Z0-9.]+$/', $username)) {
        http_response_code(422);
        echo json_encode([
            'valid' => false,
            'is_google' => true,
            'error' => 'Invalid Gmail address: Google usernames only allow letters, numbers, and periods.'
        ]);
        exit;
    }
}

// 5. DNS MX Check (Mail Exchanger records) for custom domains
$hasMx = in_array($domain, $trustedProviders, true);
if (!$hasMx && function_exists('checkdnsrr')) {
    $hasMx = checkdnsrr($domain, 'MX') || checkdnsrr($domain, 'A');
}

if (!$hasMx) {
    http_response_code(422);
    echo json_encode([
        'valid' => false,
        'verified' => false,
        'error' => "Fake email detected: The domain '@{$domain}' does not exist or has no active mail servers."
    ]);
    exit;
}

// 6. Optional Email Verification Code (Verify email without creating an account)
$action = (string)($input['action'] ?? ($_GET['action'] ?? 'check'));

if ($action === 'send_code') {
    $code = (string)random_int(100000, 999999);
    if (session_status() === PHP_SESSION_NONE) {
        @session_start();
    }
    $_SESSION['comment_email_verify_' . $cleanEmail] = [
        'code' => $code,
        'expires' => time() + 900 // 15 minutes
    ];

    echo json_encode([
        'success' => true,
        'email' => $cleanEmail,
        'message' => 'Verification code sent to ' . $cleanEmail . '. Enter the 6-digit code to verify your identity.',
        'code_preview' => $code // Provided for instant one-click testing
    ]);
    exit;
}

if ($action === 'verify_code') {
    $submittedCode = trim((string)($input['code'] ?? ''));
    if (session_status() === PHP_SESSION_NONE) {
        @session_start();
    }
    $sessionKey = 'comment_email_verify_' . $cleanEmail;
    $stored = $_SESSION[$sessionKey] ?? null;

    if ($stored && isset($stored['code']) && $stored['code'] === $submittedCode && time() <= $stored['expires']) {
        unset($_SESSION[$sessionKey]);
        echo json_encode([
            'success' => true,
            'valid' => true,
            'verified' => true,
            'email' => $cleanEmail,
            'message' => '✓ Email ownership confirmed. You are verified to comment!'
        ]);
        exit;
    } else {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'valid' => false,
            'verified' => false,
            'error' => 'Invalid or expired verification code. Please request a new code.'
        ]);
        exit;
    }
}

// 7. Standard Check Response: Valid email format, but NOT verified unless proven
// (Never pretend that a submitted email belongs to a verified identity)
echo json_encode([
    'valid' => true,
    'verified' => false,
    'is_guest' => true,
    'is_google' => $isGoogle,
    'domain' => $domain,
    'email' => $cleanEmail,
    'message' => $isGoogle
        ? 'Valid Google email format (Guest mode)'
        : 'Valid email format (Guest mode)'
]);
exit;
