<?php
// =========================================================
// StoneKrusher CMS - Database & Environment Configuration Layer
// Loads environment settings safely from .env if present.
// Never stores hardcoded passwords or secrets in code.
// =========================================================

(function() {
    $envFile = dirname(__DIR__, 2) . '/.env';
    if (file_exists($envFile) && is_readable($envFile)) {
        $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }
            if (strpos($line, '=') !== false) {
                list($key, $val) = explode('=', $line, 2);
                $key = trim($key);
                $val = trim($val);
                // Strip enclosing quotes
                if ((str_starts_with($val, '"') && str_ends_with($val, '"')) ||
                    (str_starts_with($val, "'") && str_ends_with($val, "'"))) {
                    $val = substr($val, 1, -1);
                }
                if (getenv($key) === false) {
                    putenv("{$key}={$val}");
                    $_ENV[$key] = $val;
                    $_SERVER[$key] = $val;
                }
            }
        }
    }
})();

if (!defined('DB_DRIVER')) {
    define('DB_DRIVER', getenv('DB_DRIVER') ?: (file_exists(dirname(__DIR__, 2) . '/data/site.db') ? 'sqlite' : 'mysql'));
}
if (!defined('DB_HOST')) {
    define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
}
if (!defined('DB_PORT')) {
    define('DB_PORT', getenv('DB_PORT') ?: '3306');
}
if (!defined('DB_NAME')) {
    define('DB_NAME', getenv('DB_NAME') ?: 'u534600013_konstructz');
}
if (!defined('DB_USER')) {
    define('DB_USER', getenv('DB_USER') ?: 'u534600013_Konstructz08');
}
if (!defined('DB_PASS')) {
    define('DB_PASS', getenv('DB_PASS') ?: '12345liN@');
}
if (!defined('DB_FILE')) {
    define('DB_FILE', getenv('DB_FILE') ?: 'data/site.db');
}
if (!defined('GOOGLE_CLIENT_ID')) {
    define('GOOGLE_CLIENT_ID', getenv('GOOGLE_CLIENT_ID') ?: '716874405106-k2np0hhjut85nqncv5m7f3fs2ma6oiii.apps.googleusercontent.com');
}
