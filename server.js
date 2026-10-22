import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getBlogPosts, saveBlogPosts } from './data/db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, 'dist')
const dataDir = path.join(__dirname, 'data')
const blogPostsFile = path.join(dataDir, 'blog-posts.json')
const port = Number(process.env.PORT || 3000)

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8'
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Internal server error')
      return
    }

    res.writeHead(200, {
      'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': filePath.includes(`${path.sep}assets${path.sep}`)
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=0, must-revalidate'
    })
    res.end(data)
  })
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  })
  res.end(JSON.stringify(payload))
}

function readRequestJson(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 10_000_000) {
        req.destroy()
        reject(new Error('Request body too large'))
      }
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : null)
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    const requestedPath = decodeURIComponent(url.pathname)

    if (requestedPath === '/api/blog-posts' || requestedPath === '/api/blog-posts.php') {
      if (req.method === 'GET') {
        try {
          const posts = getBlogPosts();
          sendJson(res, 200, { posts });
        } catch (error) {
          sendJson(res, 500, { error: 'Could not read blog posts.' });
        }
        return;
      }

      if (req.method === 'PUT') {
        try {
          const payload = await readRequestJson(req);
          if (!payload || !Array.isArray(payload.posts)) {
            sendJson(res, 400, { error: 'Expected { posts: [...] }.' });
            return;
          }

          const saved = saveBlogPosts(payload.posts);
          sendJson(res, 200, { ok: true, posts: saved });
        } catch (error) {
          sendJson(res, 500, { error: error.message || 'Could not save blog posts.' });
        }
        return;
      }

      sendJson(res, 405, { error: 'Method not allowed.' })
      return
    }

    const normalizedPath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, '')
    const staticPath = path.join(distDir, normalizedPath)

    if (!staticPath.startsWith(distDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Forbidden')
      return
    }

    fs.stat(staticPath, (error, stats) => {
      if (!error && stats.isFile()) {
        sendFile(res, staticPath)
        return
      }

      sendFile(res, path.join(distDir, 'index.html'))
    })
  })
  .listen(port, '0.0.0.0', () => {
    console.log(`KONSTRUCTZ server listening on port ${port}`)
  })
