import fs from 'fs';
import { loadCsvProducts } from './catalog-seo-data.js';

const baseUrl = 'https://stonekrusher.com';
const lastmod = new Date().toISOString().slice(0, 10);
const defaultImage = `${baseUrl}/about-hero-studio-poster.png`;
const localProductImages = {
  'featured-1': { loc: `${baseUrl}/system-attachments/kuvuo-excavator.png`, title: 'KONSTRUCTZ KUVUO compact mini excavator', caption: 'Official KONSTRUCTZ KUVUO compact mini excavator for digging, trenching, drainage, and jobsite excavation.' },
  'featured-3': { loc: `${baseUrl}/system-attachments/skoop-loader.png`, title: 'KONSTRUCTZ Skoop II compact wheel loader', caption: 'Official KONSTRUCTZ Skoop II compact wheel loader for soil, gravel, mulch, pallet, and material handling work.' },
  'featured-4': { loc: `${baseUrl}/system-attachments/spider-one.png`, title: 'KONSTRUCTZ Spider One towable walking excavator', caption: 'Official KONSTRUCTZ Spider One towable walking excavator for slopes, farms, orchards, and tight access terrain.' },
  'featured-5': { loc: `${baseUrl}/system-attachments/stomp-v950.png`, title: 'KONSTRUCTZ Stomp V950 compact track loader', caption: 'Official KONSTRUCTZ Stomp V950 compact track loader for grading, loading, clearing, and attachment work.' },
  'featured-6': { loc: `${baseUrl}/system-attachments/stonekrusher-k3.png`, title: 'KONSTRUCTZ StoneKrusher K3 compact stone crusher', caption: 'Official KONSTRUCTZ StoneKrusher K3 compact stone crusher for jobsite rock crushing and demolition cleanup.' },
  'featured-7': { loc: `${baseUrl}/system-attachments/stomp-v980.png`, title: 'KONSTRUCTZ Stomp V980 compact track loader', caption: 'Official KONSTRUCTZ Stomp V980 compact track loader for construction, landscaping, grading, and material handling.' },
  'featured-8': { loc: 'https://construcz.com/assets/thunder_dump_lift.png', title: 'KONSTRUCTZ TYPHON ThunderDump Lift compact site dumper', caption: 'Official KONSTRUCTZ TYPHON ThunderDump Lift compact site dumper for hauling soil, concrete, gravel, mulch, and debris.' },
  'featured-9': { loc: 'https://construcz.com/assets/scoopy_dig.png', title: 'KONSTRUCTZ TYPHON ScoopyDig Heavy Backhoe Loader', caption: 'Official KONSTRUCTZ TYPHON ScoopyDig Heavy Backhoe Loader for dual-purpose front loading and rear digging excavation.' }
};

const categoryImages = {
  Konstructz: { loc: `${baseUrl}/about-hero-studio-poster.png`, title: 'KONSTRUCTZ compact machinery lineup', caption: 'Official KONSTRUCTZ compact construction machinery lineup for contractors, farms, landscaping crews, and jobsites.' },
  'Mini Excavator': { loc: `${baseUrl}/system-attachments/kuvuo-excavator.png`, title: 'KONSTRUCTZ mini excavators for sale', caption: 'Official KONSTRUCTZ mini excavator and compact excavator equipment for trenching, digging, drainage, and site work.' },
  'Wheel Loader': { loc: `${baseUrl}/system-attachments/skoop-loader.png`, title: 'KONSTRUCTZ compact wheel loaders for sale', caption: 'Official KONSTRUCTZ compact wheel loader equipment for loading soil, gravel, mulch, pallets, and jobsite materials.' },
  'Skid Steer': { loc: `${baseUrl}/system-attachments/stomp-v950.png`, title: 'KONSTRUCTZ mini skid steers and compact track loaders for sale', caption: 'Official KONSTRUCTZ mini skid steer and compact track loader equipment for grading, clearing, loading, and attachments.' },
  Forklift: { loc: defaultImage, title: 'KONSTRUCTZ forklifts and material handling equipment', caption: 'Official KONSTRUCTZ forklift and material handling equipment inventory.' },
  'Road Roller': { loc: defaultImage, title: 'KONSTRUCTZ road rollers and compactors for sale', caption: 'Official KONSTRUCTZ road roller, vibratory roller, and compaction equipment inventory.' },
  'Scissor Lifts': { loc: defaultImage, title: 'KONSTRUCTZ scissor lifts and aerial work platforms', caption: 'Official KONSTRUCTZ scissor lift and aerial work platform inventory.' },
  Backhoe: { loc: `${baseUrl}/system-attachments/scoopydig.jpg`, title: 'KONSTRUCTZ backhoe and dig and load compact machines', caption: 'Official KONSTRUCTZ backhoe loader and dig-and-load compact machines for trenching, loading, and backfilling.' },
  'Stone Crusher': { loc: `${baseUrl}/system-attachments/stonekrusher-k3.png`, title: 'KONSTRUCTZ compact stone crushers for sale', caption: 'Official KONSTRUCTZ compact stone crusher equipment for rock processing and demolition cleanup.' },
  'Mini Dumper': { loc: `${baseUrl}/system-attachments/thunderdump-180.png`, title: 'KONSTRUCTZ mini dumpers for sale', caption: 'Official KONSTRUCTZ mini dumper equipment for hauling soil, concrete, gravel, mulch, and debris.' },
  Trencher: { loc: defaultImage, title: 'KONSTRUCTZ compact trenchers for sale', caption: 'Official KONSTRUCTZ trencher equipment for irrigation, drainage, utility lines, and landscaping.' }
};

