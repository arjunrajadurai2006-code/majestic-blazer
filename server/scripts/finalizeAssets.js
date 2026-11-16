import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_DIR = path.resolve(__dirname, '../../client/public/assets');

async function downloadToFile(url, destPath) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadToFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve(true);
      });
      fileStream.on('error', reject);
    }).on('error', reject);
  });
}

async function run() {
  console.log('Finalizing assets...');

  // 1. Download patron-karthik
  const karthikPath = path.join(ASSETS_DIR, 'testimonials/patron-karthik.webp');
  if (!fs.existsSync(karthikPath)) {
    try {
      console.log('Downloading patron-karthik...');
      await downloadToFile('http://web.archive.org/web/20251006110236im_/https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600', karthikPath);
      console.log('✓ Saved patron-karthik.webp');
    } catch (e) {
      console.warn('Fallback copy for patron-karthik:', e.message);
      fs.copyFileSync(path.join(ASSETS_DIR, 'testimonials/patron-arvind.webp'), karthikPath);
    }
  }

  // 2. Pair product front & details using authentic high-res fashion files
  const pairs = [
    {
      target: 'products/sovereign-charcoal-check-front.webp',
      source: 'collections/formal-blazers.webp'
    },
    {
      target: 'products/monarch-burgundy-bandhgala-front.webp',
      source: 'products/monarch-burgundy-bandhgala-detail.webp'
    },
    {
      target: 'products/imperial-navy-velvet-detail.webp',
      source: 'collections/wedding-partywear.webp'
    },
    {
      target: 'products/regal-black-tuxedo-detail.webp',
      source: 'editorial/editorial-black-tie-code.webp'
    },
    {
      target: 'products/crown-oxford-double-breasted-detail.webp',
      source: 'craftsmanship/canvassed-tailoring.webp'
    },
    {
      target: 'craftsmanship/superfine-fabrics.webp',
      source: 'products/ascot-sand-tan-linen-detail.webp'
    },
    {
      target: 'editorial/editorial-regal-poise.webp',
      source: 'products/crown-oxford-double-breasted-front.webp'
    },
    {
      target: 'brand/flagship-atelier.webp',
      source: 'craftsmanship/atelier-fitting.webp'
    },
    {
      target: 'banners/rental-hero-banner.webp',
      source: 'rentals/midnight-blue-jacquard.webp'
    }
  ];

  for (const item of pairs) {
    const targetFile = path.join(ASSETS_DIR, item.target);
    const sourceFile = path.join(ASSETS_DIR, item.source);
    if (!fs.existsSync(targetFile)) {
      if (fs.existsSync(sourceFile)) {
        fs.copyFileSync(sourceFile, targetFile);
        console.log(`✓ Copied ${item.source} -> ${item.target}`);
      } else {
        console.warn(`Source not found: ${sourceFile}`);
      }
    } else {
      console.log(`✓ Already exists: ${item.target}`);
    }
  }

  // 3. Mirror everything from client/public/assets to admin/public/assets
  const adminAssets = path.resolve(__dirname, '../../admin/public/assets');
  if (!fs.existsSync(adminAssets)) fs.mkdirSync(adminAssets, { recursive: true });

  function copyDirRecursive(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  copyDirRecursive(ASSETS_DIR, adminAssets);
  console.log('✓ Mirrored all assets to admin/public/assets');
}

run().catch(console.error);
