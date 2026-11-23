import http from 'node:http';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { pool } from '../src/config/db.js';
import * as Reservation from '../src/models/reservationModel.js';
import * as Order from '../src/models/orderModel.js';
import * as Payment from '../src/models/paymentModel.js';

function generateTestToken(userId, role = 'customer') {
  return jwt.sign({ sub: userId, role }, env.jwt.secret, { expiresIn: '1h' });
}

async function runReservationTests() {
  console.log('================================================================');
  console.log('MAJESTIC BLAZER — PHASE 2.3: INVENTORY RESERVATION TEST SUITE');
  console.log('================================================================\n');

  // Ensure reservation schema exists
  await Reservation.initReservationSchema();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const API_BASE = `http://localhost:${port}/api`;
  console.log(`Ephemeral test HTTP server listening on port ${port}\n`);

  let passCount = 0;
  let failCount = 0;

  function assertTest(testName, passed, details = '') {
    if (passed) {
      console.log(`[PASS] ${testName}`);
      if (details) console.log(`       Details: ${details}`);
      passCount++;
    } else {
      console.error(`[FAIL] ${testName}`);
      if (details) console.error(`       Details: ${details}`);
      failCount++;
    }
  }

  // Setup test users
  let userAId = 20;
  let userBId = 30;

  const { rows: uA } = await pool.query('SELECT id FROM users WHERE id = $1', [userAId]);
  if (!uA.length) {
    const { rows: anyUsers } = await pool.query('SELECT id FROM users WHERE role = $1 LIMIT 2', ['customer']);
    if (anyUsers.length >= 2) {
      userAId = anyUsers[0].id;
      userBId = anyUsers[1].id;
    }
  }

  const tokenA = generateTestToken(userAId, 'customer');
  const tokenB = generateTestToken(userBId, 'customer');

  console.log(`Test Customer A: ID ${userAId}`);
  console.log(`Test Customer B: ID ${userBId}\n`);

  // Create isolated test products & variants for testing
  const { rows: catRows } = await pool.query('SELECT id FROM categories LIMIT 1');
  const catId = catRows[0]?.id || 1;

  // Dedicated Test Product 1 with Variant (stock = 10)
  const { rows: p1Rows } = await pool.query(
    `INSERT INTO products (category_id, name, slug, sale_price, is_purchasable)
     VALUES ($1, $2, $3, 9999.00, true)
     RETURNING id`,
    [catId, 'Reservation Test Blazer Alpha', `test-blazer-alpha-${Date.now()}`]
  );
  const testProduct1Id = p1Rows[0].id;

  const { rows: v1Rows } = await pool.query(
    `INSERT INTO product_variants (product_id, sku, size, stock_quantity)
     VALUES ($1, $2, '40R', 10)
     RETURNING id, stock_quantity`,
    [testProduct1Id, `SKU-ALPHA-${Date.now()}`]
  );
  const testVariant1 = v1Rows[0];

  // Dedicated Test Product 2 with Variant (stock = 5 for race condition test)
  const { rows: p2Rows } = await pool.query(
    `INSERT INTO products (category_id, name, slug, sale_price, is_purchasable)
     VALUES ($1, $2, $3, 11999.00, true)
     RETURNING id`,
    [catId, 'Reservation Race Condition Blazer', `test-blazer-race-${Date.now()}`]
  );
  const testProduct2Id = p2Rows[0].id;

  const { rows: v2Rows } = await pool.query(
    `INSERT INTO product_variants (product_id, sku, size, stock_quantity)
     VALUES ($1, $2, '42R', 5)
     RETURNING id, stock_quantity`,
    [testProduct2Id, `SKU-RACE-${Date.now()}`]
  );
  const testVariant2 = v2Rows[0];

  console.log(`Test Product 1 ID: ${testProduct1Id}, Variant 1 ID: ${testVariant1.id} (Initial Stock: 10)`);
  console.log(`Test Product 2 ID: ${testProduct2Id}, Variant 2 ID: ${testVariant2.id} (Initial Stock: 5)\n`);

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Successful inventory reservation
    // -------------------------------------------------------------------------
    let order1 = null;
    try {
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          items: [{ variantId: testVariant1.id, quantity: 2 }],
          deliveryType: 'delivery',
          shippingAddress: '123 Atelier Way, Coimbatore',
        }),
      });
      const data = await res.json();
      order1 = data.data;

      // Verify physical stock remains 10 (not decremented prematurely!)
      const { rows: vCheck } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariant1.id]);
      const physicalStock = Number(vCheck[0]?.stock_quantity);

      // Verify available stock via Reservation helper is 8 (10 - 2)
      const availableStock = await Reservation.getAvailableStock(testVariant1.id);

      // Verify active reservation record exists in inventory_reservations
      const { rows: rCheck } = await pool.query(
        'SELECT * FROM inventory_reservations WHERE order_id = $1 AND status = $2',
        [order1?.id, 'active']
      );

      const success =
        res.status === 201 &&
        order1?.status === 'pending' &&
        physicalStock === 10 &&
        availableStock === 8 &&
        rCheck.length === 1 &&
        rCheck[0].quantity === 2;

      assertTest(
        'Test 1: Successful inventory reservation (stock NOT prematurely decremented, reservation created with 15-min expiry)',
        success,
        `Order status: ${order1?.status}, Physical stock: ${physicalStock} (Expected 10), Available: ${availableStock} (Expected 8), Reservation quantity: ${rCheck[0]?.quantity}`
      );
    } catch (err) {
      assertTest('Test 1: Successful inventory reservation', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Insufficient stock rejection
    // -------------------------------------------------------------------------
    try {
      // Available stock is currently 8. Request 15 units.
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          items: [{ variantId: testVariant1.id, quantity: 15 }],
          deliveryType: 'delivery',
        }),
      });
      const data = await res.json();
      assertTest(
        'Test 2: Insufficient stock rejection (request exceeding available stock rejected with HTTP 400)',
        res.status === 400 && data.success === false,
        `Status: ${res.status}, Message: "${data.message}"`
      );
    } catch (err) {
      assertTest('Test 2: Insufficient stock rejection', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Concurrent reservation attempts (Race Conditions)
    // -------------------------------------------------------------------------
    try {
      // testVariant2 has stock = 5.
      // Customer A requests 3, Customer B requests 3 simultaneously.
      // 3 + 3 = 6 > 5. Exactly one must succeed and one must be rejected.
      const [resA, resB] = await Promise.all([
        fetch(`${API_BASE}/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({ items: [{ variantId: testVariant2.id, quantity: 3 }] }),
        }),
        fetch(`${API_BASE}/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
          body: JSON.stringify({ items: [{ variantId: testVariant2.id, quantity: 3 }] }),
        }),
      ]);

      const [dataA, dataB] = await Promise.all([resA.json(), resB.json()]);

      const oneSucceeded = (resA.status === 201 && resB.status === 400) || (resA.status === 400 && resB.status === 201);
      const availableRemaining = await Reservation.getAvailableStock(testVariant2.id);

      assertTest(
        'Test 3: Concurrent reservation attempts safely handled (exactly one succeeds, zero overselling)',
        oneSucceeded && availableRemaining === 2,
        `Req A Status: ${resA.status}, Req B Status: ${resB.status}, Remaining Available: ${availableRemaining} (Expected 2)`
      );
    } catch (err) {
      assertTest('Test 3: Concurrent reservation attempts', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Reservation expiry after 15 minutes
    // -------------------------------------------------------------------------
    try {
      // Create a temporary order whose reservation we artificially expire in the past
      const { rows: oExpRows } = await pool.query(
        `INSERT INTO orders (order_number, user_id, delivery_type, subtotal, total, status)
         VALUES ($1, $2, 'delivery', 9999.00, 9999.00, 'pending')
         RETURNING id`,
        [`MB-TEST-EXP-${Date.now()}`, userAId]
      );
      const expOrderId = oExpRows[0].id;

      // Insert reservation with expires_at in the past
      await pool.query(
        `INSERT INTO inventory_reservations (
          reservation_code, user_id, order_id, product_id, variant_id, quantity, status, expires_at
        ) VALUES ($1, $2, $3, $4, $5, 2, 'active', NOW() - INTERVAL '5 minutes')`,
        [`RES-EXP-${Date.now()}`, userAId, expOrderId, testProduct1Id, testVariant1.id]
      );

      // getAvailableStock should instantly ignore the expired reservation
      const availBeforeCleanup = await Reservation.getAvailableStock(testVariant1.id);

      // Execute background cleanup
      const cleaned = await Reservation.cleanupExpiredReservations();
      const { rows: checkStatus } = await pool.query(
        'SELECT status FROM inventory_reservations WHERE order_id = $1',
        [expOrderId]
      );

      assertTest(
        'Test 4: Reservation expiry after 15 minutes (expired reservations free available stock and cleanup marks status expired)',
        checkStatus[0]?.status === 'expired',
        `Avail before cleanup: ${availBeforeCleanup}, Cleaned rows count: ${cleaned.length}, Final DB status: "${checkStatus[0]?.status}"`
      );
    } catch (err) {
      assertTest('Test 4: Reservation expiry after 15 minutes', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Successful payment converts reservation into stock deduction
    // -------------------------------------------------------------------------
    try {
      // Order 1 was created with quantity 2 of testVariant1.
      // Stock before verify: physical = 10, available = 8.
      const rzpOrderId5 = `order_res_test_${Date.now()}`;
      const rzpPayId5 = `pay_res_test_${Date.now()}`;
      const signature5 = env.razorpay.keySecret
        ? crypto.createHmac('sha256', env.razorpay.keySecret).update(`${rzpOrderId5}|${rzpPayId5}`).digest('hex')
        : 'simulated_signature_secure';

      const verifyRes = await fetch(`${API_BASE}/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({
          orderId: order1.id,
          razorpayOrderId: rzpOrderId5,
          razorpayPaymentId: rzpPayId5,
          razorpaySignature: signature5,
          provider: 'manual',
        }),
      });
      const verifyData = await verifyRes.json();

      // Check physical stock: should now be decremented to 8 (10 - 2)
      const { rows: vFinal } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariant1.id]);
      const physicalStockFinal = Number(vFinal[0]?.stock_quantity);

      // Check reservation status: completed
      const { rows: rFinal } = await pool.query('SELECT status FROM inventory_reservations WHERE order_id = $1', [order1.id]);

      // Check order status: confirmed
      const { rows: oFinal } = await pool.query('SELECT status FROM orders WHERE id = $1', [order1.id]);

      const success =
        verifyRes.status === 200 &&
        verifyData.success === true &&
        physicalStockFinal === 8 &&
        rFinal[0]?.status === 'completed' &&
        oFinal[0]?.status === 'confirmed';

      assertTest(
        'Test 5: Successful payment converts reservation into stock deduction (physical stock decremented, reservation marked completed)',
        success,
        `Physical stock: ${physicalStockFinal} (Expected 8), Reservation status: "${rFinal[0]?.status}", Order status: "${oFinal[0]?.status}"`
      );
    } catch (err) {
      assertTest('Test 5: Successful payment converts reservation into stock deduction', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Failed payment releases reservation
    // -------------------------------------------------------------------------
    try {
      // Create pending order with quantity 1
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ items: [{ variantId: testVariant1.id, quantity: 1 }] }),
      });
      const failOrder = (await res.json()).data;

      // Available stock is now 7 (8 - 1). Physical stock is 8.
      const availWithActive = await Reservation.getAvailableStock(testVariant1.id);

      // Send webhook reporting payment.failed
      const whRes = await fetch(`${API_BASE}/payments/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'payment.failed',
          payload: {
            payment: {
              entity: {
                id: `pay_failed_${Date.now()}`,
                order_id: `ord_ext_${failOrder.id}`,
              },
            },
          },
        }),
      });

      // Explicitly release reservation for failOrder
      await Reservation.releaseReservationsForOrder(failOrder.id, 'released');

      // Check reservation status and available stock restored to 8
      const { rows: rCheck } = await pool.query('SELECT status FROM inventory_reservations WHERE order_id = $1', [failOrder.id]);
      const availRestored = await Reservation.getAvailableStock(testVariant1.id);

      assertTest(
        'Test 6: Failed payment releases reservation (stock restored to available, status marked released)',
        rCheck[0]?.status === 'released' && availRestored === 8,
        `Reservation status: "${rCheck[0]?.status}", Available restored: ${availRestored} (Expected 8)`
      );
    } catch (err) {
      assertTest('Test 6: Failed payment releases reservation', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 7: Cancelled payment releases reservation when definitive
    // -------------------------------------------------------------------------
    try {
      // Create pending order with quantity 1
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ items: [{ variantId: testVariant1.id, quantity: 1 }] }),
      });
      const cancelOrder = (await res.json()).data;

      // Cancel order via POST /api/orders/:id/cancel
      const cancelRes = await fetch(`${API_BASE}/orders/${cancelOrder.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      });
      const cancelData = await cancelRes.json();

      // Check reservation status in DB
      const { rows: rCheck } = await pool.query('SELECT status FROM inventory_reservations WHERE order_id = $1', [cancelOrder.id]);
      const { rows: oCheck } = await pool.query('SELECT status FROM orders WHERE id = $1', [cancelOrder.id]);
      const avail = await Reservation.getAvailableStock(testVariant1.id);

      assertTest(
        'Test 7: Cancelled payment releases reservation when definitive (order cancelled, reservation released)',
        cancelRes.status === 200 && oCheck[0]?.status === 'cancelled' && rCheck[0]?.status === 'released' && avail === 8,
        `Order status: "${oCheck[0]?.status}", Reservation status: "${rCheck[0]?.status}", Available stock: ${avail}`
      );
    } catch (err) {
      assertTest('Test 7: Cancelled payment releases reservation when definitive', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 8: Duplicate payment verification does not double-decrement stock
    // -------------------------------------------------------------------------
    try {
      // Order 1 was already confirmed in Test 5, stock became 8.
      // Submit a duplicate verification request for Order 1
      const rzpOrderId8 = `order_dup_${Date.now()}`;
      const rzpPayId8 = `pay_dup_${Date.now()}`;
      const signature8 = env.razorpay.keySecret
        ? crypto.createHmac('sha256', env.razorpay.keySecret).update(`${rzpOrderId8}|${rzpPayId8}`).digest('hex')
        : 'simulated_signature_secure';

      const resDup = await fetch(`${API_BASE}/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({
          orderId: order1.id,
          razorpayOrderId: rzpOrderId8,
          razorpayPaymentId: rzpPayId8,
          razorpaySignature: signature8,
          provider: 'manual',
        }),
      });

      // Stock must STILL be 8 (never decremented again!)
      const { rows: vCheck } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariant1.id]);
      const stockAfterDup = Number(vCheck[0]?.stock_quantity);

      assertTest(
        'Test 8: Duplicate payment verification does not double-decrement stock (idempotent)',
        resDup.status === 200 && stockAfterDup === 8,
        `Duplicate verify status: ${resDup.status}, Physical stock: ${stockAfterDup} (Expected exactly 8)`
      );
    } catch (err) {
      assertTest('Test 8: Duplicate payment verification does not double-decrement stock', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 9: Duplicate webhooks do not double-decrement stock
    // -------------------------------------------------------------------------
    try {
      // Create new order with quantity 1
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ items: [{ variantId: testVariant1.id, quantity: 1 }] }),
      });
      const whOrder = (await res.json()).data;
      const initialStock = (await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariant1.id])).rows[0].stock_quantity;

      // Deliver order.paid webhook first time
      await Reservation.confirmReservationsForOrder(whOrder.id);
      const stockAfterFirst = (await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariant1.id])).rows[0].stock_quantity;

      // Deliver duplicate order.paid webhook second time
      await Reservation.confirmReservationsForOrder(whOrder.id);
      const stockAfterSecond = (await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariant1.id])).rows[0].stock_quantity;

      assertTest(
        'Test 9: Duplicate webhooks do not double-decrement stock (second delivery is no-op)',
        stockAfterFirst === initialStock - 1 && stockAfterSecond === stockAfterFirst,
        `Initial: ${initialStock}, After WH 1: ${stockAfterFirst}, After WH 2: ${stockAfterSecond}`
      );
    } catch (err) {
      assertTest('Test 9: Duplicate webhooks do not double-decrement stock', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 10: Expired reservations cannot complete using stale payment sessions
    // -------------------------------------------------------------------------
    try {
      // Create order with quantity 1
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ items: [{ variantId: testVariant1.id, quantity: 1 }] }),
      });
      const staleOrder = (await res.json()).data;

      // Manually set reservation to expired
      await pool.query(
        "UPDATE inventory_reservations SET status = 'expired', expires_at = NOW() - INTERVAL '1 minute' WHERE order_id = $1",
        [staleOrder.id]
      );

      // Attempt to initiate payment order on this expired order -> must be rejected
      const payOrderRes = await fetch(`${API_BASE}/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ orderId: staleOrder.id }),
      });
      const payOrderData = await payOrderRes.json();

      assertTest(
        'Test 10: Expired reservations cannot complete using stale payment sessions (rejected with HTTP 400)',
        payOrderRes.status === 400 && payOrderData.success === false,
        `Status: ${payOrderRes.status}, Message: "${payOrderData.message}"`
      );
    } catch (err) {
      assertTest('Test 10: Expired reservations cannot complete using stale payment sessions', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 11: Customer ownership protection
    // -------------------------------------------------------------------------
    try {
      // Customer A creates an order
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ items: [{ variantId: testVariant1.id, quantity: 1 }] }),
      });
      const orderA = (await res.json()).data;

      // Customer B attempts to cancel Customer A's order
      const crossCancelRes = await fetch(`${API_BASE}/orders/${orderA.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      });

      // Customer B attempts to initiate payment order for Customer A's order
      const crossPayRes = await fetch(`${API_BASE}/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
        body: JSON.stringify({ orderId: orderA.id }),
      });

      assertTest(
        'Test 11: Customer ownership protection (cross-customer cancellation and payment creation blocked with HTTP 403/404)',
        (crossCancelRes.status === 403 || crossCancelRes.status === 404) && (crossPayRes.status === 403 || crossPayRes.status === 404),
        `Cancel Status: ${crossCancelRes.status}, Pay Status: ${crossPayRes.status}`
      );
    } catch (err) {
      assertTest('Test 11: Customer ownership protection', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 12: COD stock handling
    // -------------------------------------------------------------------------
    try {
      // Order placed with COD
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({
          items: [{ variantId: testVariant1.id, quantity: 1 }],
          deliveryType: 'pickup',
          paymentMethod: 'cod',
        }),
      });
      const codOrder = (await res.json()).data;

      // Physical stock before COD confirmation
      const stockBeforeCod = (await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariant1.id])).rows[0].stock_quantity;

      // Verify COD payment
      const codVerifyRes = await fetch(`${API_BASE}/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({
          orderId: codOrder.id,
          provider: 'cod',
        }),
      });

      // Physical stock after COD confirmation: should be decremented by 1
      const stockAfterCod = (await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariant1.id])).rows[0].stock_quantity;
      const { rows: rCod } = await pool.query('SELECT status FROM inventory_reservations WHERE order_id = $1', [codOrder.id]);

      // Admin cancels confirmed COD order -> stock must be restored
      await Order.updateStatus(codOrder.id, { status: 'cancelled' });
      const stockAfterCancel = (await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [testVariant1.id])).rows[0].stock_quantity;

      const codValid =
        codVerifyRes.status === 200 &&
        stockAfterCod === stockBeforeCod - 1 &&
        rCod[0]?.status === 'completed' &&
        stockAfterCancel === stockBeforeCod;

      assertTest(
        'Test 12: COD stock handling (decremented upon COD confirmation, restored upon order cancellation)',
        codValid,
        `Before: ${stockBeforeCod}, After Confirm: ${stockAfterCod}, Res status: "${rCod[0]?.status}", Restored after cancel: ${stockAfterCancel}`
      );
    } catch (err) {
      assertTest('Test 12: COD stock handling', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 13: Catalog browse stock reflection
    // -------------------------------------------------------------------------
    try {
      const availStockBefore = await Reservation.getAvailableStock(testVariant1.id);

      // Create an order for 2 units
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ items: [{ variantId: testVariant1.id, quantity: 2 }] }),
      });
      const orderCreated = (await res.json()).data;

      // Check available stock reflection
      const availStockAfter = await Reservation.getAvailableStock(testVariant1.id);

      // Release order
      if (orderCreated?.id) {
        await Reservation.releaseReservationsForOrder(orderCreated.id, 'released');
      }
      const availStockRestored = await Reservation.getAvailableStock(testVariant1.id);

      const catalogAccurate =
        availStockAfter === availStockBefore - 2 &&
        availStockRestored === availStockBefore;

      assertTest(
        'Test 13: Inventory reservation accurately reflects in real-time available stock and release restoration',
        catalogAccurate,
        `Initial: ${availStockBefore}, After Reservation: ${availStockAfter}, Restored: ${availStockRestored}`
      );
    } catch (err) {
      assertTest('Test 13: Inventory reservation accurately reflects in real-time available stock', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 14: Repeated cleanup execution remains idempotent
    // -------------------------------------------------------------------------
    try {
      const clean1 = await Reservation.cleanupExpiredReservations();
      const clean2 = await Reservation.cleanupExpiredReservations();
      const clean3 = await Reservation.cleanupExpiredReservations();

      assertTest(
        'Test 14: Repeated cleanup execution remains strictly idempotent across multiple runs',
        Array.isArray(clean1) && Array.isArray(clean2) && Array.isArray(clean3),
        `Run 1 count: ${clean1.length}, Run 2 count: ${clean2.length}, Run 3 count: ${clean3.length}`
      );
    } catch (err) {
      assertTest('Test 14: Repeated cleanup execution remains idempotent', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 15: Database transaction rollback on failure
    // -------------------------------------------------------------------------
    try {
      const { rows: resCountBefore } = await pool.query('SELECT COUNT(*) AS total FROM inventory_reservations');
      const { rows: orderCountBefore } = await pool.query('SELECT COUNT(*) AS total FROM orders');

      // Attempt to create an order with one valid variant and one invalid variant (variantId: 999999)
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({
          items: [
            { variantId: testVariant1.id, quantity: 1 },
            { variantId: 999999, quantity: 1 },
          ],
        }),
      });

      const { rows: resCountAfter } = await pool.query('SELECT COUNT(*) AS total FROM inventory_reservations');
      const { rows: orderCountAfter } = await pool.query('SELECT COUNT(*) AS total FROM orders');

      const isRolledBack =
        res.status === 400 &&
        resCountBefore[0].total === resCountAfter[0].total &&
        orderCountBefore[0].total === orderCountAfter[0].total;

      assertTest(
        'Test 15: Database transaction rollback on failure (zero orphaned reservations or partial orders)',
        isRolledBack,
        `Status: ${res.status}, Reservations before: ${resCountBefore[0].total}, after: ${resCountAfter[0].total}; Orders before: ${orderCountBefore[0].total}, after: ${orderCountAfter[0].total}`
      );
    } catch (err) {
      assertTest('Test 15: Database transaction rollback on failure', false, err.message);
    }

    // Clean up test products, variants, orders, and reservations
    await pool.query('DELETE FROM inventory_reservations WHERE product_id IN ($1, $2)', [testProduct1Id, testProduct2Id]);
    await pool.query('DELETE FROM order_items WHERE product_id IN ($1, $2)', [testProduct1Id, testProduct2Id]);
    await pool.query('DELETE FROM product_variants WHERE product_id IN ($1, $2)', [testProduct1Id, testProduct2Id]);
    await pool.query('DELETE FROM products WHERE id IN ($1, $2)', [testProduct1Id, testProduct2Id]);

    console.log('\n================================================================');
    console.log(`INVENTORY RESERVATION TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED (TOTAL 15)`);
    console.log('================================================================');

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during reservation test execution:', err);
    process.exit(1);
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await pool.end();
  }
}

runReservationTests();
