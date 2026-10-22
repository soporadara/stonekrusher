import fs from 'fs';

export const slugify = (value = '') => String(value)
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 180);

const parseCsv = source => {
  const rows = [];
  let row = [], value = '', quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i], next = source[i + 1];
    if (char === '"' && quoted && next === '"') { value += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(value); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(value); if (row.some(cell => cell.trim())) rows.push(row);
      row = []; value = '';
    } else value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  const [headers = [], ...data] = rows;
  return data.map(cells => Object.fromEntries(headers.map((header, i) => [header.replace(/^\uFEFF/, ''), cells[i] || ''])));
};

const plainText = (html = '') => String(html)
  .replace(/\\n/g, ' ').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export const getNormalizedCategory = (rawCat = '', name = '') => {
  const cat = (rawCat + ' ' + name).toLowerCase();
  if (cat.includes('attachment') || cat.includes('bucket') || cat.includes('auger') || cat.includes('hammer') || cat.includes('mower')) return 'Attachments';
  if (cat.includes('stone crusher') || cat.includes('rock crusher') || cat.includes('stonekrusher')) return 'Stone Crushers';
  if (cat.includes('dumper') || cat.includes('thunderdump')) return 'Mini Dumpers';
  if (cat.includes('trencher') || cat.includes('ripper')) return 'Trenchers';
  if (cat.includes('scoopydig') || cat.includes('backhoe')) return 'Backhoe Loaders';
  if (cat.includes('wheel loader') || cat.includes('skoop')) return 'Wheel Loaders';
  if (cat.includes('excavator') || cat.includes('kuvuo') || cat.includes('digger') || cat.includes('spider')) return 'Mini Excavators';
  if (cat.includes('skid steer') || cat.includes('track loader') || cat.includes('stomp')) return 'Skid Steer Loaders';
  if (cat.includes('forklift') || cat.includes('lift truck')) return 'Forklifts';
  if (cat.includes('road roller') || cat.includes('compactor')) return 'Road Rollers';
  if (cat.includes('scissor lift') || cat.includes('aerial')) return 'Scissor Lifts';
  return 'Construction Equipment';
};

