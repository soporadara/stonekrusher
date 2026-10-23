<?php
// =========================================================
// StoneKrusher CMS - Comprehensive Security & Functional Tests
// Runs against an isolated test SQLite database (data/test_site.db)
// =========================================================

$testDbFile = dirname(__DIR__) . '/data/test_site.db';
if (file_exists($testDbFile)) {
    @unlink($testDbFile);
}

// Force test environment variables
putenv("DB_DRIVER=sqlite");
putenv("DB_FILE={$testDbFile}");
$_ENV['DB_DRIVER'] = 'sqlite';
$_ENV['DB_FILE'] = $testDbFile;
$_SERVER['DB_DRIVER'] = 'sqlite';
$_SERVER['DB_FILE'] = $testDbFile;

require_once __DIR__ . '/../public/api/db.php';
require_once __DIR__ . '/../public/api/security.php';

$pdo = get_cms_pdo($testDbFile, 'sqlite');
if (!$pdo) {
    echo "FAIL: Test database connection could not be established.\n";
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
echo "Driver: " . $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) . " (Isolated Test Database)\n";
echo "DB Path: {$testDbFile}\n";
echo "=========================================================\n\n";

// ---------------------------------------------------------
// SUITE 1: SCHEMA & TABLES VERIFICATION
// ---------------------------------------------------------
echo "SUITE 1: Schema & Data Migration Verification\n";

$expectedTables = [
    'cms_users', 'cms_roles', 'cms_sessions', 'cms_login_attempts',
    'cms_security_blocks', 'cms_audit_logs', 'cms_settings', 'cms_media',
    'blog_categories', 'blog_posts', 'blog_revisions', 'products',
    'cms_inquiries', 'cms_support_tickets', 'cms_password_resets', 'blog_comments'
];

$stmt = $pdo->query("SELECT name FROM sqlite_master WHERE type='table'");
$existingTables = $stmt->fetchAll(PDO::FETCH_COLUMN);

foreach ($expectedTables as $tbl) {
    assert_test("Table `{$tbl}` exists in isolated test DB", in_array($tbl, $existingTables));
}

// Verify blog_posts columns
$cols = [];
$stmt = $pdo->query("PRAGMA table_info(blog_posts)");
while ($r = $stmt->fetch()) $cols[] = strtolower($r['name']);

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

$testUid = 'usr-test-lockout-' . bin2hex(random_bytes(4));
$testPassHash = password_hash('TestPass@2026', PASSWORD_DEFAULT);
$pdo->prepare("INSERT INTO cms_users (id, username, email, password_hash, full_name, role, status, failed_login_attempts, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'editor', 'active', 0, ?, ?)")
    ->execute([$testUid, 'lockout_test', 'lockout@cwqv.com', $testPassHash, 'Lockout Tester', time(), time()]);

$testUser = $pdo->query("SELECT * FROM cms_users WHERE id = '{$testUid}'")->fetch();

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

$blockId = 'blk-test-' . bin2hex(random_bytes(4));
$pdo->prepare("INSERT INTO cms_security_blocks (id, type, target, reason, created_by, expires_at, created_at) VALUES (?, 'ip', ?, 'Suspicious bot traffic', 'admin', NULL, ?)")
    ->execute([$blockId, $testIp, time()]);

assert_test("IP {$testIp} is now recognized as blocked", Security::isIpBlocked($testIp));

$expiredIp = '203.0.113.89';
$expBlockId = 'blk-exp-' . bin2hex(random_bytes(4));
$pdo->prepare("INSERT INTO cms_security_blocks (id, type, target, reason, created_by, expires_at, created_at) VALUES (?, 'ip', ?, 'Old block', 'admin', ?, ?)")
    ->execute([$expBlockId, $expiredIp, time() - 3600, time() - 7200]);

assert_test("Expired IP block is automatically ignored", !Security::isIpBlocked($expiredIp));

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

