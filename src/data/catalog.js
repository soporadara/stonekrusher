import kuvuoImage from '../assets/products/kuvuo.png';
import grandRipperImage from '../assets/products/grand-ripper.png';
import skoopIiImage from '../assets/products/skoop-ii.png';
import spiderOneImage from '../assets/products/spider-one.png';
import stompV950Image from '../assets/products/stomp-v950.png';
import stoneKrusherImage from '../assets/products/stone-krusher.webp';
import stompV980Image from '../assets/products/stomp-v980.webp';
import thunderDumpImage from '../assets/products/thunderdump-180.webp';
import scoopyDigImage from '../assets/products/skoopydig.png';
import kuvuo25Image from '../assets/products/kuvuo-25.png';

import laravelProducts from './equipment-products.json';
import wheelLoaderProductsCsv from './wheel-loader-products.csv?raw';

const parseCsv = (source) => {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && nextCharacter === '\n') index += 1;
      row.push(value);
      if (row.some(cell => cell.trim())) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  const [headers = [], ...dataRows] = rows;
  return dataRows.map(cells => Object.fromEntries(
    headers.map((header, index) => [header.replace(/^\uFEFF/, ''), cells[index] || ''])
  ));
};

const plainText = (html = '') => String(html)
  .replace(/\\n/g, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const productSlug = (value = '') => value.toLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 180);

const csvCategoryMap = {
  'Equipment > Forklifts': 'Forklift',
  'Equipment > Mini Excavators': 'Mini Excavator',
  'Equipment > Road Rollers': 'Road Roller',
  'Equipment > Scissor Lifts': 'Scissor Lifts',
  'Equipment > Skid Steer Loaders': 'Skid Steer',
  'Equipment > Wheel Loaders': 'Wheel Loader'
};

const getEquipmentCategory = (categoryPath = '') => {
  const match = Object.entries(csvCategoryMap)
    .find(([csvCategory]) => categoryPath.split(',').some(category => category.trim() === csvCategory));
  return match?.[1];
};

const ecwidProductIdsBySku = {
  'TYPH-5013': 593348541,
  'TYPH-8005': 843665003,
  'TYPH-8007': 843668254,
  'TYPH-KV27': 869810726,
  'TYPH-KUVUO27': 869810726,
  'TYPH-SK02': 868769405,
  'TYPH-0802': 868769405,
  'TYPH-SP01': 868827561,
  'TYPH-SPIDER': 868827561,
  'TYPH-GRX1': 865478523,
  'TYPH-V950': 865478793,
  'TYPH-K3': 865511272,
  'TYPH-TD02': 865478524,
  'TYPH-TD180': 865478804,
  'TYPH-K1': 865508276,
  'TYPH-K2': 865478525
};

const getEcwidIdFromUrl = (url = '') => {
  const match = url.match(/(?:-p|\/p\/)(\d+)/);
  return match ? Number(match[1]) : undefined;
};

const getAttachmentPlacement = (categoryPath) => {
  const normalizedPath = categoryPath.toLowerCase();

  if (normalizedPath.includes('xxv attachments')) {
    return {
      fitmentCategory: 'Mini Excavators (2.5 Tons)',
      subcategory: 'XXV Attachments'
    };
  }
  if (
    normalizedPath.includes('x2 attachments')
    || normalizedPath.includes('x2 pro-x2 max attachments')
    || normalizedPath.includes('attachments for mini excavators (2.5 tons)')
  ) {
    return {
      fitmentCategory: 'Mini Excavators (2.5 Tons)',
      subcategory: 'X2 Attachments'
    };
  }
  if (normalizedPath.includes('skid steer attachments')) {
    return {
      fitmentCategory: 'Skid Steer Attachments',
      subcategory: normalizedPath.includes('standard series')
        ? 'Standard Series (X1300, 509)'
        : 'Compact Series (501-507)'
    };
  }
  if (normalizedPath.includes('skoop attachments')) {
    return { fitmentCategory: 'Skoop Attachments', subcategory: 'Skoop Attachments' };
  }
  return {
    fitmentCategory: 'Mini Excavators (2 Tons and Below)',
    subcategory: 'Compact Excavator Attachments'
  };
};

const mergedCsvRows = Array.from(
  parseCsv(wheelLoaderProductsCsv)
    .reduce((productsByKey, product, index) => {
      const key = product.SKU?.trim() || product.ID?.trim() || `csv-product-${index}`;
      productsByKey.set(key, product);
      return productsByKey;
    }, new Map())
    .values()
);