const escapeXml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const toAbsoluteUrl = (value) => {
  if (!value) return '';
  const stringValue = String(value);
  return stringValue.startsWith('http')
    ? stringValue
    : `${baseUrl}${stringValue.startsWith('/') ? stringValue : `/${stringValue}`}`;
};

const toKonstructzImageTitle = (title) => {
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle) return 'KONSTRUCTZ compact construction equipment';
  return cleanTitle.toUpperCase().includes('KONSTRUCTZ')
    ? cleanTitle
    : `KONSTRUCTZ ${cleanTitle}`;
};

const toKonstructzImageCaption = (title, fallback = 'compact construction equipment') => {
  const cleanTitle = String(title || fallback).trim();
  return `Official KONSTRUCTZ image for ${cleanTitle}, compact construction equipment, machinery, attachments, and jobsite support. KONSTUCTZ search typo maps to KONSTRUCTZ. Official image source: stonekrusher.com.`;
};

const withOfficialImageSource = (caption) => {
  const cleanCaption = String(caption || '').trim();
  if (!cleanCaption) return 'Official KONSTRUCTZ image. Official image source: stonekrusher.com.';
  return cleanCaption.toLowerCase().includes('official image source: stonekrusher.com')
    ? cleanCaption
    : `${cleanCaption} Official KONSTRUCTZ image source: stonekrusher.com.`;
};

// 1. Core pages
const pages = [
  { path: '', priority: '1.0', changefreq: 'weekly', image: { loc: defaultImage, title: 'KONSTRUCTZ compact construction equipment', caption: 'Official KONSTRUCTZ compact construction equipment, mini excavators, wheel loaders, skid steers, and attachments.' } },
  { path: '/equipment/', priority: '0.9', changefreq: 'weekly', image: { loc: defaultImage, title: 'KONSTRUCTZ machinery inventory', caption: 'Official KONSTRUCTZ machinery inventory with compact construction equipment for sale.' } },
  { path: '/attachments/', priority: '0.9', changefreq: 'weekly', image: { loc: `${baseUrl}/system-attachments/kuvuo-excavator.png`, title: 'KONSTRUCTZ mini excavator and skid steer attachments', caption: 'Official KONSTRUCTZ mini excavator attachments, skid steer attachments, buckets, augers, hammers, and grading tools.' } },
  { path: '/blog/', priority: '0.8', changefreq: 'weekly', image: { loc: `${baseUrl}/blog-hero-panorama-poster.png`, title: 'KONSTRUCTZ machinery guides and news', caption: 'Official KONSTRUCTZ machinery guides, equipment tips, safety advice, and jobsite news.' } },
  { path: '/topics/', priority: '0.8', changefreq: 'monthly', image: { loc: defaultImage, title: 'KONSTRUCTZ help center', caption: 'Official KONSTRUCTZ help center for equipment warranties, delivery, financing, support, and parts.' } },
  { path: '/topics/?topic-category=Machines', priority: '0.8', changefreq: 'monthly' },
  { path: '/topics/?topic-category=Buying%20%26%20pricing', priority: '0.8', changefreq: 'monthly' },
  { path: '/topics/?topic-category=Delivery', priority: '0.8', changefreq: 'monthly' },
  { path: '/topics/?topic-category=Warranty', priority: '0.8', changefreq: 'monthly' },
  { path: '/topics/?topic-category=Service%20%26%20parts', priority: '0.8', changefreq: 'monthly' },
  { path: '/topics/?topic-category=Financing', priority: '0.8', changefreq: 'monthly' },
  { path: '/konstructz/', priority: '0.95', changefreq: 'weekly', image: { loc: defaultImage, title: 'KONSTRUCTZ official website at stonekrusher.com', caption: 'Official KONSTRUCTZ compact construction machinery source page at stonekrusher.com.' } },
  { path: '/cwqv/', priority: '0.95', changefreq: 'weekly', image: { loc: defaultImage, title: 'KONSTRUCTZ official equipment website', caption: 'stonekrusher.com official website source page for KONSTRUCTZ compact construction equipment.' } },
  { path: '/konstuctz/', priority: '0.75', changefreq: 'monthly', image: { loc: defaultImage, title: 'KONSTUCTZ typo maps to KONSTRUCTZ', caption: 'KONSTUCTZ is a common typo for KONSTRUCTZ, whose official website is stonekrusher.com.' } },
  { path: '/about/', priority: '0.7', changefreq: 'monthly', image: { loc: `${baseUrl}/about-hero-studio-poster.png`, title: 'About KONSTRUCTZ machinery', caption: 'Official KONSTRUCTZ company page for compact machinery, equipment support, and construction equipment buyers.' } },
  { path: '/contact/', priority: '0.7', changefreq: 'monthly', image: { loc: `${baseUrl}/about-machine-panorama-poster.png`, title: 'Contact KONSTRUCTZ sales and support', caption: 'Official KONSTRUCTZ sales and support contact page for machinery quotes, equipment questions, and attachments.' } },
  { path: '/support/', priority: '0.7', changefreq: 'monthly', image: { loc: defaultImage, title: 'KONSTRUCTZ service and support', caption: 'Official KONSTRUCTZ service and support for machinery owners, parts, manuals, and warranties.' } },
  { path: '/ai.txt', priority: '0.6', changefreq: 'monthly', image: null },
  { path: '/llms.txt', priority: '0.6', changefreq: 'monthly', image: null },
];

