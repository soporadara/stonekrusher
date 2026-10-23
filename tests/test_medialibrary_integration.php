<?php
/**
 * Test Suite: Media Library Integration, SSO Authentication & Exemptions
 */

$root = dirname(__DIR__);
$indexFile = $root . '/public/medialibrary/index.php';

echo "=========================================================\n";
echo "MEDIA LIBRARY INTEGRATION & CMS SSO SECURITY TEST\n";
echo "=========================================================\n";

$passCount = 0;
$failCount = 0;

function assertTest(bool $condition, string $msg) {
    global $passCount, $failCount;
    if ($condition) {
        echo "  [PASS] " . $msg . "\n";
        $passCount++;
    } else {
        echo "  [FAIL] " . $msg . "\n";
        $failCount++;
    }
}

// 1. File existence
assertTest(is_file($indexFile), "public/medialibrary/index.php exists");

// 2. Syntax validation
$syntaxCheck = shell_exec("php -l " . escapeshellarg($indexFile));
assertTest(strpos($syntaxCheck, 'No syntax errors detected') !== false, "index.php has valid PHP syntax");

// 3. Inspect index.php content for requirements
$content = file_get_contents($indexFile);

// CMS SSO Authentication Guard
assertTest(strpos($content, 'function getCmsUser(): ?array') !== false, "getCmsUser function implemented");
assertTest(strpos($content, 'Security::getCurrentUser()') !== false, "Security::getCurrentUser integrated for CMS SSO");
assertTest(strpos($content, 'Authentication required. Please log into StoneKrusher CMS first.') !== false, "Unauthenticated access blocked with prompt");
assertTest(strpos($content, '/ourcmskiuq/?redirect=') !== false, "Redirect to CMS login configured");

// Delete password exemption
assertTest(strpos($content, 'function verifyDeletePassword($password)') !== false, "verifyDeletePassword function exists");
assertTest(preg_match('/function verifyDeletePassword\s*\(\$password\)\s*\{\s*\/\/[^\n]*\n\s*return true;/i', $content) === 1, "verifyDeletePassword unconditionally returns true (delete pw exempt)");
assertTest(strpos($content, 'if (!confirm(message') !== false, "JS addDeletePassword uses standard confirm dialog without password prompt");

// Create user exemption
assertTest(strpos($content, 'User creation is managed exclusively in StoneKrusher CMS Team & Roles.') !== false, "Create user action blocked with CMS reference");
assertTest(strpos($content, 'action="create_user"') === false, "Create user form completely removed from UI");

// Features check
$featuresDir = $root . '/public/medialibrary/features';
$requiredFeatures = [
    'ai_bg_remove.php', 'config.php', 'duplicate_finder.php', 'feature_db.php',
    'file_converter.php', 'folder_meta.php', 'image_replace.php', 'properties.php',
    'sorting.php', 'storage_dashboard.php', 'version_history.php'
];
foreach ($requiredFeatures as $f) {
    $featPath = $featuresDir . '/' . $f;
    $featSyntax = shell_exec("php -l " . escapeshellarg($featPath));
    assertTest(is_file($featPath) && strpos($featSyntax, 'No syntax errors detected') !== false, "Feature {$f} exists and is syntactically valid");
}

// 4. Test unauthenticated AJAX request returns 401 JSON
$cmd = "php -r " . escapeshellarg('
$_SERVER["REQUEST_METHOD"] = "POST";
$_SERVER["HTTP_X_REQUESTED_WITH"] = "XMLHttpRequest";
$_SERVER["PHP_SELF"] = "/medialibrary/index.php";
$_SERVER["SCRIPT_NAME"] = "/medialibrary/index.php";
$_SERVER["REQUEST_URI"] = "/medialibrary/index.php";
$_SERVER["HTTP_HOST"] = "localhost";
$_POST["action"] = "load_files";
include ' . escapeshellarg($indexFile) . ';
');

$output = shell_exec($cmd);
$json = json_decode($output, true);
assertTest(is_array($json) && !empty($json['error']) && strpos($json['error'], 'Authentication required') !== false, "Unauthenticated AJAX request receives 401 JSON error");

echo "=========================================================\n";
echo "SUMMARY: Passed {$passCount}, Failed {$failCount}\n";
echo "=========================================================\n";

if ($failCount > 0) exit(1);
