import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';

const DEMO_EMAIL = 'customer.demo@majesticblazer.com';
const DEMO_PASSWORD = 'CustomerDemo2026!';
const ADMIN_EMAIL = 'admin.demo@majesticblazer.com';
const ADMIN_PASSWORD = 'MajesticAdmin2026!Secure';
const BCRYPT_ROUNDS = 12;

export async function populateDemoData() {
  console.log('--- MAJESTIC BLAZER DEMO DATA POPULATION START ---');

  // 1. Ensure Demo Customer
  let customerRes = await pool.query('SELECT id, email FROM users WHERE email = $1', [DEMO_EMAIL]);
  let customerId;
  const customerHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

  if (customerRes.rows.length === 0) {
    const insertRes = await pool.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, is_active)
       VALUES ('Demo Patron', $1, '8903238882', $2, 'customer', true)
       RETURNING id`,
      [DEMO_EMAIL, customerHash]
    );
    customerId = insertRes.rows[0].id;
    console.log(`Created demo customer with ID: ${customerId}`);
  } else {
    customerId = customerRes.rows[0].id;
    await pool.query('UPDATE users SET password_hash = $1, is_active = true WHERE id = $2', [customerHash, customerId]);
    console.log(`Updated demo customer (ID: ${customerId})`);
  }

  // 2. Ensure Demo Admin
  let adminRes = await pool.query('SELECT id, email FROM users WHERE email = $1', [ADMIN_EMAIL]);
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);
  if (adminRes.rows.length === 0) {
    await pool.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, is_active)
       VALUES ('Atelier Demo Administrator', $1, '8903238882', $2, 'admin', true)`,
      [ADMIN_EMAIL, adminHash]
    );
    console.log('Created demo admin');
  } else {
    await pool.query('UPDATE users SET password_hash = $1, role = \'admin\', is_active = true WHERE id = $2', [
      adminHash,
      adminRes.rows[0].id,
    ]);
    console.log('Updated demo admin');
  }

  // 3. Saved Addresses for Demo Customer
  await pool.query('DELETE FROM addresses WHERE user_id = $1', [customerId]);
  const addr1 = await pool.query(
    `INSERT INTO addresses (user_id, line1, line2, city, state, pincode, is_default)
     VALUES ($1, 'Penthouse 14B, Royal Palm Boulevard', 'Race Course Road', 'Coimbatore', 'Tamil Nadu', '641018', true)
     RETURNING id`,
    [customerId]
  );
  const defaultAddressId = addr1.rows[0].id;

  await pool.query(
    `INSERT INTO addresses (user_id, line1, line2, city, state, pincode, is_default)
     VALUES ($1, 'Executive Chambers, Floor 8', 'Anna Salai, Guindy', 'Chennai', 'Tamil Nadu', '600032', false)`,
    [customerId]
  );

  await pool.query(
    `INSERT INTO addresses (user_id, line1, line2, city, state, pincode, is_default)
     VALUES ($1, 'Private Villa 42, Green Glen Layout', 'Bellandur', 'Bengaluru', 'Karnataka', '560103', false)`,
    [customerId]
  );
  console.log('✓ 3 demo patron addresses created');

  // 4. Clean up any placeholder products (slug navy-velvet-blazer-*) and ensure luxury catalog
  const productsRes = await pool.query('SELECT id, name, slug, sale_price, rent_price_per_day, security_deposit FROM products WHERE is_active = true ORDER BY id ASC');
  const activeProducts = productsRes.rows;
  console.log(`Found ${activeProducts.length} active products in catalog`);

  // Ensure 1-2 variants have low stock for Admin inventory health
  const variantsRes = await pool.query('SELECT id, sku, stock_quantity, rental_stock_quantity FROM product_variants ORDER BY id ASC LIMIT 3');
  if (variantsRes.rows.length >= 2) {
    await pool.query('UPDATE product_variants SET stock_quantity = 1 WHERE id = $1', [variantsRes.rows[0].id]);
    await pool.query('UPDATE product_variants SET rental_stock_quantity = 1 WHERE id = $1', [variantsRes.rows[1].id]);
    console.log(`✓ Low-stock inventory health alert configured on variants ${variantsRes.rows[0].id} and ${variantsRes.rows[1].id}`);
  }

  // 5. Wishlists for Demo Customer
  await pool.query('DELETE FROM wishlists WHERE user_id = $1', [customerId]);
  for (let i = 0; i < Math.min(3, activeProducts.length); i++) {
    await pool.query(
      'INSERT INTO wishlists (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [customerId, activeProducts[i].id]
    );
  }
  console.log('✓ Demo patron wishlist populated');

  // 6. Clean previous demo patron records and seed Orders across past 30 days
  await pool.query("DELETE FROM payments WHERE user_id = $1 OR provider_payment_id LIKE 'pay_MB_demo_%' OR provider_payment_id LIKE 'pay_MB_rent_%'", [customerId]);
  await pool.query("DELETE FROM invoices WHERE invoice_number LIKE 'INV-2026-88%' OR invoice_number LIKE 'INV-RNT-2026-30%' OR order_id IN (SELECT id FROM orders WHERE user_id = $1) OR rental_booking_id IN (SELECT id FROM rental_bookings WHERE user_id = $1)", [customerId]);
  await pool.query('DELETE FROM orders WHERE user_id = $1', [customerId]);
  
  // Order 1: Delivered (22 days ago)
  const p1 = activeProducts[0];
  const v1 = (await pool.query('SELECT id FROM product_variants WHERE product_id = $1 LIMIT 1', [p1.id])).rows[0];
  const order1Date = new Date(Date.now() - 22 * 24 * 3600 * 1000);
  const o1Res = await pool.query(
    `INSERT INTO orders (order_number, user_id, address_id, delivery_type, shipping_address, subtotal, discount, tax, shipping, total, status, tracking_number, notes, created_at, updated_at)
     VALUES ('MB-ORD-2026-8801', $1, $2, 'delivery', 'Penthouse 14B, Royal Palm Boulevard, Race Course Road, Coimbatore, Tamil Nadu - 641018', $3, 1000.00, 0, 0, $4, 'delivered', 'BLUEDART-EXP-9923841', 'Complimentary garment bag and cedar hanger included.', $5, $5)
     RETURNING id`,
    [customerId, defaultAddressId, p1.sale_price, Number(p1.sale_price) - 1000, order1Date]
  );
  const o1Id = o1Res.rows[0].id;
  await pool.query(
    `INSERT INTO order_items (order_id, product_id, variant_id, quantity, unit_price)
     VALUES ($1, $2, $3, 1, $4)`,
    [o1Id, p1.id, v1?.id || null, p1.sale_price]
  );
  await pool.query(
    `INSERT INTO payments (order_id, user_id, provider, provider_payment_id, amount, currency, status, created_at)
     VALUES ($1, $2, 'razorpay', 'pay_MB_demo_8801', $3, 'INR', 'paid', $4)`,
    [o1Id, customerId, Number(p1.sale_price) - 1000, order1Date]
  );
  await pool.query(
    `INSERT INTO invoices (invoice_number, order_id, amount, pdf_path, invoice_data, issued_at)
     VALUES ('INV-2026-8801', $1, $2, '/invoices/INV-2026-8801.pdf', '{"type": "sale", "customer": "Demo Patron", "item": "Delivered Order"}'::jsonb, $3)`,
    [o1Id, Number(p1.sale_price) - 1000, order1Date]
  );

  // Order 2: Shipped (5 days ago)
  if (activeProducts.length > 1) {
    const p2 = activeProducts[1];
    const v2 = (await pool.query('SELECT id FROM product_variants WHERE product_id = $1 LIMIT 1', [p2.id])).rows[0];
    const order2Date = new Date(Date.now() - 5 * 24 * 3600 * 1000);
    const o2Res = await pool.query(
      `INSERT INTO orders (order_number, user_id, address_id, delivery_type, shipping_address, subtotal, discount, tax, shipping, total, status, tracking_number, notes, created_at, updated_at)
       VALUES ('MB-ORD-2026-8842', $1, $2, 'delivery', 'Penthouse 14B, Royal Palm Boulevard, Race Course Road, Coimbatore, Tamil Nadu - 641018', $3, 0, 0, 0, $3, 'shipped', 'DELHIVERY-PRM-441029', 'Handled with white-glove courier dispatch.', $4, $4)
       RETURNING id`,
      [customerId, defaultAddressId, p2.sale_price, order2Date]
    );
    const o2Id = o2Res.rows[0].id;
    await pool.query(
      `INSERT INTO order_items (order_id, product_id, variant_id, quantity, unit_price)
       VALUES ($1, $2, $3, 1, $4)`,
      [o2Id, p2.id, v2?.id || null, p2.sale_price]
    );
    await pool.query(
      `INSERT INTO payments (order_id, user_id, provider, provider_payment_id, amount, currency, status, created_at)
       VALUES ($1, $2, 'razorpay', 'pay_MB_demo_8842', $3, 'INR', 'paid', $4)`,
      [o2Id, customerId, p2.sale_price, order2Date]
    );
    await pool.query(
      `INSERT INTO invoices (invoice_number, order_id, amount, pdf_path, invoice_data, issued_at)
       VALUES ('INV-2026-8842', $1, $2, '/invoices/INV-2026-8842.pdf', '{"type": "sale", "customer": "Demo Patron", "item": "Shipped Order"}'::jsonb, $3)`,
      [o2Id, p2.sale_price, order2Date]
    );
  }

  // Order 3: Confirmed (Yesterday)
  if (activeProducts.length > 2) {
    const p3 = activeProducts[2];
    const v3 = (await pool.query('SELECT id FROM product_variants WHERE product_id = $1 LIMIT 1', [p3.id])).rows[0];
    const order3Date = new Date(Date.now() - 1 * 24 * 3600 * 1000);
    const o3Res = await pool.query(
      `INSERT INTO orders (order_number, user_id, address_id, delivery_type, shipping_address, subtotal, discount, tax, shipping, total, status, tracking_number, notes, created_at, updated_at)
       VALUES ('MB-ORD-2026-8890', $1, $2, 'pickup', 'Flagship Atelier Boutique, Sathy Road, Kurumbampalayam, Coimbatore', $3, 500.00, 0, 0, $4, 'confirmed', NULL, 'In-store bespoke fitting scheduled.', $5, $5)
       RETURNING id`,
      [customerId, defaultAddressId, p3.sale_price, Number(p3.sale_price) - 500, order3Date]
    );
    const o3Id = o3Res.rows[0].id;
    await pool.query(
      `INSERT INTO order_items (order_id, product_id, variant_id, quantity, unit_price)
       VALUES ($1, $2, $3, 1, $4)`,
      [o3Id, p3.id, v3?.id || null, p3.sale_price]
    );
    await pool.query(
      `INSERT INTO payments (order_id, user_id, provider, provider_payment_id, amount, currency, status, created_at)
       VALUES ($1, $2, 'razorpay', 'pay_MB_demo_8890', $3, 'INR', 'paid', $4)`,
      [o3Id, customerId, Number(p3.sale_price) - 500, order3Date]
    );
    await pool.query(
      `INSERT INTO invoices (invoice_number, order_id, amount, pdf_path, invoice_data, issued_at)
       VALUES ('INV-2026-8890', $1, $2, '/invoices/INV-2026-8890.pdf', '{"type": "sale", "customer": "Demo Patron", "item": "Confirmed Order"}'::jsonb, $3)`,
      [o3Id, Number(p3.sale_price) - 500, order3Date]
    );
  }
  console.log('✓ Demo patron purchase orders & invoices seeded');

  // 7. Demo Customer Rental Bookings across past 30 days
  await pool.query('DELETE FROM rental_bookings WHERE user_id = $1', [customerId]);
  const rentableProducts = activeProducts.filter(p => Number(p.rent_price_per_day) > 0);

  if (rentableProducts.length > 0) {
    const rp1 = rentableProducts[0];
    const rv1 = (await pool.query('SELECT id FROM product_variants WHERE product_id = $1 LIMIT 1', [rp1.id])).rows[0];
    
    // Booking 1: Returned (completed past rental, 15 days ago)
    const rent1Start = new Date(Date.now() - 18 * 24 * 3600 * 1000).toISOString().split('T')[0];
    const rent1End = new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString().split('T')[0];
    const r1Res = await pool.query(
      `INSERT INTO rental_bookings (booking_number, user_id, product_id, variant_id, start_date, end_date, rental_days, rent_amount, deposit_amount, delivery_type, status, returned_at, return_condition, deposit_refund_status, deposit_refunded_amount, notes, created_at)
       VALUES ('MB-RNT-2026-3011', $1, $2, $3, $4, $5, 3, $6, $7, 'pickup', 'returned', CURRENT_TIMESTAMP - INTERVAL '15 days', 'Pristine condition — inspected and dry-cleaned.', 'refunded', $7, 'Gala event in Chennai.', CURRENT_TIMESTAMP - INTERVAL '20 days')
       RETURNING id`,
      [customerId, rp1.id, rv1?.id || null, rent1Start, rent1End, Number(rp1.rent_price_per_day) * 3, rp1.security_deposit || 5000]
    );
    const r1Id = r1Res.rows[0].id;
    await pool.query(
      `INSERT INTO payments (rental_booking_id, user_id, provider, provider_payment_id, amount, currency, status, created_at)
       VALUES ($1, $2, 'razorpay', 'pay_MB_rent_3011', $3, 'INR', 'paid', CURRENT_TIMESTAMP - INTERVAL '20 days')`,
      [r1Id, customerId, Number(rp1.rent_price_per_day) * 3 + Number(rp1.security_deposit || 5000)]
    );
    await pool.query(
      `INSERT INTO invoices (invoice_number, rental_booking_id, amount, pdf_path, invoice_data, issued_at)
       VALUES ('INV-RNT-2026-3011', $1, $2, '/invoices/INV-RNT-2026-3011.pdf', '{"type": "rental", "customer": "Demo Patron", "status": "returned"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '20 days')`,
      [r1Id, Number(rp1.rent_price_per_day) * 3]
    );

    // Booking 2: Active / Picked Up (current rental)
    if (rentableProducts.length > 1) {
      const rp2 = rentableProducts[1];
      const rv2 = (await pool.query('SELECT id FROM product_variants WHERE product_id = $1 LIMIT 1', [rp2.id])).rows[0];
      const rent2Start = new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString().split('T')[0];
      const rent2End = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().split('T')[0];
      const r2Res = await pool.query(
        `INSERT INTO rental_bookings (booking_number, user_id, product_id, variant_id, start_date, end_date, rental_days, rent_amount, deposit_amount, delivery_type, status, returned_at, return_condition, deposit_refund_status, deposit_refunded_amount, notes, created_at)
         VALUES ('MB-RNT-2026-3045', $1, $2, $3, $4, $5, 3, $6, $7, 'delivery', 'picked_up', NULL, NULL, 'pending', 0, 'High-profile award ceremony.', CURRENT_TIMESTAMP - INTERVAL '3 days')
         RETURNING id`,
        [customerId, rp2.id, rv2?.id || null, rent2Start, rent2End, Number(rp2.rent_price_per_day) * 3, rp2.security_deposit || 6000]
      );
      const r2Id = r2Res.rows[0].id;
      await pool.query(
        `INSERT INTO payments (rental_booking_id, user_id, provider, provider_payment_id, amount, currency, status, created_at)
         VALUES ($1, $2, 'razorpay', 'pay_MB_rent_3045', $3, 'INR', 'paid', CURRENT_TIMESTAMP - INTERVAL '3 days')`,
        [r2Id, customerId, Number(rp2.rent_price_per_day) * 3 + Number(rp2.security_deposit || 6000)]
      );
      await pool.query(
        `INSERT INTO invoices (invoice_number, rental_booking_id, amount, pdf_path, invoice_data, issued_at)
         VALUES ('INV-RNT-2026-3045', $1, $2, '/invoices/INV-RNT-2026-3045.pdf', '{"type": "rental", "customer": "Demo Patron", "status": "active"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '3 days')`,
        [r2Id, Number(rp2.rent_price_per_day) * 3]
      );
    }
    console.log('✓ Demo patron rental bookings & invoices seeded');
  }

  // 8. Product Reviews by Demo Patron
  await pool.query('DELETE FROM reviews WHERE user_id = $1', [customerId]);
  if (activeProducts.length > 0) {
    await pool.query(
      `INSERT INTO reviews (user_id, product_id, rating, title, comment, is_approved)
       VALUES ($1, $2, 5, 'Exceptional Canvassing & Structure', 'The drape and hand-stitched peak lapels are equal to Savile Row craftsmanship. Wore this to an annual business summit and received non-stop accolades.', true)`,
      [customerId, activeProducts[0].id]
    );
  }
  if (activeProducts.length > 1) {
    await pool.query(
      `INSERT INTO reviews (user_id, product_id, rating, title, comment, is_approved)
       VALUES ($1, $2, 5, 'Masterpiece Velvet Finish', 'Unbelievable depth of color under low evening lighting. The Bemberg silk lining ensures supreme comfort all night long.', true)`,
      [customerId, activeProducts[1].id]
    );
  }
  console.log('✓ Demo patron reviews seeded');

  // 9. Coupons (Valid & Active)
  const coupons = [
    { code: 'MAJESTIC10', type: 'percentage', value: 10, minOrder: 5000, maxDiscount: 2000 },
    { code: 'LUXURY500', type: 'fixed', value: 500, minOrder: 3000, maxDiscount: 500 },
    { code: 'ROYALRENT', type: 'percentage', value: 15, minOrder: 2000, maxDiscount: 1500 },
    { code: 'WELCOME10', type: 'percentage', value: 10, minOrder: 0, maxDiscount: 1000 },
  ];
  for (const c of coupons) {
    await pool.query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_value, max_discount, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (code) DO UPDATE SET
         discount_type = EXCLUDED.discount_type,
         discount_value = EXCLUDED.discount_value,
         min_order_value = EXCLUDED.min_order_value,
         max_discount = EXCLUDED.max_discount,
         is_active = true`,
      [c.code, c.type, c.value, c.minOrder, c.maxDiscount]
    );
  }
  console.log('✓ Luxury coupon codes seeded (MAJESTIC10, LUXURY500, ROYALRENT, WELCOME10)');

  // 10. Contact Enquiries
  const sampleEnquiries = [
    { name: 'Dr. Siddharth Menon', email: 'siddharth.menon@hospital.org', phone: '9840123891', subject: 'Custom Wedding Tuxedo Consultation', message: 'Looking for a bespoke double-breasted tuxedo with satin lapels for a wedding in Ooty next month.', status: 'new' },
    { name: 'Vikram Aditya', email: 'vikram.aditya@techcorp.in', phone: '9789012345', subject: 'Corporate Executive Blazers for Board Members', message: 'Interested in fitting 6 senior executives for our upcoming global investor summit.', status: 'replied', reply: 'Senior master tailor dispatched for executive measurements.' },
    { name: 'Karthik Raja', email: 'karthik.raja@designhouse.com', phone: '9443123890', subject: 'Rental Extension Inquiry', message: 'May I extend my rental of the Royal Navy Velvet Blazer by two additional days?', status: 'read' },
  ];
  for (const enq of sampleEnquiries) {
    await pool.query(
      `INSERT INTO contact_enquiries (name, email, phone, subject, message, status, reply_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [enq.name, enq.email, enq.phone, enq.subject, enq.message, enq.status, enq.reply || null]
    );
  }
  console.log('✓ Bespoke contact enquiries seeded');

  console.log('--- MAJESTIC BLAZER DEMO DATA POPULATION COMPLETED SUCCESSFULLY ---');
}

// Execute directly if run via CLI
if (process.argv[1]?.endsWith('populateDemoData.js')) {
  populateDemoData()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Population error:', err);
      await pool.end();
      process.exit(1);
    });
}
