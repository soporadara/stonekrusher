-- =========================================================
-- KONSTRUCTZ Website Database Schema (schema.sql)
-- Compatible with SQLite, MySQL, and PostgreSQL
-- =========================================================

-- 1. CMS Posts Table (Kuvyn / CMS database structure)
CREATE TABLE IF NOT EXISTS posts (
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
  visibility VARCHAR(50) DEFAULT 'public',
  UNIQUE KEY idx_posts_slug (slug)
);

-- 2. Blog Posts Table (JSON storage structure)
CREATE TABLE IF NOT EXISTS blog_posts (
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
);

-- 3. Blog Comments Table
CREATE TABLE IF NOT EXISTS blog_comments (
  id VARCHAR(255) PRIMARY KEY,
  post_slug VARCHAR(255) NOT NULL,
  author_name VARCHAR(255) NOT NULL,
  author_email VARCHAR(255),
  comment_text TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'Approved',
  created_at BIGINT
);

-- 4. Product Catalog Table
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(255) PRIMARY KEY,
  slug VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(500) NOT NULL,
  category VARCHAR(100),
  subcategory VARCHAR(100),
  operating_weight VARCHAR(100),
  engine VARCHAR(255),
  price VARCHAR(100),
  image_url VARCHAR(1000),
  data_json TEXT NOT NULL,
  created_at BIGINT
);

-- 5. Customer Inquiries & Quote Requests Table
CREATE TABLE IF NOT EXISTS inquiries (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(100),
  equipment_model VARCHAR(255),
  message TEXT,
  status VARCHAR(50) DEFAULT 'New',
  created_at BIGINT
);
