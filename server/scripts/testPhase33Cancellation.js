/**
 * testPhase33Cancellation.js
 * Comprehensive verification of Phase 3.3 Customer Order Cancellation Experience.
 */

import http from 'http';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { pool } from '../src/config/db.js';

dotenv.config();

const PORT = process.env.PORT || 5000;
const JWT_SECRET = env.jwt.secret;

const query = (text, params) => pool.query(text, params);

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null,
            rawBody: data
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
            rawBody: data
          });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function generateToken(userId, email, role = 'customer') {
  return jwt.sign({ sub: userId, id: userId, email, role }, JWT_SECRET, { expiresIn: '1h' });
}

async function runTests() {
  console.log('--- STARTING PHASE 3.3 ORDER CANCELLATION TESTS ---');
  let failures = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      failures++;
    } else {
      console.log(`✅ PASS: ${message}`);
    }
  }

  const createdOrderIds = [];

  try {
    // 1. Fetch test users from db
    const usersRes = await query('SELECT id, email, role FROM users WHERE role = $1 LIMIT 2', ['customer']);
    if (usersRes.rows.length < 2) {
      console.error('Need at least 2 customer accounts in DB for testing cross-access.');
      process.exit(1);
    }
    const customer1 = usersRes.rows[0];
    const customer2 = usersRes.rows[1];
    const token1 = generateToken(customer1.id, customer1.email, 'customer');
    const token2 = generateToken(customer2.id, customer2.email, 'customer');

    // Fetch an existing product variant with stock
    const variantRes = await query(`
      SELECT pv.id as variant_id, pv.product_id, pv.size, p.sale_price, pv.stock_quantity 
      FROM product_variants pv 
      JOIN products p ON pv.product_id = p.id 
      WHERE pv.stock_quantity >= 5 AND p.is_purchasable = true AND p.is_active = true
      LIMIT 1
    `);
    if (variantRes.rows.length === 0) {
      console.error('No suitable product variant found with stock_quantity >= 5.');
      process.exit(1);
    }
    const variant = variantRes.rows[0];

    // Helper to create a pending order using the API
    async function createTestOrder(token, initialNotes = 'Custom cuff fit requested') {
      const res = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/orders',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }, {
        items: [{ variantId: variant.variant_id, quantity: 1 }],
        deliveryType: 'delivery',
        shippingAddress: '42 MG Road, Bengaluru, Karnataka, 560001',
        notes: initialNotes
      });

      if (res.statusCode !== 201) {
        throw new Error(`Failed to create test order: ${res.statusCode} ${JSON.stringify(res.body)}`);
      }
      const order = res.body.data;
      createdOrderIds.push(order.id);
      return order;
    }

    // TEST 1: Rejection of invalid cancellation reason (HTTP 400)
    console.log('\n[Test 1] Validate invalid cancellation reason rejected');
    const order1 = await createTestOrder(token1);
    const resInvalidReason = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/orders/${order1.id}/cancel`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`
      }
    }, { reason: 'Found it cheaper elsewhere' });

    assert(resInvalidReason.statusCode === 400, `Expected 400 for invalid reason, got ${resInvalidReason.statusCode}`);
    assert(resInvalidReason.body?.message?.includes('Invalid cancellation reason'), `Expected invalid reason message, got ${JSON.stringify(resInvalidReason.body)}`);

    // TEST 2: Valid cancellation with "Ordered incorrect size"
    console.log('\n[Test 2] Cancel with standard reason "Ordered incorrect size"');
    const resCancel1 = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/orders/${order1.id}/cancel`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`
      }
    }, { reason: 'Ordered incorrect size' });

    assert(resCancel1.statusCode === 200, `Expected 200 for successful cancellation, got ${resCancel1.statusCode}`);
    assert(resCancel1.body?.success === true, 'Response indicates success');
    const cancelledData1 = resCancel1.body?.data || resCancel1.body?.order;
    assert(cancelledData1?.status === 'cancelled', 'Order status updated to cancelled');

    // Check DB state and notes preservation
    const dbOrder1 = await query('SELECT status, notes FROM orders WHERE id = $1', [order1.id]);
    assert(dbOrder1.rows[0].status === 'cancelled', 'DB order status is cancelled');
    assert(dbOrder1.rows[0].notes.includes('Ordered incorrect size'), 'DB notes includes cancellation reason');
    assert(dbOrder1.rows[0].notes.includes('Custom cuff fit requested'), 'DB notes preserved original fitting notes');

    // Check reservation was released
    const dbRes1 = await query('SELECT status FROM inventory_reservations WHERE order_id = $1', [order1.id]);
    assert(dbRes1.rows.length > 0 && dbRes1.rows[0].status === 'released', 'Inventory reservation was released upon cancellation');

    // TEST 3: Duplicate cancellation attempt on already cancelled order (HTTP 400)
    console.log('\n[Test 3] Reject duplicate cancellation on already cancelled order');
    const resDupCancel = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/orders/${order1.id}/cancel`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`
      }
    }, { reason: 'Ordered incorrect size' });

    assert(resDupCancel.statusCode === 400, `Expected 400 for cancelling already cancelled order, got ${resDupCancel.statusCode}`);
    assert(resDupCancel.body?.message?.includes('Only pending orders can be cancelled'), `Expected pending error message, got: ${JSON.stringify(resDupCancel.body)}`);

    // TEST 4: Cross-customer cancellation authorization (HTTP 403)
    console.log('\n[Test 4] Reject cancellation of another customer order');
    const orderCustomer2 = await createTestOrder(token2);
    const resCrossCancel = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/orders/${orderCustomer2.id}/cancel`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}` // Customer 1 trying to cancel Customer 2's order
      }
    }, { reason: 'Event rescheduled' });

    assert(resCrossCancel.statusCode === 403, `Expected 403 for cross-user cancellation, got ${resCrossCancel.statusCode}`);

    // TEST 5: Reason "Other" with custom explanation
    console.log('\n[Test 5] Cancellation with "Other" and custom explanation');
    const order3 = await createTestOrder(token1, null);
    const resCancelOther = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/orders/${order3.id}/cancel`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`
      }
    }, {
      reason: 'Other',
      explanation: 'Gala event was postponed to next year.'
    });

    assert(resCancelOther.statusCode === 200, `Expected 200 for Other reason with explanation, got ${resCancelOther.statusCode}`);
    const dbOrder3 = await query('SELECT status, notes FROM orders WHERE id = $1', [order3.id]);
    assert(dbOrder3.rows[0].notes.includes('Other - Gala event was postponed to next year.'), `Notes correctly formatted: ${dbOrder3.rows[0].notes}`);

    // TEST 6: All other predefined reasons
    console.log('\n[Test 6] Testing remaining predefined reasons');
    const remainingReasons = [
      'Event rescheduled',
      'Selected alternate blazer style',
      'Delivery timing no longer suitable'
    ];

    for (const r of remainingReasons) {
      const ord = await createTestOrder(token1);
      const res = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/orders/${ord.id}/cancel`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token1}`
        }
      }, { reason: r });
      assert(res.statusCode === 200, `Reason "${r}" accepted with 200`);
    }

    // TEST 7: Order details GET endpoint returns updated cancelled order and reason
    console.log('\n[Test 7] Verify GET /orders/:id returns cancelled order and cancellation reason');
    const resGetOrder = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/orders/${order3.id}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token1}`
      }
    });

    assert(resGetOrder.statusCode === 200, `Expected 200 from GET /orders/:id, got ${resGetOrder.statusCode}`);
    const fetchedOrder = resGetOrder.body?.data || resGetOrder.body;
    assert(fetchedOrder?.status === 'cancelled', 'GET response has status "cancelled"');
    assert(fetchedOrder?.notes?.includes('Gala event was postponed'), 'GET response preserves cancellation notes');

    // Clean up created test orders & reservations
    console.log('\nCleaning up test artifacts...');
    if (createdOrderIds.length > 0) {
      await query(`
        DELETE FROM inventory_reservations WHERE order_id = ANY($1::int[])
      `, [createdOrderIds]);
      await query(`
        DELETE FROM order_items WHERE order_id = ANY($1::int[])
      `, [createdOrderIds]);
      await query(`
        DELETE FROM orders WHERE id = ANY($1::int[])
      `, [createdOrderIds]);
    }

  } catch (err) {
    console.error('Test execution error:', err);
    failures++;
  } finally {
    await pool.end();
  }

  if (failures > 0) {
    console.error(`\n❌ Tests finished with ${failures} failure(s).`);
    process.exit(1);
  } else {
    console.log('\n🎉 ALL PHASE 3.3 ORDER CANCELLATION TESTS PASSED!');
    process.exit(0);
  }
}

runTests();
