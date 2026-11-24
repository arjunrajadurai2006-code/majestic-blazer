// Tests the live Railway deployed backend directly
const LIVE_API_BASE = process.env.LIVE_API_URL || 'https://majestic-blazer-production.up.railway.app/api';

async function request(path, options = {}) {
  const url = `${LIVE_API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'Origin': 'https://majestic-blazer.vercel.app',
    ...(options.headers || {}),
  };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data, headers: res.headers };
}

const results = [];

function recordTest(name, passed, detail = '') {
  results.push({ name, passed, detail });
  const mark = passed ? '✓ PASS' : '✗ FAIL';
  console.log(`[${mark}] ${name}`);
  if (detail) console.log(`       ${detail}`);
}

async function runLiveTests() {
  console.log('====================================================');
  console.log(`   TESTING LIVE DEPLOYED API: ${LIVE_API_BASE}   `);
  console.log('====================================================\n');

  try {
    // 0. Check health & demo config
    const health = await request('/health');
    console.log(`Live health check: ${health.status} -> ${JSON.stringify(health.data)}`);

    const cfg = await request('/auth/config');
    console.log(`Live auth config: ${cfg.status} -> demoMode=${cfg.data.data?.demoMode}\n`);

    // 1. Customer login with a new email
    const newEmail = `patron_live_${Date.now()}@example.com`;
    const res1 = await request('/auth/login', {
      method: 'POST',
      body: { email: newEmail, password: 'arbitraryDemoPassword' },
    });
    const pass1 = res1.status === 200 && res1.data.data?.token && res1.data.data?.user?.role === 'customer';
    const customerToken = res1.data.data?.token || '';
    recordTest('Customer login with a new email', pass1, `Status: ${res1.status}, role: ${res1.data.data?.user?.role}`);

    // 2. Customer login with an existing email
    const res2 = await request('/auth/login', {
      method: 'POST',
      body: { email: newEmail, password: 'differentPasswordAllowedInDemo' },
    });
    const pass2 = res2.status === 200 && res2.data.data?.token && res2.data.data?.user?.email === newEmail;
    recordTest('Customer login with an existing email', pass2, `Status: ${res2.status}, email: ${res2.data.data?.user?.email}`);

    // 3. Customer session survives refresh (GET /api/auth/me)
    const res3 = await request('/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const pass3 = res3.status === 200 && res3.data.data?.user?.email === newEmail;
    recordTest('Customer session survives refresh', pass3, `Status: ${res3.status}, user: ${res3.data.data?.user?.email}`);

    // 4. Customer logout works
    const res4Logout = await request('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const res4Check = await request('/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const pass4 = res4Logout.status === 200 && res4Check.status === 401;
    recordTest('Customer logout works', pass4, `Logout: ${res4Logout.status}, Me after logout: ${res4Check.status} (expected 401)`);

    // 5. Admin login with configured credentials
    const res5 = await request('/auth/admin/login', {
      method: 'POST',
      body: { email: 'admin@majesticblazer.com', password: 'MajesticAdmin2026!Secure' },
    });
    const pass5 = res5.status === 200 && res5.data.data?.token && res5.data.data?.user?.role === 'admin';
    const adminToken = res5.data.data?.token || '';
    recordTest('Admin login with configured credentials', pass5, `Status: ${res5.status}, role: ${res5.data.data?.user?.role}`);

    // 6. Incorrect admin credentials are rejected
    const res6WrongEmail = await request('/auth/admin/login', {
      method: 'POST',
      body: { email: 'wrong_admin@majesticblazer.com', password: 'MajesticAdmin2026!Secure' },
    });
    const res6WrongPass = await request('/auth/admin/login', {
      method: 'POST',
      body: { email: 'admin@majesticblazer.com', password: 'IncorrectPassword' },
    });
    const pass6 = res6WrongEmail.status === 401 && res6WrongPass.status === 401;
    recordTest('Incorrect admin credentials are rejected', pass6, `Wrong email: ${res6WrongEmail.status}, Wrong password: ${res6WrongPass.status}`);

    // 7. Customer credentials cannot access admin APIs
    // Create another fresh customer token
    const freshCust = await request('/auth/login', {
      method: 'POST',
      body: { email: `rbac_test_${Date.now()}@example.com`, password: 'anyPass' },
    });
    const testCustToken = freshCust.data.data?.token;
    const res7 = await request('/analytics/summary', {
      method: 'GET',
      headers: { Authorization: `Bearer ${testCustToken}` },
    });
    const pass7 = res7.status === 403;
    recordTest('Customer credentials cannot access admin APIs', pass7, `Status: ${res7.status} (expected 403 Forbidden)`);

    // 8. Admin can access protected admin APIs
    const res8 = await request('/analytics/summary', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const pass8 = res8.status === 200 && res8.data.data?.totalOrders !== undefined;
    recordTest('Admin can access protected admin APIs', pass8, `Status: ${res8.status}, totalOrders: ${res8.data.data?.totalOrders}`);

    // 9. One-click demo admin login (POST /api/auth/demo-admin)
    const res9 = await request('/auth/demo-admin', { method: 'POST' });
    const pass9 =
      res9.status === 200 &&
      res9.data.data?.token &&
      res9.data.data?.user?.role === 'admin' &&
      res9.data.data?.user?.password === undefined &&
      res9.data.data?.user?.password_hash === undefined;
    const demoAdminToken = res9.data.data?.token || '';
    recordTest(
      'One-click demo admin login (POST /api/auth/demo-admin)',
      pass9,
      `Status: ${res9.status}, role: ${res9.data.data?.user?.role}, passwordExposed: ${Boolean(res9.data.data?.user?.password_hash)}`
    );

    // 10. One-click demo customer login (POST /api/auth/demo-customer)
    const res10 = await request('/auth/demo-customer', { method: 'POST' });
    const pass10 =
      res10.status === 200 &&
      res10.data.data?.token &&
      res10.data.data?.user?.role === 'customer' &&
      res10.data.data?.user?.password_hash === undefined;
    recordTest(
      'One-click demo customer login (POST /api/auth/demo-customer)',
      pass10,
      `Status: ${res10.status}, role: ${res10.data.data?.user?.role}`
    );

    // 11. Admin session persistence via /auth/me with demo admin token
    const res11 = await request('/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${demoAdminToken}` },
    });
    const pass11 = res11.status === 200 && res11.data.data?.user?.role === 'admin';
    recordTest('Demo admin session persistence (GET /auth/me)', pass11, `Status: ${res11.status}, role: ${res11.data.data?.user?.role}`);

    // 12. CORS allows Admin Vercel Portal origin
    const res12 = await request('/health', {
      headers: { Origin: 'https://majestic-blazer-miup.vercel.app' },
    });
    const corsHeader = res12.headers.get('access-control-allow-origin');
    const pass12 = res12.status === 200 && (corsHeader === 'https://majestic-blazer-miup.vercel.app' || corsHeader === '*');
    recordTest(
      'CORS allows Admin Vercel Portal origin',
      pass12,
      `Status: ${res12.status}, access-control-allow-origin: ${corsHeader}`
    );

  } catch (err) {
    console.error('Test execution exception:', err);
  }

  const allPassed = results.length === 12 && results.every((r) => r.passed);
  console.log('\n====================================================');
  console.log(`TOTAL LIVE TESTS: ${results.length} | PASSED: ${results.filter((r) => r.passed).length} | FAILED: ${results.filter((r) => !r.passed).length}`);
  console.log(`LIVE SUITE RESULT: ${allPassed ? 'ALL LIVE TESTS PASSED!' : 'SOME LIVE TESTS FAILED'}`);
  console.log('====================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

runLiveTests();
