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

$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true) ?: $_POST;
$pdo = get_cms_pdo();
$now = time();

switch ($action) {

    // =========================================================
    // 1. DASHBOARD OVERVIEW METRICS
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
        $categoryCount = (int)$pdo->query("SELECT COUNT(*) FROM blog_categories")->fetchColumn();
        $mediaCount = (int)$pdo->query("SELECT COUNT(*) FROM cms_media")->fetchColumn();

        // Security counts
        $activeBlocksCount = (int)$pdo->query("SELECT COUNT(*) FROM cms_security_blocks WHERE expires_at IS NULL OR expires_at > {$now}")->fetchColumn();
        $failedLogins24h = (int)$pdo->query("SELECT COUNT(*) FROM cms_login_attempts WHERE success = 0 AND created_at > " . ($now - 86400))->fetchColumn();
        $activeLockouts = (int)$pdo->query("SELECT COUNT(*) FROM cms_users WHERE locked_until > {$now}")->fetchColumn();
        $activeSessions = (int)$pdo->query("SELECT COUNT(*) FROM cms_sessions WHERE is_revoked = 0 AND expires_at > {$now}")->fetchColumn();

        // Recent posts (5)
        $recentPosts = $pdo->query("SELECT id, slug, title, category, status, published_date, updated_at FROM blog_posts ORDER BY updated_at DESC LIMIT 5")->fetchAll();

        // Recent activity (8)
        $recentActivity = $pdo->query("SELECT a.*, u.username FROM cms_audit_logs a LEFT JOIN cms_users u ON a.user_id = u.id ORDER BY a.created_at DESC LIMIT 8")->fetchAll();

        echo json_encode([
            'success' => true,
            'metrics' => [
                'posts' => $postCounts,
                'products' => $productCount,
                'categories' => $categoryCount,
                'media' => $mediaCount,
                'security' => [
                    'active_blocks' => $activeBlocksCount,
                    'failed_logins_24h' => $failedLogins24h,
                    'active_lockouts' => $activeLockouts,
                    'active_sessions' => $activeSessions
                ]
            ],
            'recent_posts' => $recentPosts,
            'recent_activity' => $recentActivity
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
        $content = (string)($input['content'] ?? '');
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

        echo json_encode(['success' => true, 'message' => 'Post moved to trash.']);
        exit;

    case 'post_restore':
        Security::requirePermission($currentUser, 'posts.edit');
        $id = $input['id'] ?? ($_GET['id'] ?? '');

        $pdo->prepare("UPDATE blog_posts SET status = 'Draft', updated_at = ? WHERE id = ?")->execute([$now, $id]);
        Security::logAudit($currentUser['id'], 'post.restore', 'post', $id);

        echo json_encode(['success' => true, 'message' => 'Post restored to drafts.']);
        exit;

    case 'post_delete':
        Security::requirePermission($currentUser, 'posts.delete');
        $id = $input['id'] ?? ($_GET['id'] ?? '');

        $pdo->prepare("DELETE FROM blog_posts WHERE id = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM blog_revisions WHERE post_id = ?")->execute([$id]);
        Security::logAudit($currentUser['id'], 'post.delete_permanent', 'post', $id);

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

        echo json_encode(['success' => true, 'message' => 'Product saved successfully.', 'product' => $fullObj]);
        exit;

    case 'product_delete':
        Security::requirePermission($currentUser, 'products.delete');
        $id = $input['id'] ?? ($_GET['id'] ?? '');

        $pdo->prepare("DELETE FROM products WHERE id = ?")->execute([$id]);
        Security::logAudit($currentUser['id'], 'product.delete', 'product', $id);

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
            'google_client_id'
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

    default:
        http_response_code(400);
        echo json_encode(['error' => "Unknown action [{$action}]."]);
        exit;
}
