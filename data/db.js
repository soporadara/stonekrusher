import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = __dirname;
const dbPath = path.join(dataDir, 'site.db');
const blogPostsFile = path.join(dataDir, 'blog-posts.json');
const publicApiDir = path.join(__dirname, '..', 'public', 'api');
const publicBlogDataFile = path.join(publicApiDir, 'blog-posts-data.json');
const publicBlogDefaultFile = path.join(publicApiDir, 'blog-posts-default.json');

let db = null;

try {
  const { DatabaseSync } = await import('node:sqlite');
  db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT,
      data_json TEXT NOT NULL,
      updated_at INTEGER
    );
  `);
} catch (err) {
  console.warn('SQLite native module warning (using JSON file sync fallback):', err.message);
}

function readJsonFile(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Ignore parse error
    }
  }
  return [];
}

function syncToFiles(posts) {
  const jsonContent = `${JSON.stringify(posts, null, 2)}\n`;
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(blogPostsFile, jsonContent, 'utf8');
  } catch (err) {
    console.warn('Could not write to data/blog-posts.json:', err.message);
  }

  if (fs.existsSync(publicApiDir)) {
    try {
      fs.writeFileSync(publicBlogDataFile, jsonContent, 'utf8');
      fs.writeFileSync(publicBlogDefaultFile, jsonContent, 'utf8');
    } catch (err) {
      console.warn('Could not write to public/api blog JSON files:', err.message);
    }
  }
}

export function getBlogPosts() {
  if (db) {
    try {
      const rows = db.prepare('SELECT data_json FROM blog_posts ORDER BY updated_at DESC').all();
      if (rows && rows.length > 0) {
        return rows.map(r => JSON.parse(r.data_json));
      }
    } catch (err) {
      console.warn('Error reading from SQLite db:', err.message);
    }
  }

  // Fallback to highest-count file source
  const fileSources = [blogPostsFile, publicBlogDataFile, publicBlogDefaultFile];
  let best = [];
  for (const src of fileSources) {
    const candidate = readJsonFile(src);
    if (candidate.length >= best.length) {
      best = candidate;
    }
  }

  if (db && best.length > 0) {
    // Seed DB from file
    try {
      saveBlogPosts(best);
    } catch {
      // Ignore seeding error
    }
  }

  return best;
}

export function saveBlogPosts(posts) {
  if (!Array.isArray(posts)) {
    throw new Error('Expected an array of blog posts.');
  }

  if (db) {
    try {
      db.exec('BEGIN TRANSACTION');
      db.exec('DELETE FROM blog_posts');
      const insertStmt = db.prepare(`
        INSERT INTO blog_posts (id, slug, title, data_json, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        const slug = post.slug || `post-${i + 1}`;
        const id = String(post.id || slug);
        const title = post.title || '';
        const updatedAt = post.updatedDate ? new Date(post.updatedDate).getTime() : Date.now();
        insertStmt.run(id, slug, title, JSON.stringify(post), updatedAt || Date.now());
      }
      db.exec('COMMIT');
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch {}
      console.warn('SQLite transaction warning:', err.message);
    }
  }

  // Dual sync to JSON storage files for static site builds
  syncToFiles(posts);
  return posts;
}

// Initial seed check on load
getBlogPosts();
