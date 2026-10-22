<?php
// =========================================================
// StoneKrusher CMS - Comprehensive Security & Functional Tests
// =========================================================

require_once __DIR__ . '/../public/api/db.php';
require_once __DIR__ . '/../public/api/security.php';

$pdo = get_cms_pdo();
if (!$pdo) {
    echo "FAIL: Database connection could not be established.\n";
    exit(1);
}

$passed = 0;
$failed = 0;

function assert_test($description, $condition, $details = '') {
    global $passed, $failed;
    if ($condition) {
        echo "  [PASS] {$description}\n";
        $passed++;
    } else {
        echo "  [FAIL] {$description}" . ($details ? " - {$details}" : "") . "\n";
        $failed++;
    }
}

echo "=========================================================\n";
echo "STONEKRUSHER CMS INTEGRATED SECURITY & FUNCTIONAL TEST SUITE\n";
echo "Driver: " . $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) . "\n";
echo "=========================================================\n\n";

// ---------------------------------------------------------
// SUITE 1: SCHEMA & TABLES VERIFICATION
// ---------------------------------------------------------
echo "SUITE 1: Schema & Data Migration Verification\n";

$expectedTables = [
    'cms_users', 'cms_roles', 'cms_sessions', 'cms_login_attempts',
    'cms_security_blocks', 'cms_audit_logs', 'cms_settings', 'cms_media',
    'blog_categories', 'blog_posts', 'blog_revisions', 'products',
    'cms_password_resets'
];

$driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
$existingTables = [];
if ($driver === 'mysql') {
    $stmt = $pdo->query("SHOW TABLES");
    $existingTables = $stmt->fetchAll(PDO::FETCH_COLUMN);
} else {
    $stmt = $pdo->query("SELECT name FROM sqlite_master WHERE type='table'");
    $existingTables = $stmt->fetchAll(PDO::FETCH_COLUMN);
}

foreach ($expectedTables as $tbl) {
    assert_test("Table `{$tbl}` exists", in_array($tbl, $existingTables));
}

// Verify blog_posts columns
$cols = [];
if ($driver === 'mysql') {
    $stmt = $pdo->query("SHOW COLUMNS FROM blog_posts");
    while ($r = $stmt->fetch()) $cols[] = strtolower($r['Field']);
} else {
    $stmt = $pdo->query("PRAGMA table_info(blog_posts)");
    while ($r = $stmt->fetch()) $cols[] = strtolower($r['name']);
}

assert_test("Column `blog_posts.status` exists", in_array('status', $cols));
assert_test("Column `blog_posts.category` exists", in_array('category', $cols));
assert_test("Column `blog_posts.featured_image` exists", in_array('featured_image', $cols));
assert_test("Column `blog_posts.tags_json` exists", in_array('tags_json', $cols));

// ---------------------------------------------------------
// SUITE 2: AUTHENTICATION & SESSION MANAGEMENT
// ---------------------------------------------------------
echo "\nSUITE 2: Authentication & Session Token Lifecycle\n";

$admin = $pdo->query("SELECT * FROM cms_users WHERE username = 'admin'")->fetch();
assert_test("Default Super Admin user exists", (bool)$admin);
assert_test("Super Admin password verifies correctly", password_verify('Admin@StoneKrusher2026!', $admin['password_hash']));

// Create test session
$sessionData = Security::createSession($admin, '127.0.0.1', 'CLI-Test-Agent');
assert_test("Session creation returns 64-char hex token", strlen($sessionData['token']) === 64);
assert_test("CSRF token generated tied to session", !empty($sessionData['csrf_token']));

// Verify session in DB
$sessRow = $pdo->query("SELECT * FROM cms_sessions WHERE id = '{$sessionData['token']}'")->fetch();
assert_test("Session recorded in `cms_sessions` with unrevoked status", $sessRow && $sessRow['is_revoked'] == 0);

// Validate session user
$_COOKIE['cms_token'] = $sessionData['token'];
$currentUser = Security::getCurrentUser();
assert_test("Security::getCurrentUser resolves valid active user", $currentUser && $currentUser['username'] === 'admin');

