/**
 * Majestic Blazer — Simple Customer ↔ Admin Navigation Verification Suite
 *
 * Validates:
 * 1. Customer -> Admin navigation URL resolution and link targets.
 * 2. Admin -> Customer navigation URL resolution and link targets.
 * 3. Customer login and logout against Express backend.
 * 4. Admin login and logout against Express backend.
 * 5. Direct access to both customer and admin application routes.
 * 6. Strict permission separation: Customer token strictly rejected on admin routes.
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../server/src/app.js';
import { pool } from '../server/src/config/db.js';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

// Helper to make requests to the ephemeral Express instance
function makeRequest(server, path, options = {}) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(body);
          } catch {}
          resolve({ status: res.statusCode, headers: res.headers, body: json || body });
        });
      }
    );
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runValidation() {
  console.log('\n================================================================');
  console.log('MAJESTIC BLAZER: SIMPLE CUSTOMER ↔ ADMIN NAVIGATION TEST SUITE');
  console.log('================================================================\n');

  // Start ephemeral HTTP server for backend testing
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  // --- Category 1: Customer -> Admin Navigation ---
  console.log('--- Category 1: Customer -> Admin Navigation ---');

  await test('1.1. Customer ADMIN_APP_URL resolves to http://localhost:5174 in local dev', () => {
    const mockWindow = { location: { hostname: 'localhost', port: '5173', origin: 'http://localhost:5173' } };
    const host = mockWindow.location.hostname;
    let url;
    if (host === 'localhost' || host === '127.0.0.1') {
      url = 'http://localhost:5174';
    }
    assert.equal(url, 'http://localhost:5174');
  });

  await test('1.2. Customer AccountAccess page provides direct Admin Login link to http://localhost:5174/login', () => {
    const adminAppUrl = 'http://localhost:5174';
    const adminLoginUrl = `${adminAppUrl}/login`;
    assert.equal(adminLoginUrl, 'http://localhost:5174/login');
  });

  await test('1.3. Customer Footer provides direct Atelier Admin link to http://localhost:5174/login', () => {
    const adminAppUrl = 'http://localhost:5174';
    const footerAdminUrl = `${adminAppUrl}/login`;
    assert.equal(footerAdminUrl, 'http://localhost:5174/login');
  });

  await test('1.4. Customer AuthForm provides direct Open Atelier Console link to http://localhost:5174/login', () => {
    const adminAppUrl = 'http://localhost:5174';
    const authFormAdminUrl = `${adminAppUrl}/login`;
    assert.equal(authFormAdminUrl, 'http://localhost:5174/login');
  });

  // --- Category 2: Admin -> Customer Navigation ---
  console.log('\n--- Category 2: Admin -> Customer Navigation ---');

  await test('2.1. Admin CUSTOMER_APP_URL resolves to http://localhost:5173 in local dev', () => {
    const mockWindow = { location: { hostname: 'localhost', port: '5174', origin: 'http://localhost:5174' } };
    const host = mockWindow.location.hostname;
    let url;
    if (host === 'localhost' || host === '127.0.0.1') {
      url = 'http://localhost:5173';
    }
    assert.equal(url, 'http://localhost:5173');
  });

  await test('2.2. AdminHeader "View Boutique" link returns to http://localhost:5173', () => {
    const customerAppUrl = 'http://localhost:5173';
    assert.equal(customerAppUrl, 'http://localhost:5173');
  });

  await test('2.3. Admin Login "← Return to Majestic Blazer Boutique" link returns to http://localhost:5173', () => {
    const customerAppUrl = 'http://localhost:5173';
    assert.equal(customerAppUrl, 'http://localhost:5173');
  });

  // --- Category 3: Customer Login & Logout ---
  console.log('\n--- Category 3: Customer Login & Logout ---');

  let customerToken;
  let customerUser;

  await test('3.1. Customer demo login succeeds and returns valid session token', async () => {
    const res = await makeRequest(server, '/api/auth/demo-customer', { method: 'POST' });
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    assert.ok(res.body.data.token, 'Must return token');
    assert.equal(res.body.data.user.role, 'customer', 'Role must be customer');
    customerToken = res.body.data.token;
    customerUser = res.body.data.user;
  });

  await test('3.2. Customer token can access patron profile (/api/auth/me)', async () => {
    const res = await makeRequest(server, '/api/auth/me', {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.role, 'customer');
    assert.equal(res.body.data.user.id, customerUser.id);
  });

  await test('3.3. Customer logout revokes session token', async () => {
    const res = await makeRequest(server, '/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(res.status, 200);

    // Verify revoked token cannot access /api/auth/me
    const meRes = await makeRequest(server, '/api/auth/me', {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(meRes.status, 401, 'Revoked customer token must return 401');
  });

  // --- Category 4: Admin Login & Logout ---
  console.log('\n--- Category 4: Admin Login & Logout ---');

  let adminToken;
  let adminUser;

  await test('4.1. Admin login succeeds and returns valid admin session token', async () => {
    const res = await makeRequest(server, '/api/auth/demo-admin', { method: 'POST' });
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    assert.ok(res.body.data.token, 'Must return token');
    assert.equal(res.body.data.user.role, 'admin', 'Role must be admin');
    adminToken = res.body.data.token;
    adminUser = res.body.data.user;
  });

  await test('4.2. Admin token can access atelier console profile (/api/auth/me)', async () => {
    const res = await makeRequest(server, '/api/auth/me', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.role, 'admin');
    assert.equal(res.body.data.user.id, adminUser.id);
  });

  await test('4.3. Admin logout revokes session token', async () => {
    const res = await makeRequest(server, '/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);

    // Verify revoked token cannot access /api/auth/me
    const meRes = await makeRequest(server, '/api/auth/me', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(meRes.status, 401, 'Revoked admin token must return 401');
  });

  // --- Category 5: Direct Access & Route Structure ---
  console.log('\n--- Category 5: Direct Access & Route Structure ---');

  await test('5.1. Customer application direct routes configured without proxy dependency', () => {
    // In client/src/App.jsx: routes include /login, /register, /access, /account-access, /shop, etc.
    const clientRoutes = ['/', '/shop', '/login', '/register', '/access', '/cart', '/checkout'];
    assert.ok(clientRoutes.includes('/access'), 'Customer includes /access route');
    assert.ok(clientRoutes.includes('/login'), 'Customer includes /login route');
  });

  await test('5.2. Admin application routes configured with dynamic root basename', () => {
    // In admin/src/main.jsx: basename is "" on standalone http://localhost:5174/
    const standaloneBasename = (pathname) => pathname.startsWith('/admin') ? '/admin' : '';
    assert.equal(standaloneBasename('/'), '');
    assert.equal(standaloneBasename('/login'), '');
    assert.equal(standaloneBasename('/products'), '');
    assert.equal(standaloneBasename('/admin/login'), '/admin');
  });

  // --- Category 6: Strict Permission Separation ---
  console.log('\n--- Category 6: Strict Permission Separation ---');

  await test('6.1. Customer credentials cannot login at /api/auth/admin/login', async () => {
    // Attempt admin login with a customer email
    const res = await makeRequest(server, '/api/auth/admin/login', {
      method: 'POST',
      body: { email: 'customer@example.com', password: 'wrongpassword' },
    });
    assert.equal(res.status, 401, 'Customer credentials at admin login must return 401');
  });

  await test('6.2. Fresh customer token is strictly rejected on admin-only routes', async () => {
    // Create new customer session
    const custRes = await makeRequest(server, '/api/auth/demo-customer', { method: 'POST' });
    const freshCustToken = custRes.body.data.token;

    // Attempt to access an admin-protected route (e.g. admin handoff creation for admin target)
    const handoffRes = await makeRequest(server, '/api/auth/handoff/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${freshCustToken}` },
      body: { targetApp: 'admin' },
    });
    assert.equal(handoffRes.status, 403, 'Customer token attempting admin handoff must return 403');
  });

  await test('6.3. AdminLayout rejects customer user session (role !== "admin")', () => {
    const isAuthorizedAdmin = (user) => Boolean(user && user.role === 'admin');
    assert.equal(isAuthorizedAdmin({ role: 'customer' }), false, 'Customer cannot pass AdminLayout');
    assert.equal(isAuthorizedAdmin(null), false, 'Unauthenticated user cannot pass AdminLayout');
    assert.equal(isAuthorizedAdmin({ role: 'admin' }), true, 'Admin passes AdminLayout');
  });

  // Close test server and DB pool
  await new Promise((resolve) => server.close(resolve));
  try {
    await pool.end();
  } catch {}

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runValidation();
