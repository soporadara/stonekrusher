<?php
// =========================================================
// StoneKrusher - Public & Protected Blog Posts API
// =========================================================

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
require_once __DIR__ . '/security.php';

Security::sendSecurityHeaders();

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

$pdo = get_cms_pdo();
$now = time();

// Public Action: Track View (Increment genuine blog post reader views in database from verified real users)
if (isset($_GET['action']) && $_GET['action'] === 'track_view') {
    $slug = trim($_GET['slug'] ?? '');
    
    // Ignore automated bots, scrapers, and crawlers
    $ua = strtolower($_SERVER['HTTP_USER_AGENT'] ?? '');
    $isBot = empty($ua);
    if (!$isBot) {
        $botPatterns = [
            'bot', 'crawler', 'spider', 'slurp', 'mediapartners', 'adsbot',
            'curl', 'wget', 'python', 'headlesschrome', 'lighthouse',
            'semrush', 'ahrefs', 'mj12bot', 'dotbot', 'petalbot', 'yandex',
            'bingpreview', 'facebookexternalhit', 'whatsapp', 'slackbot',
            'telegrambot', 'twitterbot', 'pinterest', 'googlebot', 'bingbot',
            'duckduckbot', 'baiduspider', 'bytespider', 'screaming frog'
        ];
        foreach ($botPatterns as $pattern) {
            if (strpos($ua, $pattern) !== false) {
                $isBot = true;
                break;
            }
        }
    }

    if (!empty($slug) && $pdo && !$isBot) {
        if (session_status() === PHP_SESSION_NONE && !headers_sent()) {
            @session_start();
        }
        
        $sessionKey = 'stonekrusher_view_' . md5($slug);
        $cookieKey = 'sk_read_' . substr(md5($slug), 0, 12);
        $lastViewTime = max(
            (int)($_SESSION[$sessionKey] ?? 0),
            (int)($_COOKIE[$cookieKey] ?? 0)
        );

        // 4-hour window per unique real user to prevent reload spamming while capturing genuine readership
        $fourHours = 4 * 3600;
        if ((time() - $lastViewTime) >= $fourHours) {
            $_SESSION[$sessionKey] = time();
            @setcookie($cookieKey, (string)time(), [
                'expires' => time() + (86400 * 30),
                'path' => '/',
                'secure' => true,
                'httponly' => true,
                'samesite' => 'Lax'
            ]);

            try {
                $stmt = $pdo->prepare("UPDATE blog_posts SET views = COALESCE(views, 0) + 1 WHERE slug = ? OR id = ?");
                $stmt->execute([$slug, $slug]);

                $stmtV = $pdo->prepare("SELECT views FROM blog_posts WHERE slug = ? OR id = ? LIMIT 1");
                $stmtV->execute([$slug, $slug]);
                $realViews = (int)$stmtV->fetchColumn();

                // Invalidate short dashboard cache so CMS sees genuine user counts immediately
                $cacheFile = __DIR__ . '/.dashboard_cache.json';
                if (file_exists($cacheFile)) {
                    @unlink($cacheFile);
                }

                send_json(200, ['success' => true, 'slug' => $slug, 'views' => $realViews, 'counted' => true, 'is_real_user' => true]);
            } catch (Exception $e) {}
        } else {
            try {
                $stmtV = $pdo->prepare("SELECT views FROM blog_posts WHERE slug = ? OR id = ? LIMIT 1");
                $stmtV->execute([$slug, $slug]);
                $realViews = (int)$stmtV->fetchColumn();
                send_json(200, ['success' => true, 'slug' => $slug, 'views' => $realViews, 'counted' => false, 'is_real_user' => true]);
            } catch (Exception $e) {}
        }
    }
    
    // For bots or empty requests, return current views without incrementing
    if (!empty($slug) && $pdo) {
        try {
            $stmtV = $pdo->prepare("SELECT views FROM blog_posts WHERE slug = ? OR id = ? LIMIT 1");
            $stmtV->execute([$slug, $slug]);
            $realViews = (int)$stmtV->fetchColumn();
            send_json(200, ['success' => true, 'slug' => $slug, 'views' => $realViews, 'counted' => false, 'is_real_user' => false]);
        } catch (Exception $e) {}
    }
    send_json(200, ['success' => false]);
}

