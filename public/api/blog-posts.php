<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$storageFile = __DIR__ . '/blog-posts-data.json';
$deployedPostsFile = __DIR__ . '/blog-posts-default.json';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function send_json($status, $payload) {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function sanitize_posts($posts) {
    if (!is_array($posts)) {
        return [];
    }
    $clean = [];
    foreach ($posts as $post) {
        if (is_array($post) && (!empty($post['id']) || !empty($post['slug']) || !empty($post['title']))) {
            $clean[] = $post;
        }
    }
    return $clean;
}

if (file_exists(__DIR__ . '/config.php')) {
    require_once __DIR__ . '/config.php';
}

$dbHost = defined('DB_HOST') ? DB_HOST : (getenv('DB_HOST') ?: 'localhost');
$dbName = defined('DB_NAME') ? DB_NAME : (getenv('DB_NAME') ?: 'u534600013_konstructz');
$dbUser = defined('DB_USER') ? DB_USER : (getenv('DB_USER') ?: 'u534600013_Konstructz08');
$dbPass = defined('DB_PASS') ? DB_PASS : (getenv('DB_PASS') ?: '');

function ensure_tables_exist($pdo) {
    if (!$pdo) return;
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS blog_posts (
            id VARCHAR(255) PRIMARY KEY,
            slug VARCHAR(255) UNIQUE NOT NULL,
            title VARCHAR(500) NOT NULL,
            category VARCHAR(100),
            author VARCHAR(255) DEFAULT 'Admin KONSTRUCTZ',
            featured_image VARCHAR(1000),
            excerpt TEXT,
            data_json TEXT NOT NULL,
            status VARCHAR(50) DEFAULT 'Published',
            published_date VARCHAR(50),
            updated_at BIGINT
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS posts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            uid VARCHAR(255),
            title VARCHAR(500) NOT NULL,
            slug VARCHAR(255) NOT NULL,
            excerpt TEXT,
            content LONGTEXT,
            featuredImage VARCHAR(1000),
            imageStoragePath VARCHAR(1000),
            categoryId VARCHAR(255),
            status VARCHAR(50) DEFAULT 'Published',
            visibility VARCHAR(50) DEFAULT 'public'
        )");
    } catch (Exception $e) {}
}

