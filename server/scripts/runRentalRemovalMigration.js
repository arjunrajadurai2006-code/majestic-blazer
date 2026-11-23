import fs from 'fs';
import path from 'path';
import { pool } from '../src/config/db.js';

async function runMigration() {
  console.log('================================================================');
  console.log('MAJESTIC BLAZER — DATABASE RENTAL REMOVAL MIGRATION RUNNER');
  console.log('================================================================\n');

  const migrationSqlPath = path.resolve('database/migrations/20261122_remove_rental_feature.sql');
  const sql = fs.readFileSync(migrationSqlPath, 'utf8');

  console.log('Acquiring dedicated database client for transactional migration...');
  const client = await pool.connect();
  const startTime = Date.now();

  try {
    console.log('Executing migration script within transaction...');
    await client.query(sql);
    console.log(`✓ Migration executed successfully in ${Date.now() - startTime}ms\n`);
  } catch (err) {
    console.error('✖ Migration failed! Rolling back...', err);
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    process.exit(1);
  } finally {
    client.release();
  }

  console.log('--- POST-MIGRATION INTEGRITY VERIFICATION ---');

  // 1. Verify payments row count remains exactly 56
  const { rows: payRows } = await pool.query('SELECT count(*)::int AS count FROM payments');
  console.log(`  Payments count: ${payRows[0].count} (Expected: 56)`);
  if (payRows[0].count !== 56) {
    console.error('✖ CRITICAL: Payments count altered!');
    process.exit(1);
  }

  // 2. Verify invoices row count remains exactly 64
  const { rows: invRows } = await pool.query('SELECT count(*)::int AS count FROM invoices');
  console.log(`  Invoices count: ${invRows[0].count} (Expected: 64)`);
  if (invRows[0].count !== 64) {
    console.error('✖ CRITICAL: Invoices count altered!');
    process.exit(1);
  }

  // 3. Verify rental_bookings table is gone
  const { rows: tableCheck } = await pool.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'rental_bookings'
  `);
  console.log(`  rental_bookings table exists: ${tableCheck.length > 0} (Expected: false)`);
  if (tableCheck.length > 0) {
    console.error('✖ rental_bookings was not dropped!');
    process.exit(1);
  }

  // 4. Verify rental_status enum is gone
  const { rows: enumCheck } = await pool.query(`
    SELECT typname FROM pg_type WHERE typname = 'rental_status'
  `);
  console.log(`  rental_status ENUM exists: ${enumCheck.length > 0} (Expected: false)`);
  if (enumCheck.length > 0) {
    console.error('✖ rental_status was not dropped!');
    process.exit(1);
  }

  // 5. Verify rental columns removed from products, product_variants, payments, invoices
  const { rows: colCheck } = await pool.query(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND (column_name IN ('is_rentable', 'rent_price_per_day', 'security_deposit', 'rental_stock_quantity', 'rental_booking_id'))
  `);
  console.log(`  Remaining rental columns: ${colCheck.length} (Expected: 0)`);
  if (colCheck.length > 0) {
    console.error('✖ Some rental columns remain:', colCheck);
    process.exit(1);
  }

  // 6. Verify rental configuration keys deleted
  const { rows: settCheck } = await pool.query(`
    SELECT count(*)::int AS count FROM store_settings 
    WHERE key IN ('rental_late_fee_per_day', 'rental_min_days', 'rental_max_days')
  `);
  console.log(`  Remaining rental store_settings keys: ${settCheck[0].count} (Expected: 0)`);

  // 7. Verify all shared retail tables retain their rows
  const targetTables = [
    'users',
    'products',
    'product_variants',
    'product_images',
    'orders',
    'order_items',
    'inventory_reservations',
    'audit_logs',
    'categories',
    'coupons',
    'reviews',
    'addresses'
  ];

  console.log('\n--- VERIFYING SHARED RETAIL TABLES ---');
  for (const t of targetTables) {
    const { rows } = await pool.query(`SELECT count(*)::int AS count FROM "${t}"`);
    console.log(`  ✓ Table "${t}": ${rows[0].count} rows intact`);
  }

  console.log('\n================================================================');
  console.log('✓ DATABASE MIGRATION COMPLETED AND 100% VERIFIED.');
  console.log('================================================================');
  process.exit(0);
}

runMigration().catch(err => {
  console.error('Migration execution failed:', err);
  process.exit(1);
});
