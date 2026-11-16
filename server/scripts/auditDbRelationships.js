import { pool } from '../src/config/db.js';
import * as Analytics from '../src/models/analyticsModel.js';

async function auditDatabaseAndRelationships() {
  console.log('=====================================================');
  console.log('STEP 1: DATABASE & DUMMY DATA INTEGRITY AUDIT');
  console.log('=====================================================\n');

  // 1. Table Counts
  const tables = [
    'categories',
    'products',
    'product_variants',
    'product_images',
    'users',
    'addresses',
    'orders',
    'order_items',
    'rental_bookings',
    'payments',
    'coupons',
    'reviews',
    'invoices',
  ];

  console.log('--- Table Record Counts in Aiven PostgreSQL ---');
  const counts = {};
  for (const t of tables) {
    const res = await pool.query(`SELECT COUNT(*) AS c FROM ${t}`);
    counts[t] = Number(res.rows[0].c);
    console.log(`• ${t.padEnd(20)}: ${counts[t]} rows`);
  }

  // 2. Relational Integrity Checks (Foreign Key & Orphan checks)
  console.log('\n--- Relational Integrity & Orphan Checks ---');
  const orphanChecks = [
    {
      name: 'Order Items without valid Order',
      query: 'SELECT COUNT(*) AS c FROM order_items oi LEFT JOIN orders o ON o.id = oi.order_id WHERE o.id IS NULL',
    },
    {
      name: 'Order Items without valid Product',
      query: 'SELECT COUNT(*) AS c FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE p.id IS NULL',
    },
    {
      name: 'Orders without valid User/Patron',
      query: 'SELECT COUNT(*) AS c FROM orders o LEFT JOIN users u ON u.id = o.user_id WHERE u.id IS NULL',
    },
    {
      name: 'Rental Bookings without valid User/Patron',
      query: 'SELECT COUNT(*) AS c FROM rental_bookings rb LEFT JOIN users u ON u.id = rb.user_id WHERE u.id IS NULL',
    },
    {
      name: 'Rental Bookings without valid Product',
      query: 'SELECT COUNT(*) AS c FROM rental_bookings rb LEFT JOIN products p ON p.id = rb.product_id WHERE p.id IS NULL',
    },
    {
      name: 'Payments without valid Order or Rental',
      query: 'SELECT COUNT(*) AS c FROM payments p WHERE p.order_id IS NULL AND p.rental_booking_id IS NULL',
    },
    {
      name: 'Invoices without valid Order or Rental',
      query: 'SELECT COUNT(*) AS c FROM invoices i WHERE i.order_id IS NULL AND i.rental_booking_id IS NULL',
    },
    {
      name: 'Product Variants without valid Product',
      query: 'SELECT COUNT(*) AS c FROM product_variants pv LEFT JOIN products p ON p.id = pv.product_id WHERE p.id IS NULL',
    },
    {
      name: 'Reviews without valid User or Product',
      query: 'SELECT COUNT(*) AS c FROM reviews r LEFT JOIN users u ON u.id = r.user_id LEFT JOIN products p ON p.id = r.product_id WHERE u.id IS NULL OR p.id IS NULL',
    },
  ];

  let orphanErrors = 0;
  for (const check of orphanChecks) {
    const res = await pool.query(check.query);
    const count = Number(res.rows[0].c);
    if (count === 0) {
      console.log(`✓ [ZERO ORPHANS] ${check.name}: 0`);
    } else {
      console.error(`✗ [ORPHANS FOUND] ${check.name}: ${count}`);
      orphanErrors++;
    }
  }

  // 3. Compare Live Dashboard Totals with Direct DB Aggregations
  console.log('\n--- Live Dashboard Totals vs. Direct DB Queries ---');
  const overview = await Analytics.getOverview();

  // Direct SQL calculations:
  const directSales = await pool.query("SELECT COALESCE(SUM(total), 0) AS rev FROM orders WHERE status != 'cancelled'");
  const directRentals = await pool.query("SELECT COALESCE(SUM(rent_amount), 0) AS rev FROM rental_bookings WHERE status != 'cancelled'");
  const directOrders = await pool.query('SELECT COUNT(*) AS cnt FROM orders');
  const directRentalsCount = await pool.query('SELECT COUNT(*) AS cnt FROM rental_bookings');
  const directCustomers = await pool.query("SELECT COUNT(*) AS cnt FROM users WHERE role = 'customer'");
  const directProducts = await pool.query('SELECT COUNT(*) AS cnt FROM products');

  const expectedSalesRev = Number(directSales.rows[0].rev);
  const expectedRentRev = Number(directRentals.rows[0].rev);
  const expectedTotalRev = expectedSalesRev + expectedRentRev;
  const expectedOrders = Number(directOrders.rows[0].cnt);
  const expectedRentals = Number(directRentalsCount.rows[0].cnt);
  const expectedCustomers = Number(directCustomers.rows[0].cnt);
  const expectedProducts = Number(directProducts.rows[0].cnt);

  const formatINR = (n) => `₹${n.toLocaleString('en-IN')}`;

  console.log(`• Gross Revenue   : DB = ${formatINR(expectedTotalRev)} | Analytics API = ${formatINR(overview.total_revenue)} -> ${expectedTotalRev === overview.total_revenue ? 'MATCH ✓' : 'MISMATCH ✗'}`);
  console.log(`• Sales Revenue   : DB = ${formatINR(expectedSalesRev)} | Analytics API = ${formatINR(overview.sales_revenue)} -> ${expectedSalesRev === overview.sales_revenue ? 'MATCH ✓' : 'MISMATCH ✗'}`);
  console.log(`• Rental Revenue  : DB = ${formatINR(expectedRentRev)} | Analytics API = ${formatINR(overview.rental_revenue)} -> ${expectedRentRev === overview.rental_revenue ? 'MATCH ✓' : 'MISMATCH ✗'}`);
  console.log(`• Total Orders    : DB = ${expectedOrders} | Analytics API = ${overview.total_orders} -> ${expectedOrders === overview.total_orders ? 'MATCH ✓' : 'MISMATCH ✗'}`);
  console.log(`• Total Rentals   : DB = ${expectedRentals} | Analytics API = ${overview.total_rentals} -> ${expectedRentals === overview.total_rentals ? 'MATCH ✓' : 'MISMATCH ✗'}`);
  console.log(`• Total Customers : DB = ${expectedCustomers} | Analytics API = ${overview.total_customers} -> ${expectedCustomers === overview.total_customers ? 'MATCH ✓' : 'MISMATCH ✗'}`);
  console.log(`• Total Products  : DB = ${expectedProducts} | Analytics API = ${overview.total_products} -> ${expectedProducts === overview.total_products ? 'MATCH ✓' : 'MISMATCH ✗'}`);

  // 4. Canonical Categories Check
  console.log('\n--- Canonical Categories Verification ---');
  const expectedSlugs = [
    'formal-blazers',
    'casual-blazers',
    'wedding-blazers',
    'partywear-blazers',
    'premium-blazers',
    'business-blazers',
  ];
  const { rows: dbCategories } = await pool.query('SELECT name, slug FROM categories ORDER BY sort_order');
  const foundSlugs = dbCategories.map((c) => c.slug);
  const allMatch = expectedSlugs.every((s) => foundSlugs.includes(s)) && dbCategories.length === 6;
  console.log(`• Found ${dbCategories.length} categories: ${foundSlugs.join(', ')}`);
  console.log(`• Matches canonical 6 exactly: ${allMatch ? 'YES ✓' : 'NO ✗'}`);

  await pool.end();
}

auditDatabaseAndRelationships().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
