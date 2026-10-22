<?php
// =========================================================
// StoneKrusher - Public Products API
// =========================================================

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=60');
require_once __DIR__ . '/security.php';

Security::sendSecurityHeaders();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}

$pdo = get_cms_pdo();
$category = trim($_GET['category'] ?? '');
$search = trim($_GET['search'] ?? '');
$slug = trim($_GET['slug'] ?? '');

if (!empty($slug)) {
    $stmt = $pdo->prepare("SELECT * FROM products WHERE slug = ? AND status = 'Published'");
    $stmt->execute([$slug]);
    $prod = $stmt->fetch();
    if (!$prod) {
        http_response_code(404);
        echo json_encode(['error' => 'Product not found.']);
        exit;
    }
    echo json_encode(['success' => true, 'product' => $prod]);
    exit;
}

$where = ["status = 'Published'"];
$params = [];

if (!empty($category)) {
    $where[] = "category = ?";
    $params[] = $category;
}

if (!empty($search)) {
    $where[] = "(name LIKE ? OR description LIKE ?)";
    $params[] = "%{$search}%";
    $params[] = "%{$search}%";
}

$whereSql = "WHERE " . implode(" AND ", $where);
$stmt = $pdo->prepare("SELECT id, slug, name, sku, category, price, image_url, description, updated_at FROM products {$whereSql} ORDER BY updated_at DESC");
$stmt->execute($params);
$products = $stmt->fetchAll();

echo json_encode([
    'success' => true,
    'total' => count($products),
    'products' => $products
]);
