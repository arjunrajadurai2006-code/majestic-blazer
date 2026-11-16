import { pool } from '../src/config/db.js';
import app from '../src/app.js';
import http from 'node:http';

async function runAuthRegression() {
  console.log('=== MAJESTIC BLAZER AUTHENTICATION REGRESSION TEST ===\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  let passed = 0;
  let failed = 0;

  const assert = (condition, desc) => {
    if (condition) {
      console.log(`✓ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${desc}`);
      failed++;
    }
  };

  try {
    // 1. Customer registration
    const regEmail = `patron.test.${Date.now()}@majesticblazer.com`;
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Arvind Swamy',
        email: regEmail,
        phone: '9876543210',
        password: 'PatronSecure2026!',
      }),
    });
    const regData = await regRes.json();
    assert(regRes.status === 201 && regData.data.token, 'Customer registration returns 201 and JWT');
    const customerToken = regData.data.token;

    // 2. Customer login - valid credentials
    const custLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: regEmail,
        password: 'PatronSecure2026!',
      }),
    });
    const custLoginData = await custLoginRes.json();
    assert(custLoginRes.status === 200 && custLoginData.data.user.role === 'customer', 'Customer login returns 200 and user role "customer"');

    // 3. Customer login - invalid password
    const custBadLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: regEmail,
        password: 'WrongPassword123!',
      }),
    });
    assert(custBadLoginRes.status === 401, 'Customer login with invalid password returns 401 Unauthorized');

    // 4. Customer token on customer route
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const meData = await meRes.json();
    assert(meRes.status === 200 && meData.data.user.email === regEmail, 'Customer token can access /api/auth/me');

    // 5. Customer token on Admin APIs (RBAC verification)
    const custAdminCheck1 = await fetch(`${baseUrl}/analytics/summary`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(custAdminCheck1.status === 403, 'Customer token is rejected (403 Forbidden) on /api/analytics/summary');

    const custAdminCheck2 = await fetch(`${baseUrl}/customers`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(custAdminCheck2.status === 403, 'Customer token is rejected (403 Forbidden) on /api/customers');

    const custAdminCheck3 = await fetch(`${baseUrl}/orders/all`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(custAdminCheck3.status === 403, 'Customer token is rejected (403 Forbidden) on /api/orders/all');

    // 6. Admin login - valid credentials
    const adminLoginRes = await fetch(`${baseUrl}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin.demo@majesticblazer.com',
        password: 'MajesticAdmin2026!Secure',
      }),
    });
    const adminLoginData = await adminLoginRes.json();
    assert(adminLoginRes.status === 200 && adminLoginData.data.user.role === 'admin', 'Admin login returns 200 and user role "admin"');
    const adminToken = adminLoginData.data.token;

    // 7. Admin login - invalid credentials
    const adminBadLoginRes = await fetch(`${baseUrl}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin.demo@majesticblazer.com',
        password: 'IncorrectAdminPassword!',
      }),
    });
    assert(adminBadLoginRes.status === 401, 'Admin login with invalid password returns 401 Unauthorized');

    // 8. Admin token on Admin APIs
    const adminSummaryRes = await fetch(`${baseUrl}/analytics/summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminSummaryRes.status === 200, 'Admin token successfully accesses /api/analytics/summary');

    const adminCustomersRes = await fetch(`${baseUrl}/customers`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminCustomersRes.status === 200, 'Admin token successfully accesses /api/customers');

    const adminOrdersRes = await fetch(`${baseUrl}/orders/all`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminOrdersRes.status === 200, 'Admin token successfully accesses /api/orders/all');

    const adminCouponsRes = await fetch(`${baseUrl}/coupons`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminCouponsRes.status === 200, 'Admin token successfully accesses /api/coupons');

    const adminReviewsRes = await fetch(`${baseUrl}/reviews/all`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminReviewsRes.status === 200, 'Admin token successfully accesses /api/reviews/all');

    // 9. Unauthenticated requests to protected endpoints
    const noAuthRes = await fetch(`${baseUrl}/analytics/summary`);
    assert(noAuthRes.status === 401, 'Unauthenticated request to /api/analytics/summary returns 401');

    const noAuthMeRes = await fetch(`${baseUrl}/auth/me`);
    assert(noAuthMeRes.status === 401, 'Unauthenticated request to /api/auth/me returns 401');

    // 10. Logout & Token Invalidation Test (Admin)
    const adminLogoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminLogoutData = await adminLogoutRes.json();
    assert(adminLogoutRes.status === 200 && adminLogoutData.success, 'POST /api/auth/logout succeeds with 200');

    // 11. Post-logout token rejection (Revocation check)
    const postLogoutAdminCheck = await fetch(`${baseUrl}/analytics/summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(postLogoutAdminCheck.status === 401, 'Revoked admin token is immediately rejected with 401 Unauthorized on protected routes');

    // 12. Logout & Token Invalidation Test (Customer)
    const custLogoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(custLogoutRes.status === 200, 'Customer POST /api/auth/logout succeeds with 200');

    const postLogoutCustCheck = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(postLogoutCustCheck.status === 401, 'Revoked customer token is immediately rejected with 401 Unauthorized on /api/auth/me');

    console.log(`\n========================================`);
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

  } finally {
    server.close();
    await pool.end();
  }
}

runAuthRegression()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test script crashed:', err);
    process.exit(1);
  });
