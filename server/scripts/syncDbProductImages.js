import { pool } from '../src/config/db.js';

async function syncProductImages() {
  const client = await pool.connect();
  try {
    console.log('Connecting to PostgreSQL database to sync product images...');
    const productsRes = await client.query('SELECT id, name, slug FROM products ORDER BY id ASC');
    console.log(`Found ${productsRes.rows.length} products in DB:`);
    for (const p of productsRes.rows) {
      console.log(` - ID ${p.id}: ${p.name} (${p.slug})`);
    }

    // Mapping based on slug
    const imageMap = {
      'imperial-royal-navy-velvet-peak-lapel-blazer': [
        { url: '/assets/products/imperial-navy-velvet-front.webp', alt: 'Imperial Navy Velvet Blazer Front', is_primary: true, sort_order: 0 },
        { url: '/assets/products/imperial-navy-velvet-detail.webp', alt: 'Imperial Navy Velvet Lapel & Pocket Detail', is_primary: false, sort_order: 1 }
      ],
      'regal-midnight-black-satin-shawl-collar-tuxedo': [
        { url: '/assets/products/regal-black-tuxedo-front.webp', alt: 'Regal Black Satin Shawl Collar Tuxedo Front', is_primary: true, sort_order: 0 },
        { url: '/assets/products/regal-black-tuxedo-detail.webp', alt: 'Regal Black Satin Lapel & Cuff Detail', is_primary: false, sort_order: 1 }
      ],
      'sovereign-charcoal-grey-glen-check-executive-blazer': [
        { url: '/assets/products/sovereign-charcoal-check-front.webp', alt: 'Sovereign Charcoal Glen Check Blazer Front', is_primary: true, sort_order: 0 },
        { url: '/assets/products/sovereign-charcoal-check-detail.webp', alt: 'Sovereign Charcoal Weave & Horn Button Detail', is_primary: false, sort_order: 1 }
      ],
      'monarch-burgundy-gold-brocade-bandhgala-blazer': [
        { url: '/assets/products/monarch-burgundy-bandhgala-front.webp', alt: 'Monarch Burgundy Brocade Bandhgala Front', is_primary: true, sort_order: 0 },
        { url: '/assets/products/monarch-burgundy-bandhgala-detail.webp', alt: 'Monarch Burgundy Gold Zari Brocade Detail', is_primary: false, sort_order: 1 }
      ],
      'ascot-sand-tan-breathable-linen-silk-unstructured-blazer': [
        { url: '/assets/products/ascot-sand-tan-linen-front.webp', alt: 'Ascot Sand Tan Linen-Silk Blazer Front', is_primary: true, sort_order: 0 },
        { url: '/assets/products/ascot-sand-tan-linen-detail.webp', alt: 'Ascot Sand Tan Breathable Linen Texture Detail', is_primary: false, sort_order: 1 }
      ],
      'crown-classic-double-breasted-oxford-navy-blazer': [
        { url: '/assets/products/crown-oxford-double-breasted-front.webp', alt: 'Crown Classic Oxford Navy Double-Breasted Blazer Front', is_primary: true, sort_order: 0 },
        { url: '/assets/products/crown-oxford-double-breasted-detail.webp', alt: 'Crown Crest Button & Peaked Lapel Detail', is_primary: false, sort_order: 1 }
      ]
    };

    // Generic fallbacks for any test products (e.g. test product 1 & 2)
    const fallbackImages = [
      { url: '/assets/products/imperial-navy-velvet-front.webp', alt: 'Majestic Blazer Signature Collection Front', is_primary: true, sort_order: 0 },
      { url: '/assets/products/imperial-navy-velvet-detail.webp', alt: 'Majestic Blazer Tailoring Detail', is_primary: false, sort_order: 1 }
    ];

    await client.query('BEGIN');

    for (const p of productsRes.rows) {
      const images = imageMap[p.slug] || fallbackImages;
      // Delete existing placeholder / dummy records
      await client.query('DELETE FROM product_images WHERE product_id = $1', [p.id]);

      for (const img of images) {
        await client.query(
          'INSERT INTO product_images (product_id, url, alt_text, is_primary, sort_order) VALUES ($1, $2, $3, $4, $5)',
          [p.id, img.url, img.alt, img.is_primary, img.sort_order]
        );
      }
      console.log(`✓ Updated images for product ${p.id} (${p.slug})`);
    }

    await client.query('COMMIT');
    console.log('✓ Successfully synchronized all product images in PostgreSQL!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error synchronizing product images:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

syncProductImages().catch(console.error);
