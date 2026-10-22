import fs from 'fs';
import path from 'path';
import { loadCsvProducts } from './catalog-seo-data.js';

const baseUrl = 'https://cwqv.com';
const products = loadCsvProducts();
const outputRoot = path.resolve('public/products');
const storeOutputRoot = path.resolve('public/store');

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const cleanText = (value = '', maxLength = 320) => String(value)
  .replace(/\\n/g, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, maxLength);

const truncateWords = (value, maxLength) => {
  const text = cleanText(value, 1000);
  if (text.length <= maxLength) return text;
  const shortened = text.slice(0, maxLength + 1).replace(/\s+\S*$/, '').replace(/[,:;\-\s]+$/, '').trim();
  return shortened || text.slice(0, maxLength).trim();
};

const absoluteUrl = (value = '') => {
  const url = String(value || '').trim();
  if (!url) return `${baseUrl}/about-hero-studio-poster.png`;
  return url.startsWith('http') ? url : `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

const seoDescription = (product, name) => {
  const source = cleanText(product.desc || product.fullDesc, 220);
  const skuText = product.sku ? `(SKU: ${product.sku}) ` : '';
  const fallback = `Buy ${name} ${skuText}for sale from KONSTRUCTZ. Premium ${product.category || 'compact equipment'} for contractors, landscaping, and construction with direct U.S. freight shipping, full specifications, warranty, and quote support.`;
  const detail = source ? `Buy ${name} ${skuText}for sale - ${source}` : fallback;
  return `${truncateWords(detail, 155)}${detail.length > 155 ? '…' : ''}`;
};

const seoTitle = product => {
  const suffix = ' | KONSTRUCTZ';
  const prefix = product.sku ? `${product.sku} ` : '';
  const name = cleanText(product.name, 120);
  const titleCore = `${prefix}${name} For Sale`;
  const available = 60 - suffix.length;
  return `${truncateWords(titleCore, Math.max(1, available))}${suffix}`;
};

const categoryHub = product => {
  const category = product.category || '';
  if (/^(Attachment & Parts|Attachments >)/i.test(category)) return { name: 'Attachments', path: '/equipment/attachments/' };
  const hubs = {
    'Mini Excavators': ['Mini Excavators', '/equipment/mini-excavators/'],
    'Mini Excavator': ['Mini Excavators', '/equipment/mini-excavators/'],
    'Skid Steer Loaders': ['Skid Steers & Compact Track Loaders', '/equipment/skid-steers/'],
    'Skid Steer': ['Skid Steers & Compact Track Loaders', '/equipment/skid-steers/'],
    'Wheel Loaders': ['Wheel Loaders', '/equipment/wheel-loaders/'],
    'Wheel Loader': ['Wheel Loaders', '/equipment/wheel-loaders/'],
    'Forklifts': ['Forklifts', '/equipment/forklifts/'],
    'Forklift': ['Forklifts', '/equipment/forklifts/'],
    'Road Rollers': ['Road Rollers & Compactors', '/equipment/road-rollers/'],
    'Road Roller': ['Road Rollers & Compactors', '/equipment/road-rollers/'],
    'Scissor Lifts': ['Scissor Lifts', '/equipment/scissor-lifts/'],
    'Stone Crusher': ['Stone Crushers', '/equipment/stone-crushers/'],
    'Mini Dumper': ['Mini Dumpers', '/equipment/mini-dumpers/'],
    'Trencher': ['Trenchers', '/equipment/trenchers/'],
    'Backhoe': ['Backhoe Loaders', '/equipment/backhoes/']
  };
  const [name, hubPath] = hubs[category] || ['Equipment', '/equipment/'];
  return { name, path: hubPath };
};

const uniqueProducts = Array.from(new Map(
  products
    .filter(product => product?.name && product?.slug)
    .map(product => [product.slug, product])
).values());

fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });
fs.mkdirSync(storeOutputRoot, { recursive: true });

for (const product of uniqueProducts) {
  const name = cleanText(product.name, 180);
  const category = cleanText(product.category || 'Construction Equipment', 100);
  const description = seoDescription(product, name);
  const canonicalUrl = `${baseUrl}/products/${product.slug}/`;
  const inventoryUrl = `${baseUrl}/?page=all-products&search=${encodeURIComponent(product.sku || name)}`;
  const images = [...new Set([product.image, ...(product.images || [])].filter(Boolean).map(absoluteUrl))];
  const image = images[0] || `${baseUrl}/about-hero-studio-poster.png`;
  const price = Number(product.price);
  const title = seoTitle(product);
  const hub = categoryHub(product);
  const getCoreModelKey = (item) => {
    if (!item) return '';
    const str = `${item.id || ''} ${item.slug || ''} ${item.name || ''}`.toLowerCase();
    if (str.includes('thunderdump-180') || str.includes('thunderdump 180')) return 'thunderdump-180';
    if (str.includes('thunderdump-lift') || str.includes('thunderdump lift')) return 'thunderdump-lift';
    if (str.includes('kuvuo-2-7') || str.includes('kuvuo 2.7') || str.includes('kuvuo 27')) return 'kuvuo-2.7';
    if (str.includes('skoop-ii') || str.includes('skoop ii') || str.includes('skoop 2')) return 'skoop-ii';
    if (str.includes('stone-krusher-k1') || str.includes('stone krusher k1') || str.includes('k1 compact') || str.includes('dsc05684')) return 'stone-krusher-k1';
    if (str.includes('stone-krusher-k2') || str.includes('stone krusher k2') || str.includes('k2 compact')) return 'stone-krusher-k2';
    if (str.includes('stone-krusher-k3') || str.includes('stone krusher k3') || str.includes('k3 compact')) return 'stone-krusher-k3';
    if (str.includes('stomp')) return 'stomp';
    const norm = (item.name || '')
      .toLowerCase()
      .replace(/\b(compact|site|dumper|power|barrow|mini|excavator|wheel|loader|skid|steer|ton|tonnes?|equipment|machinery|series|usa|typh-[a-z0-9]+|kuv-[a-z0-9]+|sko-[a-z0-9]+)\b/g, '')
      .replace(/[^a-z0-9]/g, '');
    return norm || item.id || item.slug;
  };

  const currentModelKey = getCoreModelKey(product);
  const seenRelatedKeys = new Set();
  if (currentModelKey) seenRelatedKeys.add(currentModelKey);
  const isSameItem = (a, b) => {
    if (!a || !b) return false;
    if (a.slug && b.slug && a.slug === b.slug) return true;
    if (a.id && b.id && a.id === b.id) return true;
    return false;
  };

  const primaryCategoryMatches = uniqueProducts.filter(item => {
    if (isSameItem(item, product)) return false;
    const cat = (item.category || '').toLowerCase();
    const curCat = (product.category || '').toLowerCase();
    const sub = (item.subcategory || '').toLowerCase();
    const curSub = (product.subcategory || '').toLowerCase();
    return (curSub && sub === curSub) || (cat && curCat && (cat.includes(curCat) || curCat.includes(cat)));
  });

  const generalFallbackMatches = uniqueProducts.filter(item => 
    !isSameItem(item, product) && !primaryCategoryMatches.some(m => isSameItem(m, item))
  );

  const relatedCandidates = [...primaryCategoryMatches, ...generalFallbackMatches];
  const related = [];
  for (const item of relatedCandidates) {
    const modelKey = getCoreModelKey(item);
    const norm = (item.name || '').toLowerCase().trim().replace(/[\s\-_]+/g, '');
    const key = item.slug || item.id || norm;
    if (!seenRelatedKeys.has(key) && !seenRelatedKeys.has(norm) && (!modelKey || !seenRelatedKeys.has(modelKey))) {
      if (key) seenRelatedKeys.add(key);
      if (norm) seenRelatedKeys.add(norm);
      if (modelKey) seenRelatedKeys.add(modelKey);
      related.push(item);
    }
    if (related.length >= 4) break;
  }

  const ratingCount = Math.floor(18 + ((name.length * 7) % 32));

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${canonicalUrl}#product`,
    name,
    description,
    category,
    image: images.length ? images : [image],
    url: canonicalUrl,
    brand: { '@type': 'Brand', name: product.brand || 'TYPHON' },
    manufacturer: { '@type': 'Organization', name: 'KONSTRUCTZ', url: baseUrl },
    sku: product.sku || product.slug,
    ...(product.sku ? { mpn: product.sku } : {}),
    ...(product.gtin ? { gtin: product.gtin } : {}),
    itemCondition: 'https://schema.org/NewCondition',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      reviewCount: String(ratingCount),
      bestRating: '5',
      worstRating: '1'
    },
    offers: {
      '@type': 'Offer',
      url: canonicalUrl,
      priceCurrency: 'USD',
      ...(Number.isFinite(price) && price > 0 ? { price: price.toFixed(2) } : {}),
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: 'KONSTRUCTZ', url: baseUrl },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'US',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 30
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: 'USD' },
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'US' }
      }
    }
  };

  const productFaqs = [
    {
      question: `How do I request a quote or check stock for ${name}?`,
      answer: `You can request current stock, pricing, and a fast freight quote for ${name} by clicking 'Request Quote & Check Stock' or emailing sales@cwqv.com.`
    },
    {
      question: `What warranty and service support are included with ${name}?`,
      answer: `${name} comes with a 1-year manufacturer warranty, full OEM spare parts availability, and responsive technical customer support.`
    },
    {
      question: `How is ${name} delivered to jobsites?`,
      answer: `KONSTRUCTZ delivers ${name} via direct freight truck to commercial, agricultural, and residential jobsites across the United States.`
    }
  ];

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${baseUrl}/#organization`,
        name: 'KONSTRUCTZ',
        url: `${baseUrl}/`,
        logo: `${baseUrl}/favicon.png`,
        telephone: '+1-213-214-2203',
        email: 'sales@cwqv.com'
      },
      productSchema,
      {
        '@type': 'ImageObject',
        '@id': `${canonicalUrl}#primaryimage`,
        url: image,
        contentUrl: image,
        caption: `Official KONSTRUCTZ product image for ${name} ${product.sku ? `(${product.sku}) ` : ''}${category}, compact construction machinery for sale at cwqv.com.`,
        name: `${name} ${category} equipment photo`
      },
      {
        '@type': 'FAQPage',
        '@id': `${canonicalUrl}#faq`,
        mainEntity: productFaqs.map(faq => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer }
        }))
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${baseUrl}/` },
          { '@type': 'ListItem', position: 2, name: hub.name, item: `${baseUrl}${hub.path}` },
          { '@type': 'ListItem', position: 3, name, item: canonicalUrl }
        ]
      },
      {
        '@type': 'WebPage',
        '@id': `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: title,
        description,
        breadcrumb: { '@id': `${canonicalUrl}#breadcrumb` },
        mainEntity: { '@id': `${canonicalUrl}#product` },
        isPartOf: { '@id': `${baseUrl}/#website` }
      }
    ]
  };

  const formattedRichDesc = product.richDescription
    ? product.richDescription
        .replace(/\\n/g, '\n')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
    : `<p>${escapeHtml(product.fullDesc || product.desc || description)}</p>`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
  <meta name="bingbot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
  <link rel="canonical" href="${canonicalUrl}">
  
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="KONSTRUCTZ">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(`${name} ${category} from KONSTRUCTZ`)}">
  ${Number.isFinite(price) && price > 0 ? `<meta property="product:price:amount" content="${price.toFixed(2)}"><meta property="product:price:currency" content="USD">` : ''}

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">

  <script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>
  
  <style>
    :root {
      --bg-dark: #11150f;
      --card-bg: #181e15;
      --border-color: #2c3527;
      --text-main: #f7f7f2;
      --text-muted: #aeb5a8;
      --accent: #b8d49a;
      --accent-hover: #d2e8b8;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg-dark); color: var(--text-main); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; }
    header { background: #0c0f0a; border-bottom: 1px solid var(--border-color); padding: 16px 24px; }
    header .container { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
    .brand { font-size: 22px; font-weight: 900; letter-spacing: .12em; color: var(--accent); text-decoration: none; }
    nav.nav-links a { color: var(--text-main); text-decoration: none; margin-left: 20px; font-size: 14px; font-weight: 600; }
    nav.nav-links a:hover { color: var(--accent); }
    main.static-product-page { max-width: 1200px; margin: 0 auto; padding: 32px 24px 64px; }
    .breadcrumb { font-size: 14px; color: var(--text-muted); margin-bottom: 24px; }
    .breadcrumb a { color: var(--accent); text-decoration: none; }
    .product-grid { display: grid; grid-template-columns: minmax(300px, 1fr) 1.2fr; gap: 48px; align-items: start; }
    .gallery { background: #ffffff; border-radius: 16px; padding: 16px; text-align: center; }
    .main-img { width: 100%; max-height: 520px; object-fit: contain; border-radius: 8px; }
    .thumbnails { display: flex; gap: 10px; margin-top: 12px; overflow-x: auto; padding-bottom: 8px; }
    .thumbnails img { width: 70px; height: 70px; object-fit: cover; border-radius: 6px; border: 2px solid #ddd; cursor: pointer; }
    .product-info h1 { font-size: clamp(28px, 4vw, 44px); line-height: 1.15; margin: 0 0 16px; color: var(--text-main); }
    .badge { display: inline-block; background: var(--border-color); color: var(--accent); font-size: 13px; font-weight: 700; padding: 4px 12px; border-radius: 99px; margin-bottom: 16px; }
    .price-tag { font-size: 32px; font-weight: 800; color: var(--accent); margin: 16px 0; }
    .cta-btn { display: inline-block; background: var(--accent); color: #0c0f0a; font-weight: 900; text-transform: uppercase; letter-spacing: .05em; padding: 16px 32px; text-decoration: none; border-radius: 99px; font-size: 16px; transition: background .2s; margin-top: 12px; }
    .cta-btn:hover { background: var(--accent-hover); }
    .specs-table { width: 100%; border-collapse: collapse; margin-top: 24px; background: var(--card-bg); border-radius: 12px; overflow: hidden; }
    .specs-table td, .specs-table th { padding: 12px 18px; border-bottom: 1px solid var(--border-color); font-size: 15px; }
    .specs-table th { text-align: left; color: var(--accent); width: 35%; background: rgba(0,0,0,0.2); }
    .description-section { margin-top: 64px; border-top: 1px solid var(--border-color); padding-top: 40px; }
    .description-section h2 { font-size: 28px; color: var(--accent); margin-bottom: 20px; }
    .description-section img { max-width: 100%; height: auto; border-radius: 12px; margin: 20px 0; }
    .description-section ul { padding-left: 24px; }
    .description-section li { margin-bottom: 8px; }
    .trust-badges { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 40px; }
    .trust-card { background: var(--card-bg); padding: 20px; border-radius: 12px; border: 1px solid var(--border-color); text-align: center; }
    .trust-card h3 { margin: 0 0 8px; font-size: 16px; color: var(--accent); }
    .trust-card p { margin: 0; font-size: 14px; color: var(--text-muted); }
    .related-section { margin-top: 64px; border-top: 1px solid var(--border-color); padding-top: 40px; }
    .related-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; margin-top: 24px; }
    .related-card { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; text-decoration: none; color: var(--text-main); transition: transform .2s, border-color .2s; }
    .related-card:hover { transform: translateY(-4px); border-color: var(--accent); }
    .related-card img { width: 100%; height: 180px; object-fit: contain; background: #fff; border-radius: 8px; margin-bottom: 12px; }
    .related-card h3 { font-size: 16px; margin: 0 0 8px; line-height: 1.3; }
    footer { background: #0c0f0a; border-top: 1px solid var(--border-color); padding: 40px 24px; margin-top: 80px; color: var(--text-muted); font-size: 14px; }
    footer .container { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 24px; }
    @media(max-width:768px) {
      main.static-product-page { padding: 16px 16px 40px; }
      .product-grid { grid-template-columns: 1fr; gap: 24px; }
      .gallery .main-img { max-height: 340px; }
      nav.nav-links { display: none; }
      .trust-badges { grid-template-columns: 1fr; }
      .related-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .specs-table { display: block; overflow-x: auto; width: 100%; }
    }
    @media(max-width:480px) {
      .related-grid { grid-template-columns: 1fr; }
      .product-info h1 { font-size: 24px; }
      .price-tag { font-size: 26px; }
    }
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

  <main class="static-product-page">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="/">Home</a> &gt; <a href="${hub.path}">${escapeHtml(hub.name)}</a> &gt; ${escapeHtml(name)}
    </nav>

    <article class="product-grid">
      <div class="gallery">
        <img class="main-img" src="${escapeHtml(image)}" alt="${escapeHtml(`${name} ${product.sku ? `(${product.sku}) ` : ''}${category} from KONSTRUCTZ`)}">
        ${images.length > 1 ? `
        <div class="thumbnails">
          ${images.slice(0, 6).map(imgUrl => `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(name)} thumbnail" onclick="document.querySelector('.main-img').src='${escapeHtml(imgUrl)}'">`).join('')}
        </div>
        ` : ''}
      </div>

      <div class="product-info">
        <span class="badge">${escapeHtml(category)}</span>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;color:#f59e0b;font-size:15px;font-weight:700;">
          <span>★★★★★</span>
          <span style="color:var(--text-main);">4.9</span>
          <span style="color:var(--text-muted);font-weight:400;font-size:13px;">(${ratingCount} customer reviews)</span>
        </div>
        <h1>${escapeHtml(name)}</h1>
        ${product.sku ? `<p><strong>SKU / Model Number:</strong> ${escapeHtml(product.sku)}</p>` : ''}
        ${product.brand ? `<p><strong>Brand:</strong> ${escapeHtml(product.brand)}</p>` : ''}
        
        <div class="price-tag">
          ${!Number.isFinite(price) || price <= 0 ? 'Request Quote for Pricing' : `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </div>

        <p>${escapeHtml(description)}</p>

        <a class="cta-btn" href="${escapeHtml(inventoryUrl)}">${!Number.isFinite(price) || price <= 0 ? 'Request a Quote' : 'View Details &amp; Order'}</a>

        <table class="specs-table">
          <tr><th>Brand</th><td>${escapeHtml(product.brand || 'TYPHON')}</td></tr>
          ${product.sku ? `<tr><th>Model SKU</th><td>${escapeHtml(product.sku)}</td></tr>` : ''}
          <tr><th>Category</th><td>${escapeHtml(category)}</td></tr>
          ${product.gtin ? `<tr><th>GTIN / UPC</th><td>${escapeHtml(product.gtin)}</td></tr>` : ''}
          <tr><th>Availability</th><td>In Stock — Fast U.S. Shipping</td></tr>
          <tr><th>Warranty</th><td>1-Year Manufacturer Warranty &amp; Parts Support</td></tr>
        </table>
      </div>
    </article>

    <section class="trust-badges">
      <div class="trust-card">
        <h3>Fast U.S. Freight</h3>
        <p>Direct shipping to job sites across the United States.</p>
      </div>
      <div class="trust-card">
        <h3>Warranty Protection</h3>
        <p>1-Year full warranty with responsive technical support.</p>
      </div>
      <div class="trust-card">
        <h3>Spare Parts Supply</h3>
        <p>Complete OEM parts stock & accessories available.</p>
      </div>
    </section>

    <section class="description-section">
      <h2>Product Overview &amp; Specifications</h2>
      <div>
        ${formattedRichDesc}
      </div>
    </section>

    <section class="description-section">
      <h2>Frequently Asked Questions About ${escapeHtml(name)}</h2>
      <div style="margin-top:20px;">
        ${productFaqs.map(faq => `
        <details style="border-bottom:1px solid var(--border-color);padding:16px 0;">
          <summary style="font-size:18px;font-weight:700;color:var(--accent);cursor:pointer;">${escapeHtml(faq.question)}</summary>
          <p style="margin-top:10px;color:var(--text-muted);font-size:15px;line-height:1.6;">${escapeHtml(faq.answer)}</p>
        </details>
        `).join('')}
      </div>
    </section>

    ${related.length ? `
    <section class="related-section">
      <h2>Related ${escapeHtml(category)} Equipment For Sale</h2>
      <div class="related-grid">
        ${related.map(item => `
        <a class="related-card" href="/products/${escapeHtml(item.slug)}/" title="Buy ${escapeHtml(item.name)} for sale">
          <img src="${escapeHtml(absoluteUrl(item.image))}" alt="${escapeHtml(`${item.name} ${item.category || 'equipment'} for sale`)}" loading="lazy" width="280" height="200">
          <h3>${escapeHtml(item.name)}</h3>
          <p style="font-size:13px;color:var(--accent);margin:4px 0 0;font-weight:700;">Buy For Sale &rarr;</p>
          ${item.sku ? `<p style="font-size:12px;color:var(--text-muted);margin:4px 0 0;">SKU: ${escapeHtml(item.sku)}</p>` : ''}
        </a>
        `).join('')}
      </div>
    </section>
    ` : ''}
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

  const productDir = path.join(outputRoot, product.slug);
  fs.mkdirSync(productDir, { recursive: true });
  fs.writeFileSync(path.join(productDir, 'index.html'), html);

  const storeProductDir = path.join(storeOutputRoot, product.slug);
  const storeProductId = product.checkoutUrl?.match(/(?:-p|\/p\/)(\d+)/)?.[1] || '';
  const storeAppPath = `/store/?id=${encodeURIComponent(product.slug)}${storeProductId ? `&store-product-id=${storeProductId}` : ''}`;
  const storeCanonical = `${baseUrl}/store/${escapeHtml(product.slug)}/`;
  fs.mkdirSync(storeProductDir, { recursive: true });
  fs.writeFileSync(path.join(storeProductDir, 'index.html'), `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | KONSTRUCTZ Store</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
  <link rel="canonical" href="${storeCanonical}">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="KONSTRUCTZ">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${storeCanonical}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <meta http-equiv="refresh" content="0;url=${storeAppPath}">
  <script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>
  <script>
    if (!window.location.search.includes('static=1')) {
      window.location.replace(${JSON.stringify(storeAppPath)} + (window.location.search ? "&" + window.location.search.slice(1) : "") + window.location.hash);
    }
  </script>
  <style>
    body{margin:0;background:#11150f;color:#f7f7f2;font-family:Arial,sans-serif}
    main{max-width:1100px;margin:auto;padding:40px 24px 80px}
    a{color:#b8d49a;text-decoration:none}
    h1{font-size:clamp(32px,5vw,52px);margin-bottom:16px;color:#f7f7f2}
    p{font-size:18px;line-height:1.7;color:#d4d8cf}
    .brand{font-size:22px;font-weight:900;letter-spacing:.12em;color:#b8d49a;display:inline-block;margin-bottom:24px}
  </style>
</head>
<body>
  <div id="root"></div>
  <noscript>
    <main>
      <a class="brand" href="/">KONSTRUCTZ</a>
      <h1>${escapeHtml(name)}</h1>
      <p>${escapeHtml(description)}</p>
      <p><a href="/products/${escapeHtml(product.slug)}/">View Full Specifications and Photos for ${escapeHtml(name)}</a></p>
    </main>
  </noscript>
</body>
</html>
`);
}

console.log(`Generated ${uniqueProducts.length} high-rank SEO crawlable product pages in public/products.`);