const featuredProductsSeo = [
  { slug: "kuvuo-2-7-series-mini-excavator", name: "KUVUO 2.7 Series", category: "Mini Excavators", price: undefined, image: "http://americanminiexcavator.com/wp-content/uploads/2026/09/2.png", images: ["http://americanminiexcavator.com/wp-content/uploads/2026/09/2.png", "http://americanminiexcavator.com/wp-content/uploads/2026/09/4.png", "http://americanminiexcavator.com/wp-content/uploads/2026/09/10.png", "http://americanminiexcavator.com/wp-content/uploads/2026/09/9.png", "http://americanminiexcavator.com/wp-content/uploads/2026/09/8.png"], desc: "KUVUO 2.7 Series compact mini excavator.", brand: "TYPHON" },
  { slug: "typhon-groundripper-grx1-compact-track-trencher", name: "TYPHON GroundRipper GRX1 Compact Track Trencher", category: "Trenchers", price: undefined, image: "http://americanminiexcavator.com/wp-content/uploads/2026/09/GRX1II-scaled.webp", images: ["http://americanminiexcavator.com/wp-content/uploads/2026/09/GRX1II-scaled.webp"], desc: "TYPHON GroundRipper GRX1 Compact Track Trencher.", brand: "TYPHON" },
  { slug: "skoop-ii-wheel-loader-compact-wheel-loader", name: "Skoop II Wheel Loader", category: "Wheel Loaders", price: undefined, image: "https://wheelloadersusa.com/wp-content/uploads/2026/09/WheelloaderII.webp", images: ["https://wheelloadersusa.com/wp-content/uploads/2026/09/WheelloaderII.webp"], desc: "Skoop II compact wheel loader.", brand: "TYPHON" },
  { slug: "spider-one-towable-excavator-mini-excavator", name: "Spider One Towable Excavator", category: "Mini Excavators", price: undefined, image: "https://wheelloader.org/wp-content/uploads/2026/08/sprider-one.png", images: ["https://wheelloader.org/wp-content/uploads/2026/08/sprider-one.png"], desc: "Spider One towable compact excavator.", brand: "TYPHON" },
  { slug: "typhon-stomp-v950-mini-track-loader-1-5-ton-compact-track-loader", name: "Stomp V950 Track Loader", category: "Skid Steer Loaders", price: undefined, image: "https://asianmachinery.net/wp-content/uploads/2026/08/mini-skid-steer-track-loader-scaled.png", images: ["https://asianmachinery.net/wp-content/uploads/2026/08/mini-skid-steer-track-loader-scaled.png"], desc: "Stomp V950 mini track loader.", brand: "TYPHON" },
  { slug: "stone-krusher-k3-compact-stone-crusher", name: "Stone Krusher K3", category: "Stone Crushers", price: undefined, image: "https://mobilecranes.org/wp-content/uploads/2026/09/K3.png", images: ["https://mobilecranes.org/wp-content/uploads/2026/09/K3.png"], desc: "Stone Krusher K3 compact mobile stone crusher.", brand: "TYPHON" },
  { slug: "stomp-v980-compact-track-loader-0-98-ton", name: "Stomp V980 Compact Track Loader", category: "Skid Steer Loaders", price: undefined, image: "https://wheelloadersusa.com/wp-content/uploads/2026/09/skid-steers-v950.webp", images: ["https://wheelloadersusa.com/wp-content/uploads/2026/09/skid-steers-v950.webp"], desc: "Stomp V980 compact track loader.", brand: "TYPHON" },
  { slug: "typhon-thunderdump-lift-compact-dumper", name: "TYPHON ThunderDump Lift", category: "Mini Dumpers", price: undefined, image: "http://americanminiexcavator.com/wp-content/uploads/2026/08/TD013.png", images: ["http://americanminiexcavator.com/wp-content/uploads/2026/08/TD013.png"], desc: "TYPHON ThunderDump Lift compact dumper.", brand: "TYPHON" },
  { slug: "typhon-scoopydig-heavy-backhoe-loader-1-5-ton", name: "TYPHON ScoopyDig Heavy Backhoe Loader", category: "Backhoe Loaders", price: undefined, image: "https://wheelloadersusa.com/wp-content/uploads/2026/09/Scoopydig.webp", images: ["https://wheelloadersusa.com/wp-content/uploads/2026/09/Scoopydig.webp"], desc: "TYPHON ScoopyDig heavy backhoe loader.", brand: "TYPHON" },
  { slug: "kuvuo-2-5-mini-excavator-2-5-ton", name: "KUVUO 2.5", category: "Mini Excavators", price: undefined, image: "https://wheelloadersusa.com/wp-content/uploads/2026/09/kuvuo2.5.webp", images: ["https://wheelloadersusa.com/wp-content/uploads/2026/09/kuvuo2.5.webp"], desc: "KUVUO 2.5 compact mini excavator.", brand: "TYPHON" },
  { slug: "typhon-thunderdump-180-power-barrow-1-8-ton", name: "TYPHON ThunderDump 180 Power Barrow", category: "Mini Dumpers", price: undefined, image: "http://americanminiexcavator.com/wp-content/uploads/2026/08/TD021.png", images: ["http://americanminiexcavator.com/wp-content/uploads/2026/08/TD021.png"], desc: "TYPHON ThunderDump 180 power barrow.", brand: "TYPHON" },
  { slug: "stonekrusher-k1-compact-stone-crusher-1-0-ton", name: "STONEKRUSHER K1 Compact Stone Crusher", category: "Stone Crushers", price: undefined, image: "https://mobilecranes.org/wp-content/uploads/2026/09/k1-scaled.png", images: ["https://mobilecranes.org/wp-content/uploads/2026/09/k1-scaled.png"], desc: "STONEKRUSHER K1 compact mobile stone crusher.", brand: "TYPHON" },
  { slug: "typhon-stone-krusher-k2-compact-stone-crusher-2-2-ton", name: "TYPHON Stone Krusher K2 Compact Stone Crusher", category: "Stone Crushers", price: undefined, image: "https://mobilecranes.org/wp-content/uploads/2026/09/K2-scaled.png", images: ["https://mobilecranes.org/wp-content/uploads/2026/09/K2-scaled.png"], desc: "TYPHON Stone Krusher K2 compact stone crusher.", brand: "TYPHON" },
];

export const loadCsvProducts = () => {
  const files = ['src/data/wheel-loader-products.csv'];
  const rows = files.flatMap(file => parseCsv(fs.readFileSync(file, 'utf8')));
  const bySku = new Map();
  for (const row of rows) {
    if (row.Published !== '1' || row['Visibility in catalog'] === 'hidden') continue;
    const key = (row.SKU || row.ID).trim().toUpperCase();
    bySku.set(key, row);
  }
  const csvList = [...bySku.values()].map(row => {
    const images = row.Images.split(/[\r\n,]+/).map(value => value.trim()).filter(Boolean);
    const category = getNormalizedCategory(row.Categories, row.Name);
    const price = Number(row['Sale price']) || Number(row['Regular price']) || undefined;
    return {
      name: row.Name.trim(),
      slug: `${slugify(row.Name)}-${slugify(row.SKU)}`,
      sku: row.SKU.trim(),
      gtin: row['GTIN, UPC, EAN, or ISBN'].trim().replace(/\.0$/, ''), category,
      image: images[0], images, price,
      desc: plainText(row['Short description'] || row.Description),
      fullDesc: plainText(row.Description),
      shortDescription: (row['Short description'] || '').replace(/\\n/g, '\n'),
      richDescription: (row.Description || '').replace(/\\n/g, '\n'),
      checkoutUrl: row['External URL'] || '/store',
      brand: row.Brands || row['Meta: brand'] || 'TYPHON'
    };
  });
  return [...featuredProductsSeo, ...csvList];
};