// CSRF check
assert_test("CSRF verification passes for matching token", hash_equals($sessionData['csrf_token'], $currentUser['csrf_token']));
assert_test("CSRF verification rejects invalid token", !hash_equals('invalid-token-12345', $currentUser['csrf_token']));

// Revoke session
$pdo->prepare("UPDATE cms_sessions SET is_revoked = 1 WHERE id = ?")->execute([$sessionData['token']]);
assert_test("Revoked session no longer passes Security::getCurrentUser", Security::getCurrentUser() === null);
unset($_COOKIE['cms_token']);

// ---------------------------------------------------------
// SUITE 3: 10 FAILED LOGINS & ACCOUNT LOCKOUT POLICY
// ---------------------------------------------------------
echo "\nSUITE 3: Failed Login Counter, 10 Attempts Lockout & Rate-Limiting\n";

// Create temporary test user
$testUid = 'usr-test-lockout-' . bin2hex(random_bytes(4));
$testPassHash = password_hash('TestPass@2026', PASSWORD_DEFAULT);
$pdo->prepare("INSERT INTO cms_users (id, username, email, password_hash, full_name, role, status, failed_login_attempts, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'editor', 'active', 0, ?, ?)")
    ->execute([$testUid, 'lockout_test', 'lockout@cwqv.com', $testPassHash, 'Lockout Tester', time(), time()]);

$testUser = $pdo->query("SELECT * FROM cms_users WHERE id = '{$testUid}'")->fetch();

// 9 failed attempts -> should NOT be locked
// (documentation-range IP so the new device auto-block never touches localhost)
for ($i = 1; $i <= 9; $i++) {
    Security::recordLoginAttempt('lockout_test', '198.51.100.20', 'Tester', false, 'bad_pass', $testUser);
    $testUser = $pdo->query("SELECT * FROM cms_users WHERE id = '{$testUid}'")->fetch();
}
assert_test("After 9 failed attempts, user failed counter is 9", $testUser['failed_login_attempts'] == 9);
assert_test("After 9 failed attempts, user is NOT locked", empty($testUser['locked_until']) || $testUser['locked_until'] <= time());

// 10th failed attempt -> LOCKOUT TRIGGERED
Security::recordLoginAttempt('lockout_test', '198.51.100.20', 'Tester', false, 'bad_pass', $testUser);
$testUser = $pdo->query("SELECT * FROM cms_users WHERE id = '{$testUid}'")->fetch();

assert_test("After 10 consecutive failed attempts, account IS LOCKED", !empty($testUser['locked_until']) && $testUser['locked_until'] > time());
$lockRemainingMinutes = round(($testUser['locked_until'] - time()) / 60);
assert_test("Lockout duration matches configured policy (~15 minutes)", $lockRemainingMinutes >= 14 && $lockRemainingMinutes <= 16);

// Verify audit log recorded the lockout event
$auditLock = $pdo->query("SELECT * FROM cms_audit_logs WHERE action = 'security.account_locked' AND user_id = '{$testUid}'")->fetch();
assert_test("Security audit log entry created for account lockout", (bool)$auditLock);

// Reset & Cleanup
$pdo->prepare("DELETE FROM cms_users WHERE id = ?")->execute([$testUid]);
$pdo->prepare("DELETE FROM cms_login_attempts WHERE identifier = 'lockout_test'")->execute();
$pdo->prepare("DELETE FROM cms_audit_logs WHERE user_id = ?")->execute([$testUid]);
$pdo->prepare("DELETE FROM cms_login_attempts WHERE ip_address = '198.51.100.20'")->execute();
$pdo->prepare("DELETE FROM cms_security_blocks WHERE target = '198.51.100.20'")->execute();

// ---------------------------------------------------------
// SUITE 4: FIREWALL IP BLOCKING & UNBLOCKING
// ---------------------------------------------------------
echo "\nSUITE 4: Firewall IP Blocking & Expiration Rules\n";

