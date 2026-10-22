import https from 'https';
import fs from 'fs';
import path from 'path';

const baseUrl = 'https://stonekrusher.com';
const host = 'stonekrusher.com';
const sitemapUrl = `${baseUrl}/sitemap.xml`;
const apiKey = '4e2c9180ab5f4f899b418a032d8471e6';
const keyLocation = `${baseUrl}/${apiKey}.txt`;

const pingUrl = (url) => new Promise((resolve) => {
  https.get(url, (res) => {
    console.log(`Pinged: ${url} -> Status: ${res.statusCode}`);
    resolve(res.statusCode);
  }).on('error', (err) => {
    console.warn(`Failed pinging ${url}:`, err.message);
    resolve(null);
  });
});

const submitIndexNow = (urlList, endpoint = 'https://www.bing.com/indexnow') => new Promise((resolve) => {
  if (!urlList.length) {
    resolve(null);
    return;
  }

  const payload = JSON.stringify({
    host,
    key: apiKey,
    keyLocation,
    urlList
  });

  const req = https.request(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (res) => {
    let body = '';
    res.on('data', chunk => { body += chunk; });
    res.on('end', () => {
      console.log(`IndexNow submission (${endpoint}) -> Status: ${res.statusCode} (${urlList.length} URLs submitted)`);
      if (res.statusCode >= 400 && body) {
        console.warn(`IndexNow response detail: ${body}`);
      }
      resolve(res.statusCode);
    });
  });

  req.on('error', (err) => {
    console.warn(`IndexNow submission warning (${endpoint}):`, err.message);
    resolve(null);
  });

  req.write(payload);
  req.end();
});

function getSitemapUrls() {
  const sitemapPath = path.resolve('public/sitemap.xml');
  if (!fs.existsSync(sitemapPath)) return [];
  const content = fs.readFileSync(sitemapPath, 'utf8');
  const urls = [];
  const matches = content.matchAll(/<loc>(https:\/\/[^<]+)<\/loc>/g);
  for (const m of matches) {
    urls.push(m[1]);
  }
  return urls;
}

async function main() {
  const urls = getSitemapUrls();
  if (urls.length > 0) {
    console.log(`Submitting ${urls.length} URLs to IndexNow protocol (${sitemapUrl})...`);
    await submitIndexNow(urls);
  }
}

main();
