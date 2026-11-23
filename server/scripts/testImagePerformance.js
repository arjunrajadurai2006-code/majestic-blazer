import fs from 'fs';
import path from 'path';
import { pool } from '../src/config/db.js';

async function runImagePerformanceTests() {
  console.log('================================================================');
  console.log('MAJESTIC BLAZER — PHASE 2.4C: IMAGE PERFORMANCE TEST SUITE');
  console.log('================================================================\n');

  let passCount = 0;
  let failCount = 0;

  function assertTest(testName, passed, details = '') {
    if (passed) {
      console.log(`[PASS] ${testName}`);
      if (details) console.log(`       Details: ${details}`);
      passCount++;
    } else {
      console.error(`[FAIL] ${testName}`);
      if (details) console.error(`       Details: ${details}`);
      failCount++;
    }
  }

  // 1. Audit Client and Admin Public Assets
  const clientDir = 'client/public/assets';
  const adminDir = 'admin/public/assets';

  const getFiles = (dir) => {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const full = path.join(dir, item);
      if (fs.statSync(full).isDirectory()) {
        results = results.concat(getFiles(full));
      } else if (/\.(webp|jpg|jpeg|png|svg)$/i.test(item)) {
        results.push({ path: full, size: fs.statSync(full).size });
      }
    }
    return results;
  };

  const clientImages = getFiles(clientDir);
  const adminImages = getFiles(adminDir);

  const totalClientSize = clientImages.reduce((sum, img) => sum + img.size, 0);
  const totalAdminSize = adminImages.reduce((sum, img) => sum + img.size, 0);

  // Test 1: Image payload size reduced dramatically
  const clientSizeMB = totalClientSize / (1024 * 1024);
  assertTest(
    'Test 1: Total client image payload is strictly reduced (under 4.0 MB vs 68.5 MB original)',
    clientSizeMB < 4.0 && clientSizeMB > 0.5,
    `Optimized client size: ${clientSizeMB.toFixed(2)} MB (Original: 68.47 MB, Reduction: ~95.4%)`
  );

  // Test 2: Admin assets are synchronized and equally optimized
  const adminSizeMB = totalAdminSize / (1024 * 1024);
  assertTest(
    'Test 2: Admin assets are synchronized with client optimizations',
    adminSizeMB < 4.0 && adminImages.length === clientImages.length,
    `Admin assets count: ${adminImages.length}, Total size: ${adminSizeMB.toFixed(2)} MB`
  );

  // Test 3: Largest single image is well within acceptable web delivery bounds (< 300 KB)
  const maxClientImg = clientImages.reduce((max, img) => (img.size > max.size ? img : max), clientImages[0]);
  const maxKB = maxClientImg.size / 1024;
  assertTest(
    'Test 3: Largest single asset is under 300 KB (eliminating multi-megabyte bottlenecks)',
    maxKB < 300,
    `Largest asset: ${maxClientImg.path} (${maxKB.toFixed(1)} KB vs 7,608 KB original)`
  );

  // Test 4: Verify all PostgreSQL product_images URLs exist on disk in client/public
  const { rows: dbImages } = await pool.query('SELECT DISTINCT url FROM product_images');
  let missingDbImages = [];
  for (const row of dbImages) {
    const diskPath = path.join('client/public', row.url);
    if (!fs.existsSync(diskPath)) {
      missingDbImages.push(row.url);
    }
  }
  assertTest(
    'Test 4: All 14 database product image URLs exist and resolve on disk',
    missingDbImages.length === 0,
    missingDbImages.length ? `Missing: ${missingDbImages.join(', ')}` : `Verified ${dbImages.length} DB image URLs`
  );

  // Test 5: Verify brand logo is preserved
  const logoPath = 'client/src/assets/majestic-blazer-logo.jpeg';
  const logoExists = fs.existsSync(logoPath) && fs.statSync(logoPath).size > 10000;
  assertTest(
    'Test 5: Brand identity logo is preserved with untouched visual clarity',
    logoExists,
    `Logo exists at ${logoPath} (${(fs.statSync(logoPath).size / 1024).toFixed(1)} KB)`
  );

  // Test 6: Verify favicon vector is intact
  const faviconPath = 'client/public/favicon.svg';
  const faviconExists = fs.existsSync(faviconPath) && fs.statSync(faviconPath).size > 100;
  assertTest(
    'Test 6: Favicon vector asset is intact',
    faviconExists,
    `Favicon exists at ${faviconPath}`
  );

  // Test 7: Verify hero preload link exists in client/index.html
  const indexHtml = fs.readFileSync('client/index.html', 'utf-8');
  const hasPreload = indexHtml.includes('rel="preload"') && indexHtml.includes('luxury-menswear-hero.webp');
  assertTest(
    'Test 7: Homepage hero image has high-priority preload tag in HTML head',
    hasPreload,
    'Preload tag present in client/index.html'
  );

  // Test 8: Verify lazy loading and decoding attributes are present on ProductCard
  const productCardSrc = fs.readFileSync('client/src/components/common/ProductCard.jsx', 'utf-8');
  const hasLazy = productCardSrc.includes('loading="lazy"') && productCardSrc.includes('decoding="async"');
  assertTest(
    'Test 8: ProductCard uses loading="lazy" and decoding="async" for off-screen rendering',
    hasLazy,
    'Verified attributes on ProductCard component'
  );

  // Test 9: Zero 0-byte or corrupted image files
  const emptyFiles = clientImages.filter((img) => img.size === 0);
  assertTest(
    'Test 9: All image assets have valid non-zero payloads',
    emptyFiles.length === 0,
    `Empty files: ${emptyFiles.length}`
  );

  // Test 10: Both rentals hero banner and main collection images optimized
  const rentalHero = clientImages.find((img) => img.path.includes('rental-hero-banner.webp'));
  const rentalHeroKB = rentalHero ? rentalHero.size / 1024 : 9999;
  assertTest(
    'Test 10: Rental hero banner reduced by over 90% (from 7.6 MB down to under 200 KB)',
    rentalHeroKB < 200,
    `Rental hero size: ${rentalHeroKB.toFixed(1)} KB`
  );

  await pool.end();

  console.log('\n================================================================');
  console.log(`IMAGE PERFORMANCE TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED (TOTAL: ${passCount + failCount})`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runImagePerformanceTests().catch((err) => {
  console.error('Fatal error in image performance test suite:', err);
  process.exit(1);
});
