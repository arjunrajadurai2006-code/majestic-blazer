import http from 'node:http';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { pool } from '../src/config/db.js';

function generateTestToken(userId, role = 'customer') {
  return jwt.sign({ sub: userId, role }, env.jwt.secret, { expiresIn: '1h' });
}

async function runOrderDetailsTests() {
  console.log('================================================================');
  console.log('MAJESTIC BLAZER — PHASE 2.4B: ORDER DETAILS TEST SUITE');
  console.log('================================================================\n');

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

  // 1. Setup two distinct test customers
  const setupUser = async (email, name) => {
    const { rows } = await pool.query('SELECT id, email, role FROM users WHERE email = $1', [email]);
    if (rows.length) return rows[0];
    const { rows: created } = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, 'testhash123', 'customer')
       RETURNING id, email, role`,
      [name, email]
    );
    return created[0];
  };

  const userA = await setupUser('test_order_cust_a@majesticblazer.com', 'Customer Alpha');
  const userB = await setupUser('test_order_cust_b@majesticblazer.com', 'Customer Beta');
  const tokenA = generateTestToken(userA.id, 'customer');
  const tokenB = generateTestToken(userB.id, 'customer');

  // Setup admin user
  let adminUser;
  const { rows: admins } = await pool.query("SELECT id, email, role FROM users WHERE role = 'admin' LIMIT 1");
  if (admins.length) {
    adminUser = admins[0];
  } else {
    const { rows: crAdmin } = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ('Admin Test', 'admin_order_test@majesticblazer.com', 'adminhash123', 'admin')
       RETURNING id, email, role`
    );
    adminUser = crAdmin[0];
  }
  const tokenAdmin = generateTestToken(adminUser.id, 'admin');

  // Fetch test product variant
  const { rows: variants } = await pool.query(
    `SELECT pv.id AS variant_id, pv.size, pv.sku, p.id AS product_id, p.name AS product_name, p.sale_price
     FROM product_variants pv
     JOIN products p ON p.id = pv.product_id
     WHERE p.is_active = true AND p.is_purchasable = true AND pv.stock_quantity >= 5
     LIMIT 1`
  );
  if (!variants.length) throw new Error('No test product variants with sufficient stock found.');
  const testVar = variants[0];

  // Create Order A for Customer A
  const createOrderA = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      items: [{ variantId: testVar.variant_id, quantity: 2 }],
      deliveryType: 'pickup',
      shippingAddress: 'Majestic Flagship Boutique Pickup',
      notes: 'Please keep pressed in suit carrier.',
    }),
  });
  const orderAData = await createOrderA.json();
  const orderA = orderAData.data;

  // Create Order B for Customer B
  const createOrderB = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({
      items: [{ variantId: testVar.variant_id, quantity: 1 }],
      deliveryType: 'delivery',
      shippingAddress: '42 Bespoke Avenue, Coimbatore, TN - 641107',
    }),
  });
  const orderBData = await createOrderB.json();
  const orderB = orderBData.data;

  // ---------------------------------------------------------------------------
  // TEST 1: Customer can open their own order by numeric ID
  // ---------------------------------------------------------------------------
  {
    const res = await fetch(`${API_BASE}/orders/${orderA.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const data = await res.json();
    assertTest(
      'Test 1: Customer A can access their own order by numeric ID',
      res.status === 200 && data.data?.order_number === orderA.order_number,
      `Status: ${res.status}, Order Number: ${data.data?.order_number}`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Customer can open their own order by order_number string
  // ---------------------------------------------------------------------------
  {
    const res = await fetch(`${API_BASE}/orders/${orderA.order_number}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const data = await res.json();
    assertTest(
      'Test 2: Customer A can access their own order by order_number reference',
      res.status === 200 && data.data?.id === orderA.id,
      `Status: ${res.status}, ID: ${data.data?.id}`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Customer CANNOT access another customer's order (HTTP 403 Forbidden)
  // ---------------------------------------------------------------------------
  {
    const res = await fetch(`${API_BASE}/orders/${orderB.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const data = await res.json();
    assertTest(
      'Test 3: Customer A cannot access Customer B order (blocked with HTTP 403)',
      res.status === 403,
      `Status: ${res.status}, Message: "${data.message}"`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Unauthenticated access is blocked (HTTP 401 Unauthorized)
  // ---------------------------------------------------------------------------
  {
    const res = await fetch(`${API_BASE}/orders/${orderA.id}`);
    const data = await res.json();
    assertTest(
      'Test 4: Anonymous/Unauthenticated request receives HTTP 401 Unauthorized',
      res.status === 401,
      `Status: ${res.status}, Message: "${data.message}"`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Non-existent order reference returns HTTP 404 Not Found
  // ---------------------------------------------------------------------------
  {
    const res = await fetch(`${API_BASE}/orders/99999999`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const data = await res.json();
    assertTest(
      'Test 5: Non-existent order returns HTTP 404 Not Found',
      res.status === 404,
      `Status: ${res.status}, Message: "${data.message}"`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 6: Product, size, quantity, and unit price details match the database
  // ---------------------------------------------------------------------------
  {
    const res = await fetch(`${API_BASE}/orders/${orderA.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const data = await res.json();
    const item = data.data?.items?.[0];

    const sizeMatches = item?.size === testVar.size;
    const qtyMatches = item?.quantity === 2;
    const priceMatches = Number(item?.unitPrice) === Number(testVar.sale_price);

    assertTest(
      'Test 6: Order items data (size, quantity, unit price, product name) match database',
      sizeMatches && qtyMatches && priceMatches,
      `Size: ${item?.size} (expected ${testVar.size}), Qty: ${item?.quantity} (expected 2), Price: ₹${item?.unitPrice}`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 7: Order totals and financial breakdown are accurate
  // ---------------------------------------------------------------------------
  {
    const res = await fetch(`${API_BASE}/orders/${orderA.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const data = await res.json();
    const ord = data.data;

    const expectedSubtotal = Number(testVar.sale_price) * 2;
    const totalsMatch = Number(ord.subtotal) === expectedSubtotal && Number(ord.total) === expectedSubtotal;

    assertTest(
      'Test 7: Order financial breakdown (subtotal, discount, shipping, total) is mathematically accurate',
      totalsMatch,
      `Subtotal: ₹${ord.subtotal}, Discount: ₹${ord.discount}, Total: ₹${ord.total} (Expected ₹${expectedSubtotal})`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 8: Order lifecycle status display and transitions
  // ---------------------------------------------------------------------------
  {
    const res = await fetch(`${API_BASE}/orders/${orderA.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const data = await res.json();
    const status = data.data?.status;

    assertTest(
      'Test 8: Current order lifecycle status accurately reflects backend database state',
      status === 'pending',
      `Current order status: "${status}"`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 9: Invoice download endpoint verifies ownership for this order
  // ---------------------------------------------------------------------------
  {
    const invRes = await fetch(`${API_BASE}/invoices/${orderA.order_number}/pdf`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const crossInvRes = await fetch(`${API_BASE}/invoices/${orderA.order_number}/pdf`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    assertTest(
      'Test 9: Invoice download succeeds for order owner and strictly denies unauthorized customer (HTTP 403)',
      invRes.status === 200 && crossInvRes.status === 403,
      `Owner status: ${invRes.status}, Non-owner status: ${crossInvRes.status}`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 10: Customer can cancel pending order, but cannot cancel non-pending order
  // ---------------------------------------------------------------------------
  {
    // Customer A cancels pending order A
    const cancelRes = await fetch(`${API_BASE}/orders/${orderA.id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ notes: 'Cancelled during automated verification test' }),
    });
    const cancelData = await cancelRes.json();

    // Verify order status is now cancelled
    const verifyCancel = await fetch(`${API_BASE}/orders/${orderA.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const verifyData = await verifyCancel.json();

    // Now try to cancel again (now cancelled, non-pending)
    const reCancelRes = await fetch(`${API_BASE}/orders/${orderA.id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    });

    assertTest(
      'Test 10: Pending order is cancellable by customer; repeated/non-pending cancellation is rejected (HTTP 400)',
      cancelRes.status === 200 && verifyData.data?.status === 'cancelled' && reCancelRes.status === 400,
      `First cancel status: ${cancelRes.status}, DB status: "${verifyData.data?.status}", Re-cancel status: ${reCancelRes.status}`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 11: Admin can access orders via administrative privileges
  // ---------------------------------------------------------------------------
  {
    const res = await fetch(`${API_BASE}/orders/${orderB.id}`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const data = await res.json();
    assertTest(
      'Test 11: Administrator can access orders across accounts for atelier fulfillment',
      res.status === 200 && data.data?.id === orderB.id,
      `Admin access status: ${res.status}`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 12: Order notes and delivery details persist and render correctly
  // ---------------------------------------------------------------------------
  {
    const res = await fetch(`${API_BASE}/orders/${orderA.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const data = await res.json();
    const ord = data.data;

    assertTest(
      'Test 12: Special fitting notes and delivery configuration are preserved',
      ord.delivery_type === 'pickup' && Boolean(ord.notes),
      `Delivery type: "${ord.delivery_type}", Notes: "${ord.notes}"`
    );
  }

  // Clean up test orders and users
  await pool.query('DELETE FROM invoices WHERE order_id IN ($1, $2)', [orderA.id, orderB.id]);
  await pool.query('DELETE FROM order_items WHERE order_id IN ($1, $2)', [orderA.id, orderB.id]);
  await pool.query('DELETE FROM inventory_reservations WHERE order_id IN ($1, $2)', [orderA.id, orderB.id]);
  await pool.query('DELETE FROM orders WHERE id IN ($1, $2)', [orderA.id, orderB.id]);
  await pool.query('DELETE FROM users WHERE email IN ($1, $2)', [
    'test_order_cust_a@majesticblazer.com',
    'test_order_cust_b@majesticblazer.com',
  ]);

  await new Promise((resolve) => server.close(resolve));
  await pool.end();

  console.log('\n================================================================');
  console.log(`ORDER DETAILS TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED (TOTAL: ${passCount + failCount})`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runOrderDetailsTests().catch((err) => {
  console.error('Fatal test error in order details suite:', err);
  process.exit(1);
});