if ($method === 'GET') {
    if ($pdo) {
        try {
            // Only expose published posts to the public. Never expose drafts, scheduled, or trash!
            $stmt = $pdo->prepare("SELECT id, slug, title, category, author, featured_image, excerpt, content, status, published_date, views, data_json FROM blog_posts WHERE status = 'Published' AND (scheduled_at IS NULL OR scheduled_at <= ?) ORDER BY updated_at DESC");
            $stmt->execute([$now]);
            $dbRows = $stmt->fetchAll();
            if (!empty($dbRows)) {
                $posts = array_map(function($r) { 
                    $p = json_decode($r['data_json'] ?? '', true);
                    if (!is_array($p)) {
                        $p = [
                            'id' => $r['id'] ?: $r['slug'],
                            'slug' => $r['slug'],
                            'title' => $r['title'],
                            'category' => $r['category'] ?: 'Guide',
                            'image' => $r['featured_image'],
                            'desc' => $r['excerpt'],
                            'excerpt' => $r['excerpt'],
                            'content' => $r['content'],
                            'publishedDate' => $r['published_date'],
                            'date' => $r['published_date'],
                            'status' => $r['status'] ?: 'Published',
                            'author' => $r['author'] ?: 'StoneKrusher Editorial Team'
                        ];
                    }
                    $p['views'] = max(0, (int)($r['views'] ?? ($p['views'] ?? 0)));
                    if (empty($p['author']) || strpos($p['author'], 'KONSTRUCTZ') !== false) {
                        $p['author'] = !empty($r['author']) && strpos($r['author'], 'KONSTRUCTZ') === false ? $r['author'] : 'StoneKrusher Editorial Team';
                    }
                    return $p; 
                }, $dbRows);
                send_json(200, ['posts' => array_values(array_filter($posts))]);
            }
        } catch (Exception $e) {
            // Fallback to json files
        }
    }

    $storagePosts = is_file($storageFile) ? json_decode(file_get_contents($storageFile), true) : null;
    $defaultPosts = is_file($deployedPostsFile) ? json_decode(file_get_contents($deployedPostsFile), true) : [];

    if (!is_array($defaultPosts)) {
        $defaultPosts = [];
    }

    $rawPosts = is_array($storagePosts) ? $storagePosts : $defaultPosts;
    $posts = sanitize_posts($rawPosts);

    // Filter public view for published only
    $filtered = array_values(array_filter($posts, function($p) {
        $s = $p['status'] ?? 'Published';
        return strcasecmp($s, 'Published') === 0;
    }));
    foreach ($filtered as &$fp) {
        if (is_array($fp)) {
            $fp['views'] = max(0, (int)($fp['views'] ?? 0));
            if (empty($fp['author']) || strpos($fp['author'], 'KONSTRUCTZ') !== false) {
                $fp['author'] = 'StoneKrusher Editorial Team';
            }
        }
    }

    send_json(200, ['posts' => $filtered]);
}

// All mutation requests (PUT, POST, DELETE) MUST be authenticated
$currentUser = Security::requireAuth();
Security::requirePermission($currentUser, 'posts.edit');
Security::validateCsrf($currentUser);

if ($method !== 'PUT' && $method !== 'POST') {
    header('Allow: GET, PUT, POST');
    send_json(405, ['error' => 'Method not allowed.']);
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

if ($pdo) {
    try {
        $stmt = $pdo->prepare("INSERT INTO blog_posts (id, slug, title, category, author, featured_image, excerpt, data_json, status, published_date, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE title = VALUES(title), category = VALUES(category), author = VALUES(author), featured_image = VALUES(featured_image), excerpt = VALUES(excerpt), data_json = VALUES(data_json), status = VALUES(status), published_date = VALUES(published_date), updated_at = VALUES(updated_at)");

        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        if ($driver === 'sqlite') {
            $stmt = $pdo->prepare("INSERT INTO blog_posts (id, slug, title, category, author, featured_image, excerpt, data_json, status, published_date, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET title = excluded.title, category = excluded.category, author = excluded.author, featured_image = excluded.featured_image, excerpt = excluded.excerpt, data_json = excluded.data_json, status = excluded.status, published_date = excluded.published_date, updated_at = excluded.updated_at");
        }

        foreach ($sanitizedPosts as $i => $post) {
            $slug = $post['slug'] ?? "post-{$i}";
            $id = (string)($post['id'] ?? $slug);
            $title = $post['title'] ?? '';
            $cat = $post['category'] ?? 'Guide';
            $author = !empty($post['author']) && strpos($post['author'], 'KONSTRUCTZ') === false ? $post['author'] : 'StoneKrusher Editorial Team';
            $img = $post['image'] ?? ($post['featuredImage'] ?? '');
            $excerpt = $post['desc'] ?? ($post['excerpt'] ?? '');
            $status = $post['status'] ?? 'Published';
            $pubDate = $post['publishedDate'] ?? ($post['date'] ?? date('Y-m-d'));
            $updatedAt = time();
            $stmt->execute([
                $id,
                $slug,
                $title,
                $cat,
                $author,
                $img,
                $excerpt,
                json_encode($post, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                $status,
                $pubDate,
                $updatedAt,
                $currentUser['id']
            ]);
        }

        Security::logAudit($currentUser['id'], 'posts.batch_sync', 'posts', null, ['count' => count($sanitizedPosts)]);
    } catch (Exception $e) {
        error_log("Database sync error in blog-posts.php: " . $e->getMessage());
    }
}

if (file_put_contents($storageFile, $encodedPosts . PHP_EOL, LOCK_EX) === false && !$pdo) {
    send_json(500, ['error' => 'Shared blog posts could not be saved.']);
}

@file_put_contents($deployedPostsFile, $encodedPosts . PHP_EOL, LOCK_EX);
$rootDataFile = dirname(__DIR__, 2) . '/data/blog-posts.json';
if (is_dir(dirname($rootDataFile))) {
    @file_put_contents($rootDataFile, $encodedPosts . PHP_EOL, LOCK_EX);
}

send_json(200, ['ok' => true, 'posts' => $sanitizedPosts]);