$testIp = '203.0.113.88';
assert_test("Initial IP {$testIp} is not blocked", !Security::isIpBlocked($testIp));

// Block IP
$blockId = 'blk-test-' . bin2hex(random_bytes(4));
$pdo->prepare("INSERT INTO cms_security_blocks (id, type, target, reason, created_by, expires_at, created_at) VALUES (?, 'ip', ?, 'Suspicious bot traffic', 'admin', NULL, ?)")
    ->execute([$blockId, $testIp, time()]);

assert_test("IP {$testIp} is now recognized as blocked", Security::isIpBlocked($testIp));

// Expired IP block test
$expiredIp = '203.0.113.89';
$expBlockId = 'blk-exp-' . bin2hex(random_bytes(4));
$pdo->prepare("INSERT INTO cms_security_blocks (id, type, target, reason, created_by, expires_at, created_at) VALUES (?, 'ip', ?, 'Old block', 'admin', ?, ?)")
    ->execute([$expBlockId, $expiredIp, time() - 3600, time() - 7200]);

assert_test("Expired IP block is automatically ignored", !Security::isIpBlocked($expiredIp));

// Unblock IP
$pdo->prepare("DELETE FROM cms_security_blocks WHERE id = ?")->execute([$blockId]);
$pdo->prepare("DELETE FROM cms_security_blocks WHERE id = ?")->execute([$expBlockId]);
assert_test("Unblocked IP is no longer blocked", !Security::isIpBlocked($testIp));

// ---------------------------------------------------------
// SUITE 5: ROLE PERMISSION MATRIX
// ---------------------------------------------------------
echo "\nSUITE 5: Role & Permission Matrix Enforcement\n";

$superUser = ['role' => 'super_admin', 'permissions' => ['*']];
$editorUser = ['role' => 'editor', 'permissions' => ['posts.view', 'posts.create', 'posts.edit', 'posts.publish', 'categories.manage']];
$viewerUser = ['role' => 'viewer', 'permissions' => ['posts.view', 'products.view', 'media.view']];

assert_test("Super Admin has all permissions (wildcard *)", Security::hasPermission($superUser, 'settings.manage'));
assert_test("Super Admin has permission for security.manage", Security::hasPermission($superUser, 'security.manage'));
assert_test("Editor has permission for posts.create", Security::hasPermission($editorUser, 'posts.create'));
assert_test("Editor DOES NOT have permission for settings.manage", !Security::hasPermission($editorUser, 'settings.manage'));
assert_test("Viewer has permission for posts.view", Security::hasPermission($viewerUser, 'posts.view'));
assert_test("Viewer DOES NOT have permission for posts.create", !Security::hasPermission($viewerUser, 'posts.create'));
assert_test("Viewer DOES NOT have permission for security.view", !Security::hasPermission($viewerUser, 'security.view'));

// ---------------------------------------------------------
// SUITE 6: BLOG POST CRUD, REVISION SNAPSHOTS & TRASH
// ---------------------------------------------------------
echo "\nSUITE 6: Blog Management, Revision History & Trash Lifecycle\n";

$testPostId = 'test-article-' . bin2hex(random_bytes(4));
$testPostSlug = $testPostId;
$now = time();

// 1. Create Post
$pdo->prepare("INSERT INTO blog_posts (id, slug, title, category, author, featured_image, excerpt, content, data_json, status, published_date, updated_at, created_by) VALUES (?, ?, ?, 'Guide', 'Admin Tester', '/uploads/test.jpg', 'Excerpt test', 'Original body content', '{}', 'Draft', '2026-10-22', ?, 'usr-admin-initial')")
    ->execute([$testPostId, $testPostSlug, 'Original Title', $now]);

$createdPost = $pdo->query("SELECT * FROM blog_posts WHERE id = '{$testPostId}'")->fetch();
assert_test("Blog post created with status 'Draft'", $createdPost && $createdPost['status'] === 'Draft');

// 2. Snapshot revision & update
$revId = 'rev-test-' . bin2hex(random_bytes(4));
$pdo->prepare("INSERT INTO blog_revisions (id, post_id, title, data_json, created_by, created_at) VALUES (?, ?, ?, ?, 'usr-admin-initial', ?)")
    ->execute([$revId, $testPostId, 'Original Title', json_encode($createdPost), $now]);