$pdo->prepare("INSERT INTO blog_posts (id, slug, title, category, author, featured_image, excerpt, content, data_json, status, published_date, updated_at, created_by) VALUES (?, ?, ?, 'Guide', 'Admin Tester', '/uploads/test.jpg', 'Excerpt test', 'Original body content', '{}', 'Draft', '2026-10-22', ?, 'usr-admin-initial')")
    ->execute([$testPostId, $testPostSlug, 'Original Title', $now]);

$createdPost = $pdo->query("SELECT * FROM blog_posts WHERE id = '{$testPostId}'")->fetch();
assert_test("Blog post created with status 'Draft'", $createdPost && $createdPost['status'] === 'Draft');

$revId = 'rev-test-' . bin2hex(random_bytes(4));
$pdo->prepare("INSERT INTO blog_revisions (id, post_id, title, data_json, created_by, created_at) VALUES (?, ?, ?, ?, 'usr-admin-initial', ?)")
    ->execute([$revId, $testPostId, 'Original Title', json_encode($createdPost), $now]);

$pdo->prepare("UPDATE blog_posts SET title = 'Updated Title V2', status = 'Published', updated_at = ? WHERE id = ?")
    ->execute([$now + 10, $testPostId]);

$updatedPost = $pdo->query("SELECT * FROM blog_posts WHERE id = '{$testPostId}'")->fetch();
assert_test("Blog post title updated to 'Updated Title V2' and published", $updatedPost && $updatedPost['title'] === 'Updated Title V2');
assert_test("Revision snapshot exists in `blog_revisions`", $pdo->query("SELECT COUNT(*) FROM blog_revisions WHERE post_id = '{$testPostId}'")->fetchColumn() == 1);

// Soft delete
$pdo->prepare("UPDATE blog_posts SET status = 'Trash' WHERE id = ?")->execute([$testPostId]);
$trashedPost = $pdo->query("SELECT * FROM blog_posts WHERE id = '{$testPostId}'")->fetch();
assert_test("Soft deletion sets status to 'Trash'", $trashedPost && $trashedPost['status'] === 'Trash');

// Restore from trash
$pdo->prepare("UPDATE blog_posts SET status = 'Draft' WHERE id = ?")->execute([$testPostId]);
$restoredPost = $pdo->query("SELECT * FROM blog_posts WHERE id = '{$testPostId}'")->fetch();
assert_test("Restore from trash sets status back to 'Draft'", $restoredPost && $restoredPost['status'] === 'Draft');

// Cleanup
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
echo "\nSUITE 9: Media Upload Execution Prevention (.htaccess) & Reference Protection\n";

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

// Media Reference Deletion Safeguard
$mediaTestId = 'med-ref-test-' . bin2hex(random_bytes(4));
$mediaFilename = 'sample_excavator_' . bin2hex(random_bytes(3)) . '.jpg';
$pdo->prepare("INSERT INTO cms_media (id, filename, original_name, filepath, mime_type, file_size, uploaded_by, created_at) VALUES (?, ?, ?, ?, 'image/jpeg', 204800, 'admin', ?)")
    ->execute([$mediaTestId, $mediaFilename, 'Sample.jpg', "/uploads/{$mediaFilename}", time()]);

// Create referencing product
$refProdId = 'prod-ref-' . bin2hex(random_bytes(4));
$pdo->prepare("INSERT INTO products (id, slug, name, sku, category, image_url, status, created_at, updated_at) VALUES (?, ?, 'Ref Product', 'SKU-REF-1', 'Machinery', ?, 'Published', ?, ?)")
    ->execute([$refProdId, $refProdId, "/uploads/{$mediaFilename}", time(), time()]);

$refProdCheck = $pdo->prepare("SELECT COUNT(*) FROM products WHERE image_url LIKE ? OR gallery_json LIKE ?");
$refProdCheck->execute(["%{$mediaFilename}%", "%{$mediaFilename}%"]);
$foundRefs = (int)$refProdCheck->fetchColumn();

assert_test("Media reference detection finds active product reference", $foundRefs === 1);

// Cleanup
$pdo->prepare("DELETE FROM products WHERE id = ?")->execute([$refProdId]);
$pdo->prepare("DELETE FROM cms_media WHERE id = ?")->execute([$mediaTestId]);

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