const csvProducts = mergedCsvRows
  .filter(product => product.Published === '1' && product['Visibility in catalog'] !== 'hidden')
  .map((product, index) => {
    const categoryPath = product.Categories.trim();
    const externalUrl = product['External URL'] || '/store';
    const firstImage = product.Images.split(',').map(image => image.trim()).find(Boolean) || '';
    const salePrice = Number(product['Sale price']);
    const regularPrice = Number(product['Regular price']);
    const numericPrice = salePrice || regularPrice;
    const rawDesc = (product.Description || '').replace(/\\n/g, '\n');
    const rawShortDesc = (product['Short description'] || '').replace(/\\n/g, '\n');
    const shared = {
      id: `website-menu-${product.SKU || product.ID || index}`,
      sku: product.SKU,
      mpn: product.SKU,
      gtin: product['GTIN, UPC, EAN, or ISBN'].replace(/\.0$/, ''),
      slug: `${productSlug(product.Name)}-${productSlug(product.SKU)}`,
      ecwidProductId: ecwidProductIdsBySku[product.SKU] || getEcwidIdFromUrl(externalUrl),
      name: product.Name,
      specs: rawShortDesc || plainText(rawDesc),
      desc: rawShortDesc,
      fullDesc: plainText(rawDesc),
      richDescription: rawDesc,
      price: numericPrice ? `$${numericPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : 'Call for pricing',
      image: firstImage,
      images: product.Images.split(/[\r\n,]+/).map(image => image.trim()).filter(Boolean),
      externalUrl,
      buttonText: product['Button text'] || 'EXPLORE PRODUCT',
      catalogPosition: Number.isFinite(Number(product.Position)) ? Number(product.Position) : index,
      sourceCategories: categoryPath,
      brand: product.Brands || product['Meta: brand'] || ''
    };

    if (categoryPath.startsWith('Attachment & Parts') || categoryPath.startsWith('Attachments >') || categoryPath.startsWith('Attachments,')) {
      return { ...shared, ...getAttachmentPlacement(categoryPath), weight: product['Weight (lbs)'] || 'N/A' };
    }

    const weight = product['Weight (lbs)']
      ? `${Number(product['Weight (lbs)']).toLocaleString('en-US')} lbs`
      : product['Meta: compatibility'] || 'See details';
    return {
      ...shared,
      category: getEquipmentCategory(categoryPath) || categoryPath.replace(/^Equipment > /, ''),
      weight,
      engine: product['Attribute 2 value(s)'] || 'See details',
      cap: product['Short description'] || plainText(product.Description)
    };
  });

const byCatalogPosition = (a, b) => a.catalogPosition - b.catalogPosition;
const csvEquipmentProducts = csvProducts.filter(product => product.category).sort(byCatalogPosition);
const csvAttachmentProducts = csvProducts.filter(product => product.fitmentCategory).sort(byCatalogPosition);

const v900Specifications = `<p>The TYPHON STOMP V900 is an easy-to-use 1.4-ton compact track loader engineered for demanding work in confined spaces. Powered by a proven Kubota D1105 diesel engine, it combines responsive 3-pump / 3-valve hydraulics, an elevated triangular track configuration for superior traction, protective side safety guards, and a 460 kg (1,014 lbs) rated operating capacity.</p>
<p>Its dual auxiliary hydraulic circuits provide 48 L/min (12.7 GPM) flow at 16 MPa (2,321 PSI) rated pressure, allowing operators to run a wide range of specialized attachments from trenchers and augers to grapples and sweeper brooms. The narrow profile and 360-degree spin-turning capability make the V900 ideal for farms, construction sites, landscaping, and property maintenance.</p>
<h2>Specifications</h2>
<ul>
<li><strong>Engine:</strong> Kubota D1105 Diesel Engine</li>
<li><strong>Operating Weight:</strong> 1,400 kg (3,086 lb)</li>
<li><strong>Rated Operating Capacity (ROC):</strong> 460 kg (1,014 lb)</li>
<li><strong>Maximum Load Capacity:</strong> 500 kg (1,102 lb)</li>
<li><strong>Hydraulic Flow:</strong> 48 L/min (12.7 GPM)</li>
<li><strong>Rated Hydraulic Pressure:</strong> 16 MPa (2,321 PSI)</li>
<li><strong>Hydraulic Configuration:</strong> 3 Pumps / 3 Valves System</li>
<li><strong>Undercarriage:</strong> Triangular Track System with Elevated Drive Sprocket</li>
<li><strong>Safety Features:</strong> Heavy-Duty Protective Side Guards</li>
<li><strong>Bucket Capacity:</strong> 5.30 FT³ (0.15 m³)</li>
<li><strong>Max Breakout Force:</strong> 1,012 LBF</li>
</ul>`;

const v950Specifications = `<p>The TYPHON STOMP V950 is a compact 1.5-ton track loader powered by a fuel-efficient 25 HP Kubota D1105 three-cylinder diesel engine. Built to deliver dependable power in confined environments, it combines a narrow 1,050 mm profile with 360-degree turning for controlled movement through gates, doorways, narrow paths, and busy jobsites.</p>
<p>Its full hydraulic system provides smooth, responsive operation for lifting, loading, grading, and material handling. Automatic leveling helps keep loads stable, while durable triangular rubber tracks maintain traction across wet, muddy, uneven, and sloped ground. The 0.2 m³ steel bucket can also be exchanged for compatible attachments to support a wider range of work.</p>
<p>Designed for construction, landscaping, farms, gardens, orchards, property maintenance, and site preparation, the V950 delivers practical lifting capacity and reliable daily performance in a compact, easy-to-maintain machine.</p>
<h2>Specifications</h2>
<ul>
<li><strong>Engine:</strong> Kubota D1105 Diesel, 25 HP</li>
<li><strong>Operating Weight:</strong> 1,500 kg (1.5 Ton)</li>
<li><strong>Operating Load:</strong> 530 kg (1,168 lb)</li>
<li><strong>Max Lifting Force:</strong> 480 kg (1,058 lb)</li>
<li><strong>Max Working Height (A):</strong> 2,630 mm (103.54 in)</li>
<li><strong>Max Pin Height (B):</strong> 2,090 mm (82.28 in)</li>
<li><strong>Max Dumping Height (C):</strong> 1,535 mm (60.43 in)</li>
<li><strong>Max Dumping Distance (D):</strong> 715 mm (28.15 in)</li>
<li><strong>Max Dumping Angle (E):</strong> 38°</li>
<li><strong>Total Height (F):</strong> 1,630 mm (64.17 in)</li>
<li><strong>Ground Clearance:</strong> 150 mm (5.91 in)</li>
<li><strong>Overall Length without Bucket:</strong> 2,220 mm (87.40 in)</li>
<li><strong>Overall Length without Bucket (Pedal Folded) (Y):</strong> 2,100 mm (82.68 in)</li>
<li><strong>Total Width (G):</strong> 1,050 mm (41.34 in)</li>
<li><strong>Bucket Width (H):</strong> 1,150 mm (45.28 in)</li>
<li><strong>Total Length with Bucket (K):</strong> 2,745 mm (108.07 in)</li>
<li><strong>Bucket Capacity:</strong> 0.2 m³ (7.06 ft³)</li>
<li><strong>Noise Level:</strong> ≤93 dB</li>
<li><strong>Hydraulic Pressure:</strong> 0–17 MPa (0–2,466 psi)</li>
<li><strong>Hydraulic Flow Rate:</strong> 0–32 L/min (0–8.45 GPM)</li>
<li><strong>Travel Speed:</strong> 0–4.5 km/h (0–2.80 mph)</li>
<li><strong>Tank Capacities:</strong> Fuel 30 L (7.93 gal), Engine Oil 4 L (1.06 gal), Hydraulic Tank 35 L (9.25 gal)</li>
</ul>`;

const groundRipperDescription = `<p>The TYPHON GroundRipper GRX1 is a heavy-duty compact track trencher from the KONSTRUCTZ Series, engineered to reduce manual labor and deliver consistent trenching performance in tight jobsites. Its Honda GX690 engine produces 22.1 HP at 3,600 RPM for dependable, continuous cutting power.</p>
<p>The GRX1 cuts trenches up to 29.5 inches deep and 6 inches wide across varying soil conditions. Advanced hydraulic boom control provides smooth depth adjustment, while the direct hydraulic drive and precise flow control allow the operator to match trencher-chain speed to the ground. Responsive forward and reverse controls help maintain an efficient, consistent cut.</p>
<p>Measuring 96.5 inches long, 36.4 inches wide, and 47.2 inches high, the GRX1 combines a compact footprint with a low center of gravity and rugged tracked stability on uneven terrain. Easy service access and practical fluid capacities support straightforward daily maintenance.</p>
<p>It is designed for electrical cables, fiber-optic and communication lines, irrigation systems, drainage pipes, landscaping, municipal work, site preparation, and agricultural trenching.</p>
<h2>Specifications</h2>
<ul>
<li><strong>Engine:</strong> Honda GX690, 22.1 HP at 3,600 RPM</li>
<li><strong>Maximum trench depth:</strong> 29.5 in</li>
<li><strong>Maximum trench width:</strong> 6 in</li>
<li><strong>Dimensions:</strong> 96.5 in L × 36.4 in W × 47.2 in H</li>
<li><strong>Maximum travel speed:</strong> 2.8 mph</li>
<li><strong>Hydraulic flow:</strong> Up to 42 L/min (11.1 GPM)</li>
<li><strong>Maximum hydraulic pressure:</strong> 18 MPa (2,611 PSI)</li>
<li><strong>Tank capacities:</strong> 15 L (4.0 gal) fuel and 30 L (7.9 gal) hydraulic</li>
</ul>`;

const stoneKrusherK1Description = `<p><strong>Compact Rock Crusher for Construction, Recycling & Aggregate Production</strong></p>
<p>The STONEKRUSHER K1 is a compact, heavy-duty stone crusher designed to process rock, concrete, asphalt, and other construction materials into reusable aggregate. Powered by a reliable Honda GX390 11.7 HP gasoline engine, the K1 combines practical crushing performance with a compact design that makes it suitable for construction sites, landscaping projects, roadwork, recycling operations, and aggregate processing.</p>
<p>With a 150 mm × 250 mm (5.91 × 9.84 in) feed inlet and an adjustable crushed-stone range of approximately 5–25 mm (0.20–1 in), the STONEKRUSHER K1 is designed to produce usable crushed material for a wide range of construction and infrastructure applications.</p>
<p>Its trailer-drive configuration, reinforced steel construction, hydraulic manual control system, and integrated conveyor make the K1 a practical solution for contractors and operators who need to process materials efficiently while reducing hauling, disposal, and material purchasing costs.</p>

<h2>Key Features</h2>
<ul>
<li>Honda GX390 11.7 HP engine provides reliable gasoline-powered performance.</li>
<li>Heavy-duty reinforced steel construction is designed for demanding jobsite conditions.</li>
<li>150 × 250 mm (5.91 × 9.84 in) feed opening accommodates a variety of rock and construction materials.</li>
<li>Produces crushed material in approximately the 5–25 mm (0.20–1 in) range.</li>
<li>2–4 tons per hour (4,409–8,818 lb/hr) production capacity supports continuous material processing.</li>
<li>400 mm (15.75 in) wide conveyor belt efficiently transports crushed material for stacking.</li>
<li>700–1,000 mm (27.56–39.37 in) stacking height provides convenient material discharge.</li>
<li>Manual hydraulic valve control offers straightforward operation.</li>
<li>Trailer-drive design allows practical movement between working locations.</li>
<li>Compact transportation dimensions (2,000 × 1,250 × 1,600 mm) make the crusher easier to move and position.</li>
<li>Accessible components simplify routine inspection and maintenance.</li>
</ul>

<h2>Crushing Performance & Output Specifications</h2>
<p>The STONEKRUSHER K1 is engineered for efficient reduction of common construction and demolition materials. With an operating weight of 988 kg (2,178 lb), it offers high stability during active processing operations while maintaining easy trailer mobility.</p>
<p>Depending on material type, feed conditions, and operating settings, the crusher can process approximately 2–4 tons (4,409–8,818 lb) of material per hour. The crushing system produces aggregate ranging from approximately 5 mm to 25 mm (0.20–1 in) in diameter, making the processed material suitable for site preparation, roadwork, landscaping, backfilling, and other construction projects.</p>

<h2>Honda GX390 Engine & Fuel Specifications</h2>
<p>The STONEKRUSHER K1 is equipped with a commercial-grade Honda GX390 engine engineered for continuous high-torque output.</p>
<ul>
<li><strong>Engine Model:</strong> Honda GX390 Commercial Gasoline</li>
<li><strong>Engine Type:</strong> 4-stroke, OHV, single cylinder, air-cooled, horizontal shaft</li>
<li><strong>Rated Power Output:</strong> 8.7 kW / 11.7 HP @ 3,600 RPM</li>
<li><strong>Fuel Type:</strong> 86 AKI / 92# Gasoline</li>
<li><strong>Fuel Tank Capacity:</strong> 6 L (1.59 gal)</li>
<li><strong>Control System:</strong> Manual hydraulic valve system</li>
<li><strong>Drive / Walking Style:</strong> Trailer drive towing configuration</li>
</ul>

<h2>Dimensions & Conveyor Specifications</h2>
<ul>
<li><strong>Feed Inlet Opening:</strong> 150 × 250 mm (5.91 × 9.84 in)</li>
<li><strong>Crushed Stone Diameter Range:</strong> 5–25 mm (0.20–1 in)</li>
<li><strong>Conveyor Belt Width:</strong> 400 mm (15.75 in)</li>
<li><strong>Discharge Stacking Height:</strong> 700–1,000 mm (27.56–39.37 in)</li>
<li><strong>Working Dimensions (L × W × H):</strong> 3,330 × 1,250 × 1,600 mm (131.10 × 49.21 × 63 in)</li>
<li><strong>Transportation Dimensions (L × W × H):</strong> 2,000 × 1,250 × 1,600 mm (78.74 × 49.21 × 63 in)</li>
<li><strong>Operating Weight:</strong> 988 kg (2,178 lb)</li>
</ul>

<h2>Reduce Material Handling Costs & Applications</h2>
<p>By processing material directly at the jobsite, operators can reuse available resources instead of transporting large quantities of waste material away from the project. This reduces disposal fees, trucking expenses, and aggregate purchasing costs.</p>
<p><strong>Primary Applications:</strong> Construction site material processing, rock and stone crushing, concrete and asphalt recycling, road construction & maintenance, site development, landscaping backfill production, and contractor rental operations.</p>`;

const stoneKrusherK2Description = `<p><strong>Compact Tracked Stone Crusher with Honda GX690 Engine</strong></p>
<p>The TYPHON STONE KRUSHER K2 – KONSTRUCTZ SERIES is a compact tracked stone crusher engineered for efficient processing of rock, concrete, asphalt, demolition debris, and other suitable construction materials. Powered by a Honda GX690 22.1 HP gasoline engine, the K2 combines reliable power, hydraulic track mobility, and continuous material handling in a rugged machine designed for demanding jobsites.</p>
<p>With a 220 × 350 mm (8.7 × 13.8 in) feed port, the STONE KRUSHER K2 can accept material up to approximately 200 mm (7.9 in), while its crushing system produces gravel in an approximate 15–50 mm (0.6–2.0 in) range. With a production capacity of approximately 2–5 tons per hour, the K2 is designed for contractors and operators who need practical on-site material processing and aggregate production.</p>
<p>The hydraulic track system allows the crusher to move around construction sites, recycling areas, quarry locations, and other uneven working environments, while the integrated feeding and discharge conveyor helps maintain a continuous material-processing workflow.</p>

<h2>Key Features</h2>
<ul>
<li>Honda GX690 22.1 HP gasoline engine delivers dependable power for crushing and hydraulic operation.</li>
<li>Tracked undercarriage provides mobility across construction sites and uneven terrain.</li>
<li>Hydraulically powered track system allows convenient machine movement between working areas.</li>
<li>220 × 350 mm (8.7 × 13.8 in) feed port accommodates a wide range of suitable rock and construction materials.</li>
<li>Maximum feed size of approximately 200 mm (7.9 in) supports efficient processing of larger material.</li>
<li>15–50 mm (0.6–2.0 in) gravel output range produces usable crushed material for various applications.</li>
<li>2–5 tons per hour production capacity supports small- to medium-scale crushing operations.</li>
<li>400 mm (15.7 in) conveyor belt provides efficient transfer of processed material.</li>
<li>Hydraulic conveyor lifting system simplifies adjustment during operation and transport.</li>
<li>Manual hydraulic valve controls provide straightforward machine operation.</li>
<li>Heavy-duty reinforced construction is designed for demanding work environments.</li>
<li>Grease lubrication system helps maintain the jaw crushing mechanism.</li>
<li>Mechanical track tension adjustment simplifies routine undercarriage maintenance.</li>
</ul>

<h2>Efficient On-Site Crushing & Performance Specifications</h2>
<p>The TYPHON STONE KRUSHER K2 is designed to bring material processing closer to where the material is generated. Instead of transporting all rock, concrete, asphalt, or suitable demolition material to a separate processing facility, operators can crush material closer to the jobsite when conditions and material suitability allow.</p>
<p>This approach can help reduce unnecessary material handling, transportation requirements, and disposal costs while producing aggregate that can potentially be reused for construction and site-development applications.</p>
<p>With an overall weight of 1,814 kg (4,000 lb) and 0.25 m³ (8.83 cu ft) hopper capacity, the K2 maintains an efficient balance between structural stability and jobsite agility.</p>

<h2>Tracked Design for Jobsite Mobility</h2>
<p>Unlike stationary crushers, the STONE KRUSHER K2 features a hydraulically powered rubber-track system that allows the machine to travel around the working area at speeds up to 3 km/h (1.9 mph). The crusher can be repositioned between material piles and processing areas without requiring frequent external handling equipment.</p>

<h2>Engine, Dimensions & Technical Specifications</h2>
<ul>
<li><strong>Engine Model:</strong> Honda GX690 V-Twin Commercial Gasoline (22.1 HP / 16.5 kW @ 3,600 RPM)</li>
<li><strong>Operating Weight:</strong> 1,814 kg (4,000 lb)</li>
<li><strong>Feed Opening Dimensions:</strong> 220 × 350 mm (8.7 × 13.8 in)</li>
<li><strong>Maximum Feed Size:</strong> 200 mm (7.9 in)</li>
<li><strong>Crushed Material Range:</strong> 15–50 mm (0.6–2.0 in)</li>
<li><strong>Production Capacity:</strong> 2–5 tons/hour</li>
<li><strong>Conveyor Belt Width:</strong> 400 mm (15.7 in)</li>
<li><strong>Hopper Capacity:</strong> 0.25 m³ (8.83 cu ft)</li>
<li><strong>Discharge Height:</strong> 700–1,150 mm (27.6–45.3 in)</li>
<li><strong>Travel Speed:</strong> 0–3 km/h (0–1.9 mph)</li>
<li><strong>Working Dimensions (L × W × H):</strong> 3,200 × 1,000 × 1,600 mm (126.0 × 39.4 × 63.0 in)</li>
<li><strong>Transport Dimensions (L × W × H):</strong> 2,150 × 1,000 × 1,750 mm (84.6 × 39.4 × 68.9 in)</li>
<li><strong>Fuel Tank Capacity:</strong> 6.5 L (1.72 gal Gasoline)</li>
<li><strong>Hydraulic Tank Capacity:</strong> 35 L (9.25 gal #32/#46 Hydraulic Oil)</li>
</ul>

<h2>Crushing & Material Processing Workflow</h2>
<p>The K2 is designed around a practical material-processing workflow: <strong>Feed → Crush → Convey → Stack</strong></p>
<p>Material is loaded through the 220 × 350 mm feed opening, processed through the jaw crushing mechanism, and discharged through the integrated 400 mm conveyor belt. The system produces aggregate suitable for construction, roadwork, backfilling, site preparation, demolition recycling, and landscaping projects.</p>`;

const stoneKrusherK3Description = `<p><strong>Compact Tracked Jaw Crusher with Kubota D1105 Engine</strong></p>
<p>The TYPHON STONE CRUSHER K3 – KONSTRUCTZ SERIES is a heavy-duty tracked jaw crusher designed for efficient crushing and recycling of rock, concrete, asphalt, demolition debris, and other suitable construction materials. Powered by a Kubota D1105 engine producing 25.47 HP at 2,350 RPM, the K3 combines dependable power, hydraulic track mobility, and high-capacity material processing in a compact mobile crushing platform.</p>
<p>With a 250 × 400 mm inlet opening, a maximum input size of approximately 230 × 380 mm, and a production capacity of 5–10 tons per hour, the STONE CRUSHER K3 is designed for contractors, quarry operators, mining operations, recycling businesses, road construction companies, and infrastructure projects that require efficient on-site crushing.</p>
<p>The K3 uses a rubber-track undercarriage with dual-speed travel, allowing the machine to move around demanding jobsites and reposition between material piles and processing areas. Its integrated hopper, jaw crusher, and conveyor system provide a practical workflow for feeding, crushing, conveying, and stacking processed aggregate.</p>

<h2>Key Features</h2>
<ul>
<li>Kubota D1105 25.47 HP engine provides reliable power for mobile crushing operations.</li>
<li>Tracked jaw crusher design provides mobility across construction and recycling sites.</li>
<li>5–10 tons per hour production capacity supports continuous material processing.</li>
<li>250 × 400 mm (9.84 × 15.75 in) inlet opening provides a large feeding area for suitable materials.</li>
<li>Maximum input size of approximately 230 × 380 mm (9.06 × 15.00 in) supports processing of larger rock and construction material.</li>
<li>20–60 mm (0.79–2.36 in) output range produces crushed aggregate for a variety of applications.</li>
<li>0.4 m³ (14.13 ft³) hopper capacity supports efficient material feeding.</li>
<li>400 mm (15.75 in) conveyor belt transports processed material for convenient discharge and stacking.</li>
<li>Dual-speed traveling motor provides controlled machine movement around the jobsite.</li>
<li>Rubber tracks (300 × 86 × 52.5 mm) improve mobility and reduce the need for separate transportation between nearby working areas.</li>
<li>Heavy-duty reinforced steel construction is designed for demanding operating environments.</li>
<li>Plunger pump and gear pump hydraulic system supports the machine's hydraulic functions.</li>
<li>950–1,000 mm (37.40–39.37 in) stacking height provides convenient material discharge.</li>
<li>Compact transport dimensions (2,750 × 1,450 × 2,050 mm) simplify movement between project locations.</li>
</ul>

<h2>High-Capacity Crushing Performance & Output Specifications</h2>
<p>The TYPHON STONE CRUSHER K3 is designed for operators who require greater crushing capacity than smaller compact crushers. With an operating weight of 3,800 kg (8,377.57 lb), the machine combines heavy-duty chassis mass with agile tracked mobility.</p>
<p>With a rated production capacity of approximately 5–10 tons per hour, the K3 can process suitable material continuously while maintaining a compact tracked configuration. The jaw crusher is designed to reduce larger material into an approximate 20–60 mm output range. Actual production and output size may vary depending on material type, hardness, moisture content, feed size, operating conditions, and crusher settings.</p>

<h2>Kubota D1105 Engine & Hydraulic Systems</h2>
<p>The STONE CRUSHER K3 is equipped with a Kubota D1105 engine rated at 19 kW / 25.47 HP at 2,350 RPM. The engine provides dependable power for the crushing jaws and dual plunger/gear pump hydraulic systems while maintaining low fuel consumption.</p>
<ul>
<li><strong>Engine Model:</strong> Kubota D1105 Industrial Diesel</li>
<li><strong>Engine Power Rating:</strong> 19 kW (25.47 HP) @ 2,350 RPM</li>
<li><strong>Fuel Tank Capacity:</strong> 50 L (13.21 gal)</li>
<li><strong>Hydraulic Oil Tank Capacity:</strong> 50 L (13.21 gal)</li>
<li><strong>Hydraulic Pump Configuration:</strong> Plunger Pump + Gear Pump system</li>
<li><strong>Drive Motor:</strong> AC Motor / Dual-Speed Hydraulic Traveling System</li>
</ul>

<h2>Tracked Mobility & Working Dimensions</h2>
<p>The K3 features a rubber-track undercarriage (300 × 86 × 52.5 mm / 11.81 × 3.39 × 2.07 in) with a dual-speed traveling system. This allows operators to reposition the crusher around construction sites, quarry areas, recycling facilities, and other uneven working environments at speeds up to 4 km/h (2.49 mph).</p>
<ul>
<li><strong>Working Dimensions (L × W × H):</strong> 4,050 × 1,450 × 2,050 mm (159.45 × 57.09 × 80.71 in)</li>
<li><strong>Transport Dimensions (L × W × H):</strong> 2,750 × 1,450 × 2,050 mm (108.27 × 57.09 × 80.71 in)</li>
<li><strong>Travel Speed Range:</strong> 0–4 km/h (0–2.49 mph)</li>
<li><strong>Stacking Height:</strong> 950–1,000 mm (37.40–39.37 in)</li>
</ul>

<h2>Efficient Material Processing Workflow</h2>
<p>The STONE CRUSHER K3 is engineered for maximum throughput: <strong>Load → Feed → Crush → Convey → Stack</strong></p>
<p>Material is loaded into the 0.4 m³ (14.13 ft³) hopper and directed through the 250 × 400 mm inlet opening. The jaw crusher processes the material before the crushed aggregate is discharged onto the 400 mm wide conveyor belt for convenient jobsite stacking.</p>

<h2>Applications & Cost Reduction Benefits</h2>
<p>Processing material on-site significantly reduces trucking costs, disposal fees, and raw aggregate purchase expenses. The K3 is ideal for:</p>
<ul>
<li>Rock & Stone crushing operations</li>
<li>Quarry and Mining applications</li>
<li>Concrete, Brick & Asphalt demolition recycling</li>
<li>Road construction & infrastructure development</li>
<li>Landscaping, Site preparation & Backfill material production</li>
<li>Equipment rental fleets & Municipal recycling operations</li>
</ul>`;

const featuredCatalogProducts = [
  {
    id: "featured-1",
    sku: "TYPH-KV27",
    slug: "kuvuo-2-7-series-mini-excavator",
    name: "KUVUO 2.7 Series",
    category: "Konstructz",
    subcategory: "Excavator",
    weight: "2.7 Ton",
    engine: "Kubota D1105 Diesel Engine",
    cap: "$19,655.10",
    price: "$19,655.10",
    ecwidProductId: 869810726,
    hash: "#!/TYPHON-KUVUO-2-7-Mini-Excavator-Konstructz-Series-2-7-Ton-with-Kubota-D1105-Enclosed-Cab-A-C-&-Heater-Retractable-Metal-Tracks-Full-Pilot-Controls-and-2-Speed-Travel/p/869810726",
    externalUrl: "https://americanskidsteer.com/TYPHON-KUVUO-2-7-Mini-Excavator-Konstructz-Series-2-7-Ton-with-Kubota-D1105-Enclosed-Cab-A-C-&-Heater-Retractable-Metal-Tracks-Full-Pilot-Controls-and-2-Speed-Travel-p869810726",
    checkoutUrl: "/store#!/TYPHON-KUVUO-2-7-Mini-Excavator-Konstructz-Series-2-7-Ton-with-Kubota-D1105-Enclosed-Cab-A-C-&-Heater-Retractable-Metal-Tracks-Full-Pilot-Controls-and-2-Speed-Travel/p/869810726",
    image: "http://americanminiexcavator.com/wp-content/uploads/2026/09/2.png",
    images: [
      "http://americanminiexcavator.com/wp-content/uploads/2026/09/2.png",
      "http://americanminiexcavator.com/wp-content/uploads/2026/09/4.png",
      "http://americanminiexcavator.com/wp-content/uploads/2026/09/10.png",
      "http://americanminiexcavator.com/wp-content/uploads/2026/09/9.png",
      "http://americanminiexcavator.com/wp-content/uploads/2026/09/8.png"
    ]
  },
  { id: "featured-2", sku: "TYPH-GRX1", slug: "typhon-groundripper-grx1-compact-track-trencher", name: "TYPHON GroundRipper GRX1 Compact Track Trencher", category: "Konstructz", subcategory: "Trenchers", weight: "See details", engine: "Honda GX690 22.1 HP", cap: "$8,411.95", price: "$8,411.95", ecwidProductId: 865478523, hash: "#!/TYPHON-GroundRipper-GRX1-Compact-Track-Trencher-Konstructz-Series-w-Honda-GX690-22-1HP-Engine/p/865478523", image: "http://americanminiexcavator.com/wp-content/uploads/2026/09/GRX1II-scaled.webp", images: ["http://americanminiexcavator.com/wp-content/uploads/2026/09/GRX1II-scaled.webp", "http://americanminiexcavator.com/wp-content/uploads/2026/09/GRX1I-scaled.webp", "http://americanminiexcavator.com/wp-content/uploads/2026/09/GRX1III-scaled.webp", "http://americanminiexcavator.com/wp-content/uploads/2026/09/GRX1IV-scaled.webp", "http://americanminiexcavator.com/wp-content/uploads/2026/09/GRX1V-scaled.webp"], richDescription: groundRipperDescription },
  {
    id: "featured-3",
    sku: "TYPH-SK02",
    slug: "skoop-ii-wheel-loader-compact-wheel-loader",
    name: "Skoop II Wheel Loader",
    category: "Konstructz",
    subcategory: "Wheel Loader",
    weight: "1.8 Ton",
    engine: "Kubota Diesel Engine",
    cap: "$23,098.90",
    price: "$23,098.90",
    ecwidProductId: 868769405,
    hash: "#!/TYPHON-Telescopic-SKOOP-Wheel-Loader-Cabin-Version-Kubota-D1105-Diesel-Engine-1-Ton-Max-Load-Capacity-AC-&-Heater-Cabin/p/868769405",
    externalUrl: "https://americanskidsteer.com/TYPHON-Telescopic-SKOOP-Wheel-Loader-Cabin-Version-Kubota-D1105-Diesel-Engine-1-Ton-Max-Load-Capacity-AC-&-Heater-Cabin-p868769405",
    checkoutUrl: "/store#!/TYPHON-Telescopic-SKOOP-Wheel-Loader-Cabin-Version-Kubota-D1105-Diesel-Engine-1-Ton-Max-Load-Capacity-AC-&-Heater-Cabin/p/868769405",
    image: "https://wheelloadersusa.com/wp-content/uploads/2026/09/WheelloaderII.webp",
    images: ["https://wheelloadersusa.com/wp-content/uploads/2026/09/WheelloaderII.webp"]
  },
  {
    id: "featured-4",
    sku: "TYPH-SP01",
    slug: "spider-one-towable-excavator-mini-excavator",
    name: "Spider One Towable Excavator",
    category: "Konstructz",
    subcategory: "Excavator",
    weight: "1.0 Ton",
    engine: "Honda GX390 Gasoline Engine",
    cap: "$4,610.59",
    price: "$4,610.59",
    ecwidProductId: 868827561,
    hash: "#!/New-TYPHON-Spider-One-Mini-Excavator-Konstructz-Series-with-Honda-GX390-EPA-Engine-Towable-Design-and-Full-360-Degree-Rotation/p/868827561",
    externalUrl: "https://americanskidsteer.com/New-TYPHON-Spider-One-Mini-Excavator-Konstructz-Series-with-Honda-GX390-EPA-Engine-Towable-Design-and-Full-360-Degree-Rotation-p868827561",
    checkoutUrl: "/store#!/New-TYPHON-Spider-One-Mini-Excavator-Konstructz-Series-with-Honda-GX390-EPA-Engine-Towable-Design-and-Full-360-Degree-Rotation/p/868827561",
    image: "https://wheelloader.org/wp-content/uploads/2026/08/sprider-one.png",
    images: [
      "https://wheelloader.org/wp-content/uploads/2026/08/sprider-one.png",
      "https://asianmachinery.net/wp-content/uploads/2026/08/mini-typhon-Konstructz-sprider-excavator-scaled.png",
      "https://asianmachinery.net/wp-content/uploads/2026/08/mini-sprider-excavator-scaled.png",
      "https://asianmachinery.net/wp-content/uploads/2026/08/sprider-excavator-front-view-scaled.png",
      "https://asianmachinery.net/wp-content/uploads/2026/08/Sprider-excavator-scaled.png",
      "https://asianmachinery.net/wp-content/uploads/2026/08/sprider-one-excavator-scaled.png",
      "https://asianmachinery.net/wp-content/uploads/2026/08/typhon-sprider-excavator-scaled.png",
      "https://asianmachinery.net/wp-content/uploads/2026/08/Konstructz-sprider-excavator-scaled.png"
    ]
  },
  { id: "featured-5", sku: "TYPH-V950", slug: "typhon-stomp-v950-mini-track-loader-1-5-ton-compact-track-loader", name: "Stomp V950 Track Loader", category: "Konstructz", subcategory: "Skid Steer", weight: "1.5 Ton", engine: "Kubota D1105 25 HP", cap: "$12,098.27", price: "$12,098.27", ecwidProductId: 865478793, hash: "#!/Typhon-Stomp-V950-Mini-Skid-Steer-Track-Loader-Konstructz-Series-1-5-Ton-25HP-Kubota-D1105-Engine/p/865478793", image: "https://asianmachinery.net/wp-content/uploads/2026/08/mini-skid-steer-track-loader-scaled.png", images: [
    "https://asianmachinery.net/wp-content/uploads/2026/08/mini-skid-steer-track-loader-scaled.png",
    "https://asianmachinery.net/wp-content/uploads/2026/08/mini-track-loader-v950-scaled.png",
    "https://asianmachinery.net/wp-content/uploads/2026/08/mini-track-loader-scaled.png",
    "https://asianmachinery.net/wp-content/uploads/2026/08/stomp-v950-track-loader-scaled.png",
    "https://asianmachinery.net/wp-content/uploads/2026/08/stomp-v950-scaled.png",
    "https://asianmachinery.net/wp-content/uploads/2026/08/typhon-stomp-v950-compact-track-loader-scaled.png",
    "https://asianmachinery.net/wp-content/uploads/2026/08/typhon-stomp-v950-track-loader-scaled.png",
    "https://asianmachinery.net/wp-content/uploads/2026/08/typhon-stomp-v950-1-scaled.png"
  ], richDescription: v950Specifications },
  { id: "featured-6", sku: "TYPH-K3", slug: "stone-krusher-k3-compact-stone-crusher", name: "Stone Krusher K3", category: "Konstructz", subcategory: "Stone Crusher", weight: "3.8 Ton", engine: "Kubota D1105 Diesel 24.8 HP", cap: "$22,159.82", price: "$22,159.82", ecwidProductId: 865511272, hash: "#!/TYPHON-STONEKRUSHER-K3-Tracked-Jaw-Crusher-24-8-HP-Kubota-D1105-5-10-TPH-Self-Propelled-Mobile-Rock-Crusher/p/865511272", image: "https://mobilecranes.org/wp-content/uploads/2026/09/K3.png", images: ["https://mobilecranes.org/wp-content/uploads/2026/09/K3.png", "https://asianmachinery.net/wp-content/uploads/2026/09/typhon-mini-track-stone-crusher-k3.jpg", "https://asianmachinery.net/wp-content/uploads/2026/08/stone-krusher-3.jpg", "https://asianmachinery.net/wp-content/uploads/2026/08/TYPHON-Stone-Krusher-K3.jpg"], richDescription: stoneKrusherK3Description },
  { id: "featured-7", sku: "TYPH-V980", slug: "stomp-v980-compact-track-loader-0-98-ton", name: "Stomp V980 Compact Track Loader", category: "Konstructz", subcategory: "Skid Steer", weight: "0.98 Ton", engine: "Gasoline Engine", cap: "Call for pricing", price: "Call for pricing", image: "https://wheelloadersusa.com/wp-content/uploads/2026/09/skid-steers-v950.webp", images: ["https://wheelloadersusa.com/wp-content/uploads/2026/09/skid-steers-v950.webp"] },
  { id: "featured-8", sku: "TYPH-TD02", slug: "typhon-thunderdump-lift-compact-dumper", name: "TYPHON ThunderDump Lift", category: "Konstructz", subcategory: "Dumper", weight: "1.8 Ton", engine: "Gasoline Engine", cap: "$6,852.59", price: "$6,852.59", ecwidProductId: 865478524, hash: "#!/TYPHON-ThunderDump-Lift-KONSTRUCTZ-Series-Tracked-Dumper-2-205-lb-Load-Capacity-Honda-GX390-11HP-Gas-Engine/p/865478524", image: "http://americanminiexcavator.com/wp-content/uploads/2026/08/TD013.png", images: ["http://americanminiexcavator.com/wp-content/uploads/2026/08/TD013.png", "http://americanminiexcavator.com/wp-content/uploads/2026/08/TD011.png", "http://americanminiexcavator.com/wp-content/uploads/2026/08/TD012.png", "http://americanminiexcavator.com/wp-content/uploads/2026/08/TD014.png", "http://americanminiexcavator.com/wp-content/uploads/2026/08/TD015.png"] },
  { id: "featured-9", sku: "TYPH-SC01", slug: "typhon-scoopydig-heavy-backhoe-loader-1-5-ton", name: "TYPHON ScoopyDig Heavy Backhoe Loader", category: "Konstructz", subcategory: "Backhoe", weight: "1.5 Ton", engine: "Gasoline Engine", cap: "Request Quote for Pricing", price: "Request Quote for Pricing", image: "https://wheelloadersusa.com/wp-content/uploads/2026/09/Scoopydig.webp", images: ["https://wheelloadersusa.com/wp-content/uploads/2026/09/Scoopydig.webp"] },
  { id: "featured-10", sku: "TYPH-KV25", slug: "kuvuo-2-5-mini-excavator-2-5-ton", name: "KUVUO 2.5", category: "Konstructz", subcategory: "Excavator", weight: "2.5 Ton", engine: "Gasoline Engine", cap: "Call for pricing", price: "Call for pricing", image: "https://wheelloadersusa.com/wp-content/uploads/2026/09/kuvuo2.5.webp", images: ["https://wheelloadersusa.com/wp-content/uploads/2026/09/kuvuo2.5.webp"] },
  { id: "featured-11", sku: "TYPH-TD180", slug: "typhon-thunderdump-180-power-barrow-1-8-ton", name: "TYPHON ThunderDump 180 Power Barrow", category: "Konstructz", subcategory: "Dumper", weight: "1.8 Ton", engine: "Gasoline Engine", cap: "$6,061.66", price: "$6,061.66", ecwidProductId: 865478804, hash: "#!/TYPHON-THUNDERDUMP-180-Wheeled-Dumper-Konstructz-Series-Honda-GX390-11-HP-2-866-lb-Capacity/p/865478804", image: "http://americanminiexcavator.com/wp-content/uploads/2026/08/TD021.png", images: ["http://americanminiexcavator.com/wp-content/uploads/2026/08/TD021.png", "http://americanminiexcavator.com/wp-content/uploads/2026/08/TD022.png", "http://americanminiexcavator.com/wp-content/uploads/2026/08/TD023.png", "http://americanminiexcavator.com/wp-content/uploads/2026/08/TD024.png"] },
  { id: "featured-12", sku: "TYPH-K1", slug: "stonekrusher-k1-compact-stone-crusher-1-0-ton", name: "STONEKRUSHER K1 Compact Stone Crusher", category: "Konstructz", subcategory: "Stone Crusher", weight: "1.0 Ton", engine: "Honda GX390 11.7 HP", cap: "$7,509.22", price: "$7,509.22", ecwidProductId: 865508276, hash: "#!/TYPHON-STONEKRUSHER-K1-Compact-Rock-Crusher-11-7-HP-Honda-GX390-Towable-Jaw-Crusher-Konstructz-Series/p/865508276", image: "https://mobilecranes.org/wp-content/uploads/2026/09/k1-scaled.png", images: ["https://mobilecranes.org/wp-content/uploads/2026/09/k1-scaled.png", "https://mobilecranes.org/wp-content/uploads/2026/09/16-scaled.jpg", "https://mobilecranes.org/wp-content/uploads/2026/09/12-scaled.jpg", "https://mobilecranes.org/wp-content/uploads/2026/09/11-scaled.jpg"], richDescription: stoneKrusherK1Description },
  {
    id: "featured-v900",
    sku: "TYPH-V900Y",
    slug: "brand-new-typhon-stomp-v900-1-4-ton-compact-track-loader-with-25hp-kubota-diesel-engine-1-102-lb-max-load-typh-v900y",
    name: "TYPHON STOMP V900 Compact Track Loader",
    category: "Konstructz",
    subcategory: "Skid Steer",
    weight: "1.4 Ton",
    engine: "Kubota D1105 Diesel Engine",
    cap: "$11,999.00",
    price: "$11,999.00",
    ecwidProductId: 849060904,
    hash: "#!/Brand-New-TYPHON-STOMP-V900-1-4-Ton-Compact-Track-Loader-with-25HP-Kubota-Diesel-Engine-1-102-lb-Max-Load/p/849060904",
    externalUrl: "https://stonekrusher.com/store/brand-new-typhon-stomp-v900-1-4-ton-compact-track-loader-with-25hp-kubota-diesel-engine-1-102-lb-max-load-p849060904",
    checkoutUrl: "/store/brand-new-typhon-stomp-v900-1-4-ton-compact-track-loader-with-25hp-kubota-diesel-engine-1-102-lb-max-load-p849060904",
    image: "/images/v900/v900-compact-track-loader-hero.webp",
    images: [
      "/images/v900/v900-compact-track-loader-hero.webp",
      "/images/v900/v900-kubota-d1105-engine.webp",
      "/images/v900/v900-kubota-d1105-engine-angle.webp",
      "/images/v900/v900-hydraulic-system.webp",
      "/images/v900/v900-triangular-track-system.webp",
      "/images/v900/v900-protective-side-guards.webp",
      "/images/v900/v900-loader-raised-front.webp",
      "/images/v900/v900-lifting-capacity-poster.webp"
    ],
    richDescription: v900Specifications
  },
  { id: "featured-13", sku: "TYPH-K2", slug: "typhon-stone-krusher-k2-compact-stone-crusher-2-2-ton", name: "TYPHON Stone Krusher K2 Compact Stone Crusher", category: "Konstructz", subcategory: "Stone Crusher", weight: "2.2 Ton", engine: "Honda GX690 22.1 HP", cap: "$9,849.56", price: "$9,849.56", ecwidProductId: 865478525, hash: "#!/TYPHON-STONEKRUSHER-K2-Konstructz-Series-Tracked-Jaw-Crusher-22-1-HP-Honda-GX690-Heavy-Duty-Rock-&-Concrete/p/865478525", image: "https://mobilecranes.org/wp-content/uploads/2026/09/K2-scaled.png", images: ["https://mobilecranes.org/wp-content/uploads/2026/09/K2-scaled.png", "https://mobilecranes.org/wp-content/uploads/2026/09/1-scaled.jpg", "https://mobilecranes.org/wp-content/uploads/2026/09/11-1-scaled.jpg"], richDescription: stoneKrusherK2Description },
];

const categoryMap = {
  'Forklifts': 'Forklift',
  'Mini Excavators': 'Mini Excavator',
  'Wheel Loaders': 'Wheel Loader',
  'Skid Steers': 'Skid Steer',
  'Skid Steer Loaders': 'Skid Steer',
  'Trenchers': 'Trencher',
  'Stone Crushers': 'Stone Crusher',
  'Mini Dumpers': 'Mini Dumper',
  'Road Rollers': 'Road Roller',
  'Scissor Lifts': 'Scissor Lifts',
  'Backhoes': 'Backhoe'
};

const mapLaravelProduct = (p, index) => {
  const normalizedCategory = categoryMap[p.category] || p.category;
  return {
    id: `imported-${index}-${p.slug}`,
    name: p.name,
    category: normalizedCategory,
    weight: p.weight || p.name.match(/(\d+(?:[.,]\d+)?\s*(?:Ton|lbs))/i)?.[0] || "See details",
    engine: p.engine || "See details",
    cap: p.desc || p.fullDesc || "No details available",
    price: p.price ? `$${p.price.toLocaleString()}` : "Call for pricing",
    image: p.image,
    externalUrl: p.checkoutUrl || p.hash || `/store`,
    checkoutUrl: p.checkoutUrl,
    hash: p.hash,
    buttonText: p.buttonText || "FIND OUT MORE",
    desc: p.desc || "",
    fullDesc: p.fullDesc || ""
  };
};

const productsArray = Array.isArray(laravelProducts) 
  ? laravelProducts 
  : (laravelProducts && typeof laravelProducts === 'object' && Array.isArray(laravelProducts.default) 
      ? laravelProducts.default 
      : []);

const seenProductNames = new Set();
// Retained as a migration fallback for older equipment JSON snapshots.
const importedCatalogProducts = productsArray
  .filter(p => p.category !== 'Mini Excavator Attachments' && p.category !== 'Skid Steer Attachments')
  .filter(p => {
    const normalizedName = p.name ? p.name.trim().toLowerCase() : '';
    if (seenProductNames.has(normalizedName)) {
      return false;
    }
    seenProductNames.add(normalizedName);
    return true;
  })
  .map((p, idx) => mapLaravelProduct(p, idx));

// Retained as a migration fallback for older attachment JSON snapshots.
// eslint-disable-next-line no-unused-vars
const laravelAttachments = productsArray
  .filter(p => p.category === 'Mini Excavator Attachments' || p.category === 'Skid Steer Attachments')
  .map((p, index) => {
    let fitmentCategory = 'Mini Excavators (2 Tons and Below)';
    if (p.category === 'Skid Steer Attachments') {
      fitmentCategory = 'Skid Steer Attachments';
    }
    
    let subcategory = 'Compact Excavator Attachments';
    if (p.category === 'Skid Steer Attachments') {
      subcategory = 'Compact Series (501-507)';
    }

    return {
      id: `imported-attachment-${index}-${p.slug}`,
      name: p.name,
      fitmentCategory: fitmentCategory,
      subcategory: subcategory,
      specs: p.desc || p.fullDesc || "No details available",
      weight: "N/A",
      price: p.price ? `$${p.price.toLocaleString()}` : "Call for pricing",
      image: p.image,
      externalUrl: p.checkoutUrl || p.hash || `/store`,
      buttonText: p.buttonText || "EXPLORE MORE",
      sourceCategories: p.category
    };
  });

// Retained for compatibility with legacy attachment records.
// eslint-disable-next-line no-unused-vars
const importedAttachmentProducts = [
  { id: "imported-2-18070", name: "Skid Steer Ripper Tool Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Compact Series (501-507)", specs: "Skid Steer Loader Ripper Attachment is a practical attachment for hard-ground preparation. It helps operato...", weight: "N/A", price: "$1,560", image: "https://machinery.online/wp-content/uploads/2025/03/3603015090-scaled-1.jpg", externalUrl: "/store/#!/Skid-Steer-Loader-Ripper-Attachment-p554135397", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments > Compact Series (501–507), Equipment, Attachments > Skid Steer Attachments" },
  { id: "imported-2-18071", name: "Skid Steer Land Leveler Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Compact Series (501-507)", specs: "Skid Steer Loader Land Leveler Attachment is a practical attachment for grading and leveling. It helps oper...", weight: "N/A", price: "$1,560", image: "https://machinery.online/wp-content/uploads/2025/03/Skid-Steer-Loader-Land-Leveler-Attachment-USA2.jpg", externalUrl: "/store/#!/Skid-Steer-Loader-Land-Leveler-Attachment-p554141745", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments > Compact Series (501–507), Equipment, Attachments > Skid Steer Attachments" },
  { id: "imported-2-18072", name: "Skid Steer Pallet Fork Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Compact Series (501-507)", specs: "Skid Steer Loader Fork Pallet Attachment is a practical attachment for material handling. It helps operator...", weight: "N/A", price: "$1,680", image: "https://machinery.online/wp-content/uploads/2025/03/Skid-Steer-Loader-Fork-Pallet-Attachment-USA2-scaled-1.webp", externalUrl: "/store/#!/Skid-Steer-Loader-Fork-Pallet-Attachment-p553910423", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments > Compact Series (501–507), Equipment, Attachments > Skid Steer Attachments" },
  { id: "imported-2-18073", name: "Skid Steer Earth Auger Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Compact Series (501-507)", specs: "Skid Steer Loader Earth Auger Attachment is a practical attachment for hole drilling. It helps operators ha...", weight: "N/A", price: "$3,720", image: "https://machinery.online/wp-content/uploads/2025/03/Skid-Steer-Loader-Earth-Auger-Attachment-USA-scaled-1.jpg", externalUrl: "/store/#!/Skid-Steer-Loader-Earth-Auger-Attachment-p554137954", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments > Compact Series (501–507), Equipment, Attachments > Skid Steer Attachments" },
  { id: "imported-2-18074", name: "Skid Steer 4-in-1 Bucket Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Compact Series (501-507)", specs: "Skid Steer Loader 4 in one Bucket Attachment is a practical attachment for multi-purpose bucket work. It he...", weight: "N/A", price: "$2,760", image: "https://machinery.online/wp-content/uploads/2025/03/Skid-Steer-Loader-4-in-one-Bucket-Attachment-USA.jpg", externalUrl: "/store/#!/Skid-Steer-Loader-4-in-one-Bucket-Attachment-p554137955", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments > Compact Series (501–507), Equipment, Attachments > Skid Steer Attachments" },
  { id: "imported-2-18075", name: "Skid Steer Grapple Bucket Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Compact Series (501-507)", specs: "Skid Steer Loader Grappler Grapple Grabber Attachment is a practical attachment for grappling and cleanup....", weight: "N/A", price: "$2,400", image: "https://machinery.online/wp-content/uploads/2025/03/Skid-Steer-Loader-Grappler-Grapple-Grabber-Attachment-USA-scaled-1.jpg", externalUrl: "/store/#!/Skid-Steer-Loader-Grappler-Grapple-Grabber-Attachment-p554141746", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments > Compact Series (501–507), Equipment, Attachments > Skid Steer Attachments" },
  { id: "imported-2-18583", name: "Skid Steer Bulldozer Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Compact Series (501-507)", specs: "Skid Steer Loader Bull Dozer Attachment is a practical attachment for pushing and rough grading. It helps o...", weight: "N/A", price: "$3,600", image: "https://machinery.online/wp-content/uploads/2025/03/Skid-Steer-Loader-Bull-Dozer-Attachment-USA.webp", externalUrl: "/store/#!/Skid-Steer-Loader-Bull-Dozer-Attachment-USA-p593372782", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments > Compact Series (501–507), Equipment, Attachments > Skid Steer Attachments" },
  { id: "imported-2-18596", name: "Skid Steer Lawn Mower Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Compact Series (501-507)", specs: "Skid Steer Loader Lawn Mower Attachment is a practical attachment for vegetation cutting. It helps operator...", weight: "N/A", price: "$3,600", image: "https://machinery.online/wp-content/uploads/2025/03/Skid-Steer-Loader-Lawn-Mower-Attachment-USA2.webp", externalUrl: "/store/#!/Skid-Steer-Loader-Lawn-Mower-Attachment-USA-p593352286", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments > Compact Series (501–507), Equipment, Attachments > Skid Steer Attachments" },
  { id: "imported-2-18607", name: "Skid Steer Stump Grinder Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Compact Series (501-507)", specs: "Skid Steer Loader Stump Grinder Attachment is a practical attachment for stump removal. It helps operators...", weight: "N/A", price: "$3,600", image: "https://machinery.online/wp-content/uploads/2025/03/Skid-Steer-Loader-Stump-Grinder-Attachment-USA-scaled-1.webp", externalUrl: "/store/#!/Skid-Steer-Loader-Stump-Grinder-Attachment-USA-p593372785", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments > Compact Series (501–507), Equipment, Attachments > Skid Steer Attachments" },
  { id: "imported-2-18615", name: "Skid Steer Lawn Scarifier Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Compact Series (501-507)", specs: "Skid Steer Loader Attachment Lawn Scarifier is a practical attachment for surface preparation. It helps ope...", weight: "N/A", price: "$2,880", image: "https://machinery.online/wp-content/uploads/2025/03/Skid-Steer-Loader-Attachment-Lawn-Scarifier-USA6.jpg", externalUrl: "/store/#!/Skid-Steer-Loader-Attachment-Lawn-Scarifier-USA-p582027786", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments > Compact Series (501–507), Equipment, Attachments > Skid Steer Attachments" },
  { id: "imported-2-18625", name: "Skid Steer Trench Filler Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Compact Series (501-507)", specs: "Skid Steer Loader Attachment Trench Filler is a practical attachment for trench backfilling. It helps opera...", weight: "N/A", price: "$2,268", image: "https://machinery.online/wp-content/uploads/2025/03/Skid-Steer-Loader-Attachment-Trench-Filler-USA.jpg", externalUrl: "/store/#!/Skid-Steer-Loader-Attachment-Trench-Filler-USA-p582027785", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments > Compact Series (501–507), Equipment, Attachments > Skid Steer Attachments" },
  { id: "imported-2-18634", name: "TYPHON Skid Steer Trencher Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Compact Series (501-507)", specs: "TYPHON Skid Steer Loader Trencher Attachment is a practical attachment for trenching. It helps operators ha...", weight: "N/A", price: "$3,240", image: "https://machinery.online/wp-content/uploads/2025/03/TYPHON-Skid-Steer-Loader-Trencher-Attachment-USA.webp", externalUrl: "/store/#!/TYPHON-Skid-Steer-Loader-Trencher-Attachment-USA-p582017778", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments > Compact Series (501–507), Equipment, Attachments > Skid Steer Attachments" },
  { id: "imported-2-18643", name: "TYPHON Skid Steer Snow Blower Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Compact Series (501-507)", specs: "TYPHON Skid Steer Loader Snow Blower Attachment is a practical attachment for snow removal. It helps operat...", weight: "N/A", price: "$3,600", image: "https://machinery.online/wp-content/uploads/2025/03/TYPHON-Skid-Steer-Loader-Snow-Blower-Attachment-USA.webp", externalUrl: "/store/#!/TYPHON-Skid-Steer-Loader-Snow-Blower-Attachment-USA-p582019033", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments > Compact Series (501–507), Equipment, Attachments > Skid Steer Attachments" },
  { id: "imported-2-18652", name: "Skid Steer Rotary Tiller Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Compact Series (501-507)", specs: "Skid Steer Loader Rotary Plow Tiller Attachment is a practical attachment for soil preparation. It helps op...", weight: "N/A", price: "$2,473", image: "https://machinery.online/wp-content/uploads/2025/03/3856748428.jpg", externalUrl: "/store/#!/Skid-Steer-Loader-Rotary-Plow-Tiller-Attachment-USA-p582017777", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments > Compact Series (501–507), Equipment, Attachments > Skid Steer Attachments" },
  { id: "imported-2-18661", name: "Skid Steer Sweeper Broom Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Compact Series (501-507)", specs: "Skid Steer Loader Sweeper Attachment is a practical attachment for site cleanup. It helps operators handle...", weight: "N/A", price: "$3,600", image: "https://machinery.online/wp-content/uploads/2025/03/Skid-Steer-Loader-Sweeper-Attachment-USA.webp", externalUrl: "/store/#!/Skid-Steer-Loader-Sweeper-Attachment-USA-p576753503", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments > Compact Series (501–507), Equipment, Attachments > Skid Steer Attachments" },
  { id: "imported-2-18668", name: "Skid Steer Hydraulic Hammer Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Compact Series (501-507)", specs: "Skid Steer Loader Hydraulic Hammer Concrete Breaker Attachment is a practical attachment for breaking and d...", weight: "N/A", price: "$4,320", image: "https://machinery.online/wp-content/uploads/2025/03/Skid-Steer-Loader-Hydraulic-Hammer-Concrete-Breaker-scaled-1.jpg", externalUrl: "/store/#!/Skid-Steer-Loader-Hydraulic-Hammer-Concrete-Breaker-Attachment-USA-p593348541", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments > Compact Series (501–507), Equipment, Attachments > Skid Steer Attachments" },
  { id: "imported-2-18678", name: "Skid Steer Land Leveler Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Compact Series (501-507)", specs: "Skid Steer Loader Land Leveler Attachment is a practical attachment for grading and leveling. It helps oper...", weight: "N/A", price: "$1,560", image: "https://machinery.online/wp-content/uploads/2025/03/Skid-Steer-Loader-Land-Leveler-Attachment-USA.jpg", externalUrl: "/store/#!/Skid-Steer-Loader-Land-Leveler-Attachment-USA-p554141745", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments > Compact Series (501–507), Equipment, Attachments > Skid Steer Attachments" },
  { id: "imported-2-18709", name: "TERROR X2 PRO Top Hammer Attachment", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "X2 Attachments", specs: "2.5 ton Mini Excavator Attachment Hydraulic Hammer Top Type Rock Breaker Generic TERROR X2 PRO is a practic...", weight: "N/A", price: "$2,989", image: "https://machinery.online/wp-content/uploads/2025/03/2.5-ton-Mini-Excavator-Attachment.jpg", externalUrl: "/store/#!/2-5-ton-Mini-Excavator-Attachment-Hydraulic-Hammer-Top-Type-Rock-Breaker-Generic-p637684610", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > X2 Attachments" },
  { id: "imported-2-18718", name: "TERROR X2 PRO 1200mm Tilt Bucket", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "X2 Attachments", specs: "Excavator Attachment Tilt Bucket 47\" Hydraulic Tilting Bucket 1200mm Heavy Duty For TERROR X2 PRO is a prac...", weight: "N/A", price: "$2,999", image: "https://machinery.online/wp-content/uploads/2025/03/Excavator-Attachment-Tilt-Bucket-47-scaled-1.webp", externalUrl: "/store/#!/Excavator-Attachment-Tilt-Bucket-47-Hydraulic-Tilting-Bucket-1200mm-Heavy-Duty-p637684609", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > X2 Attachments" },
  { id: "imported-2-18727", name: "TERROR X2 PRO 1000mm Tilt Bucket", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "X2 Attachments", specs: "Excavator Attachment Tilt Bucket 39\" Hydraulic Tilting Bucket 1000mm Heavy Duty TERROR X2 PRO is a practica...", weight: "N/A", price: "$2,319", image: "https://machinery.online/wp-content/uploads/2025/03/Excavator-Attachment-Tilt-Bucket-39-scaled-1.webp", externalUrl: "/store/#!/Excavator-Attachment-Tilt-Bucket-39-Hydraulic-Tilting-Bucket-1000mm-Heavy-Duty-p637681606", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > X2 Attachments" },
  { id: "imported-2-18735", name: "TERROR X2 PRO 800mm Tilt Bucket", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "X2 Attachments", specs: "2.5 Ton Excavator Attachment Hydraulic Tilt Bucket 800mm Tilting Bucket 31 inch TERROR X2 PRO is a practica...", weight: "N/A", price: "$2,399", image: "https://machinery.online/wp-content/uploads/2025/03/2.5-Ton-Excavator-Attachment-Hydraulic-Tilt-Bucket-800mm-scaled-1.webp", externalUrl: "/store/#!/2-5-Ton-Excavator-Attachment-Hydraulic-Tilt-Bucket-800mm-Tilting-Bucket-31-inch-p637681605", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > X2 Attachments" },
  { id: "imported-2-18744", name: "TERROR X2 PRO 8in Auger Attachment", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "X2 Attachments", specs: "2.5 ton Excavator Attachment Hydraulic Earth Auger Post Hole Digger 8inch Diameter TERROR X2 PRO is a pract...", weight: "N/A", price: "$1,099", image: "https://machinery.online/wp-content/uploads/2025/03/2.5-ton-Excavator-Attachment-Hydraulic-Earth-Auger1.webp", externalUrl: "/store/#!/2-5-ton-Excavator-Attachment-Hydraulic-Earth-Auger-Post-Hole-Digger-8inch-Dia-p637681604", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > X2 Attachments" },
  { id: "imported-2-18753", name: "TERROR X2 PRO Excavator Grapple", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "X2 Attachments", specs: "Mini Excavator Attachment Grapple Wide Opening Grabber For 2 to 3.5 ton Diggers For TERROR X2 PRO is a prac...", weight: "N/A", price: "$1,599", image: "https://machinery.online/wp-content/uploads/2025/03/Wide-Opening-Grabber-For-2-to-3.5-ton-Diggers-scaled-1.webp", externalUrl: "/store/#!/Mini-Excavator-Attachment-Grapple-Wide-Opening-Grabber-For-2-to-3-5-ton-Diggers-p637681602", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > X2 Attachments" },
  { id: "imported-2-18764", name: "TERROR X2 PRO Ripper Attachment", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "X2 Attachments", specs: "2.5 Ton Mini Excavator Attachment Ripper Single Shank TYPHON Digger Attachment TERROR X2 PRO is a practical...", weight: "N/A", price: "$429", image: "https://machinery.online/wp-content/uploads/2025/03/2.5-Ton-Mini-Excavator-Attachment-Ripper-1.jpg", externalUrl: "/store/#!/2-5-Ton-Mini-Excavator-Attachment-Ripper-Single-Shank-TYPHON-Digger-Attachment-p637684603", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > X2 Attachments" },
  { id: "imported-2-18774", name: "TERROR X2 PRO 22in Excavator Rake", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "X2 Attachments", specs: "Mini Excavator Attachment Rake 22\" Wide TYPHON Attachments For 2-3.5 ton Diggers For TERROR X2 PRO is a pra...", weight: "N/A", price: "$499", image: "https://machinery.online/wp-content/uploads/2025/03/Rake-22-Wide-TYPHON-Attachment.webp", externalUrl: "/store/#!/Mini-Excavator-Attachment-Rake-22-Wide-TYPHON-Attachments-For-2-3-5-ton-Diggers-p637684602", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > X2 Attachments" },
  { id: "imported-2-18784", name: "TERROR X2 PRO 800mm Mud Bucket", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "X2 Attachments", specs: "TYPHON 2.5 Ton Mini Excavator Attachment Plain Bucket 800mm 31\" Mud Bucket For TERROR X2 PRO is a practical...", weight: "N/A", price: "$1,599", image: "https://machinery.online/wp-content/uploads/2025/03/Plain-Bucket-800mm-31-Mud-Bucket7.webp", externalUrl: "/store/#!/TYPHON-2-5-Ton-Mini-Excavator-Attachment-Plain-Bucket-800mm-31-Mud-Bucket-p637684600", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > X2 Attachments" },
  { id: "imported-2-18796", name: "TERROR X2 PRO 1000mm Rock Bucket", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "X2 Attachments", specs: "2ton Excavator Attachment 1000mm Rock Bucket Heavy Duty Trenching Bucket 39 inch TERROR X2 PRO is a practic...", weight: "N/A", price: "$2,080", image: "https://machinery.online/wp-content/uploads/2025/03/2ton-Excavator-Attachment.jpg", externalUrl: "/store/#!/2ton-Excavator-Attachment-1000mm-Rock-Bucket-Heavy-Duty-Trenching-Bucket-39-inch-p637684599", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > X2 Attachments" },
  { id: "imported-2-18800", name: "TERROR X2 600mm Teeth Bucket Set", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "X2 Attachments", specs: "2-3.5 Ton Mini Excavator Attachment 600mm Teeth Bucket Trenching Buckets 23 inch for TERROR X2 is a practic...", weight: "N/A", price: "$1,599", image: "https://machinery.online/wp-content/uploads/2025/03/2-3.5-Ton-Mini-Excavator-Attachment-600mm.webp", externalUrl: "/store/#!/2-3-5-Ton-Mini-Excavator-Attachment-600mm-Teeth-Bucket-Trenching-Buckets-23-inch-p637684598", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > X2 Attachments" },
  { id: "imported-2-18817", name: "TERROR X2 550mm Teeth Bucket Set", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "X2 Attachments", specs: "2-3.5 Ton Mini Excavator Attachment 550mm Teeth Bucket Trenching Buckets 21 inch for TERROR X2 is a practic...", weight: "N/A", price: "$749", image: "https://machinery.online/wp-content/uploads/2025/03/2-3.5-Ton-Mini-Excavator-Attachment-550mm.jpg", externalUrl: "/store/#!/2-3-5-Ton-Mini-Excavator-Attachment-550mm-Teeth-Bucket-Trenching-Buckets-21-inch-p637684597", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > X2 Attachments" },
  { id: "imported-2-18829", name: "TERROR X2 PRO 250mm Narrow Bucket", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "X2 Attachments", specs: "2-3.5 Tons Excavator Attachment 250mm Narrow Bucket Trenching Buckets 9.8 inch For TERROR X2 PRO is a pract...", weight: "N/A", price: "$439", image: "https://machinery.online/wp-content/uploads/2025/03/2-3.5-Tons-Excavator-Attachment-250mm.webp", externalUrl: "/store/#!/2-3-5-Tons-Excavator-Attachment-250mm-Narrow-Bucket-Trenching-Buckets-9-8-inch-p637681600", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > X2 Attachments" },
  { id: "imported-2-18837", name: "TERROR X2 PRO Quick Hitch Coupler", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "X2 Attachments", specs: "TYPHON 2.5 Ton Mini Excavator Attachment Mechanical Quick Hitch Quick Coupler For TERROR X2 PRO is a practi...", weight: "N/A", price: "$599", image: "https://machinery.online/wp-content/uploads/2025/03/TYPHON-2.5-Ton-Mini-Excavator-Attachment.webp", externalUrl: "/store/#!/TYPHON-2-5-Ton-Mini-Excavator-Attachment-Mechanical-Quick-Hitch-Quick-Coupler-p637681598", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > X2 Attachments" },
  { id: "imported-2-18848", name: "Mini Excavator Hydraulic Breaker", fitmentCategory: "Mini Excavators (2 Tons and Below)", subcategory: "Compact Excavator Attachments", specs: "TYPHON Attachments Hydraulic Break Hammer Attachment for Mini Digger is a practical attachment for attachme...", weight: "N/A", price: "$1,680", image: "https://machinery.online/wp-content/uploads/2025/03/Hydraulic-Break-Hammer-Attachment-for-Mini-Digger-USA.webp", externalUrl: "/store/#!/TYPHON-Attachments-Hydraulic-Break-Hammer-Attachment-for-Mini-Digger-USA-p503107271", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2 Tons and Below), Equipment" },
  { id: "imported-2-18863", name: "TYPHON 600mm Tilting Bucket Set", fitmentCategory: "Mini Excavators (2 Tons and Below)", subcategory: "Compact Excavator Attachments", specs: "600mm Tilting Bucket: Attachment for TYPHON Mini Excavators is a practical attachment for angled grading. I...", weight: "N/A", price: "$900", image: "https://machinery.online/wp-content/uploads/2025/03/600mm-Tilting-Bucket.webp", externalUrl: "/store/#!/600mm-Tilting-Bucket-Attachment-for-TYPHON-Mini-Excavators-USA-p503244519", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2 Tons and Below), Equipment" },
  { id: "imported-2-18873", name: "TYPHON 600mm Skeleton Bucket Set", fitmentCategory: "Mini Excavators (2 Tons and Below)", subcategory: "Compact Excavator Attachments", specs: "Screening skeleton Bucket Attachment 600mm TYPHON Mini Excavators is a practical attachment for attachment...", weight: "N/A", price: "$360", image: "https://machinery.online/wp-content/uploads/2025/03/Screening-skeleton-Bucket.webp", externalUrl: "/store/#!/Screening-skeleton-Bucket-Attachment-600mm-TYPHON-Mini-Excavators-USA-p503243571", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2 Tons and Below), Equipment" },
  { id: "imported-2-18885", name: "Mini Excavator Budget Thumb Clip", fitmentCategory: "Mini Excavators (2 Tons and Below)", subcategory: "Compact Excavator Attachments", specs: "Budget Style Hydraulic Thumb Clip Attachment for Mini Excavators Digger Track Crawler is a practical attach...", weight: "N/A", price: "$300", image: "https://machinery.online/wp-content/uploads/2025/03/Budget-Style-Hydraulic-Thumb-Clip-scaled-1.jpg", externalUrl: "/store/#!/Budget-Style-Hydraulic-Thumb-Clip-Attachment-for-Mini-Excavators-Digger-Track-Crawler-p569748662", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2 Tons and Below), Equipment" },
  { id: "imported-2-18897", name: "Mini Excavator Hydraulic Thumb Clip", fitmentCategory: "Mini Excavators (2 Tons and Below)", subcategory: "Compact Excavator Attachments", specs: "Generic Attachment Hydraulic Thumb Clip For Mini Excavators is a practical attachment for attachment work....", weight: "N/A", price: "$360", image: "https://machinery.online/wp-content/uploads/2025/03/New-Generic-Attachment-Hydraulic-Thumb.webp", externalUrl: "/store/#!/New-Generic-Attachment-Hydraulic-Thumb-Clip-For-Mini-Excavators-p645188073", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2 Tons and Below), Equipment" },
  { id: "imported-2-18908", name: "TYPHON Hydraulic Thumb Clip Kit", fitmentCategory: "Mini Excavators (2 Tons and Below)", subcategory: "Compact Excavator Attachments", specs: "TYPHON Attachments Hydraulic Thumb Clip Attachment for Mini Excavators is a practical attachment for attach...", weight: "N/A", price: "$336", image: "https://machinery.online/wp-content/uploads/2025/03/TYPHON-Attachments-Hydraulic-Thumb-Clip.webp", externalUrl: "/store/#!/TYPHON-Attachments-Hydraulic-Thumb-Clip-Attachment-for-Mini-Excavators-USA-p503097126", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2 Tons and Below), Equipment" },
  { id: "imported-2-18920", name: "TYPHON Mini Excavator Auger Drill", fitmentCategory: "Mini Excavators (2 Tons and Below)", subcategory: "Compact Excavator Attachments", specs: "TYPHON Attachments Auger Drill Attachment for Mini Excavators Machinery is a practical attachment for hole...", weight: "N/A", price: "$924", image: "https://machinery.online/wp-content/uploads/2025/03/Auger-Drill-Attachment-for-Mini-Excavators-scaled-1.webp", externalUrl: "/store/#!/TYPHON-Attachments-Auger-Drill-Attachment-for-Mini-Excavators-Machinery-USA-p503103318", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2 Tons and Below), Equipment" },
  { id: "imported-2-18931", name: "TYPHON Mini Excavator Grapple Tool", fitmentCategory: "Mini Excavators (2 Tons and Below)", subcategory: "Compact Excavator Attachments", specs: "TYPHON Attachments Grapple Attachment for Mini Excavators Grabber is a practical attachment for grappling a...", weight: "N/A", price: "$540", image: "https://machinery.online/wp-content/uploads/2025/03/Grapple-Attachment-for-Mini-Excavators.webp", externalUrl: "/store/#!/TYPHON-Attachments-Grapple-Attachment-for-Mini-Excavators-Grabber-USA-p503107267", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2 Tons and Below), Equipment" },
  { id: "imported-2-18943", name: "TYPHON Mini Excavator Ripper Tool", fitmentCategory: "Mini Excavators (2 Tons and Below)", subcategory: "Compact Excavator Attachments", specs: "Ripper Attachment for TYPHON Mini Excavators is a practical attachment for hard-ground preparation. It help...", weight: "N/A", price: "$240", image: "https://machinery.online/wp-content/uploads/2025/03/Ripper-Attachment-for-TYPHON.webp", externalUrl: "/store/#!/Ripper-Attachment-for-TYPHON-Mini-Excavators-USA-p503244510", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2 Tons and Below), Equipment" },
  { id: "imported-2-18951", name: "Mini Excavator Rake Attachment", fitmentCategory: "Mini Excavators (2 Tons and Below)", subcategory: "Compact Excavator Attachments", specs: "Rake Mini Excavator Attachment for Grading, Leveling, Loosening , Removing Soil is a practical attachment f...", weight: "N/A", price: "$420", image: "https://machinery.online/wp-content/uploads/2025/03/Rake-Mini-Excavator-Attachment.jpg", externalUrl: "/store/#!/Rake-Mini-Excavator-Attachment-for-Grading-Leveling-Loosening-Removing-Soil-USA-p503096218", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2 Tons and Below), Equipment" },
  { id: "imported-2-18964", name: "Mini Excavator 500mm Teeth Bucket", fitmentCategory: "Mini Excavators (2 Tons and Below)", subcategory: "Compact Excavator Attachments", specs: "500mm Trenching Bucket General Purpose w teeth for Mini Excavator is a practical attachment for digging wit...", weight: "N/A", price: "$540", image: "https://machinery.online/wp-content/uploads/2025/03/500mm-Trenching-Bucket.jpg", externalUrl: "/store/#!/500mm-Trenching-Bucket-General-Purpose-w-teeth-for-Mini-Excavator-USA-p569697108", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2 Tons and Below), Equipment" },
  { id: "imported-2-18972", name: "TYPHON 500mm Plain Mud Bucket Set", fitmentCategory: "Mini Excavators (2 Tons and Below)", subcategory: "Compact Excavator Attachments", specs: "500mm Plain Mud Bucket Attachment for TYPHON Mini Excavators is a practical attachment for ditch cleaning a...", weight: "N/A", price: "$360", image: "https://machinery.online/wp-content/uploads/2025/03/500mm-Plain-Mud-Bucket.webp", externalUrl: "/store/#!/500mm-Plain-Mud-Bucket-Attachment-for-TYPHON-Mini-Excavators-USA-p503097127", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2 Tons and Below), Equipment" },
  { id: "imported-2-18985", name: "TYPHON 200mm Narrow Bucket Set", fitmentCategory: "Mini Excavators (2 Tons and Below)", subcategory: "Compact Excavator Attachments", specs: "200mm Narrow Bucket Attachment for TYPHON Mini Excavators is a practical attachment for narrow trenching. I...", weight: "N/A", price: "$270", image: "https://machinery.online/wp-content/uploads/2025/03/200mm-Narrow-Bucket.webp", externalUrl: "/store/#!/200mm-Narrow-Bucket-Attachment-for-TYPHON-Mini-Excavators-USA-p503096060", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2 Tons and Below), Equipment" },
  { id: "imported-2-18997", name: "TYPHON Mini Excavator Quick Hitch", fitmentCategory: "Mini Excavators (2 Tons and Below)", subcategory: "Compact Excavator Attachments", specs: "Quick Hitch: Attachment for TYPHON Mini Excavators is a practical attachment for fast attachment changes. I...", weight: "N/A", price: "$360", image: "https://machinery.online/wp-content/uploads/2025/03/2.webp", externalUrl: "/store/#!/Quick-Hitch-Attachment-for-TYPHON-Mini-Excavators-USA-p503102370", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2 Tons and Below), Equipment" },
  { id: "imported-2-19005", name: "Skid Steer Rock Bucket Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Compact Series (501-507)", specs: "Skid Steer Loader Attachment Rock Bucket is a practical attachment for rock and tough-soil digging. It help...", weight: "N/A", price: "$1,800", image: "https://machinery.online/wp-content/uploads/2025/03/Rock-Bucket6.webp", externalUrl: "/store/#!/Skid-Steer-Loader-Attachment-Rock-Bucket-USA-p593352337", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments > Compact Series (501–507), Equipment, Attachments > Skid Steer Attachments" },
  { id: "imported-2-21104", name: "TYPHON STOMP Backhoe Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Compact Series (501-507)", specs: "Backhoe Digger Skid Steer Loader Attachments for TYPHON STOMP Skidsteer is a practical attachment for backh...", weight: "N/A", price: "$2,940", image: "https://machinery.online/wp-content/uploads/2025/03/NEW-Backhoe-Digger-Skid-Steer-Loader-Attachments-1.webp", externalUrl: "/store/#!/NEW-Backhoe-Digger-Skid-Steer-Loader-Attachments-for-TYPHON-STOMP-Skidsteer-p705230270", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments > Compact Series (501–507), Equipment, Attachments > Skid Steer Attachments" },
  { id: "imported-2-25045", name: "Mini Excavator 7.9in Auger Attachment", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "XXV Attachments", specs: "Auger Attachment For 2-3 ton Mini Excavator 7.9in Auger Bit Earth Drilling is a practical attachment for ho...", weight: "N/A", price: "$765", image: "https://machinery.online/wp-content/uploads/2026/02/Auger-Attachment-For-2-3-ton-Mini-Excavator6.webp", externalUrl: "/store/#!/Auger-Attachment-For-2-3-ton-Mini-Excavator-7-9in-Auger-Bit-Earth-Drilling-USA-p781509665", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > XXV Attachments" },
  { id: "imported-2-25056", name: "Mini Excavator Hedge Trimmer Attachment", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "XXV Attachments", specs: "Heavy Duty Hedge Trimmer Attachment 2-3 ton Mini Excavator Tool Fit Terror XXV is a practical attachment fo...", weight: "N/A", price: "$2,790", image: "https://machinery.online/wp-content/uploads/2026/02/Heavy-Duty-Hedge-Trimmer-Attachment-2-3-ton-Mini-Excavator.webp", externalUrl: "/store/#!/Heavy-Duty-Hedge-Trimmer-Attachment-2-3-ton-Mini-Excavator-Tool-Fit-Terror-XXV-USA-p781509664", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > XXV Attachments" },
  { id: "imported-2-25063", name: "Mini Excavator Pallet Fork Attachment", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "XXV Attachments", specs: "Pallet Fork Attachment for 2.5-3 ton Mini Excavator Adjustable Stabilizer Bar is a practical attachment for...", weight: "N/A", price: "$1,930", image: "https://machinery.online/wp-content/uploads/2026/02/Pallet-Fork-Attachment-for-2.5-3-ton-Mini-Excavator6.webp", externalUrl: "/store/#!/Pallet-Fork-Attachment-for-2-5-3-ton-Mini-Excavator-Adjustable-Stabilizer-Bar-USA-p781509663", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > XXV Attachments" },
  { id: "imported-2-25073", name: "Mini Excavator 800mm Tilting Bucket", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "XXV Attachments", specs: "800mm Tilting Bucket Attachment For 2-3 ton Mini Excavator Hyd Digging Bucket is a practical attachment for...", weight: "N/A", price: "$740", image: "https://machinery.online/wp-content/uploads/2026/02/800mm-Tilting-Bucket-Attachment-For-2-3-ton-Mini-Excavator-Hyd-Digging-Bucket.webp", externalUrl: "/store/#!/800mm-Tilting-Bucket-Attachment-For-2-3-ton-Mini-Excavator-Hyd-Digging-Bucket-USA-p781509662", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > XXV Attachments" },
  { id: "imported-2-25083", name: "Mini Excavator Compact Grapple", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "XXV Attachments", specs: "Compact Grapple Attachment For 2-3 ton Mini Excavator Wide Opening Wood Grab is a practical attachment for...", weight: "N/A", price: "$614", image: "https://machinery.online/wp-content/uploads/2026/02/Compact-Grapple-Attachment-For-2-3-ton-Mini-Excavator-Wide-Opening-Wood-Grab5.webp", externalUrl: "/store/#!/Compact-Grapple-Attachment-For-2-3-ton-Mini-Excavator-Wide-Opening-Wood-Grab-USA-p781510647", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > XXV Attachments" },
  { id: "imported-2-25095", name: "Mini Excavator Tree Digging Blade", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "XXV Attachments", specs: "Tree Digging Blade Attachment Root Cutting Digging Blade For 2-3 ton Excavator is a practical attachment fo...", weight: "N/A", price: "$530", image: "https://machinery.online/wp-content/uploads/2026/02/Tree-Digging-Blade-Attachment7.webp", externalUrl: "/store/#!/Tree-Digging-Blade-Attachment-Root-Cutting-Digging-Blade-For-2-3-ton-Excavator-USA-p781510646", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > XXV Attachments" },
  { id: "imported-2-25107", name: "TYPHON Mini Excavator Ripper Hook", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "XXV Attachments", specs: "TYPHON Ripper Hook Attachment For 2-3 ton Mini Excavator Ripper Tooth Attachment is a practical attachment...", weight: "N/A", price: "$323", image: "https://machinery.online/wp-content/uploads/2026/02/Ripper-Hook.webp", externalUrl: "/store/#!/TYPHON-Ripper-Hook-Attachment-For-2-3-ton-Mini-Excavator-Ripper-Tooth-Attachment-USA-p781510645", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > XXV Attachments" },
  { id: "imported-2-25119", name: "Mini Excavator Quick Hitch Coupler", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "XXV Attachments", specs: "Quick Hitch Attachment for 2-3 ton Mini Excavator Mechanical Quick Coupler is a practical attachment for fa...", weight: "N/A", price: "$320", image: "https://machinery.online/wp-content/uploads/2026/02/Quick-Hitch-Attachment.webp", externalUrl: "/store/#!/Quick-Hitch-Attachment-for-2-3-ton-Mini-Excavator-Mechanical-Quick-Coupler-USA-p781509661", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > XXV Attachments" },
  { id: "imported-2-25130", name: "Mini Excavator 1000mm Leveling Bucket", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "XXV Attachments", specs: "1000mm Leveling Bucket Attachment For 2-3 ton Mini Excavator Digging Bucket is a practical attachment for g...", weight: "N/A", price: "$644", image: "https://machinery.online/wp-content/uploads/2026/02/Leveling-Bucket-Attachment.webp", externalUrl: "/store/#!/1000mm-Leveling-Bucket-Attachment-For-2-3-ton-Mini-Excavator-Digging-Bucket-USA-p781510643", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > XXV Attachments" },
  { id: "imported-2-25143", name: "Mini Excavator 300mm Narrow Bucket", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "XXV Attachments", specs: "Narrow Bucket Attachment for 2-3 ton Mini Excavator Trenching Bucket 300mm is a practical attachment for na...", weight: "N/A", price: "$342", image: "https://machinery.online/wp-content/uploads/2026/02/Narrow-Bucket-Attachment.webp", externalUrl: "/store/#!/Narrow-Bucket-Attachment-for-2-3-ton-Mini-Excavator-Trenching-Bucket-300mm-USA-p781509660", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > XXV Attachments" },
  { id: "imported-2-25154", name: "Mini Excavator Hydraulic Hammer", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "XXV Attachments", specs: "Hydraulic Hammer Attachment Hydraulic Breaker Hammer for 2.5-3.5 ton Excavator is a practical attachment fo...", weight: "N/A", price: "$2,372", image: "https://machinery.online/wp-content/uploads/2026/02/Hydraulic-Hammer-Attachment.webp", externalUrl: "/store/#!/Hydraulic-Hammer-Attachment-Hydraulic-Breaker-Hammer-for-2-5-3-5-ton-Excavator-USA-p781509642", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > XXV Attachments" },
  { id: "imported-2-25166", name: "Mini Excavator Compact Rake Attachment", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "XXV Attachments", specs: "Mini Excavator Rake Compact Attachment General for 2-3 ton Small Digger is a practical attachment for rakin...", weight: "N/A", price: "$330", image: "https://machinery.online/wp-content/uploads/2026/02/Rake-Campact-Attachment.webp", externalUrl: "/store/#!/Mini-Excavator-Rake-Compact-Attachment-General-for-2-3-ton-Small-Digger-USA-p781510605", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > XXV Attachments" },
  { id: "imported-2-25179", name: "TERROR XXV 12-Piece Attachment Set", fitmentCategory: "Mini Excavators (2.5 Tons)", subcategory: "XXV Attachments", specs: "All in One 12 PCS Attachment Set Tool Fits 2-3 ton Mini Excavator Terror XXV is a practical attachment for...", weight: "N/A", price: "$5,999", image: "https://machinery.online/wp-content/uploads/2026/02/12-in-1-Mini-Excavator-Attachment.webp", externalUrl: "/store/#!/All-in-One-12-PCS-Attachment-Set-Tool-Fits-2-3-ton-Mini-Excavator-Terror-XXV-p781178089", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2.5 Tons), Equipment, Attachments > Attachments for Mini Excavators (2.5 Tons) > XXV Attachments" },
  { id: "imported-2-25211", name: "Mini Excavator 11-in-1 Attachment Kit", fitmentCategory: "Mini Excavators (2 Tons and Below)", subcategory: "Compact Excavator Attachments", specs: "11-in-1 Mini Excavator Attachment Combo Kit All Essential Tools for Worksites is a practical attachment for...", weight: "N/A", price: "$3,999", image: "https://machinery.online/wp-content/uploads/2026/02/5162997123.jpg", externalUrl: "/store/#!/11-in-1-Mini-Excavator-Attachment-Combo-Kit-All-Essential-Tools-for-Worksites-p781179871", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2 Tons and Below), Equipment" },
  { id: "imported-2-25228", name: "Mini Excavator 5-in-1 Attachment Kit", fitmentCategory: "Mini Excavators (2 Tons and Below)", subcategory: "Compact Excavator Attachments", specs: "5-in-1 0.8-2 Ton Excavator Attachments Quick Coupler Bucket Ripper Auger Hammer is a practical attachment f...", weight: "N/A", price: "$2,499", image: "https://machinery.online/wp-content/uploads/2026/02/5162956351.png", externalUrl: "/store/#!/5-in-1-0-8-2-Ton-Excavator-Attachments-Quick-Coupler-Bucket-Ripper-Auger-Hammer-p781178098", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2 Tons and Below), Equipment" },
  { id: "imported-2-25667", name: "Mini Excavator 10-in-1 Attachment Kit", fitmentCategory: "Mini Excavators (2 Tons and Below)", subcategory: "Compact Excavator Attachments", specs: "10-in-1 Mini Excavator Attachment Bundle Essential Tools Combo Kit for Worksites is a practical attachment...", weight: "N/A", price: "$3,095", image: "https://machinery.online/wp-content/uploads/2026/02/10-in-one-attachements.png", externalUrl: "/store/#!/10-in-1-Mini-Excavator-Attachment-Bundle-Essential-Tools-Combo-Kit-for-Worksites-p786191502", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Attachments for Mini Excavators (2 Tons and Below), Equipment" },
  { id: "imported-2-26181", name: "Mini Skid Steer Mulcher Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Compact Series (501-507)", specs: "Skid Steer Loader Mulcher is a practical attachment for land clearing. It helps operators handle clearing b...", weight: "N/A", price: "$3,760", image: "https://machinery.online/wp-content/uploads/2026/02/Skid-Steer-Loader-Mulcher.jpg", externalUrl: "/store/#!/Skid-Steer-Loader-Mulcher-p795290803", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments > Compact Series (501–507), Attachments > Skid Steer Attachments" },
  { id: "imported-2-28897", name: "TYPHON STOMP 200mm Auger Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Standard Series (X1300, 509)", specs: "TYPHON STOMP X1300 & STOMP 509 Mini Skid Steer Auger Attachment 200mm Hydraulic is a practical attachment f...", weight: "N/A", price: "$2,586", image: "https://machinery.online/wp-content/uploads/2026/02/TYPHON-STOMP-X1300-STOMP-509.png", externalUrl: "/store/#!/TYPHON-STOMP-X1300-&-STOMP-509-Mini-Skid-Steer-Auger-Attachment-200mm-Hydraulic-p811419550", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments, Attachments > Skid Steer Attachments > Standard Series (X1300\\, 509)" },
  { id: "imported-2-28912", name: "TYPHON STOMP 4-in-1 Bucket Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Standard Series (X1300, 509)", specs: "4-In-1 Bucket Combo Mini Skid Steer attachment for TYPHON STOMP X1300 & STOMP 509 is a practical attachment...", weight: "N/A", price: "$2,256", image: "https://machinery.online/wp-content/uploads/2026/02/4-In-1-Bucket-Combo-Mini-Skid-Steer-attachment.png", externalUrl: "/store/#!/4-In-1-Bucket-Combo-Mini-Skid-Steer-attachment-for-TYPHON-STOMP-X1300-&-STOMP-509-p811341838", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments, Attachments > Skid Steer Attachments > Standard Series (X1300\\, 509)" },
  { id: "imported-2-28926", name: "TYPHON STOMP Wood Grabber Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Standard Series (X1300, 509)", specs: "Hydraulic Wood Grabber Attachment Mini Skid Steer TYPHON STOMP X1300 & STOMP 509 is a practical attachment...", weight: "N/A", price: "$2,056", image: "https://machinery.online/wp-content/uploads/2026/02/Hydraulic-Wood-Grabber-Attachment.png", externalUrl: "/store/#!/Hydraulic-Wood-Grabber-Attachment-Mini-Skid-Steer-TYPHON-STOMP-X1300-&-STOMP-509-p811419549", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments, Attachments > Skid Steer Attachments > Standard Series (X1300\\, 509)" },
  { id: "imported-2-28939", name: "TYPHON STOMP 3-Tooth Ripper Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Standard Series (X1300, 509)", specs: "TYPHON STOMP X1300 & STOMP 509 Mini Skid Steer Ripper Attachment 3 Tooth is a practical attachment for hard...", weight: "N/A", price: "$1,421", image: "https://machinery.online/wp-content/uploads/2026/02/X1300-STOMP-509-Mini-Skid-Steer-Ripper-Attachment.png", externalUrl: "/store/#!/NEW-TYPHON-STOMP-X1300-&-STOMP-509-Mini-Skid-Steer-Ripper-Attachment-3-Tooth-p811341839", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments, Attachments > Skid Steer Attachments > Standard Series (X1300\\, 509)" },
  { id: "imported-2-28955", name: "TYPHON STOMP Rotary Tiller Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Standard Series (X1300, 509)", specs: "Mini Skid Steer Rotary Tiller Attachment for TYPHON STOMP X1300/TYPHON STOMP 509 is a practical attachment...", weight: "N/A", price: "$2,505", image: "https://machinery.online/wp-content/uploads/2026/02/Mini-Skid-Steer-Rotary-Tiller-Attachment.png", externalUrl: "/store/#!/Mini-Skid-Steer-Rotary-Tiller-Attachment-for-TYPHON-STOMP-X1300-TYPHON-STOMP-509-p811341842", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments, Attachments > Skid Steer Attachments > Standard Series (X1300\\, 509)" },
  { id: "imported-2-28967", name: "TYPHON STOMP Backhoe Digger Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Standard Series (X1300, 509)", specs: "TYPHON Digger Attachment for Mini Skid Steer STOMP X1300 & STOMP 509 is a practical attachment for backhoe...", weight: "N/A", price: "$2,118", image: "https://machinery.online/wp-content/uploads/2026/02/Digger-Attachment.png", externalUrl: "/store/#!/TYPHON-Digger-Attachment-for-Mini-Skid-Steer-STOMP-X1300-&-STOMP-509-p811419552", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments, Attachments > Skid Steer Attachments > Standard Series (X1300\\, 509)" },
  { id: "imported-2-28981", name: "TYPHON STOMP Forestry Mulcher Attachment", fitmentCategory: "Skid Steer Attachments", subcategory: "Standard Series (X1300, 509)", specs: "TYPHON STOMP X1300 & STOMP 509 Mini Skid Steer Forestry Mulcher Attachment is a practical attachment for la...", weight: "N/A", price: "$2,089", image: "https://machinery.online/wp-content/uploads/2026/02/Forestry-Mulcher-Attachment1.png", externalUrl: "/store/#!/New-TYPHON-STOMP-X1300-&-STOMP-509-Mini-Skid-Steer-Forestry-Mulcher-Attachment-p811419553", buttonText: "EXPLORE MORE", sourceCategories: "Attachments, Attachments > Skid Steer Attachments, Attachments > Skid Steer Attachments > Standard Series (X1300\\, 509)" },
];

const homePageProductIds = ['featured-12', 'featured-13', 'featured-6', 'featured-8'];
export const featuredProducts = homePageProductIds
  .map(id => featuredCatalogProducts.find(p => p.id === id))
  .filter(Boolean);
const existingCatalogSlugs = new Set([...featuredCatalogProducts, ...csvEquipmentProducts].map(p => productSlug(p.name || '')));
const uniqueImported = importedCatalogProducts.filter(p => !existingCatalogSlugs.has(productSlug(p.name || '')));
export const catalogProducts = [...featuredCatalogProducts, ...csvEquipmentProducts, ...uniqueImported];

const getAttachmentIdentity = (product) => (
  getEcwidIdFromUrl(product.externalUrl || product.checkoutUrl || product.hash || '')
  || productSlug(product.name || '')
);
const legacyAttachmentsByIdentity = new Map(
  importedAttachmentProducts.map(product => [getAttachmentIdentity(product), product])
);
const restoredCsvAttachments = csvAttachmentProducts.map(product => {
  const legacyProduct = legacyAttachmentsByIdentity.get(getAttachmentIdentity(product));
  if (!legacyProduct) return product;

  return {
    ...product,
    fitmentCategory: legacyProduct.fitmentCategory,
    subcategory: legacyProduct.subcategory
  };
});
const currentAttachmentIdentities = new Set(restoredCsvAttachments.map(getAttachmentIdentity));
const missingLegacyAttachments = importedAttachmentProducts.filter(
  product => !currentAttachmentIdentities.has(getAttachmentIdentity(product))
);

export const attachmentProducts = [...restoredCsvAttachments, ...missingLegacyAttachments];