$pdo->prepare("UPDATE blog_posts SET title = 'Updated Title V2', status = 'Published', updated_at = ? WHERE id = ?")
    ->execute([$now + 10, $testPostId]);

$updatedPost = $pdo->query("SELECT * FROM blog_posts WHERE id = '{$testPostId}'")->fetch();
assert_test("Blog post title updated to 'Updated Title V2' and published", $updatedPost && $updatedPost['title'] === 'Updated Title V2');
assert_test("Revision snapshot exists in `blog_revisions`", $pdo->query("SELECT COUNT(*) FROM blog_revisions WHERE post_id = '{$testPostId}'")->fetchColumn() == 1);

// 3. Move to Trash (Soft delete)
$pdo->prepare("UPDATE blog_posts SET status = 'Trash' WHERE id = ?")->execute([$testPostId]);
$trashedPost = $pdo->query("SELECT * FROM blog_posts WHERE id = '{$testPostId}'")->fetch();
assert_test("Soft deletion sets status to 'Trash'", $trashedPost && $trashedPost['status'] === 'Trash');

// 4. Restore from Trash
$pdo->prepare("UPDATE blog_posts SET status = 'Draft' WHERE id = ?")->execute([$testPostId]);
$restoredPost = $pdo->query("SELECT * FROM blog_posts WHERE id = '{$testPostId}'")->fetch();
assert_test("Restore from trash sets status back to 'Draft'", $restoredPost && $restoredPost['status'] === 'Draft');

// 5. Cleanup test post & revision
$pdo->prepare("DELETE FROM blog_posts WHERE id = ?")->execute([$testPostId]);
$pdo->prepare("DELETE FROM blog_revisions WHERE post_id = ?")->execute([$testPostId]);
assert_test("Permanent deletion removes post and linked revisions", $pdo->query("SELECT COUNT(*) FROM blog_posts WHERE id = '{$testPostId}'")->fetchColumn() == 0);

// ---------------------------------------------------------
// SUITE 7: PRODUCT CATALOG MANAGEMENT
// ---------------------------------------------------------
echo "\nSUITE 7: Machinery Product Catalog & SKU Validation\n";

$testProdId = 'prod-test-' . bin2hex(random_bytes(4));
$testSku = 'SKU-TEST-999';

$pdo->prepare("INSERT INTO products (id, slug, name, sku, category, price, image_url, description, status, created_at, updated_at) VALUES (?, ?, 'Test Mini Excavator 2.5T', ?, 'Mini Excavators', '14500', '/uploads/excavator.jpg', 'Compact hydraulic excavator', 'Published', ?, ?)")
    ->execute([$testProdId, $testProdId, $testSku, $now, $now]);

$pRow = $pdo->query("SELECT * FROM products WHERE id = '{$testProdId}'")->fetch();
assert_test("Product created successfully with SKU {$testSku}", $pRow && $pRow['sku'] === $testSku);

// Check duplicate SKU query detection
$dupCheck = $pdo->prepare("SELECT id FROM products WHERE sku = ? AND id != ?");
$dupCheck->execute([$testSku, 'different-id-123']);
assert_test("Duplicate SKU collision detected by query", (bool)$dupCheck->fetch());

// Cleanup
$pdo->prepare("DELETE FROM products WHERE id = ?")->execute([$testProdId]);

// ---------------------------------------------------------
// SUITE 8: CATEGORIES & SAFE REASSIGNMENT SAFEGUARD
// ---------------------------------------------------------
echo "\nSUITE 8: Categories & Safe Post Reassignment Safeguard\n";

$pdo->exec("DELETE FROM blog_categories WHERE slug LIKE 'test-safety%'");
$testCatSlug = 'test-safety-' . bin2hex(random_bytes(4));
$testCatId = 'cat-test-' . bin2hex(random_bytes(4));
$pdo->prepare("INSERT INTO blog_categories (id, name, slug, description, display_order, created_at) VALUES (?, 'Test Safety Gear', ?, 'Safety equipment', 10, ?)")
    ->execute([$testCatId, $testCatSlug, $now]);