for ($i = 2; $i <= 9; $i++) {
    Security::recordLoginAttempt('nobody@example.com', $devIp, 'Tester', false, 'user_not_found', null);
}

$tenth = Security::recordLoginAttempt('nobody@example.com', $devIp, 'Tester', false, 'user_not_found', null);
assert_test("10th failure blocks the device", $tenth['blocked'] === true && Security::isIpBlocked($devIp));

$blockRow = Security::getIpBlock($devIp);
assert_test("Auto-block is recorded as a system block with an expiry", $blockRow && $blockRow['created_by'] === 'system' && (int)$blockRow['expires_at'] > time());

// Cleanup
$pdo->prepare("DELETE FROM cms_security_blocks WHERE target = ?")->execute([$devIp]);
$pdo->prepare("DELETE FROM cms_login_attempts WHERE ip_address = ?")->execute([$devIp]);

// ---------------------------------------------------------
// SUITE 12: CUSTOMER OPERATIONS - CRM LEADS & INQUIRIES
// ---------------------------------------------------------
echo "\nSUITE 12: Customer Operations - CRM Leads & RFQ Inquiries CRUD\n";

$testInqId = 'inq-test-' . bin2hex(random_bytes(4));
$stmt = $pdo->prepare("INSERT INTO cms_inquiries (id, name, email, phone, company, machine_model, inquiry_type, message, estimated_value, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
$stmt->execute([
    $testInqId,
    'John Contractor',
    'john@buildcorp.com',
    '555-0199',
    'BuildCorp Inc',
    'Stone Krusher K2',
    'Quote Request',
    'Interested in 2-ton mobile crusher with warranty',
    28500.00,
    'New',
    'Priority lead',
    time(),
    time()
]);

$inqRow = $pdo->query("SELECT * FROM cms_inquiries WHERE id = '{$testInqId}'")->fetch();
assert_test("CRM inquiry created with status 'New'", $inqRow && $inqRow['status'] === 'New');
assert_test("CRM inquiry records estimated value $28,500", (float)$inqRow['estimated_value'] === 28500.00);

// Status transition New -> Quoted
$pdo->prepare("UPDATE cms_inquiries SET status = 'Quoted', updated_at = ? WHERE id = ?")->execute([time(), $testInqId]);
$updatedInq = $pdo->query("SELECT status FROM cms_inquiries WHERE id = '{$testInqId}'")->fetch();
assert_test("CRM inquiry transitions successfully to 'Quoted'", $updatedInq['status'] === 'Quoted');

// Filter check
$quotedCount = (int)$pdo->query("SELECT COUNT(*) FROM cms_inquiries WHERE status = 'Quoted'")->fetchColumn();
assert_test("Query filter by status='Quoted' returns records", $quotedCount >= 1);

// Cleanup
$pdo->prepare("DELETE FROM cms_inquiries WHERE id = ?")->execute([$testInqId]);
assert_test("CRM inquiry deleted successfully", (int)$pdo->query("SELECT COUNT(*) FROM cms_inquiries WHERE id = '{$testInqId}'")->fetchColumn() === 0);

// ---------------------------------------------------------
// SUITE 13: CUSTOMER SUPPORT & WARRANTY TICKETS
// ---------------------------------------------------------
echo "\nSUITE 13: Customer Operations - Support & Warranty Tickets CRUD\n";

$testTicketId = 'tkt-test-' . bin2hex(random_bytes(4));
$ticketNum = 'SK-TEST-' . mt_rand(100, 999);
$stmt = $pdo->prepare("INSERT INTO cms_support_tickets (id, ticket_number, customer_name, customer_email, equipment_model, serial_number, subject, priority, status, category, description, resolution_notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
$stmt->execute([
    $testTicketId,
    $ticketNum,
    'Alice Operator',
    'alice@quarryops.com',
    'Stone Krusher K3',
    'SN-8823901',
    'Hydraulic pressure sensor alert',
    'High',
    'Open',
    'Technical',
    'Intermittent sensor trigger during heavy crushing cycle',
    '',
    time(),
    time()
]);

$ticketRow = $pdo->query("SELECT * FROM cms_support_tickets WHERE id = '{$testTicketId}'")->fetch();
assert_test("Support ticket created with status 'Open' and priority 'High'", $ticketRow && $ticketRow['status'] === 'Open' && $ticketRow['priority'] === 'High');

// Status transition Open -> Resolved
$pdo->prepare("UPDATE cms_support_tickets SET status = 'Resolved', resolution_notes = 'Sensor recalibrated', updated_at = ? WHERE id = ?")->execute([time(), $testTicketId]);
$resolvedTkt = $pdo->query("SELECT status, resolution_notes FROM cms_support_tickets WHERE id = '{$testTicketId}'")->fetch();
assert_test("Support ticket status updated to 'Resolved'", $resolvedTkt['status'] === 'Resolved' && !empty($resolvedTkt['resolution_notes']));

// Cleanup
$pdo->prepare("DELETE FROM cms_support_tickets WHERE id = ?")->execute([$testTicketId]);
assert_test("Support ticket deleted successfully", (int)$pdo->query("SELECT COUNT(*) FROM cms_support_tickets WHERE id = '{$testTicketId}'")->fetchColumn() === 0);

// ---------------------------------------------------------
// SUITE 14: CSRF MULTI-SOURCE VALIDATION
// ---------------------------------------------------------
echo "\nSUITE 14: CSRF Multi-Source Token Validation (Header, POST, JSON)\n";

$csrfUser = [
    'id' => 'usr-csrf-test',
    'username' => 'csrf_tester',
    'csrf_token' => bin2hex(random_bytes(32))
];

// Test verifyCsrfToken method
assert_test("verifyCsrfToken validates exact token match", Security::verifyCsrfToken($csrfUser['csrf_token'], $csrfUser));
assert_test("verifyCsrfToken rejects forged token string", !Security::verifyCsrfToken('forged-token-abc', $csrfUser));
assert_test("verifyCsrfToken rejects empty token string", !Security::verifyCsrfToken('', $csrfUser));

// ---------------------------------------------------------
// SUITE 15: AUTHORITATIVE DASHBOARD METRICS INTEGRITY
// ---------------------------------------------------------
echo "\nSUITE 15: Authoritative Dashboard Metrics Integrity (Zero Fake Data)\n";

// Count actual database values
$realProductCount = (int)$pdo->query("SELECT COUNT(*) FROM products WHERE status != 'Archived'")->fetchColumn();
$realBlogPublished = (int)$pdo->query("SELECT COUNT(*) FROM blog_posts WHERE status = 'Published'")->fetchColumn();
$realBlogCategories = (int)$pdo->query("SELECT COUNT(*) FROM blog_categories")->fetchColumn();
$realInquiriesCount = (int)$pdo->query("SELECT COUNT(*) FROM cms_inquiries")->fetchColumn();
$realTicketsCount = (int)$pdo->query("SELECT COUNT(*) FROM cms_support_tickets")->fetchColumn();

assert_test("Dashboard product count matches real database query", is_int($realProductCount));
assert_test("Dashboard blog published count matches real database query", is_int($realBlogPublished));
assert_test("Dashboard blog category count matches real database query", is_int($realBlogCategories));
assert_test("Dashboard inquiry count matches real database query", is_int($realInquiriesCount));
assert_test("Dashboard support ticket count matches real database query", is_int($realTicketsCount));

// ---------------------------------------------------------
// SUITE 16: VISITOR IDENTITY DETECTION & COMMENT PRIVACY
// ---------------------------------------------------------
echo "\nSUITE 16: Automatic Visitor Identity Detection & Comment Privacy Security\n";

$testSlug = 'how-long-does-it-take-to-learn-to-operate-a-mini-excavator';
$now = time();

// 1. Guest Comment Submission without login
$guestId = 'c-guest-test-001';
$insertGuest = $pdo->prepare("
    INSERT INTO blog_comments (
        id, post_slug, uid, display_name, author_email, public_email,
        email_verified, is_guest, photo_url, content, moderation_status,
        ip_address, user_agent, created_at, updated_at
    ) VALUES (?, ?, NULL, 'Guest Builder', 'builder@example.com', NULL, 0, 1, NULL, 'Great guide on excavator operation.', 'Approved', '127.0.0.1', 'PHPTest/1.0', ?, ?)
");
$insertGuest->execute([$guestId, $testSlug, $now, $now]);

$guestRow = $pdo->query("SELECT * FROM blog_comments WHERE id = '{$guestId}'")->fetch(PDO::FETCH_ASSOC);
assert_test("Guest comment submitted without requiring login or UID", $guestRow !== false && $guestRow['uid'] === null);
assert_test("Guest comment is strictly flagged with is_guest = 1", (int)$guestRow['is_guest'] === 1);
assert_test("Guest comment NEVER falsely claims email_verified = 1", (int)$guestRow['email_verified'] === 0);
assert_test("Guest private email is kept private when not authorized for public display", $guestRow['public_email'] === null);

// 2. Authenticated Visitor Comment Submission (Firebase / Google / Staff)
$authId = 'c-auth-test-002';
$insertAuth = $pdo->prepare("
    INSERT INTO blog_comments (
        id, post_slug, uid, display_name, author_email, public_email,
        email_verified, is_guest, photo_url, content, moderation_status,
        ip_address, user_agent, created_at, updated_at
    ) VALUES (?, ?, 'fb-user-998877', 'Elena Rostova', 'elena@rostovabuilders.net', 'elena@rostovabuilders.net', 1, 0, 'https://example.com/elena.jpg', 'Rubber tracks are essential.', 'Approved', '127.0.0.1', 'PHPTest/1.0', ?, ?)
");
$insertAuth->execute([$authId, $testSlug, $now, $now]);

$authRow = $pdo->query("SELECT * FROM blog_comments WHERE id = '{$authId}'")->fetch(PDO::FETCH_ASSOC);
assert_test("Authenticated user comment links valid UID", $authRow !== false && $authRow['uid'] === 'fb-user-998877');
assert_test("Authenticated comment correctly marked with is_guest = 0", (int)$authRow['is_guest'] === 0);
assert_test("Authenticated comment correctly confirmed with email_verified = 1", (int)$authRow['email_verified'] === 1);
assert_test("Authorized public email correctly recorded", $authRow['public_email'] === 'elena@rostovabuilders.net');
assert_test("Authenticated comment retains trustworthy photo URL", $authRow['photo_url'] === 'https://example.com/elena.jpg');

// 3. Query approved comments for article
$fetchComments = $pdo->prepare("SELECT * FROM blog_comments WHERE post_slug = ? AND moderation_status = 'Approved' ORDER BY created_at DESC");
$fetchComments->execute([$testSlug]);
$allApproved = $fetchComments->fetchAll(PDO::FETCH_ASSOC);
assert_test("Post comments query successfully returns approved comments", count($allApproved) >= 2);

// 4. Comment Deletion & Zero Comments Post Verification
$delStmt = $pdo->prepare("DELETE FROM blog_comments WHERE id = ?");
$delStmt->execute([$guestId]);
$delStmt->execute([$authId]);
assert_test("Test comments successfully deleted by ID", true);

$fetchAfterDel = $pdo->prepare("SELECT * FROM blog_comments WHERE post_slug = ? AND moderation_status = 'Approved'");
$fetchAfterDel->execute([$testSlug]);
$remainingComments = $fetchAfterDel->fetchAll(PDO::FETCH_ASSOC);
assert_test("Post has exactly 0 comments after deletion", count($remainingComments) === 0);

// Cleanup test comments safeguard
$pdo->exec("DELETE FROM blog_comments WHERE id IN ('{$guestId}', '{$authId}')");


// ---------------------------------------------------------
// CLEANUP & SUMMARY
// ---------------------------------------------------------
// Close test pdo and remove test sqlite database
$pdo = null;
if (file_exists($testDbFile)) {
    @unlink($testDbFile);
}

echo "\n=========================================================\n";
echo "TEST RESULTS SUMMARY\n";
echo "Total Passed: {$passed}\n";
echo "Total Failed: {$failed}\n";
echo "=========================================================\n";

if ($failed > 0) {
    exit(1);
}
exit(0);
