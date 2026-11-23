import http from 'http';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import * as Order from '../src/models/orderModel.js';
import * as Payment from '../src/models/paymentModel.js';

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
  const bodyString = typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj);
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
    fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
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

async function runPhase55Tests() {
  console.log('================================================================');
  console.log('MAJESTIC BLAZER — PHASE 5.5 FINANCIAL CONSISTENCY TEST SUITE');
  console.log('COD Lifecycle, Refund States, Webhook Security & Reconciliation');
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

  // Clean up any leftover test data from prior runs
  await pool.query("DELETE FROM audit_logs WHERE entity_type = 'orders' AND details::text ILIKE '%Phase 5.5%'");
  await pool.query("DELETE FROM audit_logs WHERE entity_type = 'payments' AND details::text ILIKE '%Phase 5.5%'");
  await pool.query("DELETE FROM audit_logs WHERE entity_type = 'webhook_events' AND entity_id LIKE '%p55_%'");
  await pool.query("DELETE FROM payments WHERE provider_payment_id LIKE 'pay_test_p55_%' OR provider_order_id LIKE 'cod_ord_p55_%'");
  await pool.query("DELETE FROM inventory_reservations WHERE order_id IN (SELECT id FROM orders WHERE notes LIKE '%Phase 5.5%')");
  await pool.query("DELETE FROM order_items WHERE product_id IN (SELECT id FROM products WHERE name LIKE '%Phase 5.5%')");
  await pool.query("DELETE FROM orders WHERE notes LIKE '%Phase 5.5%'");
  await pool.query("DELETE FROM product_variants WHERE sku LIKE 'SKU-P55-%'");
  await pool.query("DELETE FROM products WHERE name LIKE '%Phase 5.5%'");

  const { rows: catRows } = await pool.query('SELECT id FROM categories LIMIT 1');
  const validCategoryId = catRows[0]?.id || 3;

  // Create isolated test product and variant with initial stock = 20
  const { rows: pRows } = await pool.query(
    `INSERT INTO products (
      category_id, name, slug, description, color, material, fit,
      sale_price, original_price,
      is_purchasable, is_active
    ) VALUES (
      $1, 'Phase 5.5 Financial Consistency Blazer', 'phase-5-5-financial-blazer-' || floor(random()*100000)::text,
      'Test blazer for COD, refunds, webhooks and financial reconciliation',
      'Midnight Navy', 'Italian Silk Wool', 'Tailored',
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
      $1, 'SKU-P55-' || floor(random()*100000)::text, '42R', 20
    ) RETURNING id, stock_quantity`,
    [testProductId]
  );
  const testVariantId = vRows[0].id;

  console.log(`Created isolated test product ID: ${testProductId}, variant ID: ${testVariantId}, stock: 20\n`);

  async function createTestOrder(qty = 1, custId = customerId1, notes = 'Phase 5.5 Order') {
    return await Order.create(custId, {
      items: [{ variantId: testVariantId, quantity: qty }],
      deliveryType: 'delivery',
      shippingAddress: { line1: '456 Sartorial Ave', city: 'Coimbatore', state: 'Tamil Nadu', pincode: '641107' },
      discount: 0,
      notes: `${notes} - ${Date.now()}`,
    });
  }

  try {
    // =============================================================
    // TEST 1: COD Confirmation Without Payment Collection
    // =============================================================
    const order1 = await createTestOrder(1, customerId1, 'Phase 5.5 Test 1 COD Confirm');
    const { rows: vBefore1 } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId]);

    const res1 = await request(BASE_URL, '/payments/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer1Token}` },
      body: {
        orderId: order1.id,
        provider: 'cod',
      },
    });

    const order1Db = await Order.getById(order1.id);
    const { rows: vAfter1 } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId]);

    assert(
      'COD order confirmed without payment collection (order="confirmed", payment="created", stock decremented)',
      res1.status === 200 &&
      order1Db.status === 'confirmed' &&
      order1Db.payment?.provider === 'cod' &&
      order1Db.payment?.status === 'created' &&
      order1Db.payment?.refundStatus === null &&
      vAfter1[0].stock_quantity === vBefore1[0].stock_quantity - 1,
      `Order status="${order1Db.status}", Payment status="${order1Db.payment?.status}", Stock decremented to ${vAfter1[0].stock_quantity}`
    );

    // =============================================================
    // TEST 2: COD Collection Marking Payment as Paid
    // =============================================================
    const codPaymentId = order1Db.payment.id;
    const res2 = await request(BASE_URL, `/payments/${codPaymentId}/collect-cod`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const { rows: payRows2 } = await pool.query('SELECT status, provider FROM payments WHERE id = $1', [codPaymentId]);
    const { rows: auditRows2 } = await pool.query(
      "SELECT action FROM audit_logs WHERE action = 'COD_PAYMENT_COLLECTED' AND entity_id = $1",
      [String(codPaymentId)]
    );

    assert(
      'COD collection marks payment as paid and records audit log',
      res2.status === 200 &&
      payRows2[0]?.status === 'paid' &&
      payRows2[0]?.provider === 'cod' &&
      auditRows2.length === 1,
      `Payment status="${payRows2[0]?.status}", Audit action="${auditRows2[0]?.action}"`
    );

    // =============================================================
    // TEST 3: Duplicate COD Collection Idempotency
    // =============================================================
    const res3 = await request(BASE_URL, `/payments/${codPaymentId}/collect-cod`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const { rows: payCount3 } = await pool.query('SELECT COUNT(*) as count FROM payments WHERE id = $1', [codPaymentId]);
    const { rows: auditRows3 } = await pool.query(
      "SELECT action FROM audit_logs WHERE action = 'COD_PAYMENT_COLLECTED' AND entity_id = $1",
      [String(codPaymentId)]
    );

    assert(
      'Duplicate COD collection is idempotent (returns 200, no duplicate payment records, no duplicate audit logs)',
      res3.status === 200 &&
      Number(payCount3[0].count) === 1 &&
      auditRows3.length === 1,
      `HTTP status=${res3.status}, Payments count=${payCount3[0].count}, Audit logs count=${auditRows3.length}`
    );

    // =============================================================
    // TEST 4: Return Accepted While Refund Remains Pending
    // =============================================================
    const order4 = await createTestOrder(1, customerId1, 'Phase 5.5 Test 4 Return & Refund');
    const pay4 = await Payment.recordPayment({
      orderId: order4.id,
      userId: customerId1,
      provider: 'razorpay',
      providerPaymentId: `pay_test_p55_t4_${Date.now()}`,
      amount: order4.total,
      status: 'paid',
    });

    // Advance order to delivered then refunded (return accepted)
    await Order.updateStatus(order4.id, { status: 'shipped', trackingNumber: 'TRK_P55_4' });
    await Order.updateStatus(order4.id, { status: 'delivered' });
    await Order.updateStatus(order4.id, { status: 'refunded', notes: 'Client returned blazer; atelier inspected' });

    // Admin initiates refund request
    const res4 = await request(BASE_URL, `/payments/${pay4.id}/refund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { refundAmount: Number(pay4.amount), reason: 'Customer return accepted' },
    });

    const order4Db = await Order.getById(order4.id);

    assert(
      'Return accepted while refund remains pending (order="refunded", payment status="paid", refund_status="pending")',
      res4.status === 200 &&
      order4Db.status === 'refunded' &&
      order4Db.payment?.status === 'paid' &&
      order4Db.payment?.refundStatus === 'pending',
      `Order status="${order4Db.status}", Payment status="${order4Db.payment?.status}", Refund status="${order4Db.payment?.refundStatus}"`
    );

    // =============================================================
    // TEST 5: Refund Completion After Verified Gateway Confirmation
    // =============================================================
    const refundWebhookPayload5 = {
      event: 'refund.processed',
      id: `evt_p55_ref_proc_${Date.now()}`,
      payload: {
        refund: {
          entity: {
            id: `rfnd_p55_proc_${Date.now()}`,
            payment_id: pay4.provider_payment_id,
            amount: Number(pay4.amount) * 100,
          },
        },
      },
    };

    const res5 = await request(BASE_URL, '/payments/webhook', {
      method: 'POST',
      headers: computeWebhookHeaders(refundWebhookPayload5),
      body: refundWebhookPayload5,
    });

    const { rows: pay5Updated } = await pool.query('SELECT status, refund_status FROM payments WHERE id = $1', [pay4.id]);
    const { rows: audit5 } = await pool.query(
      "SELECT action FROM audit_logs WHERE action = 'REFUND_PROCESSED' AND entity_id = $1",
      [String(pay4.id)]
    );

    assert(
      'Refund completed after verified gateway confirmation (payment="refunded", refund_status="processed", audit logged)',
      res5.status === 200 &&
      pay5Updated[0]?.status === 'refunded' &&
      pay5Updated[0]?.refund_status === 'processed' &&
      audit5.length === 1,
      `Webhook HTTP=${res5.status}, Payment status="${pay5Updated[0]?.status}", Refund status="${pay5Updated[0]?.refund_status}"`
    );

    // =============================================================
    // TEST 6: Failed Refund Handling
    // =============================================================
    const order6 = await createTestOrder(1, customerId1, 'Phase 5.5 Test 6 Failed Refund');
    const pay6 = await Payment.recordPayment({
      orderId: order6.id,
      userId: customerId1,
      provider: 'razorpay',
      providerPaymentId: `pay_test_p55_t6_${Date.now()}`,
      amount: order6.total,
      status: 'paid',
    });

    // Admin requests refund
    await request(BASE_URL, `/payments/${pay6.id}/refund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { refundAmount: Number(pay6.amount), reason: 'Refund to fail' },
    });

    // Gateway reports refund failure
    const refundWebhookPayload6 = {
      event: 'refund.failed',
      id: `evt_p55_ref_fail_${Date.now()}`,
      payload: {
        refund: {
          entity: {
            id: `rfnd_p55_fail_${Date.now()}`,
            payment_id: pay6.provider_payment_id,
            amount: Number(pay6.amount) * 100,
          },
        },
      },
    };

    const res6 = await request(BASE_URL, '/payments/webhook', {
      method: 'POST',
      headers: computeWebhookHeaders(refundWebhookPayload6),
      body: refundWebhookPayload6,
    });

    const { rows: pay6Updated } = await pool.query('SELECT status, refund_status FROM payments WHERE id = $1', [pay6.id]);
    const { rows: audit6 } = await pool.query(
      "SELECT action FROM audit_logs WHERE action = 'REFUND_FAILED' AND entity_id = $1",
      [String(pay6.id)]
    );

    assert(
      'Failed refund handling preserves payment="paid" and marks refund_status="failed"',
      res6.status === 200 &&
      pay6Updated[0]?.status === 'paid' &&
      pay6Updated[0]?.refund_status === 'failed' &&
      audit6.length === 1,
      `Payment status="${pay6Updated[0]?.status}", Refund status="${pay6Updated[0]?.refund_status}"`
    );

    // =============================================================
    // TEST 7: Late Payment After Order Cancellation
    // =============================================================
    const order7 = await createTestOrder(1, customerId1, 'Phase 5.5 Test 7 Late Payment');
    const { rows: vBefore7 } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId]);

    // Customer cancels pending order
    await request(BASE_URL, `/orders/${order7.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer1Token}` },
      body: { reason: 'Ordered incorrect size' },
    });

    const order7Cancelled = await Order.getById(order7.id);
    const latePaymentId = `pay_test_p55_t7_${Date.now()}`;
    const lateOrderId = `order_test_p55_t7_${Date.now()}`;
    const lateSig = computePaymentSignature(lateOrderId, latePaymentId);

    // Late payment callback arrives
    const res7 = await request(BASE_URL, '/payments/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer1Token}` },
      body: {
        orderId: order7.id,
        razorpayOrderId: lateOrderId,
        razorpayPaymentId: latePaymentId,
        razorpaySignature: lateSig,
        provider: 'razorpay',
      },
    });

    const order7AfterLate = await Order.getById(order7.id);
    const { rows: vAfter7 } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId]);
    const { rows: pay7Rows } = await pool.query('SELECT * FROM payments WHERE provider_payment_id = $1', [latePaymentId]);
    const { rows: audit7 } = await pool.query(
      "SELECT action FROM audit_logs WHERE action = 'PAYMENT_ON_CANCELLED_ORDER' AND entity_id = $1",
      [String(pay7Rows[0]?.id)]
    );

    assert(
      'Late payment on cancelled order keeps order cancelled, does not deduct stock, records refund pending, and alerts admin',
      order7Cancelled.status === 'cancelled' &&
      order7AfterLate.status === 'cancelled' &&
      vAfter7[0].stock_quantity === vBefore7[0].stock_quantity &&
      pay7Rows[0]?.status === 'paid' &&
      pay7Rows[0]?.refund_status === 'pending' &&
      audit7.length === 1,
      `Order status="${order7AfterLate.status}", Payment status="${pay7Rows[0]?.status}", Refund status="${pay7Rows[0]?.refund_status}"`
    );

    // =============================================================
    // TEST 8: Duplicate Late-Payment Callbacks Idempotency
    // =============================================================
    const res8 = await request(BASE_URL, '/payments/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer1Token}` },
      body: {
        orderId: order7.id,
        razorpayOrderId: lateOrderId,
        razorpayPaymentId: latePaymentId,
        razorpaySignature: lateSig,
        provider: 'razorpay',
      },
    });

    const { rows: payCount8 } = await pool.query('SELECT COUNT(*) as cnt FROM payments WHERE provider_payment_id = $1', [latePaymentId]);
    const { rows: auditCount8 } = await pool.query(
      "SELECT COUNT(*) as cnt FROM audit_logs WHERE action = 'PAYMENT_ON_CANCELLED_ORDER' AND entity_id = $1",
      [String(pay7Rows[0]?.id)]
    );

    assert(
      'Duplicate late-payment callbacks are idempotent (returns 200, no duplicate payment records, no duplicate audit alerts)',
      res8.status === 200 &&
      Number(payCount8[0].cnt) === 1 &&
      Number(auditCount8[0].cnt) === 1,
      `Payments count=${payCount8[0].cnt}, Audit logs count=${auditCount8[0].cnt}`
    );

    // =============================================================
    // TEST 9: Invalid Razorpay Refund Webhook Signature
    // =============================================================
    const webhookPayload9 = {
      event: 'refund.processed',
      id: `evt_p55_invalid_sig_${Date.now()}`,
      payload: {
        refund: {
          entity: {
            id: 'rfnd_bad_sig_1',
            payment_id: pay6.provider_payment_id,
            amount: 50000,
          },
        },
      },
    };

    const res9 = await request(BASE_URL, '/payments/webhook', {
      method: 'POST',
      headers: { 'x-razorpay-signature': 'invalid_forged_sha256_signature_hex' },
      body: webhookPayload9,
    });

    const { rows: pay6Untouched } = await pool.query('SELECT status, refund_status FROM payments WHERE id = $1', [pay6.id]);

    assert(
      'Invalid Razorpay webhook signature is rejected (HTTP 400) without database mutations',
      res9.status === 400 &&
      pay6Untouched[0].status === 'paid' &&
      pay6Untouched[0].refund_status === 'failed',
      `HTTP status=${res9.status}, Error message="${res9.data?.message}"`
    );

    // =============================================================
    // TEST 10: Duplicate Refund Webhook Event Idempotency
    // =============================================================
    const webhookEventId10 = `evt_p55_dup_test_${Date.now()}`;
    const order10 = await createTestOrder(1, customerId1, 'Phase 5.5 Test 10 Dup Webhook');
    const pay10 = await Payment.recordPayment({
      orderId: order10.id,
      userId: customerId1,
      provider: 'razorpay',
      providerPaymentId: `pay_test_p55_t10_${Date.now()}`,
      amount: order10.total,
      status: 'paid',
    });

    const webhookPayload10 = {
      event: 'refund.processed',
      id: webhookEventId10,
      payload: {
        refund: {
          entity: {
            id: `rfnd_p55_dup_rfnd_${Date.now()}`,
            payment_id: pay10.provider_payment_id,
            amount: Number(pay10.amount) * 100,
          },
        },
      },
    };

    // First arrival
    const res10a = await request(BASE_URL, '/payments/webhook', {
      method: 'POST',
      headers: computeWebhookHeaders(webhookPayload10),
      body: webhookPayload10,
    });

    // Duplicate arrival
    const res10b = await request(BASE_URL, '/payments/webhook', {
      method: 'POST',
      headers: computeWebhookHeaders(webhookPayload10),
      body: webhookPayload10,
    });

    const { rows: pay10Updated } = await pool.query('SELECT status, refund_status FROM payments WHERE id = $1', [pay10.id]);

    assert(
      'Duplicate refund webhook event is deduplicated idempotently (duplicate=true, no redundant DB mutations)',
      res10a.status === 200 &&
      res10b.status === 200 &&
      res10b.data?.duplicate === true &&
      pay10Updated[0].status === 'refunded' &&
      pay10Updated[0].refund_status === 'processed',
      `First call ok=${res10a.ok}, Second call duplicate=${res10b.data?.duplicate}, Status=${pay10Updated[0].status}`
    );

    // =============================================================
    // TEST 11: Refund Event Matched to Correct Payment
    // =============================================================
    const order11a = await createTestOrder(1, customerId1, 'Phase 5.5 Test 11 Order A');
    const pay11a = await Payment.recordPayment({
      orderId: order11a.id,
      userId: customerId1,
      provider: 'razorpay',
      providerPaymentId: `pay_test_p55_t11a_${Date.now()}`,
      amount: order11a.total,
      status: 'paid',
    });

    const order11b = await createTestOrder(1, customerId2, 'Phase 5.5 Test 11 Order B');
    const pay11b = await Payment.recordPayment({
      orderId: order11b.id,
      userId: customerId2,
      provider: 'razorpay',
      providerPaymentId: `pay_test_p55_t11b_${Date.now()}`,
      amount: order11b.total,
      status: 'paid',
    });

    // Refund webhook targets only payment B
    const webhookPayload11 = {
      event: 'refund.processed',
      id: `evt_p55_match_${Date.now()}`,
      payload: {
        refund: {
          entity: {
            id: `rfnd_p55_match_b_${Date.now()}`,
            payment_id: pay11b.provider_payment_id,
            amount: Number(pay11b.amount) * 100,
          },
        },
      },
    };

    const res11 = await request(BASE_URL, '/payments/webhook', {
      method: 'POST',
      headers: computeWebhookHeaders(webhookPayload11),
      body: webhookPayload11,
    });

    const { rows: pay11aRow } = await pool.query('SELECT status, refund_status FROM payments WHERE id = $1', [pay11a.id]);
    const { rows: pay11bRow } = await pool.query('SELECT status, refund_status FROM payments WHERE id = $1', [pay11b.id]);

    assert(
      'Refund event matches only the designated payment (Payment B refunded, Payment A remains paid)',
      res11.status === 200 &&
      pay11aRow[0].status === 'paid' &&
      pay11aRow[0].refund_status === null &&
      pay11bRow[0].status === 'refunded' &&
      pay11bRow[0].refund_status === 'processed',
      `Payment A: status="${pay11aRow[0].status}", Payment B: status="${pay11bRow[0].status}"`
    );

    // =============================================================
    // TEST 12: Customer & Admin Display of Refund States
    // =============================================================
    const res12Cust = await request(BASE_URL, `/orders/${order4.id}`, {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    const res12Admin = await request(BASE_URL, `/orders/${order4.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert(
      'Customer and admin APIs return clear, non-contradictory order and refund states',
      res12Cust.status === 200 &&
      res12Admin.status === 200 &&
      res12Cust.data?.data?.status === 'refunded' &&
      res12Cust.data?.data?.payment?.refundStatus === 'processed' &&
      res12Admin.data?.data?.status === 'refunded' &&
      res12Admin.data?.data?.payment?.refundStatus === 'processed',
      `Cust status="${res12Cust.data?.data?.status}", Payment refundStatus="${res12Cust.data?.data?.payment?.refundStatus}"`
    );

    // =============================================================
    // TEST 13: Financial Record Reconciliation
    // =============================================================
    // Historical baseline payments had ID <= 210, exactly 56 records
    const { rows: baselineRows } = await pool.query('SELECT COUNT(*) as count FROM payments WHERE id <= 210');
    const { rows: orphanedPay } = await pool.query(`
      SELECT p.id FROM payments p
      LEFT JOIN orders o ON o.id = p.order_id
      WHERE p.order_id IS NOT NULL AND o.id IS NULL
    `);
    const { rows: orphanedInv } = await pool.query(`
      SELECT i.id FROM invoices i
      LEFT JOIN orders o ON o.id = i.order_id
      WHERE i.order_id IS NOT NULL AND o.id IS NULL
    `);

    assert(
      'Financial record reconciliation confirms baseline data preserved (56 historical payments intact, 0 orphaned payments, 0 orphaned invoices)',
      Number(baselineRows[0].count) === 56 &&
      orphanedPay.length === 0 &&
      orphanedInv.length === 0,
      `Baseline payments=${baselineRows[0].count}, Orphaned payments=${orphanedPay.length}, Orphaned invoices=${orphanedInv.length}`
    );

  } finally {
    // Teardown: Safely clean up test fixtures
    console.log('\nCleaning up Phase 5.5 test fixtures...');
    await pool.query("DELETE FROM audit_logs WHERE entity_type = 'orders' AND details::text ILIKE '%Phase 5.5%'");
    await pool.query("DELETE FROM audit_logs WHERE entity_type = 'payments' AND details::text ILIKE '%Phase 5.5%'");
    await pool.query("DELETE FROM audit_logs WHERE entity_type = 'webhook_events' AND entity_id LIKE '%p55_%'");
    await pool.query("DELETE FROM payments WHERE provider_payment_id LIKE 'pay_test_p55_%' OR provider_order_id LIKE 'cod_ord_p55_%'");
    await pool.query("DELETE FROM inventory_reservations WHERE order_id IN (SELECT id FROM orders WHERE notes LIKE '%Phase 5.5%')");
    await pool.query("DELETE FROM order_items WHERE product_id = $1", [testProductId]);
    await pool.query("DELETE FROM orders WHERE notes LIKE '%Phase 5.5%'");
    await pool.query("DELETE FROM product_variants WHERE id = $1", [testVariantId]);
    await pool.query("DELETE FROM products WHERE id = $1", [testProductId]);

    server.close();
    console.log('Isolated test fixtures safely cleaned up.\n');
  }

  console.log('================================================================');
  console.log(`PHASE 5.5 TEST RESULTS: ${passed} / ${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runPhase55Tests().then(() => {
  pool.end();
}).catch((err) => {
  console.error('Fatal test runner error:', err);
  pool.end();
  process.exit(1);
});
