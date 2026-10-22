<?php
// =========================================================
// StoneKrusher CMS - Core Administration REST API
// =========================================================

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/security.php';

Security::sendSecurityHeaders();

$action = $_GET['action'] ?? ($_POST['action'] ?? '');
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$ip = Security::getClientIp();

// Global IP ban check
if (Security::isIpBlocked($ip)) {
    http_response_code(403);
    echo json_encode(['error' => 'Access denied: Your IP address is blocked.']);
    exit;
}

// Authentication required for all CMS API endpoints
$currentUser = Security::requireAuth();

// CSRF validation for state-changing methods
if (in_array($method, ['POST', 'PUT', 'DELETE', 'PATCH'])) {
    Security::validateCsrf($currentUser);
}

function format_bytes_cms($bytes) {
    if (!$bytes || $bytes <= 0) return '0 B';
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $i = (int)floor(log($bytes, 1024));
    return round($bytes / pow(1024, $i), 1) . ' ' . ($units[$i] ?? 'B');
}

function sanitize_cms_html($html) {
    if (empty($html)) return '';
    // Strip dangerous script tags and content
    $clean = preg_replace('/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i', '', $html);
    // Strip on* event handlers (onerror, onclick, onload, etc.)
    $clean = preg_replace('/\s+on[a-z]+\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $clean);
    // Strip javascript: URLs in href/src
    $clean = preg_replace('/(href|src)\s*=\s*([\'"]?)\s*javascript:[^"\'\s>]*/i', '$1=$2#', $clean);
    // Strip style tags that could include expressions
    $clean = preg_replace('/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/i', '', $clean);
    return $clean;
}

function sync_blog_posts_to_json($pdo) {
    $dataDir = dirname(__DIR__, 2) . '/data';
    $publicApiDir = __DIR__;
    try {
        $stmt = $pdo->query("SELECT data_json FROM blog_posts WHERE status = 'Published' ORDER BY updated_at DESC");
        $rows = $stmt->fetchAll(PDO::FETCH_COLUMN);
        $posts = [];
        foreach ($rows as $r) {
            $dec = json_decode($r, true);
            if ($dec) $posts[] = $dec;
        }
        $jsonContent = json_encode($posts, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n";
        @file_put_contents($dataDir . '/blog-posts.json', $jsonContent);
        @file_put_contents($publicApiDir . '/blog-posts-data.json', $jsonContent);
        @file_put_contents($publicApiDir . '/blog-posts-default.json', $jsonContent);
        return count($posts);
    } catch (Exception $e) {
        error_log("Blog sync error: " . $e->getMessage());
        return 0;
    }
}

function sync_products_to_catalog($pdo) {
    $catFile = dirname(__DIR__, 2) . '/src/data/equipment-products.json';
    try {
        $stmt = $pdo->query("SELECT data_json, name, slug, sku, category, price, image_url, gallery_json, description, status FROM products WHERE status = 'Published' ORDER BY updated_at DESC");
        $rows = $stmt->fetchAll();
        $prods = [];
        foreach ($rows as $r) {
            $item = [];
            if (!empty($r['data_json'])) {
                $item = json_decode($r['data_json'], true) ?: [];
            }
            $item['name'] = $r['name'];
            $item['slug'] = $r['slug'];
            $item['sku'] = $r['sku'] ?: ($item['sku'] ?? '');
            $item['category'] = $r['category'] ?: ($item['category'] ?? 'Machinery');
            $item['price'] = is_numeric($r['price']) ? (float)$r['price'] : ($r['price'] ?: ($item['price'] ?? 0));
            $item['image'] = $r['image_url'] ?: ($item['image'] ?? '');
            $item['desc'] = $r['description'] ?: ($item['desc'] ?? '');
            $item['status'] = $r['status'] ?: 'Published';
            if (!empty($r['gallery_json'])) {
                $item['images'] = json_decode($r['gallery_json'], true) ?: ($item['images'] ?? []);
            }
            $prods[] = $item;
        }
        $jsonContent = json_encode($prods, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n";
        @file_put_contents($catFile, $jsonContent);
        return count($prods);
    } catch (Exception $e) {
        error_log("Product sync error: " . $e->getMessage());
        return 0;
    }
}

$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true) ?: $_POST;
$pdo = get_cms_pdo();
$now = time();

switch ($action) {

    // =========================================================
    // 1. DASHBOARD OVERVIEW METRICS (AUTHORITATIVE & REAL)
    // =========================================================
    case 'dashboard_metrics':
        Security::requirePermission($currentUser, 'posts.view');

        // Blog counts
        $postCounts = [
            'total' => (int)$pdo->query("SELECT COUNT(*) FROM blog_posts WHERE status != 'Trash'")->fetchColumn(),
            'published' => (int)$pdo->query("SELECT COUNT(*) FROM blog_posts WHERE status = 'Published'")->fetchColumn(),
            'draft' => (int)$pdo->query("SELECT COUNT(*) FROM blog_posts WHERE status = 'Draft'")->fetchColumn(),
            'scheduled' => (int)$pdo->query("SELECT COUNT(*) FROM blog_posts WHERE status = 'Scheduled'")->fetchColumn(),
            'archived' => (int)$pdo->query("SELECT COUNT(*) FROM blog_posts WHERE status = 'Archived'")->fetchColumn(),
            'trash' => (int)$pdo->query("SELECT COUNT(*) FROM blog_posts WHERE status = 'Trash'")->fetchColumn(),
        ];

        // Catalog & Media counts
        $productCount = (int)$pdo->query("SELECT COUNT(*) FROM products WHERE status != 'Archived'")->fetchColumn();
        $productPublishedCount = (int)$pdo->query("SELECT COUNT(*) FROM products WHERE status = 'Published'")->fetchColumn();
        $productCategoriesCount = (int)$pdo->query("SELECT COUNT(DISTINCT category) FROM products WHERE category IS NOT NULL AND category != ''")->fetchColumn();
        $blogCategoryCount = (int)$pdo->query("SELECT COUNT(*) FROM blog_categories")->fetchColumn();
        
        $mediaCount = (int)$pdo->query("SELECT COUNT(*) FROM cms_media")->fetchColumn();
        $mediaSizeBytes = (int)$pdo->query("SELECT COALESCE(SUM(file_size), 0) FROM cms_media")->fetchColumn();

        // CRM & Inquiries counts
        $inquiriesCount = 0;
        $inquiriesNew = 0;
        $inquiriesContacted = 0;
        $inquiriesQuoted = 0;
        $inquiriesWon = 0;
        $inquiriesLost = 0;
        $pipelineValue = 0.0;
        try {
            $inquiriesCount = (int)$pdo->query("SELECT COUNT(*) FROM cms_inquiries")->fetchColumn();
            $inquiriesNew = (int)$pdo->query("SELECT COUNT(*) FROM cms_inquiries WHERE status = 'New'")->fetchColumn();
            $inquiriesContacted = (int)$pdo->query("SELECT COUNT(*) FROM cms_inquiries WHERE status = 'Contacted'")->fetchColumn();
            $inquiriesQuoted = (int)$pdo->query("SELECT COUNT(*) FROM cms_inquiries WHERE status = 'Quoted'")->fetchColumn();
            $inquiriesWon = (int)$pdo->query("SELECT COUNT(*) FROM cms_inquiries WHERE status = 'Won'")->fetchColumn();
            $inquiriesLost = (int)$pdo->query("SELECT COUNT(*) FROM cms_inquiries WHERE status = 'Lost'")->fetchColumn();
            $pipelineValue = (float)$pdo->query("SELECT COALESCE(SUM(estimated_value), 0) FROM cms_inquiries WHERE status NOT IN ('Lost')")->fetchColumn();
        } catch (Exception $e) {}

        // Support Tickets counts
        $ticketsCount = 0;
        $ticketsOpen = 0;
        $ticketsInProgress = 0;
        $ticketsResolved = 0;
        $ticketsHighPriority = 0;
        try {
            $ticketsCount = (int)$pdo->query("SELECT COUNT(*) FROM cms_support_tickets")->fetchColumn();
            $ticketsOpen = (int)$pdo->query("SELECT COUNT(*) FROM cms_support_tickets WHERE status = 'Open'")->fetchColumn();
            $ticketsInProgress = (int)$pdo->query("SELECT COUNT(*) FROM cms_support_tickets WHERE status = 'In Progress'")->fetchColumn();
            $ticketsResolved = (int)$pdo->query("SELECT COUNT(*) FROM cms_support_tickets WHERE status = 'Resolved'")->fetchColumn();
            $ticketsHighPriority = (int)$pdo->query("SELECT COUNT(*) FROM cms_support_tickets WHERE priority = 'High' AND status != 'Resolved'")->fetchColumn();
        } catch (Exception $e) {}

        $resolutionRate = $ticketsCount > 0 ? round(($ticketsResolved / $ticketsCount) * 100) : 0;

        // Security counts
        $activeBlocksCount = (int)$pdo->query("SELECT COUNT(*) FROM cms_security_blocks WHERE expires_at IS NULL OR expires_at > {$now}")->fetchColumn();
        $failedLogins24h = (int)$pdo->query("SELECT COUNT(*) FROM cms_login_attempts WHERE success = 0 AND created_at > " . ($now - 86400))->fetchColumn();
        $activeLockouts = (int)$pdo->query("SELECT COUNT(*) FROM cms_users WHERE locked_until > {$now}")->fetchColumn();
        $activeSessions = (int)$pdo->query("SELECT COUNT(*) FROM cms_sessions WHERE is_revoked = 0 AND expires_at > {$now}")->fetchColumn();

        // System & Database Health
        $dbDriver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        $dbSizeFormatted = 'N/A';
        if ($dbDriver === 'sqlite') {
            $sqlitePath = dirname(__DIR__, 2) . '/data/site.db';
            if (file_exists($sqlitePath)) {
                $dbSizeFormatted = format_bytes_cms(filesize($sqlitePath));
            }
        }
        $opcacheActive = function_exists('opcache_get_status') && !empty(opcache_get_status()['opcache_enabled']);

        // External Analytics Integrations Status (Honest reporting)
        $ga4Id = Security::getSetting('ga4_measurement_id', '');
        $gscUrl = Security::getSetting('gsc_site_url', '');
        $analyticsIntegrations = [
            'ga4' => [
                'name' => 'Google Analytics 4',
                'connected' => !empty($ga4Id),
                'id' => $ga4Id ?: null,
                'status_label' => !empty($ga4Id) ? 'Connected' : 'Not Configured'
            ],
            'gsc' => [
                'name' => 'Google Search Console',
                'connected' => !empty($gscUrl),
                'url' => $gscUrl ?: null,
                'status_label' => !empty($gscUrl) ? 'Connected' : 'Not Configured'
            ]
        ];

        // Real 7-day activity tracking from persisted timestamps
        $activity7d = [];
        for ($dayOffset = 6; $dayOffset >= 0; $dayOffset--) {
            $dayStart = strtotime("today -{$dayOffset} days 00:00:00");
            $dayEnd = strtotime("today -{$dayOffset} days 23:59:59");
            $dayLabel = date('D', $dayStart);
            $dateStr = date('Y-m-d', $dayStart);

            $inqDay = 0;
            $updatesDay = 0;
            try {
                $inqStmt = $pdo->prepare("SELECT COUNT(*) FROM cms_inquiries WHERE created_at BETWEEN ? AND ?");
                $inqStmt->execute([$dayStart, $dayEnd]);
                $inqDay = (int)$inqStmt->fetchColumn();

                $auditStmt = $pdo->prepare("SELECT COUNT(*) FROM cms_audit_logs WHERE created_at BETWEEN ? AND ?");
                $auditStmt->execute([$dayStart, $dayEnd]);
                $updatesDay = (int)$auditStmt->fetchColumn();
            } catch (Exception $e) {}

            $activity7d[] = [
                'date' => $dateStr,
                'day' => $dayLabel,
                'inquiries' => $inqDay,
                'activity' => $updatesDay
            ];
        }

        // Recent posts (5)
        $recentPosts = $pdo->query("SELECT id, slug, title, category, status, published_date, updated_at FROM blog_posts ORDER BY updated_at DESC LIMIT 5")->fetchAll();

        // Recent activity (8)
        $recentActivity = $pdo->query("SELECT a.*, u.username FROM cms_audit_logs a LEFT JOIN cms_users u ON a.user_id = u.id ORDER BY a.created_at DESC LIMIT 8")->fetchAll();

        // Recent inquiries (5)
        $recentInquiries = [];
        try {
            $recentInquiries = $pdo->query("SELECT id, name, company, email, machine_model, estimated_value, status, created_at FROM cms_inquiries ORDER BY created_at DESC LIMIT 5")->fetchAll();
        } catch (Exception $e) {}

        // Recent tickets (5)
        $recentTickets = [];
        try {
            $recentTickets = $pdo->query("SELECT id, ticket_number, customer_name, subject, priority, status, created_at FROM cms_support_tickets ORDER BY created_at DESC LIMIT 5")->fetchAll();
        } catch (Exception $e) {}

        echo json_encode([
            'success' => true,
            'metrics' => [
                'posts' => $postCounts,
                'products' => [
                    'total' => $productCount,
                    'published' => $productPublishedCount,
                    'categories' => $productCategoriesCount
                ],
                'categories' => [
                    'blog' => $blogCategoryCount,
                    'catalog' => $productCategoriesCount
                ],
                'media' => [
                    'total' => $mediaCount,
                    'size_bytes' => $mediaSizeBytes,
                    'size_formatted' => format_bytes_cms($mediaSizeBytes)
                ],
                'inquiries' => [
                    'total' => $inquiriesCount,
                    'new' => $inquiriesNew,
                    'contacted' => $inquiriesContacted,
                    'quoted' => $inquiriesQuoted,
                    'won' => $inquiriesWon,
                    'lost' => $inquiriesLost,
                    'pipeline_value' => $pipelineValue
                ],
                'support' => [
                    'total' => $ticketsCount,
                    'open' => $ticketsOpen,
                    'in_progress' => $ticketsInProgress,
                    'resolved' => $ticketsResolved,
                    'high_priority' => $ticketsHighPriority,
                    'resolution_rate' => $resolutionRate
                ],
                'security' => [
                    'active_blocks' => $activeBlocksCount,
                    'failed_logins_24h' => $failedLogins24h,
                    'active_lockouts' => $activeLockouts,
                    'active_sessions' => $activeSessions
                ],
                'system' => [
                    'db_driver' => $dbDriver,
                    'db_size_formatted' => $dbSizeFormatted,
                    'php_version' => PHP_VERSION,
                    'opcache_active' => $opcacheActive,
                    'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'PHP Engine'
                ],
                'analytics' => $analyticsIntegrations,
                'activity_chart' => $activity7d
            ],
            'recent_posts' => $recentPosts,
            'recent_activity' => $recentActivity,
            'recent_inquiries' => $recentInquiries,
            'recent_tickets' => $recentTickets
        ]);
        exit;

    // =========================================================
    // 2. BLOG MANAGEMENT
    // =========================================================
    case 'posts_list':
        Security::requirePermission($currentUser, 'posts.view');

        $status = $_GET['status'] ?? '';
        $category = $_GET['category'] ?? '';
        $search = trim($_GET['search'] ?? '');
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = max(1, min(100, (int)($_GET['limit'] ?? 10)));
        $offset = ($page - 1) * $limit;

        $where = [];
        $params = [];

        if (!empty($status)) {
            $where[] = "status = ?";
            $params[] = $status;
        } else {
            // Default: do not show Trash unless specifically requested
            $where[] = "status != 'Trash'";
        }

        if (!empty($category)) {
            $where[] = "LOWER(category) = LOWER(?)";
            $params[] = $category;
        }

        if (!empty($search)) {
            $where[] = "(title LIKE ? OR slug LIKE ? OR excerpt LIKE ?)";
            $params[] = "%{$search}%";
            $params[] = "%{$search}%";
            $params[] = "%{$search}%";
        }

        $whereSql = count($where) ? "WHERE " . implode(" AND ", $where) : "";

        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM blog_posts {$whereSql}");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        $sql = "SELECT id, slug, title, category, author, featured_image, excerpt, status, published_date, updated_at, created_by 
                FROM blog_posts {$whereSql} 
                ORDER BY updated_at DESC LIMIT {$limit} OFFSET {$offset}";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $posts = $stmt->fetchAll();

        echo json_encode([
            'success' => true,
            'posts' => $posts,
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'total_pages' => ceil($total / $limit)
        ]);
        exit;

    case 'post_get':
        Security::requirePermission($currentUser, 'posts.view');

        $id = $_GET['id'] ?? ($_GET['slug'] ?? '');
        $stmt = $pdo->prepare("SELECT * FROM blog_posts WHERE id = ? OR slug = ?");
        $stmt->execute([$id, $id]);
        $post = $stmt->fetch();

        if (!$post) {
            http_response_code(404);
            echo json_encode(['error' => 'Post not found']);
            exit;
        }

        // Get revision history
        $revStmt = $pdo->prepare("SELECT id, title, created_by, created_at FROM blog_revisions WHERE post_id = ? ORDER BY created_at DESC LIMIT 10");
        $revStmt->execute([$post['id']]);
        $revisions = $revStmt->fetchAll();

        echo json_encode([
            'success' => true,
            'post' => $post,
            'revisions' => $revisions
        ]);
        exit;

    case 'post_save':
        $isNew = empty($input['id']);
        $postId = $isNew ? ('post-' . uniqid()) : trim($input['id']);

        if ($isNew) {
            Security::requirePermission($currentUser, 'posts.create');
        } else {
            Security::requirePermission($currentUser, 'posts.edit');
        }

        $title = trim($input['title'] ?? '');
        $slug = trim($input['slug'] ?? '');
        if (empty($title)) {
            http_response_code(400);
            echo json_encode(['error' => 'Article title is required.']);
            exit;
        }

        if (empty($slug)) {
            $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $title));
            $slug = trim($slug, '-');
        }

        // Check slug collision
        $slugStmt = $pdo->prepare("SELECT id FROM blog_posts WHERE slug = ? AND id != ?");
        $slugStmt->execute([$slug, $postId]);
        if ($slugStmt->fetch()) {
            $slug = $slug . '-' . time();
        }

        $category = trim($input['category'] ?? 'Guide');
        $author = trim($input['author'] ?? $currentUser['full_name'] ?: 'Admin KONSTRUCTZ');
        $featuredImage = trim($input['featured_image'] ?? ($input['image'] ?? ''));
        $excerpt = trim($input['excerpt'] ?? ($input['desc'] ?? ''));
        $content = sanitize_cms_html((string)($input['content'] ?? ''));
        $status = trim($input['status'] ?? 'Draft');
        $tagsJson = is_array($input['tags'] ?? null) ? json_encode($input['tags']) : ($input['tags_json'] ?? '[]');
        $pubDate = trim($input['published_date'] ?? ($input['publishedDate'] ?? date('Y-m-d')));

        // Check publish permission if setting to Published
        if ($status === 'Published' && !Security::hasPermission($currentUser, 'posts.publish')) {
            $status = 'Draft';
        }

        // If existing post, save revision before updating
        if (!$isNew) {
            $prevStmt = $pdo->prepare("SELECT * FROM blog_posts WHERE id = ?");
            $prevStmt->execute([$postId]);
            $prevPost = $prevStmt->fetch();

            if ($prevPost) {
                $revId = 'rev-' . bin2hex(random_bytes(10));
                $pdo->prepare("INSERT INTO blog_revisions (id, post_id, title, data_json, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)")
                    ->execute([
                        $revId,
                        $postId,
                        $prevPost['title'],
                        $prevPost['data_json'] ?: json_encode($prevPost),
                        $currentUser['id'],
                        $now
                    ]);
            }
        }

        // Construct full json for website compatibility
        $structuredData = [
            'id' => $slug,
            'slug' => $slug,
            'title' => $title,
            'category' => $category,
            'author' => $author,
            'image' => $featuredImage,
            'featuredImage' => $featuredImage,
            'desc' => $excerpt,
            'excerpt' => $excerpt,
            'content' => $content,
            'status' => $status,
            'tags' => json_decode($tagsJson, true) ?: [],
            'publishedDate' => $pubDate,
            'date' => $pubDate,
            'updatedAt' => $now
        ];
        $dataJson = json_encode($structuredData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        if ($isNew) {
            $insertStmt = $pdo->prepare("INSERT INTO blog_posts (id, slug, title, category, author, featured_image, excerpt, content, data_json, status, tags_json, published_date, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $insertStmt->execute([
                $postId,
                $slug,
                $title,
                $category,
                $author,
                $featuredImage,
                $excerpt,
                $content,
                $dataJson,
                $status,
                $tagsJson,
                $pubDate,
                $now,
                $currentUser['id']
            ]);
            Security::logAudit($currentUser['id'], 'post.create', 'post', $postId, ['title' => $title, 'status' => $status]);
        } else {
            $updateStmt = $pdo->prepare("UPDATE blog_posts SET slug = ?, title = ?, category = ?, author = ?, featured_image = ?, excerpt = ?, content = ?, data_json = ?, status = ?, tags_json = ?, published_date = ?, updated_at = ? WHERE id = ?");
            $updateStmt->execute([
                $slug,
                $title,
                $category,
                $author,
                $featuredImage,
                $excerpt,
                $content,
                $dataJson,
                $status,
                $tagsJson,
                $pubDate,
                $now,
                $postId
            ]);
            Security::logAudit($currentUser['id'], 'post.update', 'post', $postId, ['title' => $title, 'status' => $status]);
        }

        sync_blog_posts_to_json($pdo);

        echo json_encode([
            'success' => true,
            'message' => $isNew ? 'Post created successfully.' : 'Post updated successfully.',
            'post' => $structuredData
        ]);
        exit;

    case 'post_trash':
        Security::requirePermission($currentUser, 'posts.edit');
        $id = $input['id'] ?? ($_GET['id'] ?? '');

        $pdo->prepare("UPDATE blog_posts SET status = 'Trash', updated_at = ? WHERE id = ?")->execute([$now, $id]);
        Security::logAudit($currentUser['id'], 'post.trash', 'post', $id);
        sync_blog_posts_to_json($pdo);

        echo json_encode(['success' => true, 'message' => 'Post moved to trash.']);
        exit;

    case 'post_restore':
        Security::requirePermission($currentUser, 'posts.edit');
        $id = $input['id'] ?? ($_GET['id'] ?? '');

        $pdo->prepare("UPDATE blog_posts SET status = 'Draft', updated_at = ? WHERE id = ?")->execute([$now, $id]);
        Security::logAudit($currentUser['id'], 'post.restore', 'post', $id);
        sync_blog_posts_to_json($pdo);

        echo json_encode(['success' => true, 'message' => 'Post restored to drafts.']);
        exit;

    case 'post_delete':
        Security::requirePermission($currentUser, 'posts.delete');
        $id = $input['id'] ?? ($_GET['id'] ?? '');

        $pdo->prepare("DELETE FROM blog_posts WHERE id = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM blog_revisions WHERE post_id = ?")->execute([$id]);
        Security::logAudit($currentUser['id'], 'post.delete_permanent', 'post', $id);
        sync_blog_posts_to_json($pdo);

        echo json_encode(['success' => true, 'message' => 'Post permanently deleted.']);
        exit;

    case 'post_restore_revision':
        Security::requirePermission($currentUser, 'posts.edit');
        $revId = $input['revision_id'] ?? '';

        $revStmt = $pdo->prepare("SELECT * FROM blog_revisions WHERE id = ?");
        $revStmt->execute([$revId]);
        $rev = $revStmt->fetch();

        if (!$rev) {
            http_response_code(404);
            echo json_encode(['error' => 'Revision not found.']);
            exit;
        }

        $revData = json_decode($rev['data_json'], true) ?: [];
        $title = $rev['title'];
        $excerpt = $revData['desc'] ?? ($revData['excerpt'] ?? '');
        $content = $revData['content'] ?? '';
        $featuredImage = $revData['image'] ?? ($revData['featuredImage'] ?? '');
        $category = $revData['category'] ?? 'Guide';

        $pdo->prepare("UPDATE blog_posts SET title = ?, excerpt = ?, content = ?, featured_image = ?, category = ?, data_json = ?, updated_at = ? WHERE id = ?")
            ->execute([
                $title,
                $excerpt,
                $content,
                $featuredImage,
                $category,
                $rev['data_json'],
                $now,
                $rev['post_id']
            ]);

        Security::logAudit($currentUser['id'], 'post.restore_revision', 'post', $rev['post_id'], ['revision_id' => $revId]);

        echo json_encode(['success' => true, 'message' => 'Post restored from revision successfully.']);
        exit;

    case 'check_slug':
        $slug = trim($_GET['slug'] ?? '');
        $postId = trim($_GET['post_id'] ?? '');

        $stmt = $pdo->prepare("SELECT id FROM blog_posts WHERE slug = ? AND id != ?");
        $stmt->execute([$slug, $postId]);
        $taken = (bool)$stmt->fetch();

        echo json_encode([
            'available' => !$taken,
            'slug' => $slug,
            'suggested' => $taken ? ($slug . '-' . time()) : $slug
        ]);
        exit;

    // =========================================================
    // 3. CATEGORIES & TAGS
    // =========================================================
    case 'categories_list':
        Security::requirePermission($currentUser, 'posts.view');

        $cats = $pdo->query("SELECT c.*, (SELECT COUNT(*) FROM blog_posts p WHERE LOWER(p.category) = LOWER(c.name) AND p.status != 'Trash') as post_count FROM blog_categories c ORDER BY c.display_order ASC, c.name ASC")->fetchAll();

        echo json_encode([
            'success' => true,
            'categories' => $cats
        ]);
        exit;

    case 'category_save':
        Security::requirePermission($currentUser, 'categories.manage');

        $id = trim($input['id'] ?? '');
        $name = trim($input['name'] ?? '');
        $slug = trim($input['slug'] ?? '');
        $description = trim($input['description'] ?? '');

        if (empty($name)) {
            http_response_code(400);
            echo json_encode(['error' => 'Category name is required.']);
            exit;
        }

        if (empty($slug)) {
            $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $name));
            $slug = trim($slug, '-');
        }

        if (empty($id)) {
            // New Category
            $newId = 'cat-' . bin2hex(random_bytes(6));
            $stmt = $pdo->prepare("INSERT INTO blog_categories (id, name, slug, description, display_order, created_at) VALUES (?, ?, ?, ?, 0, ?)");
            $stmt->execute([$newId, $name, $slug, $description, $now]);
            Security::logAudit($currentUser['id'], 'category.create', 'category', $newId, ['name' => $name]);
        } else {
            // Update
            $stmt = $pdo->prepare("UPDATE blog_categories SET name = ?, slug = ?, description = ? WHERE id = ?");
            $stmt->execute([$name, $slug, $description, $id]);
            Security::logAudit($currentUser['id'], 'category.update', 'category', $id, ['name' => $name]);
        }

        echo json_encode(['success' => true, 'message' => 'Category saved successfully.']);
        exit;

    case 'category_delete':
        Security::requirePermission($currentUser, 'categories.manage');

        $id = $input['id'] ?? ($_GET['id'] ?? '');
        $reassignCat = trim($input['reassign_to'] ?? '');

        $catStmt = $pdo->prepare("SELECT * FROM blog_categories WHERE id = ?");
        $catStmt->execute([$id]);
        $cat = $catStmt->fetch();

        if (!$cat) {
            http_response_code(404);
            echo json_encode(['error' => 'Category not found.']);
            exit;
        }

        // Check posts count
        $cntStmt = $pdo->prepare("SELECT COUNT(*) FROM blog_posts WHERE LOWER(category) = LOWER(?)");
        $cntStmt->execute([$cat['name']]);
        $postCount = (int)$cntStmt->fetchColumn();

        if ($postCount > 0 && empty($reassignCat)) {
            http_response_code(409);
            echo json_encode([
                'error' => "Cannot delete category '{$cat['name']}': {$postCount} post(s) currently belong to it. Please reassign them first.",
                'requires_reassignment' => true,
                'post_count' => $postCount
            ]);
            exit;
        }

        if ($postCount > 0 && !empty($reassignCat)) {
            $pdo->prepare("UPDATE blog_posts SET category = ? WHERE LOWER(category) = LOWER(?)")
                ->execute([$reassignCat, $cat['name']]);
        }

        $pdo->prepare("DELETE FROM blog_categories WHERE id = ?")->execute([$id]);
        Security::logAudit($currentUser['id'], 'category.delete', 'category', $id, ['reassigned_to' => $reassignCat]);

        echo json_encode(['success' => true, 'message' => 'Category deleted successfully.']);
        exit;

    // =========================================================
    // 4. PRODUCT MANAGEMENT
    // =========================================================
    case 'products_list':
        Security::requirePermission($currentUser, 'products.view');

        $search = trim($_GET['search'] ?? '');
        $category = trim($_GET['category'] ?? '');
        $status = trim($_GET['status'] ?? '');
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = max(1, min(100, (int)($_GET['limit'] ?? 12)));
        $offset = ($page - 1) * $limit;

        $where = [];
        $params = [];

        if (!empty($search)) {
            $where[] = "(name LIKE ? OR slug LIKE ? OR sku LIKE ? OR description LIKE ?)";
            $params[] = "%{$search}%";
            $params[] = "%{$search}%";
            $params[] = "%{$search}%";
            $params[] = "%{$search}%";
        }

        if (!empty($category)) {
            $where[] = "category = ?";
            $params[] = $category;
        }

        if (!empty($status)) {
            $where[] = "status = ?";
            $params[] = $status;
        }

        $whereSql = count($where) ? "WHERE " . implode(" AND ", $where) : "";

        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM products {$whereSql}");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        $sql = "SELECT id, slug, name, sku, category, price, image_url, status, updated_at FROM products {$whereSql} ORDER BY updated_at DESC LIMIT {$limit} OFFSET {$offset}";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $prods = $stmt->fetchAll();

        // Get unique categories for filter
        $cats = $pdo->query("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != '' ORDER BY category ASC")->fetchAll(PDO::FETCH_COLUMN);

        echo json_encode([
            'success' => true,
            'products' => $prods,
            'categories' => $cats,
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'total_pages' => ceil($total / $limit)
        ]);
        exit;

    case 'product_get':
        Security::requirePermission($currentUser, 'products.view');

        $id = $_GET['id'] ?? ($_GET['slug'] ?? '');
        $stmt = $pdo->prepare("SELECT * FROM products WHERE id = ? OR slug = ?");
        $stmt->execute([$id, $id]);
        $prod = $stmt->fetch();

        if (!$prod) {
            http_response_code(404);
            echo json_encode(['error' => 'Product not found.']);
            exit;
        }

        echo json_encode([
            'success' => true,
            'product' => $prod
        ]);
        exit;

    case 'product_save':
        $isNew = empty($input['id']);
        if ($isNew) {
            Security::requirePermission($currentUser, 'products.create');
        } else {
            Security::requirePermission($currentUser, 'products.edit');
        }

        $name = trim($input['name'] ?? '');
        $slug = trim($input['slug'] ?? '');
        $sku = trim($input['sku'] ?? '');

        if (empty($name)) {
            http_response_code(400);
            echo json_encode(['error' => 'Product name is required.']);
            exit;
        }

        if (empty($slug)) {
            $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $name));
            $slug = trim($slug, '-');
        }

        $prodId = $isNew ? ('prod-' . uniqid()) : trim($input['id']);

        // Check SKU uniqueness
        if (!empty($sku)) {
            $skuStmt = $pdo->prepare("SELECT id FROM products WHERE sku = ? AND id != ?");
            $skuStmt->execute([$sku, $prodId]);
            if ($skuStmt->fetch()) {
                http_response_code(400);
                echo json_encode(['error' => "SKU '{$sku}' is already in use by another product."]);
                exit;
            }
        }

        $category = trim($input['category'] ?? 'Machinery');
        $price = trim($input['price'] ?? '');
        $imageUrl = trim($input['image_url'] ?? ($input['image'] ?? ''));
        $gallery = is_array($input['gallery'] ?? null) ? json_encode($input['gallery']) : ($input['gallery_json'] ?? '[]');
        $specs = is_array($input['specs'] ?? null) ? json_encode($input['specs']) : ($input['specs_json'] ?? '{}');
        $desc = trim($input['description'] ?? ($input['desc'] ?? ''));
        $status = trim($input['status'] ?? 'Published');

        $fullObj = [
            'name' => $name,
            'slug' => $slug,
            'sku' => $sku,
            'category' => $category,
            'price' => $price,
            'image' => $imageUrl,
            'images' => json_decode($gallery, true) ?: [],
            'desc' => $desc,
            'status' => $status
        ];
        $dataJson = json_encode($fullObj, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        if ($isNew) {
            $stmt = $pdo->prepare("INSERT INTO products (id, slug, name, sku, category, price, image_url, gallery_json, specs_json, description, status, data_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $prodId,
                $slug,
                $name,
                $sku,
                $category,
                $price,
                $imageUrl,
                $gallery,
                $specs,
                $desc,
                $status,
                $dataJson,
                $now,
                $now
            ]);
            Security::logAudit($currentUser['id'], 'product.create', 'product', $prodId, ['name' => $name]);
        } else {
            $stmt = $pdo->prepare("UPDATE products SET slug = ?, name = ?, sku = ?, category = ?, price = ?, image_url = ?, gallery_json = ?, specs_json = ?, description = ?, status = ?, data_json = ?, updated_at = ? WHERE id = ?");
            $stmt->execute([
                $slug,
                $name,
                $sku,
                $category,
                $price,
                $imageUrl,
                $gallery,
                $specs,
                $desc,
                $status,
                $dataJson,
                $now,
                $prodId
            ]);
            Security::logAudit($currentUser['id'], 'product.update', 'product', $prodId, ['name' => $name]);
        }

        $publishedCount = sync_products_to_catalog($pdo);

        echo json_encode([
            'success' => true,
            'message' => 'Product saved and synced to live catalog successfully.',
            'product' => $fullObj,
            'catalog_published_count' => $publishedCount
        ]);
        exit;

    case 'product_delete':
        Security::requirePermission($currentUser, 'products.delete');
        $id = $input['id'] ?? ($_GET['id'] ?? '');

        $pdo->prepare("DELETE FROM products WHERE id = ?")->execute([$id]);
        Security::logAudit($currentUser['id'], 'product.delete', 'product', $id);
        sync_products_to_catalog($pdo);

        echo json_encode(['success' => true, 'message' => 'Product deleted successfully.']);
        exit;

    // =========================================================
    // 5. MEDIA LIBRARY
    // =========================================================
    case 'media_list':
        Security::requirePermission($currentUser, 'media.view');

        $search = trim($_GET['search'] ?? '');
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = max(1, min(100, (int)($_GET['limit'] ?? 24)));
        $offset = ($page - 1) * $limit;

        $where = [];
        $params = [];

        if (!empty($search)) {
            $where[] = "(original_name LIKE ? OR filename LIKE ? OR alt_text LIKE ?)";
            $params[] = "%{$search}%";
            $params[] = "%{$search}%";
            $params[] = "%{$search}%";
        }

        $whereSql = count($where) ? "WHERE " . implode(" AND ", $where) : "";

        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM cms_media {$whereSql}");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        $stmt = $pdo->prepare("SELECT * FROM cms_media {$whereSql} ORDER BY created_at DESC LIMIT {$limit} OFFSET {$offset}");
        $stmt->execute($params);
        $media = $stmt->fetchAll();

        echo json_encode([
            'success' => true,
            'media' => $media,
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'total_pages' => ceil($total / $limit)
        ]);
        exit;

    case 'media_save':
        Security::requirePermission($currentUser, 'media.upload');

        $id = trim($input['id'] ?? '');
        $altText = trim($input['alt_text'] ?? '');
        $caption = trim($input['caption'] ?? '');

        $pdo->prepare("UPDATE cms_media SET alt_text = ?, caption = ? WHERE id = ?")->execute([$altText, $caption, $id]);
        Security::logAudit($currentUser['id'], 'media.update_meta', 'media', $id);

        echo json_encode(['success' => true, 'message' => 'Media metadata updated.']);
        exit;

    case 'media_delete':
        Security::requirePermission($currentUser, 'media.delete');

        $id = $input['id'] ?? ($_GET['id'] ?? '');
        $force = !empty($input['force']);

        $stmt = $pdo->prepare("SELECT * FROM cms_media WHERE id = ?");
        $stmt->execute([$id]);
        $item = $stmt->fetch();

        if (!$item) {
            http_response_code(404);
            echo json_encode(['error' => 'Media item not found.']);
            exit;
        }

        // Check if referenced by blog posts or products
        $refBlog = $pdo->prepare("SELECT COUNT(*) FROM blog_posts WHERE featured_image LIKE ? OR content LIKE ?");
        $refBlog->execute(["%{$item['filename']}%", "%{$item['filename']}%"]);
        $blogRefs = (int)$refBlog->fetchColumn();

        $refProd = $pdo->prepare("SELECT COUNT(*) FROM products WHERE image_url LIKE ? OR gallery_json LIKE ?");
        $refProd->execute(["%{$item['filename']}%", "%{$item['filename']}%"]);
        $prodRefs = (int)$refProd->fetchColumn();

        $totalRefs = $blogRefs + $prodRefs;
        if ($totalRefs > 0 && !$force) {
            http_response_code(409);
            echo json_encode([
                'error' => "Media file is currently referenced in {$blogRefs} blog post(s) and {$prodRefs} product(s). Deleting it will cause broken image links.",
                'requires_confirmation' => true,
                'total_references' => $totalRefs
            ]);
            exit;
        }

        // Delete physical file safely
        $filepath = dirname(__DIR__) . '/uploads/' . $item['filename'];
        if (file_exists($filepath)) {
            @unlink($filepath);
        }

        $pdo->prepare("DELETE FROM cms_media WHERE id = ?")->execute([$id]);
        Security::logAudit($currentUser['id'], 'media.delete', 'media', $id, ['filename' => $item['filename']]);

        echo json_encode(['success' => true, 'message' => 'Media file deleted successfully.']);
        exit;

    // =========================================================
    // 6. SECURITY CENTER
    // =========================================================
    case 'security_metrics':
        Security::requirePermission($currentUser, 'security.view');

        $totalAttempts = (int)$pdo->query("SELECT COUNT(*) FROM cms_login_attempts")->fetchColumn();
        $failed24h = (int)$pdo->query("SELECT COUNT(*) FROM cms_login_attempts WHERE success = 0 AND created_at > " . ($now - 86400))->fetchColumn();
        $success24h = (int)$pdo->query("SELECT COUNT(*) FROM cms_login_attempts WHERE success = 1 AND created_at > " . ($now - 86400))->fetchColumn();
        $blockedIps = (int)$pdo->query("SELECT COUNT(*) FROM cms_security_blocks WHERE expires_at IS NULL OR expires_at > {$now}")->fetchColumn();
        $lockedUsers = (int)$pdo->query("SELECT COUNT(*) FROM cms_users WHERE locked_until > {$now}")->fetchColumn();
        $activeSessions = (int)$pdo->query("SELECT COUNT(*) FROM cms_sessions WHERE is_revoked = 0 AND expires_at > {$now}")->fetchColumn();

        echo json_encode([
            'success' => true,
            'metrics' => [
                'total_attempts' => $totalAttempts,
                'failed_24h' => $failed24h,
                'success_24h' => $success24h,
                'blocked_ips' => $blockedIps,
                'locked_users' => $lockedUsers,
                'active_sessions' => $activeSessions
            ]
        ]);
        exit;

    case 'security_logs':
        Security::requirePermission($currentUser, 'security.view');

        $type = $_GET['log_type'] ?? 'logins'; // logins or audit
        $search = trim($_GET['search'] ?? '');
        $statusFilter = $_GET['status_filter'] ?? '';
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = max(1, min(100, (int)($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;

        if ($type === 'audit') {
            $where = [];
            $params = [];
            if (!empty($search)) {
                $where[] = "(action LIKE ? OR resource_type LIKE ? OR ip_address LIKE ?)";
                $params[] = "%{$search}%";
                $params[] = "%{$search}%";
                $params[] = "%{$search}%";
            }
            $whereSql = count($where) ? "WHERE " . implode(" AND ", $where) : "";

            $countStmt = $pdo->prepare("SELECT COUNT(*) FROM cms_audit_logs {$whereSql}");
            $countStmt->execute($params);
            $total = (int)$countStmt->fetchColumn();

            $sql = "SELECT a.*, u.username, u.full_name FROM cms_audit_logs a LEFT JOIN cms_users u ON a.user_id = u.id {$whereSql} ORDER BY a.created_at DESC LIMIT {$limit} OFFSET {$offset}";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $logs = $stmt->fetchAll();
        } else {
            // Login attempts
            $where = [];
            $params = [];
            if (!empty($search)) {
                $where[] = "(identifier LIKE ? OR ip_address LIKE ? OR failure_reason LIKE ?)";
                $params[] = "%{$search}%";
                $params[] = "%{$search}%";
                $params[] = "%{$search}%";
            }
            if ($statusFilter === 'success') {
                $where[] = "success = 1";
            } elseif ($statusFilter === 'failed') {
                $where[] = "success = 0";
            }

            $whereSql = count($where) ? "WHERE " . implode(" AND ", $where) : "";

            $countStmt = $pdo->prepare("SELECT COUNT(*) FROM cms_login_attempts {$whereSql}");
            $countStmt->execute($params);
            $total = (int)$countStmt->fetchColumn();

            $sql = "SELECT * FROM cms_login_attempts {$whereSql} ORDER BY created_at DESC LIMIT {$limit} OFFSET {$offset}";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $logs = $stmt->fetchAll();
        }

        echo json_encode([
            'success' => true,
            'logs' => $logs,
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'total_pages' => ceil($total / $limit)
        ]);
        exit;

    case 'security_blocks_list':
        Security::requirePermission($currentUser, 'security.view');

        $blocks = $pdo->query("SELECT * FROM cms_security_blocks ORDER BY created_at DESC")->fetchAll();
        echo json_encode(['success' => true, 'blocks' => $blocks]);
        exit;

    case 'security_block_save':
        Security::requirePermission($currentUser, 'security.manage');

        $target = trim($input['target'] ?? '');
        $type = trim($input['type'] ?? 'ip');
        $reason = trim($input['reason'] ?? 'Manual administrative block');
        $durationHours = (int)($input['duration_hours'] ?? 0); // 0 = permanent

        if (empty($target)) {
            http_response_code(400);
            echo json_encode(['error' => 'Target IP or account identifier is required.']);
            exit;
        }

        $expiresAt = ($durationHours > 0) ? ($now + ($durationHours * 3600)) : null;
        $id = 'blk-' . bin2hex(random_bytes(8));

        $stmt = $pdo->prepare("INSERT INTO cms_security_blocks (id, type, target, reason, created_by, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $id,
            $type,
            $target,
            $reason,
            $currentUser['username'],
            $expiresAt,
            $now
        ]);

        Security::logAudit($currentUser['id'], 'security.ip_blocked', 'block', $id, [
            'target' => $target,
            'type' => $type,
            'reason' => $reason,
            'expires_at' => $expiresAt
        ]);

        echo json_encode(['success' => true, 'message' => "Target '{$target}' has been blocked."]);
        exit;

    case 'security_block_delete':
        Security::requirePermission($currentUser, 'security.manage');

        $id = $input['id'] ?? ($_GET['id'] ?? '');
        $stmt = $pdo->prepare("SELECT * FROM cms_security_blocks WHERE id = ?");
        $stmt->execute([$id]);
        $blk = $stmt->fetch();

        if ($blk) {
            $pdo->prepare("DELETE FROM cms_security_blocks WHERE id = ?")->execute([$id]);
            Security::logAudit($currentUser['id'], 'security.ip_unblocked', 'block', $id, [
                'target' => $blk['target']
            ]);
        }

        echo json_encode(['success' => true, 'message' => 'Block successfully removed.']);
        exit;

    case 'security_sessions_list':
        Security::requirePermission($currentUser, 'security.view');

        $stmt = $pdo->prepare("SELECT s.*, u.username, u.email, u.full_name, u.role 
                               FROM cms_sessions s
                               JOIN cms_users u ON s.user_id = u.id
                               WHERE s.is_revoked = 0 AND s.expires_at > ?
                               ORDER BY s.last_activity DESC");
        $stmt->execute([$now]);
        $sessions = $stmt->fetchAll();

        // Mark current active session
        foreach ($sessions as &$s) {
            $s['is_current'] = ($s['id'] === $currentUser['session_id']);
            $s['id'] = substr($s['id'], 0, 12) . '...'; // Truncate session key for display safety
            $s['raw_id'] = $s['id']; // Used for token matching
        }

        echo json_encode(['success' => true, 'sessions' => $sessions]);
        exit;

    case 'security_revoke_session':
        Security::requirePermission($currentUser, 'security.manage');

        $sessionId = trim($input['session_id'] ?? '');
        if (!empty($sessionId)) {
            $pdo->prepare("UPDATE cms_sessions SET is_revoked = 1 WHERE id LIKE ?")->execute([$sessionId . '%']);
            Security::logAudit($currentUser['id'], 'security.session_revoked', 'session', $sessionId);
        }

        echo json_encode(['success' => true, 'message' => 'Session successfully revoked.']);
        exit;

    case 'security_purge_logs':
        Security::requirePermission($currentUser, 'security.manage');
        if ($currentUser['role'] !== 'super_admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Only Super Administrators can purge security logs.']);
            exit;
        }

        $retentionDays = max(30, (int)Security::getSetting('audit_log_retention_days', 90));
        $cutoff = $now - ($retentionDays * 86400);

        // Record purge action first so the purge itself is never wiped out
        Security::logAudit($currentUser['id'], 'security.purge_logs', 'security', null, [
            'cutoff_timestamp' => $cutoff,
            'retention_days' => $retentionDays
        ]);

        $purgeLogins = $pdo->prepare("DELETE FROM cms_login_attempts WHERE created_at < ?");
        $purgeLogins->execute([$cutoff]);
        $deletedLogins = $purgeLogins->rowCount();

        $purgeAudit = $pdo->prepare("DELETE FROM cms_audit_logs WHERE created_at < ? AND action != 'security.purge_logs'");
        $purgeAudit->execute([$cutoff]);
        $deletedAudit = $purgeAudit->rowCount();

        echo json_encode([
            'success' => true,
            'message' => "Purged {$deletedLogins} login attempts and {$deletedAudit} audit events older than {$retentionDays} days."
        ]);
        exit;

    // =========================================================
    // 7. USER MANAGEMENT & CUSTOM ROLES
    // =========================================================
    case 'users_list':
        Security::requirePermission($currentUser, 'users.view');

        $users = $pdo->query("SELECT id, username, email, full_name, role, status, failed_login_attempts, locked_until, last_login_at, created_at FROM cms_users ORDER BY created_at ASC")->fetchAll();
        echo json_encode(['success' => true, 'users' => $users]);
        exit;

    case 'user_save':
        $isNew = empty($input['id']);
        if ($isNew) {
            Security::requirePermission($currentUser, 'users.create');
        } else {
            Security::requirePermission($currentUser, 'users.edit');
        }

        $username = trim($input['username'] ?? '');
        $email = trim($input['email'] ?? '');
        $fullName = trim($input['full_name'] ?? '');
        $role = trim($input['role'] ?? 'editor');
        $status = trim($input['status'] ?? 'active');
        $password = (string)($input['password'] ?? '');

        if (empty($username) || empty($email)) {
            http_response_code(400);
            echo json_encode(['error' => 'Username and email are required.']);
            exit;
        }

        $userId = $isNew ? ('usr-' . bin2hex(random_bytes(8))) : trim($input['id']);

        // Check for last active super_admin guard
        if (!$isNew) {
            $currentRole = $pdo->query("SELECT role, status FROM cms_users WHERE id = '{$userId}'")->fetch();
            if ($currentRole && $currentRole['role'] === 'super_admin' && ($role !== 'super_admin' || $status !== 'active')) {
                $superCount = (int)$pdo->query("SELECT COUNT(*) FROM cms_users WHERE role = 'super_admin' AND status = 'active'")->fetchColumn();
                if ($superCount <= 1) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Cannot change role or disable the only active Super Administrator.']);
                    exit;
                }
            }
        }

        if ($isNew) {
            if (empty($password) || strlen($password) < 8) {
                http_response_code(400);
                echo json_encode(['error' => 'Initial password must be at least 8 characters long.']);
                exit;
            }
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("INSERT INTO cms_users (id, username, email, password_hash, full_name, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$userId, $username, $email, $hash, $fullName, $role, $status, $now, $now]);
            Security::logAudit($currentUser['id'], 'user.create', 'user', $userId, ['username' => $username, 'role' => $role]);
        } else {
            if (!empty($password)) {
                if (strlen($password) < 8) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Password must be at least 8 characters long.']);
                    exit;
                }
                $hash = password_hash($password, PASSWORD_DEFAULT);
                $stmt = $pdo->prepare("UPDATE cms_users SET username = ?, email = ?, password_hash = ?, full_name = ?, role = ?, status = ?, updated_at = ? WHERE id = ?");
                $stmt->execute([$username, $email, $hash, $fullName, $role, $status, $now, $userId]);
            } else {
                $stmt = $pdo->prepare("UPDATE cms_users SET username = ?, email = ?, full_name = ?, role = ?, status = ?, updated_at = ? WHERE id = ?");
                $stmt->execute([$username, $email, $fullName, $role, $status, $now, $userId]);
            }
            Security::logAudit($currentUser['id'], 'user.update', 'user', $userId, ['username' => $username, 'role' => $role]);
        }

        echo json_encode(['success' => true, 'message' => 'User saved successfully.']);
        exit;

    case 'user_status':
        Security::requirePermission($currentUser, 'users.edit');

        $userId = trim($input['id'] ?? '');
        $newStatus = trim($input['status'] ?? 'active');

        // Check last super admin guard
        if ($newStatus !== 'active') {
            $userCheck = $pdo->query("SELECT role FROM cms_users WHERE id = '{$userId}'")->fetch();
            if ($userCheck && $userCheck['role'] === 'super_admin') {
                $superCount = (int)$pdo->query("SELECT COUNT(*) FROM cms_users WHERE role = 'super_admin' AND status = 'active'")->fetchColumn();
                if ($superCount <= 1) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Cannot deactivate the last active Super Administrator.']);
                    exit;
                }
            }
        }

        $pdo->prepare("UPDATE cms_users SET status = ?, updated_at = ? WHERE id = ?")->execute([$newStatus, $now, $userId]);
        if ($newStatus !== 'active') {
            // Invalidate user sessions
            $pdo->prepare("UPDATE cms_sessions SET is_revoked = 1 WHERE user_id = ?")->execute([$userId]);
        }

        Security::logAudit($currentUser['id'], 'user.change_status', 'user', $userId, ['status' => $newStatus]);

        echo json_encode(['success' => true, 'message' => "User status set to {$newStatus}."]);
        exit;

    case 'user_delete':
        Security::requirePermission($currentUser, 'users.delete');

        $userId = trim($input['id'] ?? ($_GET['id'] ?? ''));

        if ($userId === $currentUser['id']) {
            http_response_code(400);
            echo json_encode(['error' => 'You cannot delete your own active account.']);
            exit;
        }

        $userCheck = $pdo->query("SELECT role FROM cms_users WHERE id = '{$userId}'")->fetch();
        if ($userCheck && $userCheck['role'] === 'super_admin') {
            $superCount = (int)$pdo->query("SELECT COUNT(*) FROM cms_users WHERE role = 'super_admin' AND status = 'active'")->fetchColumn();
            if ($superCount <= 1) {
                http_response_code(400);
                echo json_encode(['error' => 'Cannot delete the only Super Administrator.']);
                exit;
            }
        }

        $pdo->prepare("DELETE FROM cms_users WHERE id = ?")->execute([$userId]);
        $pdo->prepare("UPDATE cms_sessions SET is_revoked = 1 WHERE user_id = ?")->execute([$userId]);
        Security::logAudit($currentUser['id'], 'user.delete', 'user', $userId);

        echo json_encode(['success' => true, 'message' => 'User account deleted.']);
        exit;

    case 'roles_list':
        Security::requirePermission($currentUser, 'users.view');

        $roles = $pdo->query("SELECT * FROM cms_roles ORDER BY is_system DESC, name ASC")->fetchAll();
        foreach ($roles as &$r) {
            $r['permissions'] = json_decode($r['permissions'], true) ?: [];
        }

        echo json_encode(['success' => true, 'roles' => $roles]);
        exit;

    case 'role_save':
        Security::requirePermission($currentUser, 'users.create');

        $id = trim($input['id'] ?? '');
        $name = trim($input['name'] ?? '');
        $displayName = trim($input['display_name'] ?? '');
        $desc = trim($input['description'] ?? '');
        $perms = is_array($input['permissions'] ?? null) ? json_encode($input['permissions']) : '[]';

        if (empty($name) || empty($displayName)) {
            http_response_code(400);
            echo json_encode(['error' => 'Role identifier and display name are required.']);
            exit;
        }

        if (empty($id)) {
            $newId = 'role-' . bin2hex(random_bytes(6));
            $stmt = $pdo->prepare("INSERT INTO cms_roles (id, name, display_name, description, permissions, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)");
            $stmt->execute([$newId, $name, $displayName, $desc, $perms, $now, $now]);
            Security::logAudit($currentUser['id'], 'role.create', 'role', $newId, ['name' => $name]);
        } else {
            $check = $pdo->query("SELECT is_system FROM cms_roles WHERE id = '{$id}'")->fetch();
            if ($check && $check['is_system'] && $name === 'super_admin') {
                http_response_code(400);
                echo json_encode(['error' => 'System Super Admin role cannot be modified.']);
                exit;
            }
            $stmt = $pdo->prepare("UPDATE cms_roles SET display_name = ?, description = ?, permissions = ?, updated_at = ? WHERE id = ?");
            $stmt->execute([$displayName, $desc, $perms, $now, $id]);
            Security::logAudit($currentUser['id'], 'role.update', 'role', $id, ['name' => $name]);
        }

        echo json_encode(['success' => true, 'message' => 'Role saved successfully.']);
        exit;

    case 'role_delete':
        Security::requirePermission($currentUser, 'users.delete');

        $id = $input['id'] ?? ($_GET['id'] ?? '');
        $check = $pdo->query("SELECT is_system, name FROM cms_roles WHERE id = '{$id}'")->fetch();

        if ($check && $check['is_system']) {
            http_response_code(400);
            echo json_encode(['error' => 'Cannot delete system-defined roles.']);
            exit;
        }

        $pdo->prepare("DELETE FROM cms_roles WHERE id = ?")->execute([$id]);
        Security::logAudit($currentUser['id'], 'role.delete', 'role', $id);

        echo json_encode(['success' => true, 'message' => 'Role deleted successfully.']);
        exit;

    // =========================================================
    // 8. CMS SETTINGS
    // =========================================================
    case 'settings_get':
        Security::requirePermission($currentUser, 'settings.manage');

        $rows = $pdo->query("SELECT setting_key, setting_value FROM cms_settings")->fetchAll(PDO::FETCH_KEY_PAIR);
        echo json_encode(['success' => true, 'settings' => $rows]);
        exit;

    case 'settings_save':
        Security::requirePermission($currentUser, 'settings.manage');

        $allowedSettings = [
            'site_name', 'site_url', 'admin_email', 'max_failed_logins',
            'lockout_duration_minutes', 'session_lifetime_hours',
            'audit_log_retention_days', 'default_theme', 'enable_2fa', 'posts_per_page',
            'google_client_id', 'ip_block_failed_logins', 'ip_block_hours'
        ];

        if (isset($input['google_client_id'])) {
            $input['google_client_id'] = trim((string)$input['google_client_id']);
            if ($input['google_client_id'] !== '' && !Security::isValidGoogleClientId($input['google_client_id'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid Google Client ID. It should look like 1234567890-abc123.apps.googleusercontent.com']);
                exit;
            }
        }

        $stmt = $pdo->prepare("INSERT INTO cms_settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?) 
                               ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at");

        // Check if MySQL driver to use ON DUPLICATE KEY UPDATE
        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        if ($driver === 'mysql') {
            $stmt = $pdo->prepare("INSERT INTO cms_settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?) 
                                   ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = VALUES(updated_at)");
        }

        $saved = [];
        foreach ($allowedSettings as $key) {
            if (isset($input[$key])) {
                $val = (string)$input[$key];
                $stmt->execute([$key, $val, $now]);
                $saved[$key] = $val;
            }
        }

        Security::logAudit($currentUser['id'], 'settings.update', 'settings', null, $saved);

        echo json_encode(['success' => true, 'message' => 'Settings updated successfully.', 'settings' => $saved]);
        exit;

    // =========================================================
    // 7. CRM & CUSTOMER INQUIRIES
    // =========================================================
    case 'inquiries_list':
        Security::requirePermission($currentUser, 'posts.view');
        $status = trim($_GET['status'] ?? 'all');
        $search = trim($_GET['search'] ?? '');

        $sql = "SELECT * FROM cms_inquiries WHERE 1=1";
        $params = [];
        if ($status !== '' && $status !== 'all') {
            $sql .= " AND status = ?";
            $params[] = $status;
        }
        if ($search !== '') {
            $sql .= " AND (name LIKE ? OR email LIKE ? OR company LIKE ? OR machine_model LIKE ?)";
            $params[] = "%{$search}%";
            $params[] = "%{$search}%";
            $params[] = "%{$search}%";
            $params[] = "%{$search}%";
        }
        $sql .= " ORDER BY created_at DESC LIMIT 100";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $inquiries = $stmt->fetchAll();

        echo json_encode(['success' => true, 'inquiries' => $inquiries]);
        exit;

    case 'inquiry_save':
        Security::requirePermission($currentUser, 'posts.create');
        $id = trim($input['id'] ?? '');
        $name = trim($input['name'] ?? '');
        $email = trim($input['email'] ?? '');
        $phone = trim($input['phone'] ?? '');
        $company = trim($input['company'] ?? '');
        $machineModel = trim($input['machine_model'] ?? '');
        $inquiryType = trim($input['inquiry_type'] ?? 'Quote Request');
        $message = trim($input['message'] ?? '');
        $estimatedValue = (float)($input['estimated_value'] ?? 0);
        $status = trim($input['status'] ?? 'New');
        $notes = trim($input['notes'] ?? '');

        if ($name === '' || $email === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Customer name and email are required.']);
            exit;
        }

        if ($id === '') {
            $id = 'inq-' . uniqid();
            $stmt = $pdo->prepare("INSERT INTO cms_inquiries (id, name, email, phone, company, machine_model, inquiry_type, message, estimated_value, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$id, $name, $email, $phone, $company, $machineModel, $inquiryType, $message, $estimatedValue, $status, $notes, $now, $now]);
            Security::logAudit($currentUser['id'], 'inquiry.create', 'inquiry', $id);
        } else {
            $stmt = $pdo->prepare("UPDATE cms_inquiries SET name = ?, email = ?, phone = ?, company = ?, machine_model = ?, inquiry_type = ?, message = ?, estimated_value = ?, status = ?, notes = ?, updated_at = ? WHERE id = ?");
            $stmt->execute([$name, $email, $phone, $company, $machineModel, $inquiryType, $message, $estimatedValue, $status, $notes, $now, $id]);
            Security::logAudit($currentUser['id'], 'inquiry.update', 'inquiry', $id, ['status' => $status]);
        }

        echo json_encode(['success' => true, 'id' => $id, 'message' => 'Lead inquiry saved successfully.']);
        exit;

    case 'inquiry_delete':
        Security::requirePermission($currentUser, 'posts.delete');
        $id = trim($input['id'] ?? ($_GET['id'] ?? ''));
        if ($id !== '') {
            $pdo->prepare("DELETE FROM cms_inquiries WHERE id = ?")->execute([$id]);
            Security::logAudit($currentUser['id'], 'inquiry.delete', 'inquiry', $id);
        }
        echo json_encode(['success' => true, 'message' => 'Inquiry deleted.']);
        exit;

    // =========================================================
    // 8. SUPPORT & WARRANTY TRACKER
    // =========================================================
    case 'support_tickets_list':
        Security::requirePermission($currentUser, 'posts.view');
        $status = trim($_GET['status'] ?? 'all');
        $priority = trim($_GET['priority'] ?? 'all');

        $sql = "SELECT * FROM cms_support_tickets WHERE 1=1";
        $params = [];
        if ($status !== '' && $status !== 'all') {
            $sql .= " AND status = ?";
            $params[] = $status;
        }
        if ($priority !== '' && $priority !== 'all') {
            $sql .= " AND priority = ?";
            $params[] = $priority;
        }
        $sql .= " ORDER BY created_at DESC LIMIT 100";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $tickets = $stmt->fetchAll();

        echo json_encode(['success' => true, 'tickets' => $tickets]);
        exit;

    case 'support_ticket_save':
        Security::requirePermission($currentUser, 'posts.create');
        $id = trim($input['id'] ?? '');
        $customerName = trim($input['customer_name'] ?? '');
        $customerEmail = trim($input['customer_email'] ?? '');
        $equipmentModel = trim($input['equipment_model'] ?? '');
        $serialNumber = trim($input['serial_number'] ?? '');
        $subject = trim($input['subject'] ?? '');
        $priority = trim($input['priority'] ?? 'Medium');
        $status = trim($input['status'] ?? 'Open');
        $category = trim($input['category'] ?? 'Technical');
        $description = trim($input['description'] ?? '');
        $resolutionNotes = trim($input['resolution_notes'] ?? '');

        if ($customerName === '' || $subject === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Customer name and ticket subject are required.']);
            exit;
        }

        if ($id === '') {
            $id = 'tkt-' . uniqid();
            $ticketNumber = 'SK-' . mt_rand(1000, 9999);
            $stmt = $pdo->prepare("INSERT INTO cms_support_tickets (id, ticket_number, customer_name, customer_email, equipment_model, serial_number, subject, priority, status, category, description, resolution_notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$id, $ticketNumber, $customerName, $customerEmail, $equipmentModel, $serialNumber, $subject, $priority, $status, $category, $description, $resolutionNotes, $now, $now]);
            Security::logAudit($currentUser['id'], 'ticket.create', 'support_ticket', $id);
        } else {
            $stmt = $pdo->prepare("UPDATE cms_support_tickets SET customer_name = ?, customer_email = ?, equipment_model = ?, serial_number = ?, subject = ?, priority = ?, status = ?, category = ?, description = ?, resolution_notes = ?, updated_at = ? WHERE id = ?");
            $stmt->execute([$customerName, $customerEmail, $equipmentModel, $serialNumber, $subject, $priority, $status, $category, $description, $resolutionNotes, $now, $id]);
            Security::logAudit($currentUser['id'], 'ticket.update', 'support_ticket', $id, ['status' => $status]);
        }

        echo json_encode(['success' => true, 'id' => $id, 'message' => 'Support ticket saved successfully.']);
        exit;

    case 'support_ticket_delete':
        Security::requirePermission($currentUser, 'posts.delete');
        $id = trim($input['id'] ?? ($_GET['id'] ?? ''));
        if ($id !== '') {
            $pdo->prepare("DELETE FROM cms_support_tickets WHERE id = ?")->execute([$id]);
            Security::logAudit($currentUser['id'], 'ticket.delete', 'support_ticket', $id);
        }
        echo json_encode(['success' => true, 'message' => 'Support ticket deleted.']);
        exit;

    // =========================================================
    // 9. QUICK SERVER CACHE PURGE & CATALOG PUBLISH
    // =========================================================
    case 'catalog_publish':
        Security::requirePermission($currentUser, 'products.edit');

        $prodCount = sync_products_to_catalog($pdo);
        $blogCount = sync_blog_posts_to_json($pdo);

        if (function_exists('clearstatcache')) {
            clearstatcache(true);
        }
        if (function_exists('opcache_reset')) {
            @opcache_reset();
        }

        Security::logAudit($currentUser['id'], 'catalog.publish', 'catalog', null, [
            'products_synced' => $prodCount,
            'blog_posts_synced' => $blogCount
        ]);

        echo json_encode([
            'success' => true,
            'message' => "Published catalog successfully synced ({$prodCount} active products, {$blogCount} blog articles).",
            'products_synced' => $prodCount,
            'blog_posts_synced' => $blogCount
        ]);
        exit;

    case 'cache_purge':
        Security::requirePermission($currentUser, 'settings.manage');

        if (function_exists('opcache_reset')) {
            @opcache_reset();
        }
        if (function_exists('clearstatcache')) {
            clearstatcache(true);
        }
        @header('X-LiteSpeed-Purge: *');

        Security::logAudit($currentUser['id'], 'system.cache_purge', 'cache', null);
        echo json_encode([
            'success' => true,
            'message' => 'LiteSpeed Web Server Cache and PHP OPcache flushed successfully.'
        ]);
    case 'seo_stats':
        Security::requirePermission($currentUser, 'posts.view');

        $rootDir = dirname(__DIR__, 2);
        $sitemapFile = $rootDir . '/public/sitemap.xml';
        $sitemapIndex = $rootDir . '/public/sitemap_index.xml';
        $robotsFile = $rootDir . '/public/robots.txt';
        $llmsFile = $rootDir . '/public/llms.txt';
        $productsDir = $rootDir . '/public/products';

        $sitemapCount = 0;
        if (file_exists($sitemapFile)) {
            $sitemapContent = file_get_contents($sitemapFile);
            $sitemapCount = substr_count($sitemapContent, '<loc>');
        }

        $staticProductPagesCount = 0;
        if (is_dir($productsDir)) {
            $files = glob($productsDir . '/*/index.html');
            $staticProductPagesCount = is_array($files) ? count($files) : 0;
        }

        $equipmentCategoriesCount = (int)$pdo->query("SELECT COUNT(DISTINCT category) FROM products WHERE category IS NOT NULL AND category != ''")->fetchColumn();
        $blogPostCount = (int)$pdo->query("SELECT COUNT(*) FROM blog_posts WHERE status = 'Published'")->fetchColumn();

        $siteUrl = Security::getSetting('site_url', 'https://stonekrusher.com');
        $ga4Id = Security::getSetting('ga4_measurement_id', '');
        $gscUrl = Security::getSetting('gsc_site_url', '');

        echo json_encode([
            'success' => true,
            'seo' => [
                'sitemap_urls' => $sitemapCount,
                'sitemap_exists' => file_exists($sitemapFile),
                'sitemap_index_exists' => file_exists($sitemapIndex),
                'sitemap_last_modified' => file_exists($sitemapFile) ? date('Y-m-d H:i:s', filemtime($sitemapFile)) : null,
                'robots_exists' => file_exists($robotsFile),
                'llms_exists' => file_exists($llmsFile),
                'crawlable_products' => $staticProductPagesCount,
                'categories_count' => $equipmentCategoriesCount,
                'published_posts' => $blogPostCount,
                'site_url' => $siteUrl,
                'ga4_connected' => !empty($ga4Id),
                'gsc_connected' => !empty($gscUrl),
                'indexnow_key_location' => $siteUrl . '/4e2c9180ab5f4f899b418a032d8471e6.txt'
            ]
        ]);
        exit;

    case 'seo_ping':
        Security::requirePermission($currentUser, 'settings.manage');

        $siteUrl = Security::getSetting('site_url', 'https://stonekrusher.com');
        $host = parse_url($siteUrl, PHP_URL_HOST) ?: 'stonekrusher.com';
        $apiKey = '4e2c9180ab5f4f899b418a032d8471e6';
        $sitemapUrl = $siteUrl . '/sitemap.xml';

        // IndexNow ping
        $indexNowPayload = json_encode([
            'host' => $host,
            'key' => $apiKey,
            'keyLocation' => "{$siteUrl}/{$apiKey}.txt",
            'urlList' => [
                $siteUrl,
                "{$siteUrl}/equipment/",
                "{$siteUrl}/equipment/attachments/",
                "{$siteUrl}/blog/",
                $sitemapUrl
            ]
        ]);

        $ch = curl_init('https://www.bing.com/indexnow');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json; charset=utf-8']);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $indexNowPayload);
        curl_setopt($ch, CURLOPT_TIMEOUT, 6);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        Security::logAudit($currentUser['id'], 'seo.ping', 'seo', null, [
            'http_code' => $httpCode,
            'curl_error' => $curlErr
        ]);

        if ($httpCode >= 200 && $httpCode < 300) {
            echo json_encode([
                'success' => true,
                'message' => "IndexNow ping successfully accepted (HTTP {$httpCode}). Search crawlers notified."
            ]);
        } else {
            echo json_encode([
                'success' => false,
                'error' => $curlErr ? "Ping connection error: {$curlErr}" : "Search engine returned HTTP {$httpCode}"
            ]);
        }
        exit;

    default:
        http_response_code(400);
        echo json_encode(['error' => "Unknown action [{$action}]."]);
        exit;
}
