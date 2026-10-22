<?php
// =========================================================
// StoneKrusher CMS - Database Connection & Schema Layer
// Supports MySQL (Production / Hostinger) and SQLite (Local)
// =========================================================

if (file_exists(__DIR__ . '/config.php')) {
    require_once __DIR__ . '/config.php';
}

function get_cms_pdo() {
    static $pdoInstance = null;
    if ($pdoInstance !== null) {
        return $pdoInstance;
    }

    $dbHost = defined('DB_HOST') ? DB_HOST : (getenv('DB_HOST') ?: 'localhost');
    $dbName = defined('DB_NAME') ? DB_NAME : (getenv('DB_NAME') ?: 'u534600013_konstructz');
    $dbUser = defined('DB_USER') ? DB_USER : (getenv('DB_USER') ?: '');
    $dbPass = defined('DB_PASS') ? DB_PASS : (getenv('DB_PASS') ?: '');

    $connected = false;

    // 1. Attempt MySQL connection if credentials are configured
    if (!empty($dbUser)) {
        try {
            $dsn = "mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4";
            $mysqlInitCommand = defined('Pdo\Mysql::ATTR_INIT_COMMAND')
                ? \Pdo\Mysql::ATTR_INIT_COMMAND
                : (defined('PDO::MYSQL_ATTR_INIT_COMMAND') ? constant('PDO::MYSQL_ATTR_INIT_COMMAND') : 1002);

            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                $mysqlInitCommand => "SET NAMES utf8mb4"
            ];
            $pdoInstance = new PDO($dsn, $dbUser, $dbPass, $options);
            $connected = true;
        } catch (Exception $e) {
            // MySQL unavailable or credentials mismatch, fallback to SQLite
            $connected = false;
        }
    }

    // 2. Fallback to SQLite (data/site.db)
    if (!$connected) {
        $dataDir = dirname(__DIR__, 2) . '/data';
        if (!is_dir($dataDir)) {
            @mkdir($dataDir, 0755, true);
        }
        $sqlitePath = $dataDir . '/site.db';
        try {
            $pdoInstance = new PDO("sqlite:{$sqlitePath}", null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
            ]);
            $pdoInstance->exec("PRAGMA journal_mode = WAL;");
            $pdoInstance->exec("PRAGMA foreign_keys = ON;");
            $connected = true;
        } catch (Exception $e) {
            error_log("Database connection error: " . $e->getMessage());
            return null;
        }
    }

    if ($pdoInstance) {
        ensure_cms_schema_migrated($pdoInstance);
    }

    return $pdoInstance;
}

