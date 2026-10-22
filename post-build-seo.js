import fs from 'fs';
import path from 'path';

const distDir = path.resolve('dist');

function getBuiltAssets() {
  const assetsDir = path.join(distDir, 'assets');
  if (!fs.existsSync(assetsDir)) {
    throw new Error('dist/assets directory does not exist. Run vite build first.');
  }

  const files = fs.readdirSync(assetsDir);
  const jsFile = files.find(f => f.startsWith('index-') && f.endsWith('.js'));
  const cssFile = files.find(f => f.startsWith('index-') && f.endsWith('.css'));

  if (!jsFile || !cssFile) {
    throw new Error('Could not find compiled index-*.js or index-*.css in dist/assets');
  }

  return {
    jsPath: `/assets/${jsFile}`,
    cssPath: `/assets/${cssFile}`
  };
}

function getAllHtmlFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllHtmlFiles(filePath));
    } else if (file.endsWith('.html')) {
      results.push(filePath);
    }
  });
  return results;
}

function processHtmlFile(filePath, assets) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Skip dist/index.html
  if (filePath === path.join(distDir, 'index.html')) return;

  // Add Google fonts if missing
  if (!content.includes('fonts.googleapis.com')) {
    const fontHead = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Belanosima:wght@400;600;700&family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&family=PT+Serif:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
`;
    content = content.replace('</head>', `${fontHead}</head>`);
  }

  // Inject CSS bundle if not present
  if (!content.includes(assets.cssPath)) {
    const cssTag = `  <link rel="stylesheet" crossorigin href="${assets.cssPath}">\n`;
    content = content.replace('</head>', `${cssTag}</head>`);
  }

  // Inject React App mount container <div id="root"></div> and JS bundle script tag
  if (!content.includes(assets.jsPath)) {
    if (!content.includes('<div id="root"></div>')) {
      const bodyInnerMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyInnerMatch) {
        const bodyInner = bodyInnerMatch[1].trim();
        const hydratedBody = `<body>\n  <div id="root"></div>\n  <noscript>${bodyInner}</noscript>\n  <script type="module" crossorigin src="${assets.jsPath}"></script>\n</body>`;
        content = content.replace(/<body[^>]*>[\s\S]*?<\/body>/i, hydratedBody);
      }
    } else {
      const jsScriptTag = `\n  <script type="module" crossorigin src="${assets.jsPath}"></script>\n</body>`;
      content = content.replace(/<\/body>/i, jsScriptTag);
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

function main() {
  console.log('Running post-build SEO asset injection...');
  try {
    const assets = getBuiltAssets();
    console.log(`Found built bundle assets: JS=${assets.jsPath}, CSS=${assets.cssPath}`);

    const htmlFiles = getAllHtmlFiles(distDir);
    console.log(`Injecting React App bundle into ${htmlFiles.length - 1} static pages in dist/`);

    let updatedCount = 0;
    for (const file of htmlFiles) {
      if (file === path.join(distDir, 'index.html')) continue;
      processHtmlFile(file, assets);
      updatedCount++;
    }

    console.log(`Successfully hydrated ${updatedCount} static pages with React JS/CSS bundles!`);
  } catch (err) {
    console.error('Error during post-build SEO asset injection:', err.message);
    process.exit(1);
  }
}

main();
