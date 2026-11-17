import http from 'node:http';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { pool } from '../src/config/db.js';
import { ensureDemoAdmin } from '../src/controllers/authController.js';

const PORT = 5098;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;

let server;

async function startServer() {
  await ensureDemoAdmin();
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(PORT, '127.0.0.1', () => {
      resolve();
    });
  });
}

async function stopServer() {
  return new Promise((resolve) => {
    server.close(async () => {
      await pool.end();
      resolve();
    });
  });
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

const results = [];

function recordTest(testNum, description, passed, detail = '') {
  results.push({ testNum, description, passed, detail });
  const statusStr = passed ? '✓ PASS' : '✗ FAIL';
  console.log(`[${statusStr}] Test ${testNum}: ${description}`);
  if (detail) console.log(`       ${detail}`);
}

async function runTests() {
  console.log('====================================================');
  console.log('   MAJESTIC BLAZER DEMO AUTHENTICATION TEST SUITE   ');
  console.log('====================================================\n');

  await startServer();

  let customerToken = '';
  let customerUser = null;
  let adminToken = '';
  let adminUser = null;

  try {
    // ----------------------------------------------------
    // TEST 1: Customer login with new email and arbitrary password
    // ----------------------------------------------------
    const newCustomerEmail = `newcustomer_${Date.now()}@example.com`;
    const res1 = await request('/auth/login', {
      method: 'POST',
      body: { email: newCustomerEmail, password: 'anyPassword123!' },
    });
    const pass1 = res1.status === 200 && res1.data.data?.token && res1.data.data?.user?.role === 'customer';
    customerToken = res1.data.data?.token || '';
    customerUser = res1.data.data?.user || null;
    recordTest(1, 'Customer login with new email and arbitrary password', pass1, `Status: ${res1.status}, role: ${customerUser?.role}`);

    // ----------------------------------------------------
    // TEST 2: Customer login with existing demo email
    // ----------------------------------------------------
    const res2 = await request('/auth/login', {
      method: 'POST',
      body: { email: 'customer.demo@majesticblazer.com', password: 'arbitraryDemoPassword' },
    });
    const pass2 = res2.status === 200 && res2.data.data?.token && res2.data.data?.user?.email === 'customer.demo@majesticblazer.com';
    recordTest(2, 'Customer login with existing demo email', pass2, `Status: ${res2.status}, email: ${res2.data.data?.user?.email}`);

    // ----------------------------------------------------
    // TEST 3: Customer registration
    // ----------------------------------------------------
    const regEmail = `registered_${Date.now()}@example.com`;
    const res3 = await request('/auth/register', {
      method: 'POST',
      body: { fullName: 'Registered Patron', email: regEmail, phone: '9876543210', password: 'samplePassword' },
    });
    const pass3 = (res3.status === 201 || res3.status === 200) && res3.data.data?.token && res3.data.data?.user?.role === 'customer';
    recordTest(3, 'Customer registration', pass3, `Status: ${res3.status}, user: ${res3.data.data?.user?.email}`);

    // ----------------------------------------------------
    // TEST 4: Customer session persistence after refresh
    // ----------------------------------------------------
    const res4 = await request('/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const pass4 = res4.status === 200 && res4.data.data?.user?.email === newCustomerEmail;
    recordTest(4, 'Customer session persistence after refresh (GET /auth/me)', pass4, `Status: ${res4.status}, restored user: ${res4.data.data?.user?.email}`);

    // ----------------------------------------------------
    // TEST 5: Customer logout
    // ----------------------------------------------------
    const res5 = await request('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const res5Check = await request('/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const pass5 = res5.status === 200 && res5Check.status === 401;
    recordTest(5, 'Customer logout and session invalidation', pass5, `Logout: ${res5.status}, Post-logout me check: ${res5Check.status} (expected 401)`);

    // ----------------------------------------------------
    // TEST 6: Correct administrator credentials
    // ----------------------------------------------------
    const res6 = await request('/auth/admin/login', {
      method: 'POST',
      body: { email: 'admin@majesticblazer.com', password: 'MajesticAdmin2026!Secure' },
    });
    const pass6 = res6.status === 200 && res6.data.data?.token && res6.data.data?.user?.role === 'admin';
    adminToken = res6.data.data?.token || '';
    adminUser = res6.data.data?.user || null;
    recordTest(6, 'Correct administrator credentials login', pass6, `Status: ${res6.status}, role: ${adminUser?.role}`);

    // ----------------------------------------------------
    // TEST 7: Incorrect administrator email
    // ----------------------------------------------------
    const res7 = await request('/auth/admin/login', {
      method: 'POST',
      body: { email: 'unauthorized_admin@majesticblazer.com', password: 'MajesticAdmin2026!Secure' },
    });
    const pass7 = res7.status === 401;
    recordTest(7, 'Incorrect administrator email rejection', pass7, `Status: ${res7.status} (expected 401)`);

    // ----------------------------------------------------
    // TEST 8: Incorrect administrator password
    // ----------------------------------------------------
    const res8 = await request('/auth/admin/login', {
      method: 'POST',
      body: { email: 'admin@majesticblazer.com', password: 'WrongPassword2026' },
    });
    const pass8 = res8.status === 401;
    recordTest(8, 'Incorrect administrator password rejection', pass8, `Status: ${res8.status} (expected 401)`);

    // ----------------------------------------------------
    // TEST 9: Customer attempting to access admin dashboard
    // ----------------------------------------------------
    // Create an active customer token
    const freshCustRes = await request('/auth/login', {
      method: 'POST',
      body: { email: `cust_for_rbac_${Date.now()}@example.com`, password: 'anyPassword' },
    });
    const freshCustToken = freshCustRes.data.data?.token;
    const res9 = await request('/analytics/summary', {
      method: 'GET',
      headers: { Authorization: `Bearer ${freshCustToken}` },
    });
    const pass9 = res9.status === 403;
    recordTest(9, 'Customer attempting to access admin protected route', pass9, `Status: ${res9.status} (expected 403 Forbidden)`);

    // ----------------------------------------------------
    // TEST 10: Admin session persistence after refresh
    // ----------------------------------------------------
    const res10 = await request('/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const pass10 = res10.status === 200 && res10.data.data?.user?.role === 'admin' && res10.data.data?.user?.email === 'admin@majesticblazer.com';
    recordTest(10, 'Admin session persistence after refresh (GET /auth/me)', pass10, `Status: ${res10.status}, role: ${res10.data.data?.user?.role}`);

    // ----------------------------------------------------
    // TEST 11: Admin logout
    // ----------------------------------------------------
    const res11 = await request('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const res11Check = await request('/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const pass11 = res11.status === 200 && res11Check.status === 401;
    recordTest(11, 'Admin logout and session invalidation', pass11, `Logout: ${res11.status}, Post-logout me check: ${res11Check.status} (expected 401)`);

    // ----------------------------------------------------
    // TEST 12: Direct access to protected admin API endpoints without token
    // ----------------------------------------------------
    const res12 = await request('/analytics/summary', {
      method: 'GET',
    });
    const pass12 = res12.status === 401;
    recordTest(12, 'Direct access to protected admin API endpoints without token', pass12, `Status: ${res12.status} (expected 401 Unauthorized)`);

    // ----------------------------------------------------
    // TEST 13: DEMO_MODE=false restores normal authentication
    // ----------------------------------------------------
    env.demoMode = false;

    // A: Non-existent email should be rejected with 401
    const res13A = await request('/auth/login', {
      method: 'POST',
      body: { email: `nonexistent_${Date.now()}@example.com`, password: 'anyPassword' },
    });
    const check13A = res13A.status === 401;

    // B: Weak password registration should fail validation
    const res13B = await request('/auth/register', {
      method: 'POST',
      body: { fullName: 'Strict User', email: `strict_${Date.now()}@example.com`, password: 'short' },
    });
    const check13B = res13B.status === 400 || res13B.status === 422;

    // C: Existing user with wrong password should be rejected with 401
    const res13C = await request('/auth/login', {
      method: 'POST',
      body: { email: 'customer.demo@majesticblazer.com', password: 'definitelyWrongPassword' },
    });
    const check13C = res13C.status === 401;

    env.demoMode = true; // Restore demo mode

    const pass13 = check13A && check13B && check13C;
    recordTest(
      13,
      'DEMO_MODE=false restores normal authentication',
      pass13,
      `Non-existent login: ${res13A.status} (exp 401), Weak reg: ${res13B.status} (exp 400/422), Wrong pass: ${res13C.status} (exp 401)`
    );

    // ----------------------------------------------------
    // TEST 14: POST /api/auth/demo-admin returns valid admin session
    // ----------------------------------------------------
    const res14 = await request('/auth/demo-admin', { method: 'POST' });
    const pass14 =
      res14.status === 200 &&
      res14.data.data?.token &&
      res14.data.data?.user?.role === 'admin' &&
      res14.data.data?.user?.password === undefined &&
      res14.data.data?.user?.password_hash === undefined &&
      res14.data.data?.user?.passwordHash === undefined;
    recordTest(
      14,
      'POST /api/auth/demo-admin returns valid admin session (no password/hash exposed)',
      pass14,
      `Status: ${res14.status}, role: ${res14.data.data?.user?.role}, passwordExposed: ${Boolean(res14.data.data?.user?.password_hash)}`
    );

    // ----------------------------------------------------
    // TEST 15: POST /api/auth/demo-customer returns valid customer session
    // ----------------------------------------------------
    const res15 = await request('/auth/demo-customer', { method: 'POST' });
    const pass15 =
      res15.status === 200 &&
      res15.data.data?.token &&
      res15.data.data?.user?.role === 'customer' &&
      res15.data.data?.user?.password_hash === undefined;
    recordTest(
      15,
      'POST /api/auth/demo-customer returns valid customer session',
      pass15,
      `Status: ${res15.status}, role: ${res15.data.data?.user?.role}, email: ${res15.data.data?.user?.email}`
    );

    // ----------------------------------------------------
    // TEST 16: POST /api/auth/demo-admin rejects when DEMO_MODE=false (403)
    // ----------------------------------------------------
    env.demoMode = false;
    const res16Admin = await request('/auth/demo-admin', { method: 'POST' });
    const res16Cust = await request('/auth/demo-customer', { method: 'POST' });
    env.demoMode = true; // Restore
    const pass16 = res16Admin.status === 403 && res16Cust.status === 403;
    recordTest(
      16,
      'POST /api/auth/demo-admin rejects when DEMO_MODE=false with 403 Forbidden',
      pass16,
      `demo-admin status: ${res16Admin.status} (exp 403), demo-customer status: ${res16Cust.status} (exp 403)`
    );

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await stopServer();
  }

  const allPassed = results.length === 16 && results.every((r) => r.passed);
  console.log('\n====================================================');
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${results.filter((r) => r.passed).length} | FAILED: ${results.filter((r) => !r.passed).length}`);
  console.log(`SUITE RESULT: ${allPassed ? 'ALL 16 TESTS PASSED!' : 'SOME TESTS FAILED'}`);
  console.log('====================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

runTests();
