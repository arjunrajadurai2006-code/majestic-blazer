import { pool } from '../src/config/db.js';

async function seed() {
  console.log('Seeding Majestic Blazer database...');

  // 1. Store settings
  const settings = [
    ['store_name', 'Majestic Blazer', 'Official brand name'],
    ['brand_tagline', 'Style That Speaks', 'Official brand tagline'],
    ['store_address', 'Sathy Road, Kurumbampalayam, Coimbatore - 641107', 'Physical boutique address'],
    ['store_phone', '8903238882', 'Customer service phone number'],
    ['store_email', 'contact@majesticblazer.com', 'Store contact email'],
    ['rental_late_fee_per_day', '400', 'Daily late fee for overdue rentals in INR'],
    ['rental_min_days', '1', 'Minimum rental duration in days'],
    ['rental_max_days', '14', 'Maximum rental duration in days'],
    ['tax_percentage', '0', 'Configurable tax percentage (0 by default until business specifies GST)'],
    ['shipping_fee', '0', 'Standard shipping fee in INR (0 for complimentary delivery)'],
  ];

  for (const [key, value, description] of settings) {
    await pool.query(
      `INSERT INTO store_settings (key, value, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description`,
      [key, value, description]
    );
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, value]
    );
  }
  console.log('✓ Store settings seeded');

  // 2. Categories
  const categories = [
    {
      name: 'Formal Blazers',
      slug: 'formal-blazers',
      description: 'Sharp, commanding tailoring for corporate boardrooms and executive presence.',
      sortOrder: 1,
    },
    {
      name: 'Wedding & Partywear',
      slug: 'wedding-partywear',
      description: 'Opulent velvets, rich jacquards, and celebratory silhouettes designed to make an indelible statement.',
      sortOrder: 2,
    },
    {
      name: 'Casual & Smart Blazers',
      slug: 'casual-smart',
      description: 'Unconstructed linen, breathable wool blends, and versatile jackets for modern leisure.',
      sortOrder: 3,
    },
    {
      name: 'Tuxedos & Black Tie',
      slug: 'tuxedos-black-tie',
      description: 'Satin shawl lapels and midnight blacks crafted for galas, red carpets, and black-tie affairs.',
      sortOrder: 4,
    },
  ];

  const categoryMap = {};
  for (const cat of categories) {
    const res = await pool.query(
      `INSERT INTO categories (name, slug, description, sort_order, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, sort_order = EXCLUDED.sort_order
       RETURNING id, slug`,
      [cat.name, cat.slug, cat.description, cat.sortOrder]
    );
    categoryMap[res.rows[0].slug] = res.rows[0].id;
  }
  console.log('✓ Categories seeded');

  // 3. Products
  const products = [
    {
      categorySlug: 'wedding-partywear',
      name: 'Imperial Royal Navy Velvet Peak Lapel Blazer',
      slug: 'imperial-royal-navy-velvet-peak-lapel-blazer',
      description: 'Crafted from plush imported Italian cotton velvet, this midnight navy blazer exudes quiet sovereignty. Features hand-stitched peak lapels, silk covered buttons, and a double-vented silhouette for effortless poise.',
      color: 'Midnight Navy',
      material: '100% Cotton Italian Velvet with Silk Bemberg Lining',
      fit: 'Tailored Slim Fit',
      careInstructions: 'Dry clean only. Steam with low temperature. Store on contoured wooden hanger in dust bag.',
      isPurchasable: true,
      isRentable: true,
      isFeatured: true,
      salePrice: 14999.0,
      originalPrice: 18999.0,
      rentPricePerDay: 1799.0,
      securityDeposit: 6000.0,
      images: [
        { url: '/assets/products/imperial-navy-velvet-front.webp', alt: 'Imperial Navy Velvet Blazer Front', isPrimary: true },
        { url: '/assets/products/imperial-navy-velvet-detail.webp', alt: 'Imperial Navy Velvet Blazer Detail', isPrimary: false },
      ],
      variants: [
        { sku: 'MB-INV-38R', size: '38R', stock: 8, rentalStock: 4 },
        { sku: 'MB-INV-40R', size: '40R', stock: 10, rentalStock: 5 },
        { sku: 'MB-INV-42R', size: '42R', stock: 6, rentalStock: 3 },
        { sku: 'MB-INV-44R', size: '44R', stock: 4, rentalStock: 2 },
      ],
    },
    {
      categorySlug: 'tuxedos-black-tie',
      name: 'Regal Midnight Black Satin Shawl Collar Tuxedo',
      slug: 'regal-midnight-black-satin-shawl-collar-tuxedo',
      description: 'The definitive black-tie piece. Cut from Super 140s Australian Merino wool with an immaculate satin shawl collar. Hand-canvassed construction molds to your physique with every wearing.',
      color: 'Onyx Black',
      material: 'Super 140s Pure New Wool & Duchesse Silk Satin',
      fit: 'Classic Tailored Fit',
      careInstructions: 'Specialist dry clean only. Brush gently after wearing.',
      isPurchasable: true,
      isRentable: true,
      isFeatured: true,
      salePrice: 19499.0,
      originalPrice: 24999.0,
      rentPricePerDay: 2299.0,
      securityDeposit: 8000.0,
      images: [
        { url: '/assets/products/regal-black-tuxedo-front.webp', alt: 'Regal Black Tuxedo Front', isPrimary: true },
        { url: '/assets/products/regal-black-tuxedo-detail.webp', alt: 'Regal Black Tuxedo Cuff and Lapel', isPrimary: false },
      ],
      variants: [
        { sku: 'MB-RBT-38R', size: '38R', stock: 5, rentalStock: 3 },
        { sku: 'MB-RBT-40R', size: '40R', stock: 9, rentalStock: 4 },
        { sku: 'MB-RBT-42R', size: '42R', stock: 7, rentalStock: 3 },
        { sku: 'MB-RBT-44R', size: '44R', stock: 3, rentalStock: 2 },
      ],
    },
    {
      categorySlug: 'formal-blazers',
      name: 'Sovereign Charcoal Grey Glen Check Executive Blazer',
      slug: 'sovereign-charcoal-grey-glen-check-executive-blazer',
      description: 'Command boardroom presence. Subtle glen plaid pattern woven in Yorkshire, England. Features a notch lapel, horn buttons, and functional sleeve buttonholes.',
      color: 'Charcoal Grey Check',
      material: '100% English Worsted Wool',
      fit: 'Modern Executive Fit',
      careInstructions: 'Dry clean only. Steam between wears.',
      isPurchasable: true,
      isRentable: true,
      isFeatured: true,
      salePrice: 13499.0,
      originalPrice: 16999.0,
      rentPricePerDay: 1499.0,
      securityDeposit: 5000.0,
      images: [
        { url: '/assets/products/sovereign-charcoal-check-front.webp', alt: 'Sovereign Charcoal Grey Blazer Front', isPrimary: true },
        { url: '/assets/products/sovereign-charcoal-check-detail.webp', alt: 'Sovereign Charcoal Grey Blazer Detail', isPrimary: false },
      ],
      variants: [
        { sku: 'MB-SCG-36R', size: '36R', stock: 4, rentalStock: 2 },
        { sku: 'MB-SCG-38R', size: '38R', stock: 8, rentalStock: 4 },
        { sku: 'MB-SCG-40R', size: '40R', stock: 12, rentalStock: 6 },
        { sku: 'MB-SCG-42R', size: '42R', stock: 8, rentalStock: 4 },
        { sku: 'MB-SCG-44R', size: '44R', stock: 5, rentalStock: 2 },
      ],
    },
    {
      categorySlug: 'wedding-partywear',
      name: 'Monarch Burgundy Gold Brocade Bandhgala Blazer',
      slug: 'monarch-burgundy-gold-brocade-bandhgala-blazer',
      description: 'Rich wine burgundy fabric embroidered with intricate tone-on-tone metallic zari motifs. Finished with embossed brass crest buttons. Perfect for Sangeet, receptions, and regal galas.',
      color: 'Wine Burgundy',
      material: 'Silk Brocade Jacquard with Micro Viscose Lining',
      fit: 'Structured Heritage Fit',
      careInstructions: 'Dry clean only. Do not iron directly on zari embroidery.',
      isPurchasable: true,
      isRentable: true,
      isFeatured: true,
      salePrice: 17999.0,
      originalPrice: 22999.0,
      rentPricePerDay: 2499.0,
      securityDeposit: 7500.0,
      images: [
        { url: '/assets/products/monarch-burgundy-bandhgala-front.webp', alt: 'Monarch Burgundy Bandhgala Blazer Front', isPrimary: true },
        { url: '/assets/products/monarch-burgundy-bandhgala-detail.webp', alt: 'Monarch Burgundy Bandhgala Blazer Detail', isPrimary: false },
      ],
      variants: [
        { sku: 'MB-MBB-38R', size: '38R', stock: 6, rentalStock: 3 },
        { sku: 'MB-MBB-40R', size: '40R', stock: 8, rentalStock: 4 },
        { sku: 'MB-MBB-42R', size: '42R', stock: 6, rentalStock: 3 },
      ],
    },
    {
      categorySlug: 'casual-smart',
      name: 'Ascot Sand Tan Breathable Linen-Silk Unstructured Blazer',
      slug: 'ascot-sand-tan-breathable-linen-silk-unstructured-blazer',
      description: 'Effortless Mediterranean elegance. Soft unstructured shoulders, half-lined construction, and patch pockets create a relaxed yet undeniably sophisticated drape.',
      color: 'Sand Tan',
      material: '65% French Linen, 35% Mulberry Silk',
      fit: 'Relaxed Tailored Fit',
      careInstructions: 'Gentle dry clean or specialized linen laundry.',
      isPurchasable: true,
      isRentable: true,
      isFeatured: false,
      salePrice: 11999.0,
      originalPrice: 14500.0,
      rentPricePerDay: 1299.0,
      securityDeposit: 4000.0,
      images: [
        { url: '/assets/products/ascot-sand-tan-linen-front.webp', alt: 'Ascot Sand Tan Linen Blazer Front', isPrimary: true },
        { url: '/assets/products/ascot-sand-tan-linen-detail.webp', alt: 'Ascot Sand Tan Linen Texture Detail', isPrimary: false },
      ],
      variants: [
        { sku: 'MB-AST-38R', size: '38R', stock: 5, rentalStock: 2 },
        { sku: 'MB-AST-40R', size: '40R', stock: 7, rentalStock: 3 },
        { sku: 'MB-AST-42R', size: '42R', stock: 6, rentalStock: 3 },
      ],
    },
    {
      categorySlug: 'formal-blazers',
      name: 'Crown Classic Double-Breasted Oxford Navy Blazer',
      slug: 'crown-classic-double-breasted-oxford-navy-blazer',
      description: 'The timeless 6-on-2 double-breasted silhouette made with fine tropical wool. Finished with bespoke silver crest buttons and wide peak lapels.',
      color: 'Oxford Navy',
      material: '100% Super 120s High-Twist Wool',
      fit: 'Bespoke Double-Breasted Fit',
      careInstructions: 'Dry clean only. Steam with garment steamer.',
      isPurchasable: true,
      isRentable: true,
      isFeatured: false,
      salePrice: 15499.0,
      originalPrice: 19000.0,
      rentPricePerDay: 1699.0,
      securityDeposit: 5500.0,
      images: [
        { url: '/assets/products/crown-oxford-double-breasted-front.webp', alt: 'Crown Double-Breasted Navy Blazer Front', isPrimary: true },
        { url: '/assets/products/crown-oxford-double-breasted-detail.webp', alt: 'Crown Double-Breasted Crest & Lapel Detail', isPrimary: false },
      ],
      variants: [
        { sku: 'MB-CDB-38R', size: '38R', stock: 6, rentalStock: 3 },
        { sku: 'MB-CDB-40R', size: '40R', stock: 10, rentalStock: 5 },
        { sku: 'MB-CDB-42R', size: '42R', stock: 7, rentalStock: 4 },
      ],
    },
  ];

  for (const p of products) {
    const categoryId = categoryMap[p.categorySlug];
    const prodRes = await pool.query(
      `INSERT INTO products (
        category_id, name, slug, description, color, material, fit, care_instructions,
        is_purchasable, is_rentable, is_featured, sale_price, original_price,
        rent_price_per_day, security_deposit, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, true)
      ON CONFLICT (slug) DO UPDATE SET
        category_id = EXCLUDED.category_id,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        color = EXCLUDED.color,
        material = EXCLUDED.material,
        fit = EXCLUDED.fit,
        care_instructions = EXCLUDED.care_instructions,
        is_purchasable = EXCLUDED.is_purchasable,
        is_rentable = EXCLUDED.is_rentable,
        is_featured = EXCLUDED.is_featured,
        sale_price = EXCLUDED.sale_price,
        original_price = EXCLUDED.original_price,
        rent_price_per_day = EXCLUDED.rent_price_per_day,
        security_deposit = EXCLUDED.security_deposit
      RETURNING id`,
      [
        categoryId,
        p.name,
        p.slug,
        p.description,
        p.color,
        p.material,
        p.fit,
        p.careInstructions,
        p.isPurchasable,
        p.isRentable,
        p.isFeatured,
        p.salePrice,
        p.originalPrice,
        p.rentPricePerDay,
        p.securityDeposit,
      ]
    );
    const productId = prodRes.rows[0].id;

    // Delete existing images & variants for clean seed
    await pool.query('DELETE FROM product_images WHERE product_id = $1', [productId]);
    for (let i = 0; i < p.images.length; i++) {
      const img = p.images[i];
      await pool.query(
        `INSERT INTO product_images (product_id, url, alt_text, is_primary, sort_order)
         VALUES ($1, $2, $3, $4, $5)`,
        [productId, img.url, img.alt, img.isPrimary, i]
      );
    }

    for (const v of p.variants) {
      await pool.query(
        `INSERT INTO product_variants (product_id, sku, size, stock_quantity, rental_stock_quantity)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (product_id, size) DO UPDATE SET
           sku = EXCLUDED.sku,
           stock_quantity = EXCLUDED.stock_quantity,
           rental_stock_quantity = EXCLUDED.rental_stock_quantity`,
        [productId, v.sku, v.size, v.stock, v.rentalStock]
      );
    }
  }
  console.log('✓ Products, images and size variants seeded');

  // 4. Coupons
  const coupons = [
    { code: 'MAJESTIC10', discountType: 'percentage', discountValue: 10, minOrderValue: 4000, maxDiscount: 2500 },
    { code: 'LUXURY500', discountType: 'fixed', discountValue: 500, minOrderValue: 2000, maxDiscount: null },
    { code: 'ROYALRENT', discountType: 'percentage', discountValue: 15, minOrderValue: 1500, maxDiscount: 1000 },
  ];

  for (const c of coupons) {
    await pool.query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_value, max_discount, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (code) DO UPDATE SET
         discount_type = EXCLUDED.discount_type,
         discount_value = EXCLUDED.discount_value,
         min_order_value = EXCLUDED.min_order_value,
         max_discount = EXCLUDED.max_discount`,
      [c.code, c.discountType, c.discountValue, c.minOrderValue, c.maxDiscount]
    );
  }
  console.log('✓ Coupons seeded');

  // 5. Customer Reviews
  const reviews = [
    {
      productSlug: 'imperial-royal-navy-velvet-peak-lapel-blazer',
      rating: 5,
      title: 'Stole the spotlight at my brother’s reception',
      comment: 'Rented this for 3 days. The velvet quality is breathtaking and the fit was as if bespoke tailored. Deposit refund was seamless.',
    },
    {
      productSlug: 'regal-midnight-black-satin-shawl-collar-tuxedo',
      rating: 5,
      title: 'True luxury tailoring',
      comment: 'Purchased for an international gala. The drape of the Super 140s wool is unmatched. Coimbatore now has world-class menswear.',
    },
  ];

  // Fetch admin user or first user to attach reviews
  const usersRes = await pool.query('SELECT id FROM users LIMIT 1');
  if (usersRes.rows.length > 0) {
    const userId = usersRes.rows[0].id;
    for (const r of reviews) {
      const pRes = await pool.query('SELECT id FROM products WHERE slug = $1', [r.productSlug]);
      if (pRes.rows.length > 0) {
        await pool.query(
          `INSERT INTO reviews (user_id, product_id, rating, title, comment, is_approved)
           VALUES ($1, $2, $3, $4, $5, true)`,
          [userId, pRes.rows[0].id, r.rating, r.title, r.comment]
        );
      }
    }
    console.log('✓ Reviews seeded');
  }

  console.log('\n========================================');
  console.log('SEEDED MAJESTIC BLAZER DATA SUCCESSFULLY');
  console.log('========================================');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});