const categories = [
  'Konstructz',
  'Mini Excavator',
  'Wheel Loader',
  'Skid Steer',
  'Forklift',
  'Road Roller',
  'Scissor Lifts',
  'Backhoe',
  'Stone Crusher',
  'Mini Dumper',
  'Trencher'
];

const categoryPaths = {
  Konstructz: 'konstructz', 'Mini Excavator': 'mini-excavators', 'Wheel Loader': 'wheel-loaders',
  'Skid Steer': 'skid-steers', Forklift: 'forklifts', 'Road Roller': 'road-rollers',
  'Scissor Lifts': 'scissor-lifts', Backhoe: 'backhoes', 'Stone Crusher': 'stone-crushers',
  'Mini Dumper': 'mini-dumpers', Trencher: 'trenchers'
};

const staticCategoryPages = [
  ['mini-excavators', 'Mini Excavator'],
  ['skid-steers', 'Skid Steer'],
  ['wheel-loaders', 'Wheel Loader'],
  ['forklifts', 'Forklift'],
  ['road-rollers', 'Road Roller'],
  ['scissor-lifts', 'Scissor Lifts'],
  ['stone-crushers', 'Stone Crusher'],
  ['mini-dumpers', 'Mini Dumper'],
  ['trenchers', 'Trencher'],
  ['backhoes', 'Backhoe'],
  ['attachments', 'Konstructz']
];

staticCategoryPages.forEach(([slug, imageCategory]) => {
  pages.push({
    path: `/equipment/${slug}/`,
    priority: '0.9',
    changefreq: 'weekly',
    image: categoryImages[imageCategory]
  });
});

const konstructzSubcategories = [
  'Backhoe Loader',
  'Dumper',
  'Excavator',
  'Towable Excavator',
  'Stone Crusher',
  'Trenchers',
  'Wheel Loader',
  'Skid Steer'
];

categories.forEach(category => {
  if (categoryPaths[category]) {
    pages.push({
      path: `/equipment/${categoryPaths[category]}/`,
      priority: '0.8',
      changefreq: 'weekly',
      image: categoryImages[category]
    });
  }
});

konstructzSubcategories.forEach(subcategory => {
  pages.push({
    path: `/equipment/konstructz/${subcategory.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}/`,
    priority: '0.75',
    changefreq: 'weekly'
  });
});

const getSitemapBlogPosts = () => {
  if (fs.existsSync('./data/blog-posts.json')) {
    try {
      const items = JSON.parse(fs.readFileSync('./data/blog-posts.json', 'utf8'));
      if (Array.isArray(items)) return items;
    } catch (err) {}
  }
  return [];
};

