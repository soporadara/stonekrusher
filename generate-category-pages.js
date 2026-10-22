import fs from 'fs';
import path from 'path';
import { loadCsvProducts } from './catalog-seo-data.js';

const baseUrl = 'https://stonekrusher.com';
const outputRoot = path.resolve('public/equipment');

const profiles = [
  {
    slug: 'mini-excavators', label: 'Mini Excavators', match: value => /Mini Excavator/i.test(value),
    title: 'Mini Excavators For Sale | Compact Excavators | KONSTRUCTZ',
    description: 'Compare mini excavators for sale by operating weight, engine, digging needs, attachments, and price. Browse compact excavators with U.S. quote and delivery support.',
    intro: 'Compare compact excavators for trenching, drainage, landscaping, foundations, utility work, farms, and tight-access jobs. Review individual models and contact KONSTRUCTZ to confirm current price, inventory, delivery, and attachment fit.',
    questions: [
      ['What size mini excavator should I buy?', 'Choose by access width, digging depth, lift needs, ground conditions, transport limits, and the attachments your work requires.'],
      ['Can I request current mini excavator pricing?', 'Yes. Open a model page and contact KONSTRUCTZ for current inventory, pricing, delivery, and quote support.']
    ]
  },
  {
    slug: 'skid-steers', label: 'Skid Steers & Compact Track Loaders', match: value => /Skid Steer/i.test(value),
    title: 'Skid Steers For Sale | Compact Track Loaders | KONSTRUCTZ',
    description: 'Browse skid steers and compact track loaders for sale for grading, loading, clearing, landscaping, and attachment work. Compare models and request a quote.',
    intro: 'Browse skid steers and compact track loaders for grading, loading, clearing, property maintenance, landscaping, and attachment-driven work. Compare machine specifications before requesting current availability and delivery information.',
    questions: [
      ['What is a compact track loader best used for?', 'Compact track loaders are commonly used for grading, loading, clearing, landscaping, material handling, and hydraulic attachment work.'],
      ['How do I compare skid steer models?', 'Compare operating weight, rated capacity, dimensions, engine, auxiliary hydraulic requirements, terrain, and attachment compatibility.']
    ]
  },
  {
    slug: 'wheel-loaders', label: 'Wheel Loaders', match: value => /Wheel Loader/i.test(value),
    title: 'Compact Wheel Loaders For Sale | KONSTRUCTZ',
    description: 'Compare compact wheel loaders for sale for moving soil, gravel, mulch, pallets, and jobsite materials. View specifications and request current pricing.',
    intro: 'Find compact wheel loaders for material handling, farms, landscape yards, construction sites, property maintenance, and pallet work. Compare models by capacity, dimensions, engine, bucket work, and attachment needs.',
    questions: [
      ['Why choose a compact wheel loader?', 'A compact wheel loader combines maneuverability, material capacity, visibility, and attachment versatility for space-limited jobsites.'],
      ['Can KONSTRUCTZ help with loader selection?', 'Yes. Share the material, daily volume, site access, lift needs, attachments, and delivery location for model guidance.']
    ]
  },
  {
    slug: 'forklifts', label: 'Forklifts', match: value => /Forklift/i.test(value),
    title: 'Forklifts For Sale | Electric Lift Trucks | KONSTRUCTZ',
    description: 'Browse forklifts and electric lift trucks for sale for warehouses, yards, farms, and material handling. Compare capacity and request current pricing.',
    intro: 'Compare forklifts and electric lift trucks for warehouse, yard, farm, pallet, and material-handling work. Confirm rated capacity, lift height, mast, battery or engine, turning space, and surface conditions before purchase.',
    questions: [
      ['What should I compare when buying a forklift?', 'Compare rated load capacity, lift height, mast configuration, power source, aisle space, tire type, operating environment, and charging needs.'],
      ['Are current prices shown on every forklift?', 'Product pages show available catalog information; contact KONSTRUCTZ to verify current price, stock, freight, and delivery.']
    ]
  },
  {
    slug: 'road-rollers', label: 'Road Rollers & Compactors', match: value => /Road Roller/i.test(value),
    title: 'Road Rollers For Sale | Vibratory Compactors | KONSTRUCTZ',
    description: 'Shop compact road rollers and vibratory compactors for asphalt, driveways, trenches, and soil compaction. Compare equipment and request a quote.',
    intro: 'Browse road rollers and vibratory compactors for asphalt repair, driveways, paths, trenches, parking areas, farm roads, and soil preparation. Match drum width, operating weight, vibration, terrain, and job type.',
    questions: [
      ['What jobs need a compact road roller?', 'Compact rollers are used for asphalt, driveway, pathway, trench, parking-area, soil, and small jobsite compaction.'],
      ['How should I choose a roller?', 'Consider material type, required compaction, drum width, operating weight, vibration, grade, access, and transport.']
    ]
  },
  {
    slug: 'scissor-lifts', label: 'Scissor Lifts', match: value => /Scissor Lift/i.test(value),
    title: 'Scissor Lifts For Sale | Electric Work Platforms | KONSTRUCTZ',
    description: 'Compare scissor lifts and electric work platforms for sale by platform height, capacity, power, and indoor or outdoor use. Request current pricing.',
    intro: 'Compare scissor lifts and elevated work platforms for maintenance, construction, warehouse, and installation work. Review platform height, working height, load capacity, dimensions, surface, power source, and access requirements.',
    questions: [
      ['What specifications matter for a scissor lift?', 'Confirm working height, platform height, load capacity, dimensions, extension deck, power source, surface rating, and indoor or outdoor use.'],
      ['Where can I get current scissor lift availability?', 'Contact KONSTRUCTZ with the required working height and delivery location for current inventory and quote information.']
    ]
  },
  {
    slug: 'attachments', label: 'Excavator & Skid Steer Attachments', match: value => /^(Attachment & Parts|Attachments >)/.test(value),
    title: 'Mini Excavator & Skid Steer Attachments | KONSTRUCTZ',
    description: 'Shop mini excavator and skid steer attachments, including buckets, augers, hammers, grapples, rakes, mowers, trenchers, and grading tools.',
    intro: 'Find attachments for digging, trenching, drilling, breaking, grading, clearing, mowing, handling, and cleanup. Always verify machine weight class, coupler dimensions, pin size, hydraulic flow, pressure, and model compatibility before ordering.',
    questions: [
      ['How do I know whether an attachment fits?', 'Verify the host machine model, weight class, pin and coupler dimensions, mounting interface, hydraulic flow, pressure, and hose connections.'],
      ['Which attachment is best for my project?', 'Choose by the material, required depth or width, hydraulic requirements, ground conditions, production target, and host-machine limits.']
    ]
  },
  {
    slug: 'stone-crushers', label: 'Stone Crushers', match: value => value === 'Stone Crusher' || /stone crusher/i.test(value),
    title: 'Stone Crushers For Sale | Compact Rock Crushers | KONSTRUCTZ',
    description: 'Shop compact stone crushers and crushing equipment for rock processing, demolition cleanup, and contractor workflows. Compare equipment and request a quote.',
    intro: 'Browse compact stone crushers for jobsite material reduction, rock processing, concrete demolition recycling, and contractor workflows. Review equipment specifications before requesting current inventory and pricing.',
    questions: [
      ['What is a compact stone crusher used for?', 'Compact stone crushers reduce rocks, concrete, bricks, and masonry rubble on jobsites for reuse as base material or easy disposal.'],
      ['Can I request current stone crusher pricing?', 'Yes. Open a product page and contact KONSTRUCTZ for current inventory, pricing, delivery, and quote support.']
    ]
  },
  {
    slug: 'mini-dumpers', label: 'Mini Dumpers', match: value => value === 'Mini Dumper' || /dumper/i.test(value),
    title: 'Mini Dumpers For Sale | Compact Site Dumpers | KONSTRUCTZ',
    description: 'Browse mini dumpers and compact site dumpers for hauling soil, concrete, gravel, mulch, landscaping material, and jobsite debris.',
    intro: 'Shop mini dumpers and compact site dumpers for moving soil, concrete, gravel, mulch, landscaping supplies, and jobsite debris. Compare payload capacity, engine power, track drive, and dump mechanisms.',
    questions: [
      ['What are mini dumpers best used for?', 'Mini dumpers haul bulk materials across tight, soft, or hilly jobsites where full-size dump trucks cannot reach.'],
      ['How do I choose the right site dumper?', 'Consider payload weight, bucket volume, engine/battery type, track vs wheel drive, and site clearance dimensions.']
    ]
  },
  {
    slug: 'trenchers', label: 'Trenchers', match: value => value === 'Trencher' || /trencher/i.test(value),
    title: 'Trenchers For Sale | Compact Trenching Machinery | KONSTRUCTZ',
    description: 'Compare compact trenchers and trenching machinery for irrigation, drainage, utility lines, landscaping, and compact jobsite digging work.',
    intro: 'Browse trenchers and trenching machinery for utility lines, irrigation, pipe laying, drainage, landscaping, and farm digging. Review digging depth, chain width, engine power, and machine width before ordering.',
    questions: [
      ['Why use a dedicated trencher instead of an excavator?', 'A trencher cuts narrow, clean trenches quickly with minimal ground disturbance, making it ideal for utility lines and pipes.'],
      ['How do I select the right trencher model?', 'Match trench depth, chain width, soil hardness, engine specs, and site access width to your job requirements.']
    ]
  },
  {
    slug: 'backhoes', label: 'Backhoe Loaders', match: value => value === 'Backhoe' || /backhoe/i.test(value),
    title: 'Backhoe Loaders For Sale | Dig & Load Machinery | KONSTRUCTZ',
    description: 'Shop backhoe loaders and dig-and-load compact machines for trenching, loading, backfilling, utility work, landscaping, and all-around site duty.',
    intro: 'Compare backhoe loaders and multi-function dig-and-load compact machines. Get front-loader material handling combined with backhoe digging reach in a single compact footprint.',
    questions: [
      ['What are the advantages of a backhoe loader?', 'A backhoe loader combines front loading and rear excavation in one machine, saving transport costs and crew downtime.'],
      ['How can I check current stock and delivery?', 'Contact KONSTRUCTZ sales with your project specs and delivery zip code for current pricing and freight quotes.']
    ]
  }
];