function get_pdo() {
    global $dbHost, $dbName, $dbUser, $dbPass;
    if (empty($dbUser)) return null;
    try {
        $pdo = new PDO("mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4", $dbUser, $dbPass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
        ensure_tables_exist($pdo);
        return $pdo;
    } catch (Exception $e) {
        return null;
    }
}

if ($method === 'GET') {
    $pdo = get_pdo();
    if ($pdo) {
        // 1. Try reading from CMS 'posts' table (title, slug, content, featuredImage, excerpt)
        try {
            $stmt = $pdo->query("SELECT * FROM posts WHERE status = 'Published' OR status = 'published' ORDER BY id DESC");
            $dbRows = $stmt->fetchAll();
            if (!empty($dbRows)) {
                $posts = array_map(function($r) {
                    $rawContent = $r['content'] ?? '';
                    return [
                        'id' => (string)($r['id'] ?? $r['uid'] ?? ''),
                        'slug' => $r['slug'] ?? '',
                        'title' => $r['title'] ?? '',
                        'category' => $r['categoryId'] ?? 'Guide',
                        'image' => $r['featuredImage'] ?? '',
                        'desc' => strip_tags($r['excerpt'] ?? $rawContent),
                        'status' => 'Published',
                        'date' => date('F j, Y'),
                        'publishedDate' => date('Y-m-d'),
                        'sections' => [
                            [
                                'h2' => '',
                                'body' => $rawContent
                            ]
                        ]
                    ];
                }, $dbRows);
                send_json(200, ['posts' => $posts]);
            }
        } catch (Exception $e) {}

        // 2. Try reading from 'blog_posts' table (data_json)
        try {
            $stmt = $pdo->query("SELECT data_json FROM blog_posts ORDER BY updated_at DESC");
            $dbRows = $stmt->fetchAll();
            if (!empty($dbRows)) {
                $posts = array_map(function($r) { return json_decode($r['data_json'], true); }, $dbRows);
                send_json(200, ['posts' => $posts]);
            }
        } catch (Exception $e) {}
    }

    $storagePosts = is_file($storageFile) ? json_decode(file_get_contents($storageFile), true) : null;
    $defaultPosts = is_file($deployedPostsFile) ? json_decode(file_get_contents($deployedPostsFile), true) : [];

    if (!is_array($defaultPosts)) {
        $defaultPosts = [];
    }

    $rawPosts = is_array($storagePosts) ? $storagePosts : $defaultPosts;
    $posts = sanitize_posts($rawPosts);

    send_json(200, ['posts' => $posts]);
}

if ($method !== 'PUT') {
    header('Allow: GET, PUT');
    send_json(405, ['error' => 'Method not allowed.']);
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host = $_SERVER['HTTP_HOST'] ?? '';
if ($origin !== '') {
    $originHost = parse_url($origin, PHP_URL_HOST);
    $requestHost = preg_replace('/:\d+$/', '', $host);
    if (!$originHost || strcasecmp($originHost, $requestHost) !== 0) {
        send_json(403, ['error' => 'Cross-site updates are not allowed.']);
    }
}

$contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength > 10000000) {
    send_json(413, ['error' => 'Blog data is too large.']);
}

$rawBody = file_get_contents('php://input');
$payload = json_decode($rawBody, true);
if (!is_array($payload) || !isset($payload['posts']) || !is_array($payload['posts'])) {
    send_json(400, ['error' => 'Expected a posts array.']);
}

$sanitizedPosts = sanitize_posts($payload['posts']);

$encodedPosts = json_encode(
    $sanitizedPosts,
    JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
);
if ($encodedPosts === false) {
    send_json(400, ['error' => 'Blog data could not be encoded.']);
}

$pdo = get_pdo();
if ($pdo) {
    try {
        $pdo->exec("DELETE FROM blog_posts");
        $stmt = $pdo->prepare("INSERT INTO blog_posts (id, slug, title, category, author, featured_image, excerpt, data_json, status, published_date, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        foreach ($sanitizedPosts as $i => $post) {
            $slug = $post['slug'] ?? "post-{$i}";
            $id = (string)($post['id'] ?? $slug);
            $title = $post['title'] ?? '';
            $cat = $post['category'] ?? 'Guide';
            $author = $post['author'] ?? 'Admin KONSTRUCTZ';
            $img = $post['image'] ?? '';
            $excerpt = $post['desc'] ?? '';
            $status = $post['status'] ?? 'Published';
            $pubDate = $post['publishedDate'] ?? ($post['date'] ?? date('Y-m-d'));
            $updatedAt = time();
            $stmt->execute([$id, $slug, $title, $cat, $author, $img, $excerpt, json_encode($post, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), $status, $pubDate, $updatedAt]);
        }
    } catch (Exception $e) {
        // Fall back to JSON file write if MySQL query fails
    }
}

if (file_put_contents($storageFile, $encodedPosts . PHP_EOL, LOCK_EX) === false && !$pdo) {
    send_json(500, ['error' => 'Shared blog posts could not be saved.']);
}

// Also keep deployed default file and workspace data file in sync
@file_put_contents($deployedPostsFile, $encodedPosts . PHP_EOL, LOCK_EX);
$rootDataFile = __DIR__ . '/../../data/blog-posts.json';
if (is_dir(dirname($rootDataFile))) {
    @file_put_contents($rootDataFile, $encodedPosts . PHP_EOL, LOCK_EX);
}

send_json(200, ['ok' => true, 'posts' => $sanitizedPosts]);