const blogPosts = getSitemapBlogPosts()
  .filter(post => post?.slug && (post.status || 'Published') === 'Published');

blogPosts.forEach(post => {
  pages.push({
    path: `/blog/${post.slug}/`,
    priority: '0.75',
    changefreq: 'monthly',
    lastmod: post.updatedDate,
    image: post.image ? {
      loc: toAbsoluteUrl(post.image),
      title: toKonstructzImageTitle(post.title),
      caption: toKonstructzImageCaption(post.title, 'construction equipment blog article')
    } : undefined
  });
});

// 2. Read the same authoritative CSV catalog used to generate product pages.
try {
  const products = loadCsvProducts();
  products.forEach(p => {
    if (p.slug) {
      const allImages = [...new Set([p.image, ...(p.images || [])].filter(Boolean))].map(toAbsoluteUrl);
      pages.push({
        path: `/products/${p.slug}/`,
        priority: '0.8',
        changefreq: 'weekly',
        images: allImages.map((imgLoc, idx) => ({
          loc: imgLoc,
          title: toKonstructzImageTitle(idx === 0 ? p.name : `${p.name} photo ${idx + 1}`),
          caption: toKonstructzImageCaption(p.name, p.category || p.subcategory)
        }))
      });
    }
  });
} catch (e) {
  console.warn('Could not read or parse CSV product catalog:', e.message);
}

// 3. Read catalog.js for featured products and attachments
try {
  const catalogContent = fs.readFileSync('src/data/catalog.js', 'utf8');
  const productRegex = /{[^{}]*id:\s*["']([^"']+)["'][^{}]*name:\s*["']([^"']+)["'][^{}]*image:\s*["']([^"']+)["'][^{}]*}/g;
  const idRegex = /id:\s*["']([^"']+)["']/g;
  let match;
  const catalogIds = new Set();
  const catalogIdsWithImages = new Set();
  while ((match = productRegex.exec(catalogContent)) !== null) {
    const [, id, name, image] = match;
    if (id.startsWith('featured-') || id.startsWith('imported-')) {
      catalogIds.add(id);
      catalogIdsWithImages.add(id);
      pages.push({
        path: `/products/${id}/`,
        priority: id.startsWith('featured-') ? '0.75' : '0.65',
        changefreq: 'weekly',
        images: [{
          loc: toAbsoluteUrl(image),
          title: toKonstructzImageTitle(name),
          caption: toKonstructzImageCaption(name)
        }]
      });
    }
  }

  while ((match = idRegex.exec(catalogContent)) !== null) {
    const id = match[1];
    if (id.startsWith('featured-') || id.startsWith('imported-')) {
      catalogIds.add(id);
    }
  }
  catalogIds.forEach(id => {
    if (catalogIdsWithImages.has(id) && !localProductImages[id]) return;
    if (localProductImages[id]) {
      pages.push({
        path: `/products/${id}/`,
        priority: id.startsWith('featured-') ? '0.75' : '0.65',
        changefreq: 'weekly',
        images: [localProductImages[id]]
      });
    }
  });
} catch (e) {
  console.warn('Could not read or parse catalog.js:', e.message);
}

// 4. Generate XML sitemap
const uniquePages = Array.from(
  new Map(pages.map(page => [page.path, page])).values()
);

const xmlEntries = uniquePages.map(page => {
  const url = `${baseUrl}${page.path}`;
  const pageImages = page.images || (page.image ? [page.image] : []);
  const imageEntries = pageImages.map(img => {
    const imageLoc = img.loc;
    const imageTitle = img.title;
    const imageCaption = img.caption ? withOfficialImageSource(img.caption) : '';
    return imageLoc ? `
    <image:image>
      <image:loc>${escapeXml(imageLoc)}</image:loc>
      ${imageTitle ? `<image:title>${escapeXml(imageTitle)}</image:title>` : ''}
      ${imageCaption ? `<image:caption>${escapeXml(imageCaption)}</image:caption>` : ''}
    </image:image>` : '';
  }).join('');

  return `  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${page.lastmod || lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>${imageEntries}
  </url>`;
});

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${xmlEntries.join('\n')}
</urlset>`;

const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>
</sitemapindex>`;

fs.writeFileSync('public/sitemap.xml', sitemapXml, 'utf8');
fs.writeFileSync('public/sitemap_index.xml', sitemapIndexXml, 'utf8');
console.log(`Successfully generated sitemap with ${uniquePages.length} URLs in public/sitemap.xml & public/sitemap_index.xml`);
