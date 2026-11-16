import fs from 'fs';
import path from 'path';

const ASSET_SPECS = [
  // 1. Hero
  {
    category: 'hero',
    filename: 'luxury-menswear-hero.webp',
    photoId: 'photo-1507679799987-c73779587ccf',
    label: 'Majestic Blazer Hero Editorial',
    width: 1800
  },
  // 2. Collections
  {
    category: 'collections',
    filename: 'wedding-partywear.webp',
    photoId: 'photo-1594938298603-c8148c4dae35',
    label: 'Wedding & Partywear Velvet Edition',
    width: 1000
  },
  {
    category: 'collections',
    filename: 'tuxedos-black-tie.webp',
    photoId: 'photo-1598808503746-f34c53b9323e',
    label: 'Tuxedos & Black Tie Edition',
    width: 1000
  },
  {
    category: 'collections',
    filename: 'formal-blazers.webp',
    photoId: 'photo-1592878904946-b3cd8ae243d0',
    label: 'Formal & Corporate Executive Edition',
    width: 1000
  },
  {
    category: 'collections',
    filename: 'casual-smart.webp',
    photoId: 'photo-1593032465175-481ac7f401a0',
    label: 'Casual & Smart Unstructured Edition',
    width: 1000
  },
  // 3. Products
  {
    category: 'products',
    filename: 'imperial-navy-velvet-front.webp',
    photoId: 'photo-1594938298603-c8148c4dae35',
    label: 'Imperial Royal Navy Velvet Peak Lapel Blazer Front',
    width: 1200
  },
  {
    category: 'products',
    filename: 'imperial-navy-velvet-detail.webp',
    photoId: 'photo-1534030347209-467a5b0ad3e6',
    label: 'Imperial Navy Velvet Lapel & Lining Detail',
    width: 1200
  },
  {
    category: 'products',
    filename: 'regal-black-tuxedo-front.webp',
    photoId: 'photo-1598808503746-f34c53b9323e',
    label: 'Regal Midnight Black Satin Shawl Collar Tuxedo Front',
    width: 1200
  },
  {
    category: 'products',
    filename: 'regal-black-tuxedo-detail.webp',
    photoId: 'photo-1617137984095-74e4e5e3613f',
    label: 'Regal Black Tuxedo Satin Shawl Detail',
    width: 1200
  },
  {
    category: 'products',
    filename: 'sovereign-charcoal-check-front.webp',
    photoId: 'photo-1592878904946-b3cd8ae243d0',
    label: 'Sovereign Charcoal Grey Glen Check Executive Blazer Front',
    width: 1200
  },
  {
    category: 'products',
    filename: 'sovereign-charcoal-check-detail.webp',
    photoId: 'photo-1507679799987-c73779587ccf',
    label: 'Sovereign Glen Check Worsted Wool Weave Detail',
    width: 1200
  },
  {
    category: 'products',
    filename: 'monarch-burgundy-bandhgala-front.webp',
    photoId: 'photo-1585856557672-d5cb367606cb',
    label: 'Monarch Burgundy Gold Brocade Bandhgala Blazer Front',
    width: 1200
  },
  {
    category: 'products',
    filename: 'monarch-burgundy-bandhgala-detail.webp',
    photoId: 'photo-1605518216938-7c31b7b14ad0',
    label: 'Monarch Burgundy Brocade Zari Motifs Detail',
    width: 1200
  },
  {
    category: 'products',
    filename: 'ascot-sand-tan-linen-front.webp',
    photoId: 'photo-1593032465175-481ac7f401a0',
    label: 'Ascot Sand Tan Breathable Linen-Silk Unstructured Blazer Front',
    width: 1200
  },
  {
    category: 'products',
    filename: 'ascot-sand-tan-linen-detail.webp',
    photoId: 'photo-1508243529287-e21914733111',
    label: 'Ascot Sand Tan Linen Texture Detail',
    width: 1200
  },
  {
    category: 'products',
    filename: 'crown-oxford-double-breasted-front.webp',
    photoId: 'photo-1548883354-7622d03aca27',
    label: 'Crown Classic Double-Breasted Oxford Navy Blazer Front',
    width: 1200
  },
  {
    category: 'products',
    filename: 'crown-oxford-double-breasted-detail.webp',
    photoId: 'photo-1555069519-127aadedf1ee',
    label: 'Crown Double-Breasted Crest Button & Peak Lapel Detail',
    width: 1200
  },
  // 4. Rentals
  {
    category: 'rentals',
    filename: 'emerald-velvet-tuxedo.webp',
    photoId: 'photo-1516826957135-700dedea698c',
    label: 'Emerald Green Velvet Tuxedo Occasion Rental',
    width: 1200
  },
  {
    category: 'rentals',
    filename: 'midnight-blue-jacquard.webp',
    photoId: 'photo-1563630423918-b58f07336ac9',
    label: 'Midnight Blue Brocade Jacquard Occasion Rental',
    width: 1200
  },
  // 5. Craftsmanship
  {
    category: 'craftsmanship',
    filename: 'canvassed-tailoring.webp',
    photoId: 'photo-1558769132-cb1aea458c5e',
    label: 'Hand-Canvassed Floating Chest Piece Tailoring',
    width: 1000
  },
  {
    category: 'craftsmanship',
    filename: 'superfine-fabrics.webp',
    photoId: 'photo-1534030347209-467a5b0ad3e6',
    label: 'Superfine European Worsted Wool & Velvets',
    width: 1000
  },
  {
    category: 'craftsmanship',
    filename: 'atelier-fitting.webp',
    photoId: 'photo-1507679799987-c73779587ccf',
    label: 'Bespoke Atelier Fitting at Kurumbampalayam',
    width: 1000
  },
  // 6. Editorial Gallery
  {
    category: 'editorial',
    filename: 'editorial-sovereign-presence.webp',
    photoId: 'photo-1506794778202-cad84cf45f1d',
    label: 'Editorial — Sovereign Menswear Presence',
    width: 1200
  },
  {
    category: 'editorial',
    filename: 'editorial-black-tie-code.webp',
    photoId: 'photo-1519085360753-af0119f7cbe7',
    label: 'Editorial — The Black Tie Dress Code',
    width: 1200
  },
  {
    category: 'editorial',
    filename: 'editorial-regal-poise.webp',
    photoId: 'photo-1492562080023-ab3db95bfbce',
    label: 'Editorial — Regal Poise & Modern Silhouette',
    width: 1200
  },
  // 7. Testimonials
  {
    category: 'testimonials',
    filename: 'patron-karthik.webp',
    photoId: 'photo-1500648767791-00dcc994a43e',
    label: 'Karthik Subramanian — Wedding Reception Rental Patron',
    width: 600
  },
  {
    category: 'testimonials',
    filename: 'patron-arvind.webp',
    photoId: 'photo-1472099645785-5658abf4ff4e',
    label: 'Dr. Arvind Rajan — Black-Tie Purchase Patron',
    width: 600
  },
  {
    category: 'testimonials',
    filename: 'patron-vikram.webp',
    photoId: 'photo-1507003211169-0a1dd7228f2d',
    label: 'Vikram Menon — Sangeet Ceremony Rental Patron',
    width: 600
  },
  // 8. Brand & Banners
  {
    category: 'brand',
    filename: 'flagship-atelier.webp',
    photoId: 'photo-1441986300917-64674bd600d8',
    label: 'Majestic Blazer Sathy Road Boutique & Atelier',
    width: 1400
  },
  {
    category: 'banners',
    filename: 'rental-hero-banner.webp',
    photoId: 'photo-1594938298603-c8148c4dae35',
    label: 'Luxury Blazer Rental Collection Showcase Banner',
    width: 1400
  }
];