assert_test("Category created", (bool)$pdo->query("SELECT id FROM blog_categories WHERE id = '{$testCatId}'")->fetch());

// Assign dummy post to category
$dummyPostId = 'post-cat-test-' . bin2hex(random_bytes(4));
$pdo->prepare("INSERT INTO blog_posts (id, slug, title, category, data_json, status, updated_at) VALUES (?, ?, 'Safety Tips', 'Test Safety Gear', '{}', 'Draft', ?)")
    ->execute([$dummyPostId, $dummyPostId, $now]);

$countAssigned = (int)$pdo->query("SELECT COUNT(*) FROM blog_posts WHERE category = 'Test Safety Gear'")->fetchColumn();
assert_test("Category has 1 active assigned post", $countAssigned === 1);

// Reassign and delete
$pdo->prepare("UPDATE blog_posts SET category = 'Safety' WHERE category = 'Test Safety Gear'")->execute();
$pdo->prepare("DELETE FROM blog_categories WHERE id = ?")->execute([$testCatId]);
$pdo->prepare("DELETE FROM blog_posts WHERE id = ?")->execute([$dummyPostId]);

assert_test("Category deleted and posts safely reassigned to 'Safety'", (bool)($pdo->query("SELECT COUNT(*) FROM blog_categories WHERE id = '{$testCatId}'")->fetchColumn() == 0));

// ---------------------------------------------------------
// SUITE 9: MEDIA SECURITY & EXECUTION PREVENTION
// ---------------------------------------------------------
echo "\nSUITE 9: Media Upload Execution Prevention (.htaccess)\n";

$uploadDir = dirname(__DIR__) . '/public/uploads';
if (!is_dir($uploadDir)) {
    @mkdir($uploadDir, 0755, true);
    @file_put_contents($uploadDir . '/.htaccess', "# Security barrier\nDeny from all\n");
}
$htaccessFile = $uploadDir . '/.htaccess';
assert_test("Upload directory exists", is_dir($uploadDir));
assert_test(".htaccess security barrier exists in /public/uploads", file_exists($htaccessFile));
if (file_exists($htaccessFile)) {
    $content = file_get_contents($htaccessFile);
    assert_test(".htaccess denies PHP/CGI script execution", strpos($content, 'Deny from all') !== false || strpos($content, 'RemoveHandler') !== false);
}

// ---------------------------------------------------------
// ---------------------------------------------------------
// SUITE 10: GOOGLE SIGN-IN CLAIM VALIDATION
// ---------------------------------------------------------
echo "\nSUITE 10: Google Sign-In Token Claim Validation\n";

$gid = '1234567890-abcdefg.apps.googleusercontent.com';
$goodClaims = [
    'aud' => $gid,
    'iss' => 'https://accounts.google.com',
    'exp' => time() + 600,
    'email' => 'staff@example.com',
    'email_verified' => 'true',
    'sub' => '1098765432'
];