function ensure_cms_schema_migrated($pdo) {
    if (!$pdo) return;

    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    $isMysql = ($driver === 'mysql');

    $idType = "VARCHAR(64) PRIMARY KEY";
    $textType = $isMysql ? "LONGTEXT" : "TEXT";

    try {
        // 1. Users Table
        $pdo->exec("CREATE TABLE IF NOT EXISTS cms_users (
            id VARCHAR(64) PRIMARY KEY,
            username VARCHAR(100) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(255),
            role VARCHAR(50) NOT NULL DEFAULT 'editor',
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            two_factor_secret VARCHAR(255) NULL,
            two_factor_enabled INT DEFAULT 0,
            failed_login_attempts INT DEFAULT 0,
            locked_until BIGINT NULL,
            last_login_at BIGINT NULL,
            created_at BIGINT NOT NULL,
            updated_at BIGINT NOT NULL
        )");

        // 2. Custom Roles Table
        $pdo->exec("CREATE TABLE IF NOT EXISTS cms_roles (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(100) UNIQUE NOT NULL,
            display_name VARCHAR(100) NOT NULL,
            description TEXT,
            permissions TEXT NOT NULL,
            is_system INT DEFAULT 0,
            created_at BIGINT NOT NULL,
            updated_at BIGINT NOT NULL
        )");

        // 3. User Sessions Table
        $pdo->exec("CREATE TABLE IF NOT EXISTS cms_sessions (
            id VARCHAR(128) PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL,
            ip_address VARCHAR(45) NOT NULL,
            user_agent TEXT,
            last_activity BIGINT NOT NULL,
            expires_at BIGINT NOT NULL,
            is_revoked INT DEFAULT 0,
            created_at BIGINT NOT NULL
        )");

        // 4. Login Attempts Table
        $pdo->exec("CREATE TABLE IF NOT EXISTS cms_login_attempts (
            id VARCHAR(64) PRIMARY KEY,
            identifier VARCHAR(255) NOT NULL,
            ip_address VARCHAR(45) NOT NULL,
            user_agent TEXT,
            success INT NOT NULL,
            failure_reason VARCHAR(100) NULL,
            created_at BIGINT NOT NULL
        )");

        // 5. Security Blocks Table (IP or account bans)
        $pdo->exec("CREATE TABLE IF NOT EXISTS cms_security_blocks (
            id VARCHAR(64) PRIMARY KEY,
            type VARCHAR(20) NOT NULL,
            target VARCHAR(255) NOT NULL,
            reason TEXT NOT NULL,
            created_by VARCHAR(255) NOT NULL,
            expires_at BIGINT NULL,
            created_at BIGINT NOT NULL
        )");

        // 6. Security & Action Audit Logs Table
        $pdo->exec("CREATE TABLE IF NOT EXISTS cms_audit_logs (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(64) NULL,
            action VARCHAR(100) NOT NULL,
            resource_type VARCHAR(50) NOT NULL,
            resource_id VARCHAR(255) NULL,
            details_json TEXT,
            ip_address VARCHAR(45),
            created_at BIGINT NOT NULL
        )");

        // 7. CMS Settings Table
        $pdo->exec("CREATE TABLE IF NOT EXISTS cms_settings (
            setting_key VARCHAR(100) PRIMARY KEY,
            setting_value TEXT,
            updated_at BIGINT NOT NULL
        )");

        // 8. Media Library Table
        $pdo->exec("CREATE TABLE IF NOT EXISTS cms_media (
            id VARCHAR(64) PRIMARY KEY,
            filename VARCHAR(255) NOT NULL,
            original_name VARCHAR(255) NOT NULL,
            filepath VARCHAR(500) NOT NULL,
            mime_type VARCHAR(100) NOT NULL,
            file_size INT NOT NULL,
            dimensions VARCHAR(50),
            alt_text VARCHAR(500),
            caption TEXT,
            uploaded_by VARCHAR(64),
            created_at BIGINT NOT NULL
        )");

        // 9. Blog Categories Table
        $pdo->exec("CREATE TABLE IF NOT EXISTS blog_categories (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            slug VARCHAR(100) UNIQUE NOT NULL,
            description TEXT,
            parent_id VARCHAR(64) NULL,
            display_order INT DEFAULT 0,
            created_at BIGINT NOT NULL
        )");

        // 10. Blog Posts Table
        $pdo->exec("CREATE TABLE IF NOT EXISTS blog_posts (
            id VARCHAR(255) PRIMARY KEY,
            slug VARCHAR(255) UNIQUE NOT NULL,
            title VARCHAR(500) NOT NULL,
            category VARCHAR(100) DEFAULT 'Guide',
            author VARCHAR(255) DEFAULT 'Admin KONSTRUCTZ',
            featured_image VARCHAR(1000) DEFAULT '',
            excerpt TEXT,
            content {$textType},
            data_json {$textType} NOT NULL,
            status VARCHAR(50) DEFAULT 'Published',
            tags_json TEXT,
            scheduled_at BIGINT NULL,
            published_date VARCHAR(50),
            updated_at BIGINT,
            created_by VARCHAR(64)
        )");

        // Safe column check & migration for blog_posts if table already existed
        $existingCols = [];
        if ($isMysql) {
            $q = $pdo->query("SHOW COLUMNS FROM blog_posts");
            while ($row = $q->fetch()) {
                $existingCols[] = strtolower($row['Field']);
            }
        } else {
            $q = $pdo->query("PRAGMA table_info(blog_posts)");
            while ($row = $q->fetch()) {
                $existingCols[] = strtolower($row['name']);
            }
        }

        $colsToAdd = [
            'category' => "VARCHAR(100) DEFAULT 'Guide'",
            'author' => "VARCHAR(255) DEFAULT 'Admin KONSTRUCTZ'",
            'featured_image' => "VARCHAR(1000) DEFAULT ''",
            'excerpt' => "TEXT",
            'content' => $textType,
            'status' => "VARCHAR(50) DEFAULT 'Published'",
            'tags_json' => "TEXT",
            'scheduled_at' => "BIGINT NULL",
            'published_date' => "VARCHAR(50)",
            'created_by' => "VARCHAR(64)"
        ];

        foreach ($colsToAdd as $col => $definition) {
            if (!in_array(strtolower($col), $existingCols)) {
                $pdo->exec("ALTER TABLE blog_posts ADD COLUMN {$col} {$definition}");
            }
        }

        // Backfill empty columns from data_json in blog_posts
        try {
            $unpopulated = $pdo->query("SELECT id, data_json FROM blog_posts WHERE category IS NULL OR status IS NULL OR status = ''")->fetchAll();
            if (!empty($unpopulated)) {
                $updateStmt = $pdo->prepare("UPDATE blog_posts SET category = ?, author = ?, featured_image = ?, excerpt = ?, status = ?, published_date = ? WHERE id = ?");
                foreach ($unpopulated as $row) {
                    $d = json_decode($row['data_json'] ?? '{}', true) ?: [];
                    $updateStmt->execute([
                        $d['category'] ?? 'Guide',
                        $d['author'] ?? 'Admin KONSTRUCTZ',
                        $d['image'] ?? ($d['featuredImage'] ?? ''),
                        $d['desc'] ?? ($d['excerpt'] ?? ''),
                        $d['status'] ?? 'Published',
                        $d['publishedDate'] ?? ($d['date'] ?? date('Y-m-d')),
                        $row['id']
                    ]);
                }
            }
        } catch (Exception $e) {
            // Non-fatal
        }

        // 11. Blog Post Revisions Table
        $pdo->exec("CREATE TABLE IF NOT EXISTS blog_revisions (
            id VARCHAR(64) PRIMARY KEY,
            post_id VARCHAR(255) NOT NULL,
            title VARCHAR(500) NOT NULL,
            data_json {$textType} NOT NULL,
            created_by VARCHAR(64),
            created_at BIGINT NOT NULL
        )");

        // 12. Products Table
        $pdo->exec("CREATE TABLE IF NOT EXISTS products (
            id VARCHAR(255) PRIMARY KEY,
            slug VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(500) NOT NULL,
            sku VARCHAR(100) NULL,
            category VARCHAR(100) NULL,
            subcategory VARCHAR(100) NULL,
            operating_weight VARCHAR(100) NULL,
            engine VARCHAR(255) NULL,
            price VARCHAR(100) NULL,
            image_url VARCHAR(1000) NULL,
            gallery_json TEXT NULL,
            specs_json TEXT NULL,
            description TEXT NULL,
            status VARCHAR(50) DEFAULT 'Published',
            data_json {$textType} NULL,
            created_at BIGINT,
            updated_at BIGINT
        )");

        // 13. Password Reset Tokens Table
        $pdo->exec("CREATE TABLE IF NOT EXISTS cms_password_resets (
            token VARCHAR(128) PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL,
            expires_at BIGINT NOT NULL,
            used INT DEFAULT 0,
            created_at BIGINT NOT NULL
        )");

        // Create indexes where appropriate
        // MySQL does not support IF NOT EXISTS for indexes, so each one is attempted independently
        $indexStatements = [
            "CREATE INDEX idx_login_identifier ON cms_login_attempts(identifier)",
            "CREATE INDEX idx_login_ip ON cms_login_attempts(ip_address)",
            "CREATE INDEX idx_sessions_user ON cms_sessions(user_id)",
            "CREATE INDEX idx_audit_created ON cms_audit_logs(created_at)",
            "CREATE INDEX idx_posts_status ON blog_posts(status)",
            "CREATE INDEX idx_products_sku ON products(sku)",
            "CREATE INDEX idx_products_status ON products(status)",
        ];
        foreach ($indexStatements as $indexSql) {
            try {
                $pdo->exec($indexSql);
            } catch (Exception $indexError) {
                // Index already exists or is unsupported; safe to ignore
            }
        }

        // Seed Default Roles, Super Admin, Categories, and Products if empty
        seed_cms_defaults($pdo);

    } catch (Exception $e) {
        error_log("Schema migration error: " . $e->getMessage());
    }
}

