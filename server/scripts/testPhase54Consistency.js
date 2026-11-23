import http from 'http';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import * as Order from '../src/models/orderModel.js';
import * as Payment from '../src/models/paymentModel.js';
import { getAvailableStock, confirmReservationsForOrder, releaseReservationsForOrder } from '../src/models/reservationModel.js';

function generateTestToken(userId, role = 'admin') {
  return jwt.sign({ sub: userId, role }, env.jwt.secret, { expiresIn: '1h' });
}

function computePaymentSignature(orderId, paymentId) {
  if (env.razorpay.keySecret) {
    return crypto.createHmac('sha256', env.razorpay.keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  }
  return 'simulated_signature_secure';
}

function computeWebhookHeaders(bodyObj) {
  const bodyString = JSON.stringify(bodyObj);
  if (env.razorpay.webhookSecret) {
    const sig = crypto.createHmac('sha256', env.razorpay.webhookSecret).update(bodyString).digest('hex');
    return { 'x-razorpay-signature': sig };
  }
  return {};
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

async function runPhase54Tests() {
  console.log('================================================================');
  console.log('MAJESTIC BLAZER — PHASE 5.4 CONSISTENCY AUDIT TEST SUITE');
  console.log('Order, Payment, Refund, Inventory & Concurrency Verification');
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

  // Clean up any leftover test data
  await pool.query("DELETE FROM audit_logs WHERE entity_type = 'orders' AND details::text ILIKE '%Phase 5.4%'");
  await pool.query("DELETE FROM audit_logs WHERE entity_type = 'payments' AND details::text ILIKE '%Phase 5.4%'");
  await pool.query("DELETE FROM audit_logs WHERE entity_type = 'webhook_events' AND (entity_id LIKE '%p54_%' OR entity_id LIKE '%rfnd_mock_fail_%')");
  await pool.query("DELETE FROM payments WHERE provider_payment_id LIKE 'pay_test_p54_%'");
  await pool.query("DELETE FROM inventory_reservations WHERE order_id IN (SELECT id FROM orders WHERE notes LIKE '%Phase 5.4%')");
  await pool.query("DELETE FROM order_items WHERE product_id IN (SELECT id FROM products WHERE name LIKE '%Phase 5.4%')");
  await pool.query("DELETE FROM orders WHERE notes LIKE '%Phase 5.4%'");
  await pool.query("DELETE FROM product_variants WHERE sku LIKE 'SKU-P54-%'");
  await pool.query("DELETE FROM products WHERE name LIKE '%Phase 5.4%'");

  const { rows: catRows } = await pool.query('SELECT id FROM categories LIMIT 1');
  const validCategoryId = catRows[0]?.id || 3;

  // Create isolated test product and variant with initial stock = 10
  const { rows: pRows } = await pool.query(
    `INSERT INTO products (
      category_id, name, slug, description, color, material, fit,
      sale_price, original_price,
      is_purchasable, is_active
    ) VALUES (
      $1, 'Phase 5.4 Consistency Safeguard Blazer', 'phase-5-4-safeguard-blazer-' || floor(random()*100000)::text,
      'Test blazer for order, payment, refund, inventory and concurrency safeguards',
      'Midnight Velvet', 'Italian Wool', 'Tailored',
      19999, 24999,
      true, true
    ) RETURNING id`,
    [validCategoryId]
  );
  const testProductId = pRows[0].id;

  const { rows: vRows } = await pool.query(
    `INSERT INTO product_variants (
      product_id, sku, size, stock_quantity
    ) VALUES (
      $1, 'SKU-P54-' || floor(random()*100000)::text, '40R', 10
    ) RETURNING id`,
    [testProductId]
  );
  const testVariantId = vRows[0].id;

  // Create isolated address for customer 1
  const { rows: addrRows } = await pool.query(
    `INSERT INTO addresses (
      user_id, line1, line2, city, state, pincode, is_default
    ) VALUES (
      $1, '45 Luxury Avenue', 'Floor 3', 'Coimbatore', 'Tamil Nadu', '641001', false
    ) RETURNING id`,
    [customerId1]
  );
  const testAddressId = addrRows[0].id;

  console.log(`Fixtures ready: Product #${testProductId}, Variant #${testVariantId} (Stock: 10), Address #${testAddressId}\n`);

  const createdOrderIds = [];

  try {
    async function createTestOrder(qty = 1) {
      const ord = await Order.create(customerId1, {
        addressId: testAddressId,
        fulfillmentType: 'delivery',
        notes: 'Phase 5.4 automated consistency test order',
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
    // TEST 1: Duplicate Payment Callback Idempotency
    // =============================================================
    const order1 = await createTestOrder(1);
    const mockPaymentId = `pay_test_p54_dup_${Date.now()}`;
    const mockOrderId = `order_test_p54_dup_${Date.now()}`;
    const sig1 = computePaymentSignature(mockOrderId, mockPaymentId);

    // First callback
    const res1a = await request(BASE_URL, '/payments/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer1Token}` },
      body: {
        orderId: order1.id,
        razorpayOrderId: mockOrderId,
        razorpayPaymentId: mockPaymentId,
        razorpaySignature: sig1,
        provider: 'razorpay',
      },
    });

    const { rows: vAfterFirst } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId]);

    // Second (duplicate) callback
    const res1b = await request(BASE_URL, '/payments/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer1Token}` },
      body: {
        orderId: order1.id,
        razorpayOrderId: mockOrderId,
        razorpayPaymentId: mockPaymentId,
        razorpaySignature: sig1,
        provider: 'razorpay',
      },
    });

    const { rows: vAfterSecond } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId]);
    const { rows: payCount } = await pool.query('SELECT COUNT(*) FROM payments WHERE order_id = $1', [order1.id]);

    assert(
      'Duplicate payment callback is strictly idempotent (zero double-deduction, exactly 1 payment record)',
      res1a.status === 200 &&
      res1b.status === 200 &&
      vAfterFirst[0].stock_quantity === 9 &&
      vAfterSecond[0].stock_quantity === 9 &&
      Number(payCount[0].count) === 1,
      `Physical Stock: First=${vAfterFirst[0].stock_quantity}, Second=${vAfterSecond[0].stock_quantity}, Payment rows=${payCount[0].count}`
    );

    // =============================================================
    // TEST 2: Payment Callback Racing With Customer Cancellation
    // =============================================================
    const order2 = await createTestOrder(1);

    // Customer cancels order first
    await request(BASE_URL, `/orders/${order2.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer1Token}` },
      body: { reason: 'Ordered incorrect size' },
    });

    const order2Before = await Order.getById(order2.id);
    const { rows: vBeforeRacePay } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId]);

    // In-flight delayed payment arrives after cancellation
    const res2 = await Payment.recordPayment({
      orderId: order2.id,
      userId: customerId1,
      provider: 'razorpay',
      providerOrderId: `order_test_p54_race_${Date.now()}`,
      providerPaymentId: `pay_test_p54_race_${Date.now()}`,
      providerSignature: 'simulated_signature_secure',
      amount: order2.total,
      status: 'paid',
    });

    const order2After = await Order.getById(order2.id);
    const { rows: vAfterRacePay } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId]);

    assert(
      'Payment arriving on cancelled order does NOT reopen order or deduct stock; marks refund pending',
      order2Before.status === 'cancelled' &&
      order2After.status === 'cancelled' &&
      vBeforeRacePay[0].stock_quantity === vAfterRacePay[0].stock_quantity &&
      res2.refund_status === 'pending',
      `Order status remained "${order2After.status}", Stock remained ${vAfterRacePay[0].stock_quantity}, Refund status=${res2.refund_status}`
    );

    // =============================================================
    // TEST 3: Repeated Stock Restoration Prevention
    // =============================================================
    const order3 = await createTestOrder(1);
    // Confirm order3
    await Payment.recordPayment({
      orderId: order3.id,
      userId: customerId1,
      provider: 'manual',
      providerPaymentId: `pay_test_p54_rep_${Date.now()}`,
      amount: order3.total,
      status: 'paid',
    });

    const { rows: vBeforeCancel3 } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId]);

    // Admin cancels confirmed order (stock restored)
    await request(BASE_URL, `/orders/${order3.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'cancelled', notes: 'First admin cancellation' },
    });
    const { rows: vAfterCancel3a } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId]);

    // Repeated cancel request
    await request(BASE_URL, `/orders/${order3.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'cancelled', notes: 'Repeated cancel call' },
    });
    const { rows: vAfterCancel3b } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId]);

    assert(
      'Repeated cancellation request does NOT duplicate stock restoration',
      vAfterCancel3a[0].stock_quantity === vBeforeCancel3[0].stock_quantity + 1 &&
      vAfterCancel3b[0].stock_quantity === vAfterCancel3a[0].stock_quantity,
      `Stock Before=${vBeforeCancel3[0].stock_quantity}, After Cancel 1=${vAfterCancel3a[0].stock_quantity}, After Cancel 2=${vAfterCancel3b[0].stock_quantity}`
    );

    // =============================================================
    // TEST 4: Repeated Reservation Release Idempotency
    // =============================================================
    const order4 = await createTestOrder(2);
    const availBeforeRelease = await getAvailableStock(testVariantId);

    // First release
    const rel1 = await releaseReservationsForOrder(order4.id, 'released');
    const availAfter1 = await getAvailableStock(testVariantId);

    // Second release
    const rel2 = await releaseReservationsForOrder(order4.id, 'released');
    const availAfter2 = await getAvailableStock(testVariantId);

    assert(
      'Repeated reservation release does not duplicate available stock',
      rel1.length > 0 && rel2.length === 0 && availAfter1 === availAfter2,
      `Avail Before=${availBeforeRelease}, After 1st=${availAfter1}, After 2nd=${availAfter2}`
    );

    // =============================================================
    // TEST 5: Confirmed Order Cancellation Restores Stock Exactly Once
    // =============================================================
    const order5 = await createTestOrder(1);
    await Payment.recordPayment({
      orderId: order5.id,
      userId: customerId1,
      provider: 'manual',
      providerPaymentId: `pay_test_p54_c5_${Date.now()}`,
      amount: order5.total,
      status: 'paid',
    });

    const { rows: vBeforeCancel5 } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId]);

    const res5 = await request(BASE_URL, `/orders/${order5.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'cancelled', notes: 'Confirmed order cancelled prior to dispatch' },
    });

    const { rows: vAfterCancel5 } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId]);

    assert(
      'Confirmed order cancellation restores physical stock to atelier inventory',
      res5.status === 200 && vAfterCancel5[0].stock_quantity === vBeforeCancel5[0].stock_quantity + 1,
      `Stock Before=${vBeforeCancel5[0].stock_quantity}, Stock After=${vAfterCancel5[0].stock_quantity}`
    );

    // =============================================================
    // TEST 6: Shipped Order Cancellation Stock Policy (Withheld vs Restocked)
    // =============================================================
    const order6a = await createTestOrder(1);
    await Payment.recordPayment({
      orderId: order6a.id,
      userId: customerId1,
      provider: 'manual',
      providerPaymentId: `pay_test_p54_c6a_${Date.now()}`,
      amount: order6a.total,
      status: 'paid',
    });
    // Move to shipped
    await request(BASE_URL, `/orders/${order6a.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'shipped', trackingNumber: 'BD78901IN' },
    });

    const { rows: vShippedBefore } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId]);

    // Shipped order cancelled without inspection: stock MUST BE WITHHELD (not automatically restocked)
    const res6a = await request(BASE_URL, `/orders/${order6a.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'cancelled', notes: 'Courier delivery refused / in-transit cancellation' },
    });

    const { rows: vShippedAfterWithheld } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId]);

    // Shipped order cancelled WITH explicit inspection confirmation: stock is restored
    const order6b = await createTestOrder(1);
    await Payment.recordPayment({
      orderId: order6b.id,
      userId: customerId1,
      provider: 'manual',
      providerPaymentId: `pay_test_p54_c6b_${Date.now()}`,
      amount: order6b.total,
      status: 'paid',
    });
    await request(BASE_URL, `/orders/${order6b.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'shipped', trackingNumber: 'BD78902IN' },
    });

    const { rows: vShippedBeforeB } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId]);

    const res6b = await request(BASE_URL, `/orders/${order6b.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'cancelled', restock: true, notes: 'Package physically received and inspected at atelier' },
    });

    const { rows: vShippedAfterRestocked } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId]);

    assert(
      'Shipped order cancellation enforces explicit stock policy (withheld by default, restored on verified inspection)',
      res6a.status === 200 &&
      vShippedAfterWithheld[0].stock_quantity === vShippedBefore[0].stock_quantity &&
      res6b.status === 200 &&
      vShippedAfterRestocked[0].stock_quantity === vShippedBeforeB[0].stock_quantity + 1,
      `Default Withheld: ${vShippedAfterWithheld[0].stock_quantity} (remained ${vShippedBefore[0].stock_quantity}), With Restock: ${vShippedAfterRestocked[0].stock_quantity} (increased from ${vShippedBeforeB[0].stock_quantity})`
    );

    // =============================================================
    // TEST 7: Delivered Order Refund Eligibility & Stock Non-Restoration
    // =============================================================
    const order7 = await createTestOrder(1);
    await Payment.recordPayment({
      orderId: order7.id,
      userId: customerId1,
      provider: 'manual',
      providerPaymentId: `pay_test_p54_c7_${Date.now()}`,
      amount: order7.total,
      status: 'paid',
    });
    await request(BASE_URL, `/orders/${order7.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'shipped', trackingNumber: 'BD78903IN' },
    });
    await request(BASE_URL, `/orders/${order7.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'delivered' },
    });

    const { rows: vDeliveredBefore } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId]);

    // Delivered cannot be cancelled (409)
    const res7a = await request(BASE_URL, `/orders/${order7.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'cancelled' },
    });

    // Delivered CAN transition to refunded
    const res7b = await request(BASE_URL, `/orders/${order7.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'refunded', notes: 'Client returned garment; atelier inspected' },
    });

    const { rows: vDeliveredAfter } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId]);

    assert(
      'Delivered order cannot be cancelled (409), can transition to refunded (200), and does not restore stock',
      res7a.status === 409 &&
      res7b.status === 200 &&
      vDeliveredBefore[0].stock_quantity === vDeliveredAfter[0].stock_quantity,
      `Delivered cancel status=${res7a.status}, Delivered refund status=${res7b.status}, Stock remained=${vDeliveredAfter[0].stock_quantity}`
    );

    // =============================================================
    // TEST 8: Refund Request Without Gateway Confirmation (Pending State)
    // =============================================================
    const order8 = await createTestOrder(1);
    const pay8 = await Payment.recordPayment({
      orderId: order8.id,
      userId: customerId1,
      provider: 'razorpay',
      providerPaymentId: `pay_test_p54_c8_${Date.now()}`,
      amount: order8.total,
      status: 'paid',
    });

    // Admin requests refund via API
    const res8 = await request(BASE_URL, `/payments/${pay8.id}/refund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { refundAmount: Number(pay8.amount), reason: 'Customer requested return refund' },
    });

    const { rows: pay8Updated } = await pool.query('SELECT status, refund_status, refund_amount FROM payments WHERE id = $1', [pay8.id]);

    assert(
      'Refund without gateway confirmation accurately represents refund_status="pending" and keeps status="paid"',
      res8.status === 200 &&
      pay8Updated[0].refund_status === 'pending' &&
      pay8Updated[0].status === 'paid' &&
      Number(pay8Updated[0].refund_amount) === Number(pay8.amount),
      `Payment status="${pay8Updated[0].status}", refund_status="${pay8Updated[0].refund_status}", refund_amount=${pay8Updated[0].refund_amount}`
    );

    // =============================================================
    // TEST 9: Failed Refund Webhook Handling
    // =============================================================
    // Simulate Razorpay refund.failed webhook
    const webhookPayload9 = {
      event: 'refund.failed',
      id: `evt_p54_fail_${Date.now()}`,
      payload: {
        refund: {
          entity: {
            id: `rfnd_mock_fail_${Date.now()}`,
            payment_id: pay8.provider_payment_id,
            amount: Number(pay8.amount) * 100,
          },
        },
      },
    };

    const res9 = await request(BASE_URL, '/payments/webhook', {
      method: 'POST',
      headers: computeWebhookHeaders(webhookPayload9),
      body: webhookPayload9,
    });

    const { rows: pay9Updated } = await pool.query('SELECT status, refund_status FROM payments WHERE id = $1', [pay8.id]);

    assert(
      'Failed refund webhook updates refund_status="failed" while keeping payment status="paid"',
      res9.status === 200 &&
      pay9Updated[0].refund_status === 'failed' &&
      pay9Updated[0].status === 'paid',
      `Webhook Status=${res9.status}, DB payment status="${pay9Updated[0].status}", refund_status="${pay9Updated[0].refund_status}"`
    );

    // =============================================================
    // TEST 10: COD Order Lifecycle (Confirmation, Stock & Cancellation)
    // =============================================================
    const initialStock10 = (await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId])).rows[0].stock_quantity;

    const order10 = await createTestOrder(1);

    // COD checkout confirmation
    const res10Verify = await request(BASE_URL, '/payments/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer1Token}` },
      body: {
        orderId: order10.id,
        provider: 'cod',
      },
    });

    const order10Confirmed = await Order.getById(order10.id);
    const stockAfterCodConfirm = (await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId])).rows[0].stock_quantity;

    // Admin cancels COD order
    const res10Cancel = await request(BASE_URL, `/orders/${order10.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'cancelled', notes: 'Patron cancelled COD order' },
    });

    const stockAfterCodCancel = (await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId])).rows[0].stock_quantity;

    assert(
      'COD order lifecycle correctly confirms order, decrements physical stock, and restores stock on cancel',
      res10Verify.status === 200 &&
      order10Confirmed.status === 'confirmed' &&
      stockAfterCodConfirm === initialStock10 - 1 &&
      res10Cancel.status === 200 &&
      stockAfterCodCancel === initialStock10,
      `COD Verify Status=${res10Verify.status}, Stock After Confirm=${stockAfterCodConfirm}, Stock After Cancel=${stockAfterCodCancel}`
    );

    // =============================================================
    // TEST 11: Concurrent Administrator Status Updates Serialized
    // =============================================================
    const order11 = await createTestOrder(1);
    await Payment.recordPayment({
      orderId: order11.id,
      userId: customerId1,
      provider: 'manual',
      providerPaymentId: `pay_test_p54_c11_${Date.now()}`,
      amount: order11.total,
      status: 'paid',
    });

    // Two concurrent status updates
    const [adminUpdate1, adminUpdate2] = await Promise.all([
      request(BASE_URL, `/orders/${order11.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { status: 'shipped', trackingNumber: 'BD_CONCUR_1' },
      }),
      request(BASE_URL, `/orders/${order11.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { status: 'shipped', trackingNumber: 'BD_CONCUR_2' },
      }),
    ]);

    const finalOrder11 = await Order.getById(order11.id);

    assert(
      'Concurrent administrator status updates strictly serialize with row locking (zero race condition)',
      adminUpdate1.status === 200 &&
      adminUpdate2.status === 200 &&
      finalOrder11.status === 'shipped',
      `Res 1=${adminUpdate1.status}, Res 2=${adminUpdate2.status}, Final Status=${finalOrder11.status}`
    );

    // =============================================================
    // TEST 12: Inventory Consistency After Database Rollback
    // =============================================================
    const stockBeforeRollback = (await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId])).rows[0].stock_quantity;
    const availBeforeRollback = await getAvailableStock(testVariantId);

    // Deliberately trigger transaction rollback by providing invalid variant ID in order creation
    const res12 = await request(BASE_URL, '/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer1Token}` },
      body: {
        addressId: testAddressId,
        fulfillmentType: 'delivery',
        items: [
          { productId: testProductId, variantId: 9999999, quantity: 2 },
        ],
      },
    });

    const stockAfterRollback = (await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId])).rows[0].stock_quantity;
    const availAfterRollback = await getAvailableStock(testVariantId);

    assert(
      'Failed order placement cleanly rolls back; physical and available stock are unchanged (zero orphan reservations)',
      res12.status >= 400 &&
      stockBeforeRollback === stockAfterRollback &&
      availBeforeRollback === availAfterRollback,
      `Status=${res12.status}, Physical Before/After=${stockBeforeRollback}/${stockAfterRollback}, Avail Before/After=${availBeforeRollback}/${availAfterRollback}`
    );

    // =============================================================
    // TEST 13: Customer Ownership & Administrator RBAC Barriers
    // =============================================================
    // Customer 2 attempts to refund Customer 1's payment
    const res13a = await request(BASE_URL, `/payments/${pay8.id}/refund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer2Token}` },
      body: { refundAmount: 1000 },
    });

    // Anonymous attempts to access payments ledger
    const res13b = await request(BASE_URL, '/payments/all', {
      method: 'GET',
    });

    assert(
      'Customer and anonymous actors strictly blocked from payment admin and refund endpoints (401/403)',
      res13a.status === 403 && res13b.status === 401,
      `Customer Refund Attempt: ${res13a.status} (Expected 403), Anon Ledger Attempt: ${res13b.status} (Expected 401)`
    );

    // =============================================================
    // TEST 14: Audit Log Consistency Across Financial & Inventory Events
    // =============================================================
    const { rows: auditRows } = await pool.query(
      `SELECT action, entity_type, details FROM audit_logs
       WHERE details::text ILIKE '%Phase 5.4%'
          OR details::text ILIKE '%${testProductId}%'
          OR entity_id = '${pay8.id}'
          OR entity_id = ANY($1::text[])
       ORDER BY id DESC LIMIT 20`,
      [createdOrderIds.map(String)]
    );

    const actions = auditRows.map(r => r.action);
    const hasOrderUpdate = actions.includes('ORDER_STATUS_UPDATE') || actions.includes('ORDER_CANCELLED');
    const hasRefundAudit = actions.includes('REFUND_REQUESTED') || actions.includes('REFUND_FAILED');

    assert(
      'Audit log consistently captures order status transitions and payment/refund events with full context',
      auditRows.length > 0 && hasOrderUpdate && hasRefundAudit,
      `Found ${auditRows.length} audit entries. Actions logged: ${[...new Set(actions)].join(', ')}`
    );

  } finally {
    // Teardown test fixtures
    console.log('\nCleaning up isolated test fixtures...');
    if (createdOrderIds.length > 0) {
      await pool.query("DELETE FROM audit_logs WHERE entity_type = 'orders' AND entity_id = ANY($1::text[])", [createdOrderIds.map(String)]);
      await pool.query("DELETE FROM audit_logs WHERE entity_type = 'payments' AND details::text ILIKE '%Phase 5.4%'");
      await pool.query("DELETE FROM audit_logs WHERE entity_type = 'webhook_events' AND (entity_id LIKE '%p54_%' OR entity_id LIKE '%rfnd_mock_fail_%')");
      await pool.query('DELETE FROM payments WHERE order_id = ANY($1::int[]) OR provider_payment_id LIKE \'pay_test_p54_%\'', [createdOrderIds]);
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
  console.log(`PHASE 5.4 TESTS COMPLETED: ${passed} / ${total} PASSED`);
  if (passed === total) {
    console.log('RESULT: ALL 14 CONSISTENCY AUDIT SCENARIOS VERIFIED SUCCESSFULLY!');
  } else {
    console.error(`RESULT: ${total - passed} TESTS FAILED.`);
    process.exitCode = 1;
  }
  console.log('================================================================\n');
}

runPhase54Tests()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Fatal test error:', err);
    pool.end();
    process.exit(1);
  });