const escapeHtml = (value = '') => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const absoluteUrl = value => !value ? `${baseUrl}/about-hero-studio-poster.png` : value.startsWith('http') ? value : `${baseUrl}${value.startsWith('/') ? '' : '/'}${value}`;

const products = loadCsvProducts();
fs.mkdirSync(outputRoot, { recursive: true });

for (const profile of profiles) {
  let matches = products.filter(product => profile.match(product.category));
  if (profile.slug === 'skid-steers') {
    matches.sort((a, b) => {
      const aIsV900 = /v900/i.test(a.name || '') || /v900/i.test(a.sku || '');
      const bIsV900 = /v900/i.test(b.name || '') || /v900/i.test(b.sku || '');
      if (aIsV900 && !bIsV900) return -1;
      if (!aIsV900 && bIsV900) return 1;
      return 0;
    });
  }
  const canonicalUrl = `${baseUrl}/equipment/${profile.slug}/`;
  const cards = matches.map(product => `<article class="card">
      <a href="/products/${escapeHtml(product.slug)}/"><img src="${escapeHtml(absoluteUrl(product.image))}" alt="${escapeHtml(`${product.name} ${product.category || ''} for sale from KONSTRUCTZ official image source stonekrusher.com`)}" title="${escapeHtml(`Buy ${product.name} for sale`)}" loading="lazy" width="480" height="360"></a>
      <div><p class="type">${escapeHtml(product.category)}</p><h2><a href="/products/${escapeHtml(product.slug)}/">${escapeHtml(product.name)}</a></h2>${product.sku ? `<p>Model / SKU: ${escapeHtml(product.sku)}</p>` : ''}<a class="link" href="/products/${escapeHtml(product.slug)}/">View specifications</a></div>
    </article>`).join('\n');
  const faq = profile.questions.map(([question, answer]) => `<details><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`).join('\n');
  const schema = {
    '@context': 'https://schema.org', '@graph': [
      { '@type': 'CollectionPage', '@id': `${canonicalUrl}#page`, url: canonicalUrl, name: profile.title, description: profile.description, isPartOf: { '@id': `${baseUrl}/#website` }, mainEntity: { '@id': `${canonicalUrl}#products` } },
      { '@type': 'ItemList', '@id': `${canonicalUrl}#products`, name: profile.label, numberOfItems: matches.length, itemListElement: matches.map((product, index) => ({ '@type': 'ListItem', position: index + 1, name: product.name, url: `${baseUrl}/products/${product.slug}/` })) },
      { '@type': 'FAQPage', '@id': `${canonicalUrl}#faq`, mainEntity: profile.questions.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })) },
      { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${baseUrl}/` }, { '@type': 'ListItem', position: 2, name: 'Equipment', item: `${baseUrl}/?page=all-products` }, { '@type': 'ListItem', position: 3, name: profile.label, item: canonicalUrl }] }
    ]
  };
  const otherLinks = profiles.filter(item => item.slug !== profile.slug).map(item => `<a href="/equipment/${item.slug}/">${escapeHtml(item.label)}</a>`).join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(profile.title)}</title><meta name="description" content="${escapeHtml(profile.description)}"><meta name="robots" content="index, follow, max-image-preview:large"><meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"><link rel="canonical" href="${canonicalUrl}"><meta property="og:type" content="website"><meta property="og:site_name" content="KONSTRUCTZ"><meta property="og:title" content="${escapeHtml(profile.title)}"><meta property="og:description" content="${escapeHtml(profile.description)}"><meta property="og:url" content="${canonicalUrl}"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script><style>
body{margin:0;background:#11150f;color:#f7f7f2;font-family:Arial,sans-serif}main{max-width:1180px;margin:auto;padding:30px 22px 70px}a{color:inherit}.brand{color:#b8d49a;font-weight:900;letter-spacing:.12em;text-decoration:none}.crumbs{margin:28px 0;color:#adb5a7}.hero{max-width:850px;margin:52px 0}h1{font-size:clamp(40px,7vw,78px);line-height:1;margin:0 0 24px}p{color:#d4d8cf;line-height:1.65}.hero p{font-size:19px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.card{background:#1b2118;border:1px solid #343c30;border-radius:14px;overflow:hidden}.card img{width:100%;height:240px;object-fit:contain;background:#fff}.card div{padding:18px}.card h2{font-size:19px;line-height:1.3}.card h2 a{text-decoration:none}.type{font-size:12px;text-transform:uppercase;letter-spacing:.1em}.link{color:#b8d49a;font-weight:700}.faq,.browse{margin-top:58px;max-width:900px}.faq details{border-top:1px solid #3a4236;padding:18px 0}.faq summary{font-size:18px;font-weight:700;cursor:pointer}.browse{display:flex;flex-wrap:wrap;gap:10px}.browse h2{width:100%}.browse a{border:1px solid #4b5546;border-radius:999px;padding:10px 14px;text-decoration:none}@media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.grid{grid-template-columns:1fr}}
  </style></head><body><div id="root"></div><noscript><main><a class="brand" href="/">KONSTRUCTZ</a><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/?page=all-products">Equipment</a> / ${escapeHtml(profile.label)}</nav><header class="hero"><h1>${escapeHtml(profile.label)} For Sale</h1><p>${escapeHtml(profile.intro)}</p><p><strong>${matches.length} products and models</strong> are listed in this category.</p></header><section class="grid" aria-label="${escapeHtml(profile.label)} inventory">${cards}</section><section class="faq"><h2>${escapeHtml(profile.label)} buying questions</h2>${faq}</section><nav class="browse" aria-label="Browse equipment categories"><h2>Browse more equipment</h2>${otherLinks}</nav></main></noscript></body></html>`;
  const directory = path.join(outputRoot, profile.slug);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'index.html'), html);
}

console.log(`Generated ${profiles.length} crawlable category pages in public/equipment.`);