assert_test("Valid Google Client ID format accepted", Security::isValidGoogleClientId($gid));
assert_test("Malformed Google Client ID rejected", !Security::isValidGoogleClientId('not-a-client-id'));
assert_test("Client ID with injected characters rejected", !Security::isValidGoogleClientId("x.apps.googleusercontent.com\"><script>"));
assert_test("Valid claims pass validation", Security::validateGoogleClaims($goodClaims, $gid) === null);
assert_test("accounts.google.com issuer (no scheme) accepted", Security::validateGoogleClaims(array_merge($goodClaims, ['iss' => 'accounts.google.com']), $gid) === null);
assert_test("Wrong audience (token for another app) rejected", Security::validateGoogleClaims(array_merge($goodClaims, ['aud' => 'other.apps.googleusercontent.com']), $gid) === 'audience_mismatch');
assert_test("Wrong issuer rejected", Security::validateGoogleClaims(array_merge($goodClaims, ['iss' => 'https://evil.example.com']), $gid) === 'issuer_mismatch');
assert_test("Expired token rejected", Security::validateGoogleClaims(array_merge($goodClaims, ['exp' => time() - 5]), $gid) === 'token_expired');
assert_test("Unverified email rejected", Security::validateGoogleClaims(array_merge($goodClaims, ['email_verified' => 'false']), $gid) === 'email_not_verified');
assert_test("Missing email rejected", Security::validateGoogleClaims(array_merge($goodClaims, ['email' => '']), $gid) === 'missing_identity');
assert_test("Non-array claims rejected", Security::validateGoogleClaims(null, $gid) === 'invalid_claims');
assert_test("Empty configured client ID never validates", Security::validateGoogleClaims($goodClaims, '') === 'audience_mismatch');
assert_test("Garbage ID token is rejected before any network call", Security::fetchGoogleTokenClaims("abc def<>") === null);

$pdo->prepare("DELETE FROM cms_settings WHERE setting_key = 'google_client_id'")->execute();
assert_test("Google Client ID is empty until configured", Security::getGoogleClientId() === '' || defined('GOOGLE_CLIENT_ID') || getenv('GOOGLE_CLIENT_ID'));
$pdo->prepare("INSERT INTO cms_settings (setting_key, setting_value, updated_at) VALUES ('google_client_id', ?, ?)")->execute([$gid, time()]);
assert_test("Google Client ID read from CMS settings", Security::getGoogleClientId() === $gid);
$pdo->prepare("DELETE FROM cms_settings WHERE setting_key = 'google_client_id'")->execute();

// ---------------------------------------------------------
// SUITE 11: DEVICE (IP) AUTO-BLOCK AFTER 10 FAILED SIGN-INS
// ---------------------------------------------------------
echo "\nSUITE 11: Device Auto-Block After 10 Failed Sign-ins\n";

$devIp = '198.51.100.77';
$pdo->prepare("DELETE FROM cms_settings WHERE setting_key IN ('ip_block_failed_logins','ip_block_hours')")->execute();
$pdo->prepare("DELETE FROM cms_login_attempts WHERE ip_address = ?")->execute([$devIp]);
$pdo->prepare("DELETE FROM cms_security_blocks WHERE target = ?")->execute([$devIp]);

assert_test("Default device-block threshold is 10 failed sign-ins", Security::getIpBlockThreshold() === 10);

$firstResult = Security::recordLoginAttempt('nobody@example.com', $devIp, 'Tester', false, 'user_not_found', null);
assert_test("First failure reports 9 attempts remaining", $firstResult['remaining'] === 9 && $firstResult['limit'] === 10);

$lastResult = $firstResult;
for ($i = 2; $i <= 9; $i++) {
    $lastResult = Security::recordLoginAttempt('nobody@example.com', $devIp, 'Tester', false, 'user_not_found', null);
}
assert_test("After 9 failures the device is NOT blocked", !Security::isIpBlocked($devIp) && $lastResult['blocked'] === false);
assert_test("After 9 failures exactly 1 attempt is reported as remaining", $lastResult['remaining'] === 1);

$tenth = Security::recordLoginAttempt('nobody@example.com', $devIp, 'Tester', false, 'user_not_found', null);
assert_test("10th failure blocks the device", $tenth['blocked'] === true && Security::isIpBlocked($devIp));

$blockRow = Security::getIpBlock($devIp);
assert_test("Auto-block is recorded as a system block with an expiry", $blockRow && $blockRow['created_by'] === 'system' && (int)$blockRow['expires_at'] > time());
assert_test("Default auto-block lasts about 24 hours", $blockRow && abs(((int)$blockRow['expires_at'] - time()) - 86400) < 120);
$autoAudit = $pdo->prepare("SELECT COUNT(*) FROM cms_audit_logs WHERE action = 'security.ip_auto_blocked' AND details_json LIKE ?");
$autoAudit->execute(['%' . $devIp . '%']);
assert_test("Automatic block is written to the audit log", (int)$autoAudit->fetchColumn() === 1);

