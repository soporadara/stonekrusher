// Generates crawlable static HTML for the legal pages from src/data/legal-content.js.
// The React bundle is injected later by post-build-seo.js, so users get the full app
// while crawlers and no-JS visitors still see the complete document text.
import fs from 'fs';
import path from 'path';
import {
  LEGAL_COMPANY,
  LEGAL_DOCUMENT_LIST,
  LEGAL_LAST_UPDATED
} from './src/data/legal-content.js';

const baseUrl = LEGAL_COMPANY.siteUrl;
const ogImage = `${baseUrl}/about-hero-studio-poster.png`;

const esc = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const renderBlock = (block) => {
  if (typeof block === 'string') return `<p>${esc(block)}</p>`;
  if (block.list) return `<ul>${block.list.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`;
  if (block.note) return `<p><em>${esc(block.note)}</em></p>`;
  return '';
};

const renderSection = (section, index) => `
      <section id="${esc(section.id)}">
        <h2>${index + 1}. ${esc(section.title)}</h2>
        ${section.body.map(renderBlock).join('\n        ')}${section.id === 'contact' ? `
        <p>${esc(LEGAL_COMPANY.brand)}<br>${LEGAL_COMPANY.addressLines.map(esc).join('<br>')}<br>${esc(LEGAL_COMPANY.phone)}<br><a href="mailto:${esc(LEGAL_COMPANY.email)}">${esc(LEGAL_COMPANY.email)}</a></p>` : ''}
      </section>`;

const buildPage = (doc) => {
  const url = `${baseUrl}${doc.path}`;
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: doc.seoTitle,
        description: doc.seoDescription,
        dateModified: '2026-10-22',
        isPartOf: { '@id': `${baseUrl}/#website` },
        publisher: { '@id': `${baseUrl}/#organization` }
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${baseUrl}/` },
          { '@type': 'ListItem', position: 2, name: doc.title, item: url }
        ]
      }
    ]
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(doc.seoTitle)}</title>
  <meta name="description" content="${esc(doc.seoDescription)}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="KONSTRUCTZ">
  <meta property="og:title" content="${esc(doc.seoTitle)}">
  <meta property="og:description" content="${esc(doc.seoDescription)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${ogImage}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(doc.seoTitle)}">
  <meta name="twitter:description" content="${esc(doc.seoDescription)}">
  <meta name="twitter:image" content="${ogImage}">
  <link rel="icon" type="image/png" href="/favicon.png">
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
  <style>
    body{margin:0;background:#11150f;color:#f7f7f2;font-family:Arial,sans-serif}
    main{max-width:860px;margin:auto;padding:40px 24px 80px}
    a{color:#b8d49a}
    h1{font-size:clamp(32px,5vw,52px);margin-bottom:12px}
    h2{margin-top:34px;font-size:22px}
    p,li{font-size:17px;line-height:1.7;color:#d4d8cf}
  </style>
</head>
<body>
  <div id="root"></div>
  <noscript>
    <main>
      <a href="/">KONSTRUCTZ</a>
      <h1>${esc(doc.title)}</h1>
      <p>Last updated: ${esc(LEGAL_LAST_UPDATED)}</p>
      <p>${esc(doc.intro)}</p>
${doc.sections.map(renderSection).join('\n')}
      <p><a href="/terms-of-service/">Terms of Service</a> | <a href="/privacy-policy/">Privacy Policy</a></p>
    </main>
  </noscript>
</body>
</html>
`;
};

for (const doc of LEGAL_DOCUMENT_LIST) {
  const dir = path.resolve('public', doc.path.replace(/^\/|\/$/g, ''));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), buildPage(doc), 'utf8');
}

console.log(`Generated ${LEGAL_DOCUMENT_LIST.length} legal pages (${LEGAL_DOCUMENT_LIST.map(d => d.path).join(', ')}).`);
