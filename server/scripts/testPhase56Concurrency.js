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

async function runPhase56Tests() {
  console.log('================================================================');
  console.log('MAJESTIC BLAZER — PHASE 5.6 CONCURRENCY & INTEGRITY TEST SUITE');
  console.log('Simultaneous Webhooks, Racing Actions & Transaction Rollbacks');
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
  const adminId = 1;

  const adminToken = generateTestToken(adminId, 'admin');
  const customer1Token = generateTestToken(customerId1, 'customer');

  // Clean up any leftover test data
  await pool.query("DELETE FROM audit_logs WHERE entity_type = 'orders' AND details::text ILIKE '%Phase 5.6%'");
  await pool.query("DELETE FROM audit_logs WHERE entity_type = 'payments' AND details::text ILIKE '%Phase 5.6%'");
  await pool.query("DELETE FROM audit_logs WHERE entity_type = 'webhook_events' AND entity_id LIKE '%p56_%'");
  await pool.query("DELETE FROM payments WHERE provider_payment_id LIKE 'pay_test_p56_%' OR provider_order_id LIKE 'cod_ord_p56_%'");
  await pool.query("DELETE FROM inventory_reservations WHERE order_id IN (SELECT id FROM orders WHERE notes LIKE '%Phase 5.6%')");
  await pool.query("DELETE FROM order_items WHERE product_id IN (SELECT id FROM products WHERE name LIKE '%Phase 5.6%')");
  await pool.query("DELETE FROM orders WHERE notes LIKE '%Phase 5.6%'");
  await pool.query("DELETE FROM product_variants WHERE sku LIKE 'SKU-P56-%'");
  await pool.query("DELETE FROM products WHERE name LIKE '%Phase 5.6%'");

  const { rows: catRows } = await pool.query('SELECT id FROM categories LIMIT 1');
  const validCategoryId = catRows[0]?.id || 3;

  // Create isolated test product and variant with initial stock = 30
  const { rows: pRows } = await pool.query(
    `INSERT INTO products (
      category_id, name, slug, description, color, material, fit,
      sale_price, original_price,
      is_purchasable, is_active
    ) VALUES (
      $1, 'Phase 5.6 Concurrency Audit Blazer', 'phase-5-6-concurrency-blazer-' || floor(random()*100000)::text,
      'Test blazer for simultaneous webhooks, racing actions, and rollback integrity',
      'Charcoal Silk', 'Italian Wool', 'Tailored',
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
      $1, 'SKU-P56-' || floor(random()*100000)::text, '42R', 30
    ) RETURNING id, stock_quantity`,
    [testProductId]
  );
  const testVariantId = vRows[0].id;

  console.log(`Created isolated test product ID: ${testProductId}, variant ID: ${testVariantId}, stock: 30\n`);

  async function createTestOrder(qty = 1, custId = customerId1, notes = 'Phase 5.6 Order') {
    return await Order.create(custId, {
      items: [{ variantId: testVariantId, quantity: qty }],
      deliveryType: 'delivery',
      shippingAddress: { line1: '789 Concurrency Blvd', city: 'Coimbatore', state: 'Tamil Nadu', pincode: '641107' },
      discount: 0,
      notes: `${notes} - ${Date.now()}`,
    });
  }

  try {
    // =============================================================
    // TEST 1: Two Simultaneous Duplicate Webhook Deliveries
    // =============================================================
    const simOrder1 = await createTestOrder(1, customerId1, 'Phase 5.6 Test 1 Sim Webhook');
    const simPay1 = await Payment.recordPayment({
      orderId: simOrder1.id,
      userId: customerId1,
      provider: 'razorpay',
      providerPaymentId: `pay_test_p56_t1_${Date.now()}`,
      amount: simOrder1.total,
      status: 'paid',
    });

    const simEventId1 = `evt_p56_sim_${Date.now()}`;
    const simWebhookPayload1 = {
      event: 'refund.processed',
      id: simEventId1,
      payload: {
        refund: {
          entity: {
            id: `rfnd_p56_sim_${Date.now()}`,
            payment_id: simPay1.provider_payment_id,
            amount: Number(simPay1.amount) * 100,
          },
        },
      },
    };

    // Fire two identical webhooks simultaneously
    const [simRes1a, simRes1b] = await Promise.all([
      request(BASE_URL, '/payments/webhook', {
        method: 'POST',
        headers: computeWebhookHeaders(simWebhookPayload1),
        body: simWebhookPayload1,
      }),
      request(BASE_URL, '/payments/webhook', {
        method: 'POST',
        headers: computeWebhookHeaders(simWebhookPayload1),
        body: simWebhookPayload1,
      }),
    ]);

    const { rows: pay1Check } = await pool.query('SELECT status, refund_status FROM payments WHERE id = $1', [simPay1.id]);
    const { rows: audit1Count } = await pool.query(
      "SELECT COUNT(*) as count FROM audit_logs WHERE action = 'WEBHOOK_EVENT_PROCESSED' AND entity_id = $1",
      [simEventId1]
    );

    const hasDuplicate = simRes1a.data?.duplicate === true || simRes1b.data?.duplicate === true;

    assert(
      'Two simultaneous duplicate webhook deliveries: exactly one processes and other deduplicates atomically',
      simRes1a.status === 200 &&
      simRes1b.status === 200 &&
      hasDuplicate &&
      pay1Check[0].status === 'refunded' &&
      pay1Check[0].refund_status === 'processed' &&
      Number(audit1Count[0].count) === 1,
      `ResA duplicate=${simRes1a.data?.duplicate}, ResB duplicate=${simRes1b.data?.duplicate}, Audit count=${audit1Count[0].count}`
    );

    // =============================================================
    // TEST 2: Two Different Webhook Events for Same Payment
    // =============================================================
    const diffOrder2 = await createTestOrder(1, customerId1, 'Phase 5.6 Test 2 Diff Events');
    const diffPaymentId2 = `pay_test_p56_t2_${Date.now()}`;
    const diffOrderId2 = `order_test_p56_t2_${Date.now()}`;

    // Event A: payment.captured
    const eventCapturePayload = {
      event: 'payment.captured',
      id: `evt_p56_cap_${Date.now()}`,
      payload: {
        payment: {
          entity: {
            id: diffPaymentId2,
            order_id: diffOrderId2,
            amount: Number(diffOrder2.total) * 100,
          },
        },
      },
    };

    const res2a = await request(BASE_URL, '/payments/webhook', {
      method: 'POST',
      headers: computeWebhookHeaders(eventCapturePayload),
      body: eventCapturePayload,
    });

    const { rows: pay2AfterCapture } = await pool.query('SELECT id, status FROM payments WHERE provider_payment_id = $1', [diffPaymentId2]);

    // Event B: refund.processed for the same payment
    const eventRefundPayload = {
      event: 'refund.processed',
      id: `evt_p56_ref_${Date.now()}`,
      payload: {
        refund: {
          entity: {
            id: `rfnd_p56_diff_${Date.now()}`,
            payment_id: diffPaymentId2,
            amount: Number(diffOrder2.total) * 100,
          },
        },
      },
    };

    const res2b = await request(BASE_URL, '/payments/webhook', {
      method: 'POST',
      headers: computeWebhookHeaders(eventRefundPayload),
      body: eventRefundPayload,
    });

    const { rows: pay2AfterRefund } = await pool.query('SELECT status, refund_status FROM payments WHERE provider_payment_id = $1', [diffPaymentId2]);

    assert(
      'Two different webhook events for same payment (capture -> refund) are processed according to state',
      res2a.status === 200 &&
      res2b.status === 200 &&
      pay2AfterCapture[0]?.status === 'paid' &&
      pay2AfterRefund[0]?.status === 'refunded' &&
      pay2AfterRefund[0]?.refund_status === 'processed',
      `After Capture status="${pay2AfterCapture[0]?.status}", After Refund status="${pay2AfterRefund[0]?.status}"`
    );

    // =============================================================
    // TEST 3: Duplicate COD Collection Requests Concurrency
    // =============================================================
    const codOrder3 = await createTestOrder(1, customerId1, 'Phase 5.6 Test 3 COD Concur');
    await request(BASE_URL, '/payments/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer1Token}` },
      body: { orderId: codOrder3.id, provider: 'cod' },
    });

    const { rows: codPayRows } = await pool.query('SELECT id, status FROM payments WHERE order_id = $1 AND provider = \'cod\'', [codOrder3.id]);
    const targetCodPayId = codPayRows[0]?.id;

    // Fire two simultaneous collection requests
    const [res3a, res3b] = await Promise.all([
      request(BASE_URL, `/payments/${targetCodPayId}/collect-cod`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
      request(BASE_URL, `/payments/${targetCodPayId}/collect-cod`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
    ]);

    const { rows: codPayFinal } = await pool.query('SELECT status FROM payments WHERE id = $1', [targetCodPayId]);
    const { rows: codAuditCount } = await pool.query(
      "SELECT COUNT(*) as count FROM audit_logs WHERE action = 'COD_PAYMENT_COLLECTED' AND entity_id = $1",
      [String(targetCodPayId)]
    );

    assert(
      'Duplicate concurrent COD collection requests serialize cleanly (both return 200, exactly 1 audit log)',
      res3a.status === 200 &&
      res3b.status === 200 &&
      codPayFinal[0].status === 'paid' &&
      Number(codAuditCount[0].count) === 1,
      `ResA status=${res3a.status}, ResB status=${res3b.status}, Payment status="${codPayFinal[0].status}", Audit count=${codAuditCount[0].count}`
    );

    // =============================================================
    // TEST 4: Refund Webhook Racing With Administrator Action
    // =============================================================
    const raceOrder4 = await createTestOrder(1, customerId1, 'Phase 5.6 Test 4 Race Admin Webhook');
    const racePay4 = await Payment.recordPayment({
      orderId: raceOrder4.id,
      userId: customerId1,
      provider: 'razorpay',
      providerPaymentId: `pay_test_p56_t4_${Date.now()}`,
      amount: raceOrder4.total,
      status: 'paid',
    });

    const raceWebhookPayload = {
      event: 'refund.processed',
      id: `evt_p56_race_${Date.now()}`,
      payload: {
        refund: {
          entity: {
            id: `rfnd_p56_race_${Date.now()}`,
            payment_id: racePay4.provider_payment_id,
            amount: Number(racePay4.amount) * 100,
          },
        },
      },
    };

    // Race: Admin calls /refund while webhook calls /webhook
    const [adminRaceRes, webhookRaceRes] = await Promise.all([
      request(BASE_URL, `/payments/${racePay4.id}/refund`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { refundAmount: Number(racePay4.amount), reason: 'Concurrent admin refund' },
      }),
      request(BASE_URL, '/payments/webhook', {
        method: 'POST',
        headers: computeWebhookHeaders(raceWebhookPayload),
        body: raceWebhookPayload,
      }),
    ]);

    const { rows: racePayFinal } = await pool.query('SELECT status, refund_status FROM payments WHERE id = $1', [racePay4.id]);

    assert(
      'Refund webhook racing with administrator action resolves safely under row-level locking without deadlock',
      adminRaceRes.status === 200 &&
      webhookRaceRes.status === 200 &&
      racePayFinal[0].status === 'refunded' &&
      racePayFinal[0].refund_status === 'processed',
      `Admin status=${adminRaceRes.status}, Webhook status=${webhookRaceRes.status}, Final: status="${racePayFinal[0].status}", refund="${racePayFinal[0].refund_status}"`
    );

    // =============================================================
    // TEST 5: Payment Callback Racing With Order Cancellation
    // =============================================================
    const raceOrder5 = await createTestOrder(1, customerId1, 'Phase 5.6 Test 5 Race Cancel Payment');
    const { rows: vBefore5 } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId]);

    const race5PaymentId = `pay_test_p56_t5_${Date.now()}`;
    const race5OrderId = `order_test_p56_t5_${Date.now()}`;
    const race5Sig = computePaymentSignature(race5OrderId, race5PaymentId);

    // Concurrently: Customer cancels and Gateway callback arrives
    const [cancelRes5, paymentRes5] = await Promise.all([
      request(BASE_URL, `/orders/${raceOrder5.id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { reason: 'Delivery timing no longer suitable' },
      }),
      request(BASE_URL, '/payments/verify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${customer1Token}` },
        body: {
          orderId: raceOrder5.id,
          razorpayOrderId: race5OrderId,
          razorpayPaymentId: race5PaymentId,
          razorpaySignature: race5Sig,
          provider: 'razorpay',
        },
      }),
    ]);

    const race5OrderFinal = await Order.getById(raceOrder5.id);
    const { rows: vAfter5 } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId]);
    const { rows: pay5Rows } = await pool.query('SELECT * FROM payments WHERE provider_payment_id = $1', [race5PaymentId]);

    const isConsistentOutcome =
      race5OrderFinal.status === 'cancelled' &&
      vAfter5[0].stock_quantity === vBefore5[0].stock_quantity &&
      (pay5Rows.length === 0 || pay5Rows[0].refund_status === 'pending' || pay5Rows[0].status === 'paid');

    assert(
      'Payment callback racing with order cancellation guarantees order remains cancelled and stock protected',
      isConsistentOutcome,
      `Order status="${race5OrderFinal.status}", Stock preserved=${vAfter5[0].stock_quantity === vBefore5[0].stock_quantity}, Payment status="${pay5Rows[0]?.status}", Refund="${pay5Rows[0]?.refund_status}"`
    );

    // =============================================================
    // TEST 6: Concurrent Inventory Updates
    // =============================================================
    const [stockRes1, stockRes2] = await Promise.all([
      request(BASE_URL, `/inventory/${testVariantId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { stockQuantity: 35, reason: 'Concurrent Count Adjustment A' },
      }),
      request(BASE_URL, `/inventory/${testVariantId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { stockQuantity: 40, reason: 'Concurrent Count Adjustment B' },
      }),
    ]);

    const { rows: vFinal6 } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariantId]);
    const finalStockVal = vFinal6[0].stock_quantity;

    assert(
      'Concurrent inventory updates serialize safely with row-level locking (zero deadlocks, valid final stock)',
      stockRes1.status === 200 &&
      stockRes2.status === 200 &&
      (finalStockVal === 35 || finalStockVal === 40),
      `Res1=${stockRes1.status}, Res2=${stockRes2.status}, Final Stock=${finalStockVal}`
    );

    // =============================================================
    // TEST 7: Duplicate Audit-Event Prevention
    // =============================================================
    const auditOrder7 = await createTestOrder(1, customerId1, 'Phase 5.6 Test 7 Audit Prevention');

    // First cancel
    await request(BASE_URL, `/orders/${auditOrder7.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer1Token}` },
      body: { reason: 'Selected alternate blazer style' },
    });

    // Idempotent second cancel
    await request(BASE_URL, `/orders/${auditOrder7.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer1Token}` },
      body: { reason: 'Selected alternate blazer style' },
    });

    const { rows: cancelAuditCount } = await pool.query(
      "SELECT COUNT(*) as count FROM audit_logs WHERE action = 'ORDER_CANCELLED' AND entity_id = $1",
      [String(auditOrder7.id)]
    );

    assert(
      'Duplicate idempotent operations prevent duplicate audit log spam (exactly 1 audit log entry)',
      Number(cancelAuditCount[0].count) === 1,
      `Audit log entries for cancelled order=${cancelAuditCount[0].count}`
    );

    // =============================================================
    // TEST 8: Rollback After Failed Financial Transaction
    // =============================================================
    const rollbackOrder8 = await createTestOrder(1, customerId1, 'Phase 5.6 Test 8 Rollback');
    const rollbackPay8 = await Payment.recordPayment({
      orderId: rollbackOrder8.id,
      userId: customerId1,
      provider: 'manual',
      providerPaymentId: `pay_test_p56_t8_${Date.now()}`,
      amount: rollbackOrder8.total,
      status: 'paid',
    });

    // Attempt illegal refund exceeding transaction amount (e.g. ₹999,999)
    const illegalRefundRes = await request(BASE_URL, `/payments/${rollbackPay8.id}/refund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { refundAmount: 999999, reason: 'Exorbitant refund' },
    });

    const { rows: pay8AfterRollback } = await pool.query('SELECT status, refund_status, refund_amount FROM payments WHERE id = $1', [rollbackPay8.id]);
    const { rows: auditRollback } = await pool.query(
      "SELECT * FROM audit_logs WHERE action IN ('REFUND_REQUESTED', 'REFUND_PROCESSED') AND entity_id = $1",
      [String(rollbackPay8.id)]
    );

    assert(
      'Rollback after failed financial transaction cleanly discards partial mutations and orphaned audit logs',
      illegalRefundRes.status === 400 &&
      pay8AfterRollback[0].status === 'paid' &&
      pay8AfterRollback[0].refund_status === null &&
      Number(pay8AfterRollback[0].refund_amount) === 0 &&
      auditRollback.length === 0,
      `HTTP status=${illegalRefundRes.status}, Payment status="${pay8AfterRollback[0].status}", Orphaned audit logs=${auditRollback.length}`
    );

  } finally {
    // Teardown: Safely clean up test fixtures
    console.log('\nCleaning up Phase 5.6 test fixtures...');
    await pool.query("DELETE FROM audit_logs WHERE entity_type = 'orders' AND details::text ILIKE '%Phase 5.6%'");
    await pool.query("DELETE FROM audit_logs WHERE entity_type = 'payments' AND details::text ILIKE '%Phase 5.6%'");
    await pool.query("DELETE FROM audit_logs WHERE entity_type = 'webhook_events' AND entity_id LIKE '%p56_%'");
    await pool.query("DELETE FROM payments WHERE provider_payment_id LIKE 'pay_test_p56_%' OR provider_order_id LIKE 'cod_ord_p56_%'");
    await pool.query("DELETE FROM inventory_reservations WHERE order_id IN (SELECT id FROM orders WHERE notes LIKE '%Phase 5.6%')");
    await pool.query("DELETE FROM order_items WHERE product_id = $1", [testProductId]);
    await pool.query("DELETE FROM orders WHERE notes LIKE '%Phase 5.6%'");
    await pool.query("DELETE FROM product_variants WHERE id = $1", [testVariantId]);
    await pool.query("DELETE FROM products WHERE id = $1", [testProductId]);

    server.close();
    console.log('Isolated test fixtures safely cleaned up.\n');
  }

  console.log('================================================================');
  console.log(`PHASE 5.6 CONCURRENCY TEST RESULTS: ${passed} / ${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runPhase56Tests().then(() => {
  pool.end();
}).catch((err) => {
  console.error('Fatal test runner error:', err);
  pool.end();
  process.exit(1);
});
