/**
 * Comprehensive Rental Feature Removal Integrity Test Suite (ESM)
 * 
 * Verifies:
 * 1. Database schema purity (rental tables, columns, enums, settings removed)
 * 2. Complete preservation of all 56 payments and 64 invoices
 * 3. 404 response on obsolete /api/rentals routes
 * 4. Purity and functionality of retail catalog, inventory, order, and invoice APIs
 */
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { pool } from '../src/config/db.js';
import app from '../src/app.js';

async function runTests() {
  console.log('====================================================');
  console.log('MAJESTIC BLAZER — RENTAL REMOVAL INTEGRITY TEST');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // Start ephemeral HTTP server for live API tests
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Database Structure Tests
    console.log('--- 1. Database Schema Purity ---');

    // 1a. Table rental_bookings
    const tableRes = await pool.query(
      `SELECT to_regclass('public.rental_bookings') as tbl;`
    );
    assert(tableRes.rows[0].tbl === null, 'Table "rental_bookings" does not exist in database');

    // 1b. Enum rental_status
    const enumRes = await pool.query(
      `SELECT typname FROM pg_type WHERE typname = 'rental_status';`
    );
    assert(enumRes.rows.length === 0, 'ENUM type "rental_status" does not exist in database');

    // 1c. Products columns
    const prodCols = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'products' 
         AND column_name IN ('is_rentable', 'rent_price_per_day', 'security_deposit');`
    );
    assert(prodCols.rows.length === 0, 'Rental columns removed from "products" table (is_rentable, rent_price_per_day, security_deposit)');

    // 1d. Product variants columns
    const varCols = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'product_variants' 
         AND column_name = 'rental_stock_quantity';`
    );
    assert(varCols.rows.length === 0, 'Rental column removed from "product_variants" table (rental_stock_quantity)');

    // 1e. Payments columns
    const payCols = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'payments' 
         AND column_name = 'rental_booking_id';`
    );
    assert(payCols.rows.length === 0, 'Rental column removed from "payments" table (rental_booking_id)');

    // 1f. Invoices columns
    const invCols = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'invoices' 
         AND column_name = 'rental_booking_id';`
    );
    assert(invCols.rows.length === 0, 'Rental column removed from "invoices" table (rental_booking_id)');

    // 1g. Settings keys
    const setRes = await pool.query(
      `SELECT key FROM settings WHERE key LIKE '%rental%';`
    );
    assert(setRes.rows.length === 0, 'Zero rental settings keys in "settings" table');

    // 2. Data Preservation Tests
    console.log('\n--- 2. Retail Financial & Data Preservation ---');

    // 2a. Payments count preserved
    const payCount = await pool.query(`SELECT COUNT(*)::int as count FROM payments;`);
    assert(payCount.rows[0].count >= 56, `Payments count preserved without loss (baseline: 56, current: ${payCount.rows[0].count})`);

    // 2b. Invoices count preserved
    const invCount = await pool.query(`SELECT COUNT(*)::int as count FROM invoices;`);
    assert(invCount.rows[0].count >= 64, `Invoices count preserved without loss (baseline: 64, current: ${invCount.rows[0].count})`);

    // 2c. Users count
    const userCount = await pool.query(`SELECT COUNT(*)::int as count FROM users;`);
    assert(userCount.rows[0].count >= 160, `Users count preserved (${userCount.rows[0].count} users)`);

    // 2d. Products count
    const prodCount = await pool.query(`SELECT COUNT(*)::int as count FROM products;`);
    assert(prodCount.rows[0].count >= 40, `Products count preserved (${prodCount.rows[0].count} products)`);

    // 2e. Variants count
    const varCount = await pool.query(`SELECT COUNT(*)::int as count FROM product_variants;`);
    assert(varCount.rows[0].count >= 170, `Variants count preserved (${varCount.rows[0].count} variants)`);

    // 3. API Purity Tests
    console.log('\n--- 3. API Contract & Security ---');

    // 3a. Obsolete rentals endpoint returns 404
    const rentCheckRes = await fetch(`${baseUrl}/api/rentals/check`);
    assert(rentCheckRes.status === 404, `/api/rentals/check returns 404 (status: ${rentCheckRes.status})`);

    const rentCreateRes = await fetch(`${baseUrl}/api/rentals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert(rentCreateRes.status === 404, `/api/rentals POST returns 404 (status: ${rentCreateRes.status})`);

    // 3b. Products listing works cleanly
    const prodApiRes = await fetch(`${baseUrl}/api/products?limit=5`);
    assert(prodApiRes.status === 200, `/api/products returns 200 (status: ${prodApiRes.status})`);
    const prodJson = await prodApiRes.json();
    assert(Array.isArray(prodJson.data), 'Products API returns data array');
    if (prodJson.data.length > 0) {
      const first = prodJson.data[0];
      assert(first.is_rentable === undefined, 'Product object has no "is_rentable" property');
      assert(first.rent_price_per_day === undefined, 'Product object has no "rent_price_per_day" property');
      assert(first.security_deposit === undefined, 'Product object has no "security_deposit" property');
    }

    // 3c. Protected retail endpoints enforce auth
    const orderAuthRes = await fetch(`${baseUrl}/api/orders/mine`);
    assert(orderAuthRes.status === 401, `/api/orders/mine requires authentication (status: ${orderAuthRes.status})`);

    const invAuthRes = await fetch(`${baseUrl}/api/invoices/all`);
    assert(invAuthRes.status === 401, `/api/invoices/all requires admin auth (status: ${invAuthRes.status})`);

    console.log('\n====================================================');
    console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('====================================================\n');

    server.close();
    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution error:', err);
    server.close();
    await pool.end();
    process.exit(1);
  }
}

runTests();