const TARGET_ROOT = path.resolve(process.cwd(), 'client/public/assets');

async function downloadPhoto(spec) {
  const destDir = path.join(TARGET_ROOT, spec.category);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const destPath = path.join(destDir, spec.filename);

  console.log(`[Processing] ${spec.category}/${spec.filename} (${spec.photoId})...`);

  // Try direct unsplash archive snapshot
  try {
    const waybackCheck = `https://archive.org/wayback/available?url=https://images.unsplash.com/${spec.photoId}`;
    const chkRes = await fetch(waybackCheck, { signal: AbortSignal.timeout(6000) });
    const chkJson = await chkRes.json();
    let downloadUrl = chkJson.archived_snapshots?.closest?.url;

    if (downloadUrl) {
      downloadUrl = downloadUrl.replace('/http', 'im_/http');
    } else {
      // Fallback: direct wayback im_ URL with year 2023
      downloadUrl = `http://web.archive.org/web/2023im_/https://images.unsplash.com/${spec.photoId}?auto=format&fit=crop&w=${spec.width}&q=80`;
    }

    const imgRes = await fetch(downloadUrl, { signal: AbortSignal.timeout(15000) });
    if (!imgRes.ok) {
      throw new Error(`HTTP ${imgRes.status} from archive: ${downloadUrl}`);
    }

    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (buf.length < 1000) {
      throw new Error(`Downloaded buffer too small (${buf.length} bytes)`);
    }

    fs.writeFileSync(destPath, buf);
    console.log(`  ✓ Saved ${spec.filename} (${buf.length} bytes)`);
    return {
      spec,
      destPath,
      size: buf.length,
      success: true,
      sourceUrl: `https://unsplash.com/photos/${spec.photoId}`,
      archiveUrl: downloadUrl
    };
  } catch (err) {
    console.warn(`  ⚠ Error downloading ${spec.photoId}: ${err.message}`);
    return {
      spec,
      success: false,
      error: err.message
    };
  }
}

async function run() {
  console.log('Starting Majestic Blazer Asset Downloader...');
  console.log(`Target directory: ${TARGET_ROOT}`);
  const report = [];

  for (const spec of ASSET_SPECS) {
    const res = await downloadPhoto(spec);
    report.push(res);
  }

  const successCount = report.filter(r => r.success).length;
  console.log(`\n========================================`);
  console.log(`COMPLETED: ${successCount} / ${ASSET_SPECS.length} images downloaded`);
  console.log(`========================================`);

  fs.writeFileSync(
    path.resolve(process.cwd(), 'download_report.json'),
    JSON.stringify(report, null, 2)
  );
}

run().catch(console.error);

