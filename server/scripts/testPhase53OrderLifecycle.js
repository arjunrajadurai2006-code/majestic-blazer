import http from 'http';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import { pool } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import * as Order from '../src/models/orderModel.js';
import { getAvailableStock, confirmReservationsForOrder } from '../src/models/reservationModel.js';

function generateTestToken(userId, role = 'admin') {
  return jwt.sign({ sub: userId, role }, env.jwt.secret, { expiresIn: '1h' });
}

async function request(baseUrl, endpoint, options = {}) {
  const url = `${baseUrl}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const fetchOptions = {
    method: options.method || 'GET',
    headers,
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, fetchOptions);
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

async function runPhase53Tests() {
  console.log('================================================================');
  console.log('MAJESTIC BLAZER — PHASE 5.3 ORDER LIFECYCLE SAFEGUARDS TEST SUITE');
  console.log('State Machine, Payment Integrity, Stock Consistency & Audit Logs');
  console.log('================================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const BASE_URL = `http://localhost:${port}/api`;
  console.log(`Ephemeral test HTTP server listening on port ${port}\n`);

  let passed = 0;
  let total = 0;

  function assert(testName, condition, details = '') {
    total++;
    if (condition) {
      console.log(`  ✓ [PASS ${total}] ${testName}`);
      if (details) console.log(`       Details: ${details}`);
      passed++;
    } else {
      console.error(`  ✖ [FAIL ${total}] ${testName}`);
      if (details) console.error(`       Details: ${details}`);
    }
  }

  // Setup Test Fixtures
  console.log('Setting up isolated test fixtures...');
  const customerId1 = 2;
  const customerId2 = 3;
  const adminId = 1;

  const adminToken = generateTestToken(adminId, 'admin');
  const customer1Token = generateTestToken(customerId1, 'customer');
  const customer2Token = generateTestToken(customerId2, 'customer');

  const { rows: catRows } = await pool.query('SELECT id FROM categories LIMIT 1');
  const validCategoryId = catRows[0]?.id || 3;

  // Clean up any leftover test data first
  await pool.query("DELETE FROM audit_logs WHERE entity_type = 'orders' AND details::text ILIKE '%Phase 5.3%'");
  await pool.query("DELETE FROM payments WHERE provider_payment_id LIKE 'pay_test_p53_%'");
  await pool.query("DELETE FROM inventory_reservations WHERE order_id IN (SELECT id FROM orders WHERE notes LIKE '%Phase 5.3%' OR notes LIKE '%atelier%')");
  await pool.query("DELETE FROM order_items WHERE product_id IN (SELECT id FROM products WHERE name LIKE '%Phase 5.3%')");
  await pool.query("DELETE FROM orders WHERE notes LIKE '%Phase 5.3%' OR notes LIKE '%atelier%'");
  await pool.query("DELETE FROM product_variants WHERE sku LIKE 'SKU-P53-%'");
  await pool.query("DELETE FROM products WHERE name LIKE '%Phase 5.3%'");

  // Create isolated test product and variant with initial stock = 10
  const { rows: pRows } = await pool.query(
    `INSERT INTO products (
      category_id, name, slug, description, color, material, fit,
      sale_price, original_price,
      is_purchasable, is_active
    ) VALUES (
      $1, 'Phase 5.3 Lifecycle Safeguard Blazer', 'phase-5-3-lifecycle-blazer-' || floor(random()*100000)::text,
      'Test blazer for order status lifecycle transitions, payment integrity and audit trail',
      'Charcoal Houndstooth', 'Italian Wool', 'Tailored',
      18000, 22000,
      true, true
    ) RETURNING id`,
    [validCategoryId]
  );
  const testProductId = pRows[0].id;

  const { rows: vRows } = await pool.query(
    `INSERT INTO product_variants (
      product_id, sku, size, stock_quantity
    ) VALUES (
      $1, 'SKU-P53-' || floor(random()*100000)::text, '42R', 10
    ) RETURNING id`,
    [testProductId]
  );
  const testVariantId = vRows[0].id;

  // Create test address for customer 1
  const { rows: addrRows } = await pool.query(
    `INSERT INTO addresses (
      user_id, line1, line2, city, state, pincode, is_default
    ) VALUES (
      $1, '100 Mount Road', 'Suite 4B', 'Chennai', 'Tamil Nadu', '600002', false
    ) RETURNING id`,
    [customerId1]
  );
  const testAddressId = addrRows[0].id;

  console.log(`Fixtures ready: Product #${testProductId}, Variant #${testVariantId} (Stock: 10), Address #${testAddressId}\n`);

  const createdOrderIds = [];

  try {
    // -------------------------------------------------------------
    // Helper to create order for customer 1
    // -------------------------------------------------------------
    async function createTestOrder(qty = 1) {
      const ord = await Order.create(customerId1, {
        addressId: testAddressId,
        fulfillmentType: 'delivery',
        notes: 'Phase 5.3 automated test order',
        items: [
          {
            productId: testProductId,
            variantId: testVariantId,
            quantity: qty,
          },
        ],
      });
      createdOrderIds.push(ord.id);
      return ord;
    }

    // =============================================================
    // TEST 1: Status Payload Validation - Unknown Status Returns 400
    // =============================================================
    const order1 = await createTestOrder(1);
    const res1 = await request(BASE_URL, `/orders/${order1.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'invalid_status_xyz' },
    });
    assert(
      'Unknown status in update payload returns HTTP 400 Bad Request',
      res1.status === 400 && res1.data?.message?.includes('Invalid order status'),
      `Status: ${res1.status}, Message: "${res1.data?.message}"`
    );

    // =============================================================
    // TEST 2: Status Payload Validation - Missing Status Returns 400
    // =============================================================
    const res2 = await request(BASE_URL, `/orders/${order1.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { trackingNumber: 'BD123456' },
    });
    assert(
      'Missing status in update payload returns HTTP 400 Bad Request',
      res2.status === 400 && res2.data?.message?.includes('Order status is required'),
      `Status: ${res2.status}, Message: "${res2.data?.message}"`
    );

    // =============================================================
    // TEST 3: RBAC Barrier - Non-Admin Forbidden From Updating Status
    // =============================================================
    const res3 = await request(BASE_URL, `/orders/${order1.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${customer1Token}` },
      body: { status: 'confirmed' },
    });
    assert(
      'Customer cannot call status update endpoint (returns HTTP 403 Forbidden)',
      res3.status === 403,
      `Status: ${res3.status}, Response: ${JSON.stringify(res3.data)}`
    );

    // =============================================================
    // TEST 4: Cross-Customer Security - Customer B Cannot Cancel Customer A Order
    // =============================================================
    const res4 = await request(BASE_URL, `/orders/${order1.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer2Token}` },
      body: { reason: 'Ordered incorrect size' },
    });
    assert(
      'Cross-customer cancellation blocked (returns HTTP 403 Forbidden)',
      res4.status === 403,
      `Status: ${res4.status}, Message: "${res4.data?.message}"`
    );

    // =============================================================
    // TEST 5: Customer Predefined Cancellation Reason Enforcement
    // =============================================================
    const res5 = await request(BASE_URL, `/orders/${order1.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer1Token}` },
      body: { reason: 'Arbitrary unapproved reason' },
    });
    assert(
      'Invalid customer cancellation reason rejected with HTTP 400 Bad Request',
      res5.status === 400 && res5.data?.message?.includes('Invalid cancellation reason'),
      `Status: ${res5.status}, Message: "${res5.data?.message}"`
    );

    // =============================================================
    // TEST 6: Customer Pending Cancellation With Valid Reason
    // =============================================================
    const res6 = await request(BASE_URL, `/orders/${order1.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer1Token}` },
      body: { reason: 'Ordered incorrect size' },
    });
    const order1PostCancel = await Order.getById(order1.id);
    assert(
      'Customer successfully cancels pending order with valid predefined reason',
      res6.status === 200 && order1PostCancel?.status === 'cancelled',
      `Status: ${res6.status}, Order status: ${order1PostCancel?.status}, Notes: "${order1PostCancel?.notes}"`
    );

    // =============================================================
    // TEST 7: Cancellation Idempotency
    // =============================================================
    const res7 = await request(BASE_URL, `/orders/${order1.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer1Token}` },
      body: { reason: 'Ordered incorrect size' },
    });
    assert(
      'Repeated cancellation call succeeds idempotently without error',
      res7.status === 200 && (res7.data?.message?.includes('already cancelled') || res7.data?.data?.status === 'cancelled'),
      `Status: ${res7.status}, Message: "${res7.data?.message}"`
    );

    // =============================================================
    // TEST 8: Payment Verification Gate on Admin Confirmation
    // =============================================================
    const order2 = await createTestOrder(1);
    const res8 = await request(BASE_URL, `/orders/${order2.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'confirmed' },
    });
    assert(
      'Admin cannot confirm order without verified payment (returns HTTP 409 Conflict)',
      res8.status === 409 && res8.data?.message?.includes('verified payment'),
      `Status: ${res8.status}, Message: "${res8.data?.message}"`
    );

    // =============================================================
    // TEST 9: Permitted Lifecycle Progression: pending -> confirmed -> shipped -> delivered
    // =============================================================
    // Insert verified payment record for order2
    await pool.query(
      `INSERT INTO payments (
        order_id, user_id, provider, provider_payment_id, amount, status
      ) VALUES ($1, $2, 'razorpay', 'pay_test_p53_' || floor(random()*100000)::text, $3, 'paid')`,
      [order2.id, customerId1, order2.total]
    );

    // Confirmation
    const res9a = await request(BASE_URL, `/orders/${order2.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'confirmed' },
    });

    // Shipment
    const res9b = await request(BASE_URL, `/orders/${order2.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'shipped', trackingNumber: 'BD789102IN' },
    });

    // Delivery
    const res9c = await request(BASE_URL, `/orders/${order2.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'delivered' },
    });

    const order2Delivered = await Order.getById(order2.id);
    assert(
      'Permitted sequential transitions (pending -> confirmed -> shipped -> delivered) succeed',
      res9a.status === 200 && res9b.status === 200 && res9c.status === 200 && order2Delivered?.status === 'delivered',
      `Statuses: [confirmed: ${res9a.status}, shipped: ${res9b.status}, delivered: ${res9c.status}], Final: ${order2Delivered?.status}`
    );

    // =============================================================
    // TEST 10: Delivered Terminal State Protection - Cannot Be Cancelled
    // =============================================================
    const res10 = await request(BASE_URL, `/orders/${order2.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'cancelled' },
    });
    assert(
      'Delivered order cannot transition to cancelled (returns HTTP 409 Conflict)',
      res10.status === 409 && res10.data?.message?.includes('Delivered orders can only be refunded'),
      `Status: ${res10.status}, Message: "${res10.data?.message}"`
    );

    // =============================================================
    // TEST 11: Delivered Terminal State Protection - Cannot Reopen to Confirmed
    // =============================================================
    const res11 = await request(BASE_URL, `/orders/${order2.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'confirmed' },
    });
    assert(
      'Delivered order cannot be reopened to confirmed (returns HTTP 409 Conflict)',
      res11.status === 409,
      `Status: ${res11.status}, Message: "${res11.data?.message}"`
    );

    // =============================================================
    // TEST 12: Delivered Order Can Transition to Refunded Upon Return
    // =============================================================
    const res12 = await request(BASE_URL, `/orders/${order2.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'refunded', notes: 'Item returned and inspected at atelier' },
    });
    const order2Refunded = await Order.getById(order2.id);
    assert(
      'Delivered order can transition to refunded upon return (returns HTTP 200)',
      res12.status === 200 && order2Refunded?.status === 'refunded',
      `Status: ${res12.status}, Order status: ${order2Refunded?.status}`
    );

    // =============================================================
    // TEST 13: Refunded Terminal State Is Permanently Locked
    // =============================================================
    const res13 = await request(BASE_URL, `/orders/${order2.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'confirmed' },
    });
    assert(
      'Refunded order cannot be reopened (returns HTTP 409 Conflict)',
      res13.status === 409 && res13.data?.message?.includes('Refunded orders are terminal'),
      `Status: ${res13.status}, Message: "${res13.data?.message}"`
    );

    // =============================================================
    // TEST 14: Disallowed Skip Transition (pending -> shipped) Blocked
    // =============================================================
    const order3 = await createTestOrder(1);
    const res14 = await request(BASE_URL, `/orders/${order3.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'shipped' },
    });
    assert(
      'Invalid status skip (pending -> shipped) returns HTTP 409 Conflict',
      res14.status === 409 && res14.data?.message?.includes('Invalid status transition'),
      `Status: ${res14.status}, Message: "${res14.data?.message}"`
    );

    // =============================================================
    // TEST 15: Customer Cannot Cancel Confirmed or Shipped Orders
    // =============================================================
    // Confirm order3 with valid payment
    await pool.query(
      `INSERT INTO payments (
        order_id, user_id, provider, provider_payment_id, amount, status
      ) VALUES ($1, $2, 'razorpay', 'pay_test_p53_' || floor(random()*100000)::text, $3, 'paid')`,
      [order3.id, customerId1, order3.total]
    );
    await Order.updateStatus(order3.id, { status: 'confirmed' });

    const res15 = await request(BASE_URL, `/orders/${order3.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer1Token}` },
      body: { reason: 'Ordered incorrect size' },
    });
    assert(
      'Customer cannot cancel confirmed order (returns HTTP 400 Bad Request)',
      res15.status === 400 && res15.data?.message?.includes('Only pending orders can be cancelled by customers'),
      `Status: ${res15.status}, Message: "${res15.data?.message}"`
    );

    // =============================================================
    // TEST 16: Inventory Reservation Release on Pending Cancellation
    // =============================================================
    const initialAvail = await getAvailableStock(testVariantId);
    const order4 = await createTestOrder(2);
    const availAfterOrder = await getAvailableStock(testVariantId);
    assert(
      'Order creation reserves stock (available decreases by quantity)',
      availAfterOrder === initialAvail - 2,
      `Initial available: ${initialAvail}, After order: ${availAfterOrder}`
    );

    await request(BASE_URL, `/orders/${order4.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer1Token}` },
      body: { reason: 'Selected alternate blazer style' },
    });
    const availAfterCancel = await getAvailableStock(testVariantId);
    assert(
      'Pending order cancellation releases reservation back to available stock',
      availAfterCancel === initialAvail,
      `Available after cancellation: ${availAfterCancel} (matches initial: ${initialAvail})`
    );

    // =============================================================
    // TEST 17: Physical Stock Restoration on Confirmed Cancellation
    // =============================================================
    // Check initial physical stock
    const { rows: vBefore } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId]);
    const physicalStockBefore = vBefore[0].stock_quantity;

    const order5 = await createTestOrder(2);
    // Add payment and confirm order (confirming decrements physical stock)
    await pool.query(
      `INSERT INTO payments (
        order_id, user_id, provider, provider_payment_id, amount, status
      ) VALUES ($1, $2, 'razorpay', 'pay_test_p53_' || floor(random()*100000)::text, $3, 'paid')`,
      [order5.id, customerId1, order5.total]
    );

    // Confirm reservation to simulate normal checkout completion (confirmReservationsForOrder decrements physical stock)
    await confirmReservationsForOrder(order5.id);
    await pool.query("UPDATE orders SET status = 'confirmed' WHERE id = $1", [order5.id]);

    const { rows: vConfirmed } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId]);
    assert(
      'Physical stock was decremented upon confirmation',
      vConfirmed[0].stock_quantity === physicalStockBefore - 2,
      `Physical stock after confirmation: ${vConfirmed[0].stock_quantity}`
    );

    // Admin cancels confirmed order
    const res17 = await request(BASE_URL, `/orders/${order5.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'cancelled', notes: 'Admin cancelled at patron request' },
    });

    const { rows: vRestored } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId]);
    assert(
      'Confirmed order cancellation restores physical stock in product_variants',
      res17.status === 200 && vRestored[0].stock_quantity === physicalStockBefore,
      `Restored physical stock: ${vRestored[0].stock_quantity} (expected: ${physicalStockBefore})`
    );

    // =============================================================
    // TEST 18: Atomic Audit Logging in audit_logs Table
    // =============================================================
    const { rows: auditEntries } = await pool.query(
      `SELECT * FROM audit_logs
       WHERE entity_type = 'orders' AND entity_id = $1
       ORDER BY created_at DESC`,
      [String(order5.id)]
    );

    const hasCancelAudit = auditEntries.some((entry) => {
      const details = typeof entry.details === 'string' ? JSON.parse(entry.details) : entry.details;
      return entry.action === 'ORDER_CANCELLED' && details?.newStatus === 'cancelled' && details?.previousStatus === 'confirmed';
    });

    assert(
      'Status transitions generate atomic audit log records with full state details',
      auditEntries.length > 0 && hasCancelAudit,
      `Found ${auditEntries.length} audit entries for order ${order5.id}. Cancel action logged: ${hasCancelAudit}`
    );

  } finally {
    // Teardown test fixtures
    console.log('\nCleaning up isolated test fixtures...');
    if (createdOrderIds.length > 0) {
      await pool.query("DELETE FROM audit_logs WHERE entity_type = 'orders' AND entity_id = ANY($1::text[])", [createdOrderIds.map(String)]);
      await pool.query('DELETE FROM payments WHERE order_id = ANY($1::int[])', [createdOrderIds]);
      await pool.query('DELETE FROM invoices WHERE order_id = ANY($1::int[])', [createdOrderIds]);
      await pool.query('DELETE FROM inventory_reservations WHERE order_id = ANY($1::int[])', [createdOrderIds]);
      await pool.query('DELETE FROM order_items WHERE order_id = ANY($1::int[])', [createdOrderIds]);
      await pool.query('DELETE FROM orders WHERE id = ANY($1::int[])', [createdOrderIds]);
    }
    await pool.query('DELETE FROM addresses WHERE id = $1', [testAddressId]);
    await pool.query('DELETE FROM product_variants WHERE id = $1', [testVariantId]);
    await pool.query('DELETE FROM products WHERE id = $1', [testProductId]);
    console.log('Test fixtures cleaned up successfully.');

    await new Promise((resolve) => server.close(resolve));
  }

  console.log('\n================================================================');
  console.log(`PHASE 5.3 TESTS COMPLETED: ${passed} / ${total} PASSED`);
  if (passed === total) {
    console.log('RESULT: ALL 18 ORDER LIFECYCLE SAFEGUARDS VERIFIED SUCCESSFULLY!');
  } else {
    console.error(`RESULT: ${total - passed} TESTS FAILED.`);
    process.exitCode = 1;
  }
  console.log('================================================================\n');
}

runPhase53Tests()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Fatal test error:', err);
    pool.end();
    process.exit(1);
  });
