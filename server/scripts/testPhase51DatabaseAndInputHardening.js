import { pool, testConnection } from '../src/config/db.js';
import { env } from '../src/config/env.js';

const BASE_URL = 'http://localhost:5000/api';

async function runPhase51Tests() {
  console.log('=====================================================');
  console.log('MAJESTIC BLAZER — PHASE 5.1 VERIFICATION SUITE');
  console.log('Database Connection Resilience & Input Hardening');
  console.log('=====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(desc, condition) {
    total++;
    if (condition) {
      console.log(`  ✓ [PASS ${total}] ${desc}`);
      passed++;
    } else {
      console.error(`  ✖ [FAIL ${total}] ${desc}`);
    }
  }

  // =========================================================
  // 1. DATABASE CONNECTION RESILIENCE & POOL CONFIGURATION
  // =========================================================
  console.log('--- 1. DATABASE CONFIGURATION & RESILIENCE ---');

  assert(
    'Connection timeout configured to 20,000ms (increased from 10,000ms)',
    pool.options.connectionTimeoutMillis === 20000
  );

  assert(
    'Idle timeout configured to 30,000ms (tuned from 5,000ms to prevent premature TLS teardown)',
    pool.options.idleTimeoutMillis === 30000
  );

  assert(
    'Pool connection limit maintained conservatively at max: 5 (preventing quota exhaustion)',
    pool.options.max === 5
  );

  assert(
    'TCP keepalive is enabled on pool client options',
    pool.options.keepAlive === true
  );

  assert(
    'TCP keepalive initial delay is configured to 10,000ms',
    pool.options.keepAliveInitialDelayMillis === 10000
  );

  assert(
    'PostgreSQL SSL certificate verification is enabled (rejectUnauthorized: true)',
    env.db.ssl && env.db.ssl.rejectUnauthorized === true
  );

  assert(
    'PostgreSQL SSL CA certificate is loaded and non-empty',
    Boolean(env.db.ssl && env.db.ssl.ca && env.db.ssl.ca.includes('BEGIN CERTIFICATE'))
  );

  // Test live connection through pool
  try {
    const connInfo = await testConnection();
    assert(
      `Live database pool handshake succeeded against database "${connInfo.db}"`,
      Boolean(connInfo && connInfo.db && connInfo.now)
    );
  } catch (err) {
    assert(`Live database pool handshake succeeded: ${err.message}`, false);
  }

  // =========================================================
  // 2. INVENTORY ROUTE PARAMETER VALIDATION (PATCH /inventory/:id)
  // =========================================================
  console.log('\n--- 2. INVENTORY PARAMETER VALIDATION (PATCH /api/inventory/:id) ---');

  // Obtain admin and customer tokens
  const adminLoginRes = await fetch(`${BASE_URL}/auth/demo-admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const adminData = await adminLoginRes.json();
  const adminToken = adminData.data?.token;

  const customerLoginRes = await fetch(`${BASE_URL}/auth/demo-customer-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const customerData = await customerLoginRes.json();
  const customerToken = customerData.data?.token;

  if (!adminToken || !customerToken) {
    console.error('Fatal: Failed to acquire authentication tokens.');
    process.exit(1);
  }

  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`,
  };

  // Helper for PATCH requests
  async function patchInventory(idPath, body, headers = adminHeaders) {
    const res = await fetch(`${BASE_URL}/inventory/${idPath}`, {
      method: 'PATCH',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  // Test Alphabetic ID
  const alphaRes = await patchInventory('abc', { stockQuantity: 5 });
  assert(
    'Rejects alphabetic ID ("abc") with HTTP 400 Bad Request',
    alphaRes.status === 400 && alphaRes.data.message.includes('positive integer')
  );

  // Test Route Keyword ID ("adjust")
  const keywordRes = await patchInventory('adjust', { stockQuantity: 5 });
  assert(
    'Rejects route keyword ID ("adjust") with HTTP 400 Bad Request',
    keywordRes.status === 400 && keywordRes.data.message.includes('positive integer')
  );

  // Test Zero ID ("0")
  const zeroRes = await patchInventory('0', { stockQuantity: 5 });
  assert(
    'Rejects zero ID ("0") with HTTP 400 Bad Request',
    zeroRes.status === 400 && zeroRes.data.message.includes('positive integer')
  );

  // Test Negative Single Digit ID ("-1")
  const neg1Res = await patchInventory('-1', { stockQuantity: 5 });
  assert(
    'Rejects negative ID ("-1") with HTTP 400 Bad Request',
    neg1Res.status === 400 && neg1Res.data.message.includes('positive integer')
  );

  // Test Negative Multi-digit ID ("-50")
  const neg50Res = await patchInventory('-50', { stockQuantity: 5 });
  assert(
    'Rejects negative ID ("-50") with HTTP 400 Bad Request',
    neg50Res.status === 400 && neg50Res.data.message.includes('positive integer')
  );

  // Test Decimal ID ("1.5")
  const decRes = await patchInventory('1.5', { stockQuantity: 5 });
  assert(
    'Rejects decimal ID ("1.5") with HTTP 400 Bad Request',
    decRes.status === 400 && decRes.data.message.includes('positive integer')
  );

  // Test Decimal ID with zero fraction ("1.0")
  const dec0Res = await patchInventory('1.0', { stockQuantity: 5 });
  assert(
    'Rejects decimal with trailing zero ("1.0") with HTTP 400 Bad Request',
    dec0Res.status === 400 && dec0Res.data.message.includes('positive integer')
  );

  // Test Alphanumeric Malformed ID ("1a")
  const alphaNumRes = await patchInventory('1a', { stockQuantity: 5 });
  assert(
    'Rejects alphanumeric malformed ID ("1a") with HTTP 400 Bad Request',
    alphaNumRes.status === 400 && alphaNumRes.data.message.includes('positive integer')
  );

  // Test Leading Zero Malformed ID ("01")
  const leadZeroRes = await patchInventory('01', { stockQuantity: 5 });
  assert(
    'Rejects leading-zero malformed ID ("01") with HTTP 400 Bad Request',
    leadZeroRes.status === 400 && leadZeroRes.data.message.includes('positive integer')
  );

  // Test Integer Overflow ID ("999999999999")
  const overflowRes = await patchInventory('999999999999', { stockQuantity: 5 });
  assert(
    'Rejects 32-bit integer overflow ID ("999999999999") with HTTP 400 Bad Request',
    overflowRes.status === 400
  );

  // Test Nonexistent Valid ID (99999999) -> Expect HTTP 404
  const notFoundRes = await patchInventory('99999999', { stockQuantity: 5 });
  assert(
    'Returns HTTP 404 Variant Not Found for valid but nonexistent ID ("99999999")',
    notFoundRes.status === 404 && notFoundRes.data.message === 'Variant not found'
  );

  // =========================================================
  // 3. INVENTORY PAYLOAD QUANTITY VALIDATION
  // =========================================================
  console.log('\n--- 3. INVENTORY PAYLOAD QUANTITY VALIDATION ---');

  // Test Empty Payload ({})
  const emptyBodyRes = await patchInventory('1', {});
  assert(
    'Rejects empty payload ({}) with HTTP 400 Bad Request',
    emptyBodyRes.status === 400 && emptyBodyRes.data.message.includes('At least one of stockQuantity or rentalStockQuantity')
  );

  // Test Negative stockQuantity (-1)
  const negStockRes = await patchInventory('1', { stockQuantity: -1 });
  assert(
    'Rejects negative stockQuantity (-1) with HTTP 400 Bad Request',
    negStockRes.status === 400 && negStockRes.data.message.includes('stockQuantity must be a non-negative integer')
  );

  // Test Decimal stockQuantity (3.5)
  const decStockRes = await patchInventory('1', { stockQuantity: 3.5 });
  assert(
    'Rejects decimal stockQuantity (3.5) with HTTP 400 Bad Request',
    decStockRes.status === 400 && decStockRes.data.message.includes('stockQuantity must be a non-negative integer')
  );

  // Test Non-numeric stockQuantity ("ten")
  const nonNumStockRes = await patchInventory('1', { stockQuantity: 'ten' });
  assert(
    'Rejects non-numeric stockQuantity ("ten") with HTTP 400 Bad Request',
    nonNumStockRes.status === 400 && nonNumStockRes.data.message.includes('stockQuantity must be a non-negative integer')
  );

  // Test Negative rentalStockQuantity (-2)
  const negRentalRes = await patchInventory('1', { rentalStockQuantity: -2 });
  assert(
    'Rejects negative rentalStockQuantity (-2) with HTTP 400 Bad Request',
    negRentalRes.status === 400 && negRentalRes.data.message.includes('rentalStockQuantity must be a non-negative integer')
  );

  // Test Decimal rentalStockQuantity (1.5)
  const decRentalRes = await patchInventory('1', { rentalStockQuantity: 1.5 });
  assert(
    'Rejects decimal rentalStockQuantity (1.5) with HTTP 400 Bad Request',
    decRentalRes.status === 400 && decRentalRes.data.message.includes('rentalStockQuantity must be a non-negative integer')
  );

  // Test Non-numeric rentalStockQuantity ("high")
  const nonNumRentalRes = await patchInventory('1', { rentalStockQuantity: 'high' });
  assert(
    'Rejects non-numeric rentalStockQuantity ("high") with HTTP 400 Bad Request',
    nonNumRentalRes.status === 400 && nonNumRentalRes.data.message.includes('rentalStockQuantity must be a non-negative integer')
  );

  // =========================================================
  // 4. SECURITY & AUTHORIZATION GUARDS
  // =========================================================
  console.log('\n--- 4. SECURITY & AUTHORIZATION GUARDS ---');

  // Test Unauthenticated Request -> Expect 401
  const unauthRes = await patchInventory('1', { stockQuantity: 10 }, { 'Content-Type': 'application/json' });
  assert(
    'Rejects unauthenticated stock adjustment with HTTP 401 Unauthorized',
    unauthRes.status === 401
  );

  // Test Customer Authenticated Request -> Expect 403 Forbidden
  const custRes = await patchInventory(
    '1',
    { stockQuantity: 10 },
    { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` }
  );
  assert(
    'Rejects customer-authenticated stock adjustment with HTTP 403 Forbidden',
    custRes.status === 403
  );

  // =========================================================
  // 5. AUTHORIZED SUCCESSFUL STOCK ADJUSTMENT
  // =========================================================
  console.log('\n--- 5. AUTHORIZED STOCK ADJUSTMENT & IDEMPOTENCY ---');

  // Fetch lowest existing variant from DB to ensure testing against a real row
  const { rows: existingVariants } = await pool.query('SELECT id, stock_quantity, rental_stock_quantity FROM product_variants ORDER BY id ASC LIMIT 1');
  const targetVariantId = existingVariants[0]?.id || 7;
  const initialStock = existingVariants[0]?.stock_quantity ?? 10;
  const initialRental = existingVariants[0]?.rental_stock_quantity ?? 5;

  // Perform valid admin update
  const validRes = await patchInventory(String(targetVariantId), { stockQuantity: 15, rentalStockQuantity: 8 });
  assert(
    `Authorized admin update on valid positive integer ID (${targetVariantId}) returns HTTP 200 OK`,
    validRes.status === 200 && validRes.data.success === true
  );

  assert(
    'Variant stock updated accurately to 15 retail units',
    validRes.data?.data?.stock_quantity === 15
  );

  assert(
    'Variant rental stock updated accurately to 8 rental units',
    validRes.data?.data?.rental_stock_quantity === 8
  );

  // Restore original state
  await patchInventory(String(targetVariantId), { stockQuantity: initialStock, rentalStockQuantity: initialRental });
  const { rows: restoredRows } = await pool.query('SELECT stock_quantity, rental_stock_quantity FROM product_variants WHERE id = $1', [targetVariantId]);
  assert(
    'Original variant quantities safely restored in database',
    restoredRows[0]?.stock_quantity === initialStock && restoredRows[0]?.rental_stock_quantity === initialRental
  );

  // Summary
  console.log('\n=====================================================');
  console.log(`PHASE 5.1 VERIFICATION SUMMARY: ${passed}/${total} assertions passed`);
  console.log('=====================================================');

  if (passed === total) {
    console.log('✓ ALL PHASE 5.1 TESTS COMPLETED SUCCESSFULLY.');
    process.exit(0);
  } else {
    console.error(`✖ ${total - passed} ASSERTIONS FAILED.`);
    process.exit(1);
  }
}

runPhase51Tests().catch((err) => {
  console.error('Fatal Phase 5.1 test suite error:', err);
  process.exit(1);
});