function seed_cms_defaults($pdo) {
    $now = time();

    // 1. Seed Roles
    $countStmt = $pdo->query("SELECT COUNT(*) FROM cms_roles");
    if ((int)$countStmt->fetchColumn() === 0) {
        $roles = [
            [
                'id' => 'role-superadmin',
                'name' => 'super_admin',
                'display_name' => 'Super Administrator',
                'description' => 'Unrestricted access to all CMS features, security center, user permissions, and configuration.',
                'permissions' => json_encode(['*']),
                'is_system' => 1
            ],
            [
                'id' => 'role-admin',
                'name' => 'admin',
                'display_name' => 'Administrator',
                'description' => 'Manage content, products, categories, media, and standard users.',
                'permissions' => json_encode([
                    'posts.*', 'categories.*', 'products.*', 'media.*', 'users.view', 'users.create', 'users.edit', 'security.view'
                ]),
                'is_system' => 1
            ],
            [
                'id' => 'role-editor',
                'name' => 'editor',
                'display_name' => 'Editor',
                'description' => 'Create, edit, review, and publish blog articles and categories.',
                'permissions' => json_encode([
                    'posts.view', 'posts.create', 'posts.edit', 'posts.publish', 'categories.manage', 'media.upload', 'media.view'
                ]),
                'is_system' => 1
            ],
            [
                'id' => 'role-author',
                'name' => 'author',
                'display_name' => 'Author',
                'description' => 'Create and edit their own articles and upload media.',
                'permissions' => json_encode([
                    'posts.view', 'posts.create', 'posts.edit_own', 'media.upload', 'media.view'
                ]),
                'is_system' => 1
            ],
            [
                'id' => 'role-productmanager',
                'name' => 'product_manager',
                'display_name' => 'Product Manager',
                'description' => 'Manage machinery catalog, specs, pricing, and product media.',
                'permissions' => json_encode([
                    'products.*', 'media.*', 'posts.view'
                ]),
                'is_system' => 1
            ],
            [
                'id' => 'role-securitymanager',
                'name' => 'security_manager',
                'display_name' => 'Security Manager',
                'description' => 'Inspect login activity, manage IP blocks, and revoke suspicious sessions.',
                'permissions' => json_encode([
                    'security.*', 'users.view'
                ]),
                'is_system' => 1
            ],
            [
                'id' => 'role-viewer',
                'name' => 'viewer',
                'display_name' => 'Viewer',
                'description' => 'Read-only access to view CMS content and reports.',
                'permissions' => json_encode([
                    'posts.view', 'products.view', 'media.view'
                ]),
                'is_system' => 1
            ]
        ];

        $stmt = $pdo->prepare("INSERT INTO cms_roles (id, name, display_name, description, permissions, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        foreach ($roles as $r) {
            $stmt->execute([$r['id'], $r['name'], $r['display_name'], $r['description'], $r['permissions'], $r['is_system'], $now, $now]);
        }
    }

    // 2. Seed Default Super Admin User if none exists
    $userCountStmt = $pdo->query("SELECT COUNT(*) FROM cms_users");
    if ((int)$userCountStmt->fetchColumn() === 0) {
        $defaultPassword = 'Admin@StoneKrusher2026!';
        $hashed = password_hash($defaultPassword, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO cms_users (id, username, email, password_hash, full_name, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            'usr-admin-initial',
            'admin',
            'admin@cwqv.com',
            $hashed,
            'KONSTRUCTZ Super Admin',
            'super_admin',
            'active',
            $now,
            $now
        ]);
    }

    // 3. Seed Default Settings
    $settingsCountStmt = $pdo->query("SELECT COUNT(*) FROM cms_settings");
    if ((int)$settingsCountStmt->fetchColumn() === 0) {
        $defaults = [
            'site_name' => 'KONSTRUCTZ Machinery',
            'site_url' => 'https://stonekrusher.com',
            'admin_email' => 'sales@cwqv.com',
            'max_failed_logins' => '10',
            'lockout_duration_minutes' => '15',
            'session_lifetime_hours' => '8',
            'audit_log_retention_days' => '90',
            'default_theme' => 'dark',
            'enable_2fa' => '0',
            'posts_per_page' => '10'
        ];
        $stmt = $pdo->prepare("INSERT INTO cms_settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?)");
        foreach ($defaults as $k => $v) {
            $stmt->execute([$k, $v, $now]);
        }
    }

    // 4. Seed Default Categories
    $catCountStmt = $pdo->query("SELECT COUNT(*) FROM blog_categories");
    if ((int)$catCountStmt->fetchColumn() === 0) {
        $cats = [
            ['id' => 'cat-machines', 'name' => 'Machines', 'slug' => 'machines', 'description' => 'Heavy equipment, excavators, loaders, and compact machines.'],
            ['id' => 'cat-guides', 'name' => 'Guides', 'slug' => 'guides', 'description' => 'Operator guidance, maintenance, and jobsite best practices.'],
            ['id' => 'cat-industry', 'name' => 'Industry', 'slug' => 'industry', 'description' => 'Construction news, machinery tech, and market comparisons.'],
            ['id' => 'cat-safety', 'name' => 'Safety', 'slug' => 'safety', 'description' => 'Jobsite safety guidelines and equipment standards.']
        ];
        $stmt = $pdo->prepare("INSERT INTO blog_categories (id, name, slug, description, display_order, created_at) VALUES (?, ?, ?, ?, ?, ?)");
        $order = 0;
        foreach ($cats as $c) {
            $stmt->execute([$c['id'], $c['name'], $c['slug'], $c['description'], $order++, $now]);
        }
    }

    // 5. Seed Existing Blog Posts into database if table is empty
    $postCountStmt = $pdo->query("SELECT COUNT(*) FROM blog_posts");
    if ((int)$postCountStmt->fetchColumn() === 0) {
        $blogJsonFile = dirname(__DIR__, 2) . '/data/blog-posts.json';
        if (file_exists($blogJsonFile)) {
            $postsData = json_decode(file_get_contents($blogJsonFile), true);
            if (is_array($postsData)) {
                $stmt = $pdo->prepare("INSERT INTO blog_posts (id, slug, title, category, author, featured_image, excerpt, data_json, status, published_date, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                foreach ($postsData as $p) {
                    $slug = $p['slug'] ?? ('post-' . uniqid());
                    $title = $p['title'] ?? 'Untitled Article';
                    $cat = $p['category'] ?? 'Guide';
                    $author = $p['author'] ?? 'Admin KONSTRUCTZ';
                    $img = $p['image'] ?? ($p['featuredImage'] ?? '');
                    $desc = $p['desc'] ?? ($p['excerpt'] ?? '');
                    $dataJson = json_encode($p, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
                    $pubDate = $p['publishedDate'] ?? ($p['date'] ?? date('Y-m-d'));
                    $status = $p['status'] ?? 'Published';
                    $stmt->execute([
                        $slug,
                        $slug,
                        $title,
                        $cat,
                        $author,
                        $img,
                        $desc,
                        $dataJson,
                        $status,
                        $pubDate,
                        $now,
                        'usr-admin-initial'
                    ]);
                }
            }
        }
    }

    // 6. Seed Products from equipment-products.json if table is empty
    $prodCountStmt = $pdo->query("SELECT COUNT(*) FROM products");
    if ((int)$prodCountStmt->fetchColumn() === 0) {
        $prodJsonFile = dirname(__DIR__, 2) . '/src/data/equipment-products.json';
        if (file_exists($prodJsonFile)) {
            $prodsData = json_decode(file_get_contents($prodJsonFile), true);
            if (is_array($prodsData)) {
                $stmt = $pdo->prepare("INSERT INTO products (id, slug, name, sku, category, price, image_url, gallery_json, description, status, data_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                foreach ($prodsData as $idx => $pr) {
                    $slug = $pr['slug'] ?? ('prod-' . uniqid());
                    $name = $pr['name'] ?? 'Equipment Product';
                    $sku = 'SKU-' . strtoupper(substr(md5($slug), 0, 8));
                    $cat = $pr['category'] ?? 'Machinery';
                    $price = isset($pr['price']) ? (string)$pr['price'] : '';
                    $img = $pr['image'] ?? '';
                    $gallery = isset($pr['images']) ? json_encode($pr['images']) : json_encode([]);
                    $desc = $pr['desc'] ?? ($pr['fullDesc'] ?? '');
                    $dataJson = json_encode($pr, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
                    $stmt->execute([
                        $slug,
                        $slug,
                        $name,
                        $sku,
                        $cat,
                        $price,
                        $img,
                        $gallery,
                        $desc,
                        'Published',
                        $dataJson,
                        $now,
                        $now
                    ]);
                }
            }
        }
    }
}
