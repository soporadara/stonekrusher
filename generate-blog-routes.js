import fs from 'node:fs'
import path from 'node:path'
import { getBlogPosts, saveBlogPosts } from './data/db.js'

const siteUrl = 'https://stonekrusher.com'
const outputRoot = path.resolve('public/blog')

const posts = getBlogPosts();
saveBlogPosts(posts);

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const publishedPosts = posts.filter(post => (
  post?.slug &&
  (post.status || 'Published') === 'Published'
))

const formatArticleBody = (text = '', articleTitle = 'KONSTRUCTZ equipment guide') => {
  return String(text)
    .split(/\n\n+/)
    .map(block => {
      block = block.trim();
      if (!block) return '';
      if (block.startsWith('## ')) {
        return `<h2 style="font-size:26px;color:#b8d49a;margin:32px 0 16px;">${escapeHtml(block.slice(3))}</h2>`;
      }
      if (block.startsWith('### ')) {
        return `<h3 style="font-size:20px;color:#f7f7f2;margin:24px 0 12px;">${escapeHtml(block.slice(4))}</h3>`;
      }
      if (/^https?:\/\/.*?\.(webp|jpg|jpeg|png)$/i.test(block)) {
        return `<div style="text-align:center;margin:32px 0;"><img src="${escapeHtml(block)}" alt="${escapeHtml(`${articleTitle} equipment photo for sale official image source stonekrusher.com`)}" title="${escapeHtml(`KONSTRUCTZ ${articleTitle} machinery image`)}" width="800" height="480" loading="lazy" style="max-width:100%;height:auto;border-radius:12px;border:1px solid #2c3527;"></div>`;
      }
      if (block.startsWith('- ')) {
        const items = block.split(/\n- /).map(item => `<li style="margin-bottom:8px;">${escapeHtml(item.replace(/^- /, ''))}</li>`).join('');
        return `<ul style="padding-left:24px;margin-bottom:20px;">${items}</ul>`;
      }
      return `<p style="font-size:17px;line-height:1.75;color:#d4d8cf;margin-bottom:20px;">${escapeHtml(block)}</p>`;
    })
    .join('\n');
};

// Generate Full Blog Hub Page at public/blog/index.html
const blogHubSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'KONSTRUCTZ',
      url: `${siteUrl}/`,
      logo: `${siteUrl}/favicon.png`,
      telephone: '+1-213-214-2203',
      email: 'sales@cwqv.com'
    },
    {
      '@type': 'CollectionPage',
      '@id': `${siteUrl}/blog/#webpage`,
      url: `${siteUrl}/blog/`,
      name: 'KONSTRUCTZ Machinery Blog & Equipment Guides',
      description: 'Read the latest compact construction equipment guides, mini excavator operating tips, maintenance advice, and machinery comparison articles from KONSTRUCTZ.',
      isPartOf: { '@id': `${siteUrl}/#website` }
    }
  ]
};

const blogCardsHtml = publishedPosts.map(post => `
  <article style="background:#181e15;border:1px solid #2c3527;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;transition:transform .2s,border-color .2s;">
    <a href="/blog/${escapeHtml(post.slug)}/">
      <img src="${escapeHtml(post.image || `${siteUrl}/about-machine-panorama-poster.png`)}" alt="${escapeHtml(`${post.title} KONSTRUCTZ equipment photo for sale official image source stonekrusher.com`)}" title="${escapeHtml(`Read ${post.title}`)}" width="400" height="220" loading="lazy" style="width:100%;height:220px;object-fit:cover;background:#0c0f0a;">
    </a>
    <div style="padding:24px;display:flex;flex-direction:column;flex-grow:1;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="background:#2c3527;color:#b8d49a;font-size:12px;font-weight:700;padding:4px 10px;border-radius:99px;">${escapeHtml(post.category || 'Guide')}</span>
        <span style="color:#aeb5a8;font-size:13px;">${escapeHtml(post.date || post.publishedDate)}</span>
      </div>
      <h2 style="font-size:20px;line-height:1.35;margin:0 0 12px;color:#f7f7f2;">
        <a href="/blog/${escapeHtml(post.slug)}/" style="color:#f7f7f2;text-decoration:none;">${escapeHtml(post.title)}</a>
      </h2>
      <p style="color:#aeb5a8;font-size:14px;line-height:1.6;margin:0 0 20px;flex-grow:1;">${escapeHtml(post.desc || post.seoDescription)}</p>
      <a href="/blog/${escapeHtml(post.slug)}/" style="display:inline-flex;align-items:center;color:#b8d49a;font-weight:700;text-decoration:none;font-size:15px;">Read Full Guide &rarr;</a>
    </div>
  </article>
`).join('\n');

const blogHubHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KONSTRUCTZ Machinery Blog &amp; Equipment Guides | KONSTRUCTZ</title>
  <meta name="description" content="Read the latest compact construction equipment guides, mini excavator tips, maintenance advice, and jobsite news from KONSTRUCTZ.">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
  <link rel="canonical" href="${siteUrl}/blog/">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="KONSTRUCTZ">
  <meta property="og:title" content="KONSTRUCTZ Machinery Blog &amp; Equipment Guides">
  <meta property="og:description" content="Read the latest compact construction equipment guides, mini excavator tips, maintenance advice, and jobsite news from KONSTRUCTZ.">
  <meta property="og:url" content="${siteUrl}/blog/">
  <meta property="og:image" content="${siteUrl}/about-hero-studio-poster.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="KONSTRUCTZ Machinery Blog &amp; Equipment Guides">
  <meta name="twitter:description" content="Read the latest compact construction equipment guides, mini excavator tips, maintenance advice, and jobsite news from KONSTRUCTZ.">
  <meta name="twitter:image" content="${siteUrl}/about-hero-studio-poster.png">
  <script type="application/ld+json">${JSON.stringify(blogHubSchema).replace(/</g, '\\u003c')}</script>
  <style>
    :root { --bg-dark: #11150f; --card-bg: #181e15; --border-color: #2c3527; --text-main: #f7f7f2; --text-muted: #aeb5a8; --accent: #b8d49a; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg-dark); color: var(--text-main); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; }
    header { background: #0c0f0a; border-bottom: 1px solid var(--border-color); padding: 16px 24px; }
    header .container { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
    .brand { font-size: 22px; font-weight: 900; letter-spacing: .12em; color: var(--accent); text-decoration: none; }
    nav.nav-links a { color: var(--text-main); text-decoration: none; margin-left: 20px; font-size: 14px; font-weight: 600; }
    nav.nav-links a:hover { color: var(--accent); }
    main.static-blog-hub { max-width: 1200px; margin: 0 auto; padding: 40px 24px 80px; }
    .hero-heading { max-width: 750px; margin-bottom: 48px; }
    .hero-heading h1 { font-size: clamp(32px, 5vw, 54px); margin: 0 0 16px; color: var(--text-main); line-height: 1.15; }
    .hero-heading p { font-size: 18px; color: var(--text-muted); margin: 0; }
    .blog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 28px; }
    footer { background: #0c0f0a; border-top: 1px solid var(--border-color); padding: 40px 24px; margin-top: 80px; color: var(--text-muted); font-size: 14px; }
    footer .container { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 24px; }
    @media(max-width:768px) { nav.nav-links { display: none; } }
  </style>
</head>
<body>
    <header>
      <div class="container">
        <a class="brand" href="/">KONSTRUCTZ</a>
        <nav class="nav-links">
          <a href="/">Home</a>
          <a href="/equipment/">Equipment</a>
          <a href="/equipment/attachments/">Attachments</a>
          <a href="/blog/">Blog</a>
          <a href="/contact/">Contact</a>
          <a href="/support/">Support</a>
        </nav>
      </div>
    </header>

    <main class="static-blog-hub">
      <div class="hero-heading">
        <h1>KONSTRUCTZ Machinery Blog</h1>
        <p>Read the latest compact construction equipment guides, mini excavator tips, maintenance advice, and jobsite news from KONSTRUCTZ.</p>
      </div>

      <section class="blog-grid" aria-label="KONSTRUCTZ Blog Articles">
        ${blogCardsHtml}
      </section>
    </main>

    <footer>
      <div class="container">
        <div>
          <strong style="color:var(--accent);font-size:18px;">KONSTRUCTZ</strong>
          <p style="max-width:320px;margin-top:8px;">Official supplier of compact construction machinery, mini excavators, wheel loaders, skid steers, and heavy-duty attachments.</p>
        </div>
        <div>
          <strong>Contact Us</strong>
          <p style="margin-top:8px;">Email: sales@cwqv.com<br>Phone: +1 213-214-2203<br>Address: 2522 S Malt Ave, Commerce, CA 90040</p>
        </div>
      </div>
    </footer>
</body>
</html>
`;

fs.mkdirSync(outputRoot, { recursive: true });
fs.writeFileSync(path.join(outputRoot, 'index.html'), blogHubHtml, 'utf8');

// Clean up retired / deleted post folders in public/blog/
const activeSlugs = new Set(publishedPosts.map(p => p.slug));
if (fs.existsSync(outputRoot)) {
  const existingFiles = fs.readdirSync(outputRoot);
  for (const file of existingFiles) {
    if (file === 'index.html') continue;
    const fullPath = path.join(outputRoot, file);
    if (fs.statSync(fullPath).isDirectory() && !activeSlugs.has(file)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`Cleaned up deleted blog route folder: public/blog/${file}`);
    }
  }
}

// Generate Individual Blog Post Pages (e.g. public/blog/how-long-does-it-take-to-learn-to-operate-a-mini-excavator/index.html)
for (const post of publishedPosts) {
  const slug = post.slug;
  const cleanPath = `/blog/${slug}/`;
  const outputDir = path.join(outputRoot, slug);
  const title = escapeHtml(post.seoTitle || `${post.title} | KONSTRUCTZ Blog`);
  const description = escapeHtml(post.seoDescription || post.desc || '');
  const image = escapeHtml(post.image || `${siteUrl}/about-machine-panorama-poster.png`);

  const articleBodyHtml = (post.sections || [])
    .map(sec => formatArticleBody(sec.body || '', post.title))
    .join('\n');

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${siteUrl}${cleanPath}#article`,
        headline: post.title,
        description: post.seoDescription || post.desc || '',
        image: [post.image || `${siteUrl}/about-machine-panorama-poster.png`],
        datePublished: post.publishedDate || '2026-08-15',
        dateModified: post.updatedDate || '2026-08-15',
        author: { '@type': 'Organization', name: 'KONSTRUCTZ', url: siteUrl },
        publisher: { '@type': 'Organization', name: 'KONSTRUCTZ', url: siteUrl, logo: { '@type': 'ImageObject', url: `${siteUrl}/favicon.png` } }
      },
      {
        '@type': 'ImageObject',
        '@id': `${siteUrl}${cleanPath}#primaryimage`,
        url: image,
        contentUrl: image,
        caption: `Official KONSTRUCTZ image for ${post.title}, compact construction equipment and machinery guide at stonekrusher.com.`,
        name: `${post.title} KONSTRUCTZ equipment photo`
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${siteUrl}/blog/` },
          { '@type': 'ListItem', position: 3, name: post.title, item: `${siteUrl}${cleanPath}` }
        ]
      }
    ]
  };

  const articleHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
  <link rel="canonical" href="${siteUrl}${cleanPath}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="KONSTRUCTZ">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${siteUrl}${cleanPath}">
  <meta property="og:image" content="${image}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${image}">
  <script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>
  <style>
    :root { --bg-dark: #11150f; --card-bg: #181e15; --border-color: #2c3527; --text-main: #f7f7f2; --text-muted: #aeb5a8; --accent: #b8d49a; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg-dark); color: var(--text-main); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; }
    header { background: #0c0f0a; border-bottom: 1px solid var(--border-color); padding: 16px 24px; }
    header .container { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
    .brand { font-size: 22px; font-weight: 900; letter-spacing: .12em; color: var(--accent); text-decoration: none; }
    nav.nav-links a { color: var(--text-main); text-decoration: none; margin-left: 20px; font-size: 14px; font-weight: 600; }
    nav.nav-links a:hover { color: var(--accent); }
    main.static-blog-article { max-width: 900px; margin: 0 auto; padding: 40px 24px 80px; }
    .breadcrumb { font-size: 14px; color: var(--text-muted); margin-bottom: 24px; }
    .breadcrumb a { color: var(--accent); text-decoration: none; }
    .category-badge { display: inline-block; background: var(--border-color); color: var(--accent); font-size: 13px; font-weight: 700; padding: 4px 12px; border-radius: 99px; margin-bottom: 16px; }
    h1 { font-size: clamp(28px, 4.5vw, 48px); line-height: 1.2; margin: 0 0 16px; color: var(--text-main); }
    .meta-info { color: var(--text-muted); font-size: 14px; margin-bottom: 32px; border-bottom: 1px solid var(--border-color); padding-bottom: 16px; }
    .hero-img { width: 100%; max-height: 480px; object-fit: cover; border-radius: 16px; border: 1px solid var(--border-color); margin-bottom: 40px; }
    .article-content p { font-size: 18px; line-height: 1.8; color: #d4d8cf; margin-bottom: 24px; }
    .cta-box { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 16px; padding: 32px; margin-top: 56px; text-align: center; }
    .cta-box h3 { font-size: 22px; color: var(--accent); margin: 0 0 12px; }
    .cta-btn { display: inline-block; background: var(--accent); color: #0c0f0a; font-weight: 900; text-transform: uppercase; padding: 14px 28px; text-decoration: none; border-radius: 99px; font-size: 15px; margin-top: 12px; }
    footer { background: #0c0f0a; border-top: 1px solid var(--border-color); padding: 40px 24px; margin-top: 80px; color: var(--text-muted); font-size: 14px; }
    footer .container { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 24px; }
    @media(max-width:768px) { nav.nav-links { display: none; } }
  </style>
</head>
<body>
    <header>
      <div class="container">
        <a class="brand" href="/">KONSTRUCTZ</a>
        <nav class="nav-links">
          <a href="/">Home</a>
          <a href="/equipment/">Equipment</a>
          <a href="/equipment/attachments/">Attachments</a>
          <a href="/blog/">Blog</a>
          <a href="/contact/">Contact</a>
          <a href="/support/">Support</a>
        </nav>
      </div>
    </header>

    <main class="static-blog-article">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a> &gt; <a href="/blog/">Blog</a> &gt; ${escapeHtml(post.title)}
      </nav>

      <article>
        <span class="category-badge">${escapeHtml(post.category || 'Buyer Guide')}</span>
        <h1>${escapeHtml(post.title)}</h1>
        <div class="meta-info">
          Published on <strong>${escapeHtml(post.date || post.publishedDate)}</strong> by <strong>KONSTRUCTZ Machinery Team</strong>
        </div>

        ${post.image ? `<img class="hero-img" src="${escapeHtml(post.image)}" alt="${escapeHtml(`${post.title} equipment guide`)}" width="900" height="480" loading="eager">` : ''}

        <div class="article-content">
          ${articleBodyHtml}
        </div>

        <div class="cta-box">
          <h3>Looking for Compact Construction Equipment?</h3>
          <p style="color:var(--text-muted);margin:0 0 16px;">Shop mini excavators, wheel loaders, skid steers, and attachments with direct U.S. freight shipping and quote support.</p>
          <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
            <a class="cta-btn" href="/equipment/mini-excavators/">Mini Excavators For Sale</a>
            <a class="cta-btn" style="background:#2c3527;color:#b8d49a;" href="/equipment/skid-steers/">Skid Steers For Sale</a>
            <a class="cta-btn" style="background:#2c3527;color:#b8d49a;" href="/equipment/backhoes/">Backhoe Loaders For Sale</a>
          </div>
        </div>
      </article>
    </main>

    <footer>
      <div class="container">
        <div>
          <strong style="color:var(--accent);font-size:18px;">KONSTRUCTZ</strong>
          <p style="max-width:320px;margin-top:8px;">Official supplier of compact construction machinery, mini excavators, wheel loaders, skid steers, and heavy-duty attachments.</p>
        </div>
        <div>
          <strong>Contact Us</strong>
          <p style="margin-top:8px;">Email: sales@cwqv.com<br>Phone: +1 213-214-2203<br>Address: 2522 S Malt Ave, Commerce, CA 90040</p>
        </div>
      </div>
    </footer>
</body>
</html>
`;

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'index.html'), articleHtml, 'utf8');
}

console.log(`Generated full HTML Blog Hub and ${publishedPosts.length} rich blog article pages in public/blog/`);