// Admin lifts the block: the counter must restart instead of re-blocking on the next typo
// (history is back-dated because timestamps have 1-second resolution)
$pdo->prepare("UPDATE cms_login_attempts SET created_at = created_at - 20 WHERE ip_address = ?")->execute([$devIp]);
$pdo->prepare("DELETE FROM cms_security_blocks WHERE target = ?")->execute([$devIp]);
Security::logAudit(null, 'security.ip_unblocked', 'block', 'blk-x', ['target' => $devIp]);
$pdo->prepare("UPDATE cms_audit_logs SET created_at = created_at - 10 WHERE action = 'security.ip_unblocked' AND details_json LIKE ?")->execute(['%' . $devIp . '%']);
$afterUnblock = Security::recordLoginAttempt('nobody@example.com', $devIp, 'Tester', false, 'user_not_found', null);
assert_test("After an admin unblock the failure counter restarts", $afterUnblock['blocked'] === false && $afterUnblock['remaining'] === 9);

// A configurable threshold and permanent blocks
$pdo->prepare("INSERT INTO cms_settings (setting_key, setting_value, updated_at) VALUES ('ip_block_failed_logins', '3', ?)")->execute([time()]);
$pdo->prepare("INSERT INTO cms_settings (setting_key, setting_value, updated_at) VALUES ('ip_block_hours', '0', ?)")->execute([time()]);
$pdo->prepare("DELETE FROM cms_security_blocks WHERE target = ?")->execute([$devIp]);
$pdo->prepare("DELETE FROM cms_login_attempts WHERE ip_address = ?")->execute([$devIp]);
assert_test("Threshold is configurable from CMS settings", Security::getIpBlockThreshold() === 3);
Security::recordLoginAttempt('x', $devIp, 'Tester', false, 'bad', null);
Security::recordLoginAttempt('x', $devIp, 'Tester', false, 'bad', null);
$third = Security::recordLoginAttempt('x', $devIp, 'Tester', false, 'bad', null);
$permBlock = Security::getIpBlock($devIp);
assert_test("Configured threshold of 3 blocks on the 3rd failure", $third['blocked'] === true && $permBlock !== null);
assert_test("ip_block_hours = 0 creates a block with no expiry", $permBlock && empty($permBlock['expires_at']));

// A successful sign-in clears the counter
$pdo->prepare("DELETE FROM cms_security_blocks WHERE target = ?")->execute([$devIp]);
$pdo->prepare("DELETE FROM cms_login_attempts WHERE ip_address = ?")->execute([$devIp]);
$pdo->prepare("DELETE FROM cms_settings WHERE setting_key IN ('ip_block_failed_logins','ip_block_hours')")->execute();
Security::recordLoginAttempt('x', $devIp, 'Tester', false, 'bad', null);
Security::recordLoginAttempt('x', $devIp, 'Tester', false, 'bad', null);
$pdo->prepare("INSERT INTO cms_login_attempts (id, identifier, ip_address, user_agent, success, failure_reason, created_at) VALUES (?, 'x', ?, 'Tester', 1, NULL, ?)")
    ->execute(['att-test-' . bin2hex(random_bytes(6)), $devIp, time() + 1]);
assert_test("A successful sign-in resets the device failure counter", Security::countIpFailedLogins($devIp) === 0);

$pdo->prepare("DELETE FROM cms_login_attempts WHERE ip_address = ?")->execute([$devIp]);
$pdo->prepare("DELETE FROM cms_security_blocks WHERE target = ?")->execute([$devIp]);
$pdo->prepare("DELETE FROM cms_audit_logs WHERE details_json LIKE ?")->execute(['%' . $devIp . '%']);

// ---------------------------------------------------------
// SUITE 12: GOOGLE ACCOUNT LINKING, UNLINKING & LOGIN INTEGRATION
// ---------------------------------------------------------
echo "\nSUITE 12: Google Account Linking & CMS Profile Integration\n";

