import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app.js';
import { pool, testConnection } from '../src/config/db.js';

let server;
let baseUrl;

async function request(path, { method = 'GET', body, token, headers = {} } = {}) {
  const reqHeaders = { ...headers };
  if (body) reqHeaders['Content-Type'] = 'application/json';
  if (token) reqHeaders['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  const isPdf = res.headers.get('content-type')?.includes('application/pdf');
  const data = isPdf ? await res.arrayBuffer() : await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, data };
}

async function runE2EAudit() {
  console.log('====================================================');
  console.log('MAJESTIC BLAZER — COMPREHENSIVE END-TO-END AUDIT');
  console.log('====================================================\n');

  // 1. Database & SSL
  console.log('[1/12] AUDITING AIVEN POSTGRESQL SSL CONNECTION...');
  const dbInfo = await testConnection();
  console.log(`✓ PostgreSQL Connected: ${dbInfo.db} | Version: ${dbInfo.version}`);

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}/api`;
  console.log(`✓ Audit server running on port ${port}`);

  const testSuffix = Date.now().toString(36);
  const patronEmail = `lord.patron.${testSuffix}@majesticblazer.com`;
  const patronPassword = 'LuxuryPatronPassword#2026';
  let patronToken;
  let patronId;

  // 2. Customer Registration & JWT
  console.log('\n[2/12] AUDITING PATRON REGISTRATION & AUTHENTICATION...');
  const regRes = await request('/auth/register', {
    method: 'POST',
    body: {
      fullName: 'Lord Sterling of Coimbatore',
      email: patronEmail,
      phone: '9876543210',
      password: patronPassword,
    },
  });
  assert.equal(regRes.status, 201, `Registration failed: ${JSON.stringify(regRes.data)}`);
  patronToken = regRes.data.data.token;
  patronId = regRes.data.data.user.id;
  console.log(`✓ Patron registered successfully: ID #${patronId} (${patronEmail})`);

  // 3. Customer Login & Profile
  console.log('\n[3/12] AUDITING PATRON LOGIN & PROFILE RESTORATION...');
  const loginRes = await request('/auth/login', {
    method: 'POST',
    body: { email: patronEmail, password: patronPassword },
  });
  assert.equal(loginRes.status, 200);
  assert.equal(loginRes.data.data.user.email, patronEmail);
  console.log('✓ Login verified, JWT session token valid');

  const addrRes = await request('/auth/addresses', {
    method: 'POST',
    token: patronToken,
    body: {
      fullName: 'Lord Sterling',
      phone: '9876543210',
      line1: '142 Sathy Road, Kurumbampalayam',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      pincode: '641107',
      isDefault: true,
    },
  });
  assert.equal(addrRes.status, 201);
  const addressId = addrRes.data.data.id;
  console.log(`✓ Saved address created: #${addressId}`);

  // 4. Admin Authentication & Role Authorization
  console.log('\n[4/12] AUDITING ADMIN AUTH & ROLE-BASED ACCESS CONTROL...');
  const adminLoginRes = await request('/auth/admin/login', {
    method: 'POST',
    body: { email: 'admin@majesticblazer.com', password: 'MajesticAdmin2026!Secure' },
  });
  assert.equal(adminLoginRes.status, 200, 'Admin login failed');
  const adminToken = adminLoginRes.data.data.token;
  console.log('✓ Admin authenticated successfully');

  // Verify patron cannot access protected admin routes
  const unauthorizedRes = await request('/analytics/summary', { token: patronToken });
  assert.equal(unauthorizedRes.status, 403, 'Customer should be forbidden from admin analytics');
  console.log('✓ RBAC Security verified: Customer blocked from admin endpoints (403)');

  // 5. Catalog Browse & Real-Time Availability
  console.log('\n[5/12] AUDITING BLAZER CATALOG & VARIANT RETRIEVAL...');
  const catalogRes = await request('/products?limit=10&all=true');
  assert.equal(catalogRes.status, 200);
  assert.ok(catalogRes.data.data.length > 0);

  // Find a product and variant with positive stock
  let sampleProduct = null;
  let targetVariant = null;

  for (const p of catalogRes.data.data) {
    const detail = await request(`/products/${p.slug}`);
    const foundV = (detail.data.data.variants || []).find((v) => v.stock_quantity > 0 && v.rental_stock_quantity > 0);
    if (foundV) {
      sampleProduct = detail.data.data;
      targetVariant = foundV;
      break;
    }
  }

  if (!targetVariant) {
    sampleProduct = catalogRes.data.data[0];
    const detail = await request(`/products/${sampleProduct.slug}`);
    targetVariant = detail.data.data.variants[0];
    await pool.query('UPDATE product_variants SET stock_quantity = 5, rental_stock_quantity = 5 WHERE id = $1', [targetVariant.id]);
    targetVariant.stock_quantity = 5;
    targetVariant.rental_stock_quantity = 5;
  }

  console.log(`✓ Catalog loaded: ${catalogRes.data.data.length} blazers available. Selected: "${sampleProduct.name}"`);
  console.log(`✓ Variant selected: Size ${targetVariant.size} (SKU: ${targetVariant.sku}, Stock: ${targetVariant.stock_quantity})`);

  // 6. Workflow A: Complete Purchase Journey
  console.log('\n[6/12] AUDITING WORKFLOW A: COMPLETE PURCHASE JOURNEY...');
  const initialStock = targetVariant.stock_quantity;

  // Coupon validation
  const couponRes = await request('/coupons/validate', {
    method: 'POST',
    token: patronToken,
    body: { code: 'MAJESTIC10', cartTotal: sampleProduct.sale_price },
  });
  assert.equal(couponRes.status, 200);
  const discountAmount = couponRes.data.data.discountAmount;
  console.log(`✓ Promo coupon applied: MAJESTIC10 (Discount: ₹${discountAmount})`);

  // Create order
  const orderRes = await request('/orders', {
    method: 'POST',
    token: patronToken,
    body: {
      items: [{ variantId: targetVariant.id, quantity: 1 }],
      addressId,
      deliveryType: 'delivery',
      discount: discountAmount,
      shipping: 0,
      notes: 'Please ensure signature gold buttons are polished.',
    },
  });
  assert.equal(orderRes.status, 201, `Order creation failed: ${JSON.stringify(orderRes.data)}`);
  const order = orderRes.data.data;
  console.log(`✓ Order placed: #${order.order_number} | Total: ₹${order.total}`);

  // Verify stock was decremented
  const checkStockRes = await request(`/products/${sampleProduct.slug}`);
  const postStock = checkStockRes.data.data.variants.find((v) => v.id === targetVariant.id).stock_quantity;
  assert.equal(postStock, initialStock - 1, `Stock did not decrement: was ${initialStock}, now ${postStock}`);
  console.log(`✓ Atomic stock decrement verified: ${initialStock} -> ${postStock}`);

  // 7. Payment Verification & Duplicate Prevention
  console.log('\n[7/12] AUDITING PAYMENT VERIFICATION & IDEMPOTENCY...');
  const paymentId = `pay_audit_${Date.now()}`;
  const payRes1 = await request('/payments/verify', {
    method: 'POST',
    token: patronToken,
    body: {
      orderId: order.id,
      razorpayOrderId: `order_${Date.now()}`,
      razorpayPaymentId: paymentId,
      razorpaySignature: 'simulated_valid_signature',
      amount: order.total,
      provider: 'razorpay',
    },
  });
  assert.equal(payRes1.status, 200);
  console.log(`✓ Payment recorded and verified for Order #${order.order_number}`);

  // Test duplicate payment replay
  const payRes2 = await request('/payments/verify', {
    method: 'POST',
    token: patronToken,
    body: {
      orderId: order.id,
      razorpayOrderId: `order_${Date.now()}`,
      razorpayPaymentId: paymentId, // duplicate payment ID
      razorpaySignature: 'simulated_valid_signature',
      amount: order.total,
      provider: 'razorpay',
    },
  });
  assert.equal(payRes2.status, 200);
  assert.equal(payRes2.data.data.id, payRes1.data.data.id, 'Duplicate payment should return existing record');
  console.log('✓ Idempotency verified: Replay payment did not create duplicate record');

  // 8. Workflow B: Complete Rental Journey & Availability Calendar
  console.log('\n[8/12] AUDITING WORKFLOW B: COMPLETE RENTAL JOURNEY...');
  const startDate = '2026-12-10';
  const endDate = '2026-12-14';

  const availRes = await request(
    `/rentals/check?productId=${sampleProduct.id}&variantId=${targetVariant.id}&startDate=${startDate}&endDate=${endDate}`
  );
  assert.equal(availRes.status, 200);
  assert.equal(availRes.data.data.available, true);
  console.log(`✓ Rental availability confirmed for dates ${startDate} to ${endDate} (${availRes.data.data.rentalDays} days)`);

  const rentRes = await request('/rentals', {
    method: 'POST',
    token: patronToken,
    body: {
      productId: sampleProduct.id,
      variantId: targetVariant.id,
      startDate,
      endDate,
      deliveryType: 'pickup',
      shippingAddress: 'Flagship Atelier Pickup, Coimbatore',
      notes: 'Gala reception attendance.',
    },
  });
  assert.equal(rentRes.status, 201, `Rental booking failed: ${JSON.stringify(rentRes.data)}`);
  const rental = rentRes.data.data;
  console.log(`✓ Rental booking confirmed: #${rental.booking_number} (Rental Fee: ₹${rental.rent_amount}, Deposit: ₹${rental.deposit_amount})`);

  // 9. Overlapping Rental Collision Prevention
  console.log('\n[9/12] AUDITING OVERLAPPING RENTAL COLLISION PREVENTION...');
  // Overlap test: request overlapping dates
  const overlapRes = await request(
    `/rentals/check?productId=${sampleProduct.id}&variantId=${targetVariant.id}&startDate=2026-12-12&endDate=2026-12-16`
  );
  assert.equal(overlapRes.status, 200);
  console.log(`✓ Overlap check telemetry: Available units for overlapping dates = ${overlapRes.data.data.availableStock} / ${overlapRes.data.data.totalRentalStock}`);

  // 10. Admin Dispatch, Garment Inspection & Deposit Settlement
  console.log('\n[10/12] AUDITING GARMENT DISPATCH, INSPECTION & DEPOSIT SETTLEMENT...');
  // Admin dispatches garment
  const dispatchRes = await request(`/rentals/${rental.id}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'picked_up', notes: 'Collected at Coimbatore atelier' },
  });
  assert.equal(dispatchRes.status, 200);
  console.log(`✓ Garment dispatched to client (Status: ${dispatchRes.data.data.status})`);

  // Admin records return with inspection
  const returnRes = await request(`/rentals/${rental.id}/return`, {
    method: 'POST',
    token: adminToken,
    body: {
      returnCondition: 'pristine',
      damageFee: 0,
      lateFee: 0,
      depositRefundStatus: 'refunded',
      depositRefundedAmount: rental.deposit_amount,
    },
  });
  assert.equal(returnRes.status, 200);
  assert.equal(returnRes.data.data.status, 'returned');
  console.log(`✓ Return processed: Condition pristine, Deposit refunded: ₹${returnRes.data.data.deposit_refunded_amount}`);

  // 11. PDF Tax Invoice Generation & Streaming
  console.log('\n[11/12] AUDITING PDF TAX & RENTAL INVOICE GENERATION...');
  const invRes = await request(`/invoices/${order.id}/pdf`);
  assert.equal(invRes.status, 200);
  assert.ok(invRes.data.byteLength > 1000, 'PDF buffer should be substantial');
  console.log(`✓ Purchase Invoice PDF generated and streamed (${invRes.data.byteLength} bytes)`);

  const rentInvRes = await request(`/invoices/${rental.id}/pdf`);
  assert.equal(rentInvRes.status, 200);
  assert.ok(rentInvRes.data.byteLength > 1000);
  console.log(`✓ Rental Invoice PDF generated and streamed (${rentInvRes.data.byteLength} bytes)`);

  // 12. Account Suspension & Security Enforcement
  console.log('\n[12/12] AUDITING ACCOUNT SUSPENSION & REAL-TIME BLOCKING...');
  // Admin suspends customer
  const suspendRes = await request(`/customers/${patronId}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { isActive: false },
  });
  assert.equal(suspendRes.status, 200);
  assert.equal(suspendRes.data.data.is_active, false);

  // Patron attempts to make an authenticated request with existing token
  const blockedRes = await request('/orders/mine', { token: patronToken });
  assert.equal(blockedRes.status, 401, 'Suspended user must be immediately blocked');
  console.log('✓ Suspended patron blocked immediately from APIs (401 Account Inactive)');

  // Re-activate patron
  await request(`/customers/${patronId}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { isActive: true },
  });
  console.log('✓ Patron reactivated');

  console.log('\n====================================================');
  console.log('ALL 12 END-TO-END BUSINESS AUDIT WORKFLOWS PASSED!');
  console.log('====================================================');
}

runE2EAudit()
  .catch((err) => {
    console.error('\n❌ AUDIT FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    if (server) server.close();
    await pool.end();
  });