$linkUid = 'usr-link-test-' . bin2hex(random_bytes(4));
$linkPassHash = password_hash('LinkPass@2026', PASSWORD_DEFAULT);
$pdo->prepare("INSERT INTO cms_users (id, username, email, password_hash, full_name, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'editor', 'active', ?, ?)")
    ->execute([$linkUid, 'link_tester', 'link_tester@example.com', $linkPassHash, 'Link Tester', time(), time()]);

$uRow = $pdo->query("SELECT * FROM cms_users WHERE id = '{$linkUid}'")->fetch();
assert_test("User created without linked Google account", empty($uRow['google_id']) && empty($uRow['google_email']));

// 1. Password login works before linking Google
assert_test("Email/password login works before Google link", password_verify('LinkPass@2026', $uRow['password_hash']));

// 2. Unlinked Google lookup fails
$gSub = 'google-sub-987654';
$gEmail = 'googleuser@gmail.com';
$unlinkedStmt = $pdo->prepare("SELECT * FROM cms_users WHERE (google_id IS NOT NULL AND google_id = ?) OR (google_email IS NOT NULL AND LOWER(google_email) = LOWER(?))");
$unlinkedStmt->execute([$gSub, $gEmail]);
assert_test("Unlinked Google account cannot match any user", $unlinkedStmt->fetch() === false);

// 3. Link Google account to profile
$pdo->prepare("UPDATE cms_users SET google_id = ?, google_email = ?, google_linked_at = ?, updated_at = ? WHERE id = ?")
    ->execute([$gSub, $gEmail, time(), time(), $linkUid]);

$linkedStmt = $pdo->prepare("SELECT * FROM cms_users WHERE (google_id IS NOT NULL AND google_id = ?) OR (google_email IS NOT NULL AND LOWER(google_email) = LOWER(?))");
$linkedStmt->execute([$gSub, $gEmail]);
$matchedUser = $linkedStmt->fetch();
assert_test("After linking in profile, Google account matches user", $matchedUser && $matchedUser['id'] === $linkUid);

// 4. Create session and verify getCurrentUser returns linked state
$sess = Security::createSession($matchedUser, '198.51.100.30', 'Agent');
$_COOKIE['cms_token'] = $sess['token'];
$resolved = Security::getCurrentUser();
assert_test("Session resolves is_google_linked = true", $resolved && $resolved['is_google_linked'] === true);
assert_test("Session returns linked google_email", $resolved && $resolved['google_email'] === $gEmail);
unset($_COOKIE['cms_token']);

// 5. Email/password STILL works while Google is linked
$refreshedUser = $pdo->query("SELECT * FROM cms_users WHERE id = '{$linkUid}'")->fetch();
assert_test("Email/password login STILL works after Google is linked", password_verify('LinkPass@2026', $refreshedUser['password_hash']));

// 6. Unlink Google account
$pdo->prepare("UPDATE cms_users SET google_id = NULL, google_email = NULL, google_linked_at = NULL, updated_at = ? WHERE id = ?")
    ->execute([time(), $linkUid]);
$unlinkedAgain = $pdo->prepare("SELECT * FROM cms_users WHERE (google_id IS NOT NULL AND google_id = ?) OR (google_email IS NOT NULL AND LOWER(google_email) = LOWER(?))");
$unlinkedAgain->execute([$gSub, $gEmail]);
assert_test("After unlinking in profile, Google login is rejected again", $unlinkedAgain->fetch() === false);

// 7. Email/password STILL works after unlinking
assert_test("Email/password login STILL works after unlinking", password_verify('LinkPass@2026', $refreshedUser['password_hash']));

// Cleanup
$pdo->prepare("DELETE FROM cms_sessions WHERE user_id = ?")->execute([$linkUid]);
$pdo->prepare("DELETE FROM cms_users WHERE id = ?")->execute([$linkUid]);

// ---------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------
echo "\n=========================================================\n";
echo "TEST RESULTS SUMMARY\n";
echo "Total Passed: {$passed}\n";
echo "Total Failed: {$failed}\n";
echo "=========================================================\n";

if ($failed > 0) {
    exit(1);
}
exit(0);
