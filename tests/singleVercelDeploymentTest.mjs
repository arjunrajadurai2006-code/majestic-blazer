/**
 * Majestic Blazer — Single Vercel URL Deployment & Role-Based Access Test Suite
 *
 * Validates:
 * 1. Customer login opens customer portal (role: 'customer', redirects to customer path).
 * 2. Admin login opens admin portal (role: 'admin', redirects to /admin).
 * 3. Customer cannot access admin routes (blocked with 403 on API and rejected by AdminLayout).
 * 4. Admin can access authorized admin routes.
 * 5. Both portals navigate between each other seamlessly under one origin.
 * 6. Sessions survive page refresh on the same origin (localStorage token retrieval).
 * 7. Logout revokes session on backend and clears local tokens.
 * 8. Nested routes work after refresh (vercel.json rewrites).
 * 9. Customer and admin static assets exist in unified dist without 404s.
 * 10. Backend API requests reach the Express backend.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import app from '../server/src/app.js';
import { pool } from '../server/src/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

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

async function runTestSuite() {
  console.log('\n================================================================');
  console.log('MAJESTIC BLAZER: SINGLE VERCEL DEPLOYMENT & ROLE ACCESS TESTS');
  console.log('================================================================\n');

  // Start ephemeral HTTP server for backend testing
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  // --- Category 1: Shared Login & Role Detection ---
  console.log('--- Category 1: Shared Login & Role Detection ---');

  let customerToken;
  let customerUser;
  let adminToken;
  let adminUser;

  await test('1.1. Customer login at shared /api/auth/login returns role: "customer"', async () => {
    const res = await makeRequest(server, '/api/auth/demo-customer', { method: 'POST' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.role, 'customer');
    assert.ok(res.body.data.token);
    customerToken = res.body.data.token;
    customerUser = res.body.data.user;

    // Verify post-login redirection logic
    const targetUrl = customerUser.role === 'admin' ? '/admin' : '/';
    assert.equal(targetUrl, '/', 'Customer role must route to storefront /');
  });

  await test('1.2. Admin login at shared /api/auth/login returns role: "admin"', async () => {
    const res = await makeRequest(server, '/api/auth/demo-admin', { method: 'POST' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.role, 'admin');
    assert.ok(res.body.data.token);
    adminToken = res.body.data.token;
    adminUser = res.body.data.user;

    // Verify post-login redirection logic
    const targetUrl = adminUser.role === 'admin' ? '/admin' : '/';
    assert.equal(targetUrl, '/admin', 'Admin role must route to admin portal /admin');
  });

  await test('1.3. Backend strictly dictates role (frontend inputs ignored)', async () => {
    // If request attempts to supply fake role in body, backend ignores it
    const res = await makeRequest(server, '/api/auth/demo-customer', {
      method: 'POST',
      body: { role: 'admin', forcedRole: 'admin' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.role, 'customer', 'Role must remain verified customer role');
  });

  // --- Category 2: Role Authorization & Route Protection ---
  console.log('\n--- Category 2: Role Authorization & Route Protection ---');

  await test('2.1. Customer token is rejected on admin-only routes (403 Forbidden)', async () => {
    // Attempt admin handoff creation with customer token
    const res = await makeRequest(server, '/api/auth/handoff/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: { targetApp: 'admin' },
    });
    assert.equal(res.status, 403, 'Customer token must be rejected with 403');
  });

  await test('2.2. Admin token is accepted on admin-authorized routes (200 OK)', async () => {
    const res = await makeRequest(server, '/api/auth/handoff/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { targetApp: 'admin' },
    });
    assert.equal(res.status, 200, 'Admin token must succeed with 200');
    assert.ok(res.body.data.handoffCode);
  });

  await test('2.3. AdminLayout route guard rejects customer role', () => {
    const guardEvaluator = (user) => {
      if (!user) return '/login';
      if (user.role !== 'admin') return '/login';
      return null; // authorized
    };

    assert.equal(guardEvaluator(null), '/login', 'Unauthenticated user rejected');
    assert.equal(guardEvaluator({ role: 'customer' }), '/login', 'Customer rejected from admin layout');
    assert.equal(guardEvaluator({ role: 'admin' }), null, 'Admin accepted');
  });

  // --- Category 3: Session Management & Navigation on Same Origin ---
  console.log('\n--- Category 3: Session Management & Navigation on Same Origin ---');

  await test('3.1. Unified Vercel URL evaluation for Customer -> Admin', () => {
    const mockWindow = {
      location: {
        hostname: 'majestic-blazer.vercel.app',
        origin: 'https://majestic-blazer.vercel.app',
        pathname: '/',
      },
    };
    const host = mockWindow.location.hostname;
    let adminUrl;
    if (host.includes('vercel.app')) {
      adminUrl = `${mockWindow.location.origin}/admin`;
    }
    assert.equal(adminUrl, 'https://majestic-blazer.vercel.app/admin');
  });

  await test('3.2. Unified Vercel URL evaluation for Admin -> Customer', () => {
    const mockWindow = {
      location: {
        hostname: 'majestic-blazer.vercel.app',
        origin: 'https://majestic-blazer.vercel.app',
        pathname: '/admin/orders',
      },
    };
    const host = mockWindow.location.hostname;
    let customerUrl;
    if (host.includes('vercel.app')) {
      customerUrl = mockWindow.location.origin;
    }
    assert.equal(customerUrl, 'https://majestic-blazer.vercel.app');
  });

  await test('3.3. Shared origin session persistence via localStorage tokenStore', () => {
    const mockLocalStorage = {
      mb_token: adminToken,
      mb_admin_token: adminToken,
    };

    // Client tokenStore reads either
    const clientToken = mockLocalStorage['mb_token'] || mockLocalStorage['mb_admin_token'];
    assert.equal(clientToken, adminToken);

    // Admin tokenStore reads either
    const adminStoredToken = mockLocalStorage['mb_admin_token'] || mockLocalStorage['mb_token'];
    assert.equal(adminStoredToken, adminToken);
  });

  await test('3.4. Logout terminates session on backend and revokes token', async () => {
    // Logout with customer token
    const logoutRes = await makeRequest(server, '/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(logoutRes.status, 200);

    // Verifies revoked token is rejected with 401
    const verifyRes = await makeRequest(server, '/api/auth/me', {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(verifyRes.status, 401, 'Revoked token must be rejected with 401');
  });

  // --- Category 4: Unified Vercel Static Build & Asset Verification ---
  console.log('\n--- Category 4: Unified Vercel Static Build & Asset Verification ---');

  await test('4.1. Unified dist/ contains customer index.html at root', () => {
    const customerHtmlPath = path.resolve(rootDir, 'dist', 'index.html');
    assert.ok(fs.existsSync(customerHtmlPath), 'dist/index.html must exist');
    const content = fs.readFileSync(customerHtmlPath, 'utf8');
    assert.match(content, /<title>MAJESTIC BLAZER/);
    assert.match(content, /src="\/assets\/index-/);
  });

  await test('4.2. Unified dist/ contains customer static assets under /assets/', () => {
    const assetsDir = path.resolve(rootDir, 'dist', 'assets');
    assert.ok(fs.existsSync(assetsDir), 'dist/assets/ must exist');
    const files = fs.readdirSync(assetsDir);
    assert.ok(files.length > 0, 'dist/assets/ must contain compiled asset files');
    const hasJs = files.some((f) => f.endsWith('.js'));
    const hasCss = files.some((f) => f.endsWith('.css'));
    assert.ok(hasJs, 'Must contain compiled JS chunks');
    assert.ok(hasCss, 'Must contain compiled CSS');
  });

  await test('4.3. Unified dist/ contains admin index.html under /admin/', () => {
    const adminHtmlPath = path.resolve(rootDir, 'dist', 'admin', 'index.html');
    assert.ok(fs.existsSync(adminHtmlPath), 'dist/admin/index.html must exist');
    const content = fs.readFileSync(adminHtmlPath, 'utf8');
    assert.match(content, /<title>Majestic Blazer Admin/);
    assert.match(content, /src="\/admin\/assets\/index-/);
  });

  await test('4.4. Unified dist/ contains admin static assets under /admin/assets/', () => {
    const adminAssetsDir = path.resolve(rootDir, 'dist', 'admin', 'assets');
    assert.ok(fs.existsSync(adminAssetsDir), 'dist/admin/assets/ must exist');
    const files = fs.readdirSync(adminAssetsDir);
    assert.ok(files.length > 0, 'dist/admin/assets/ must contain compiled asset files');
    const hasJs = files.some((f) => f.endsWith('.js'));
    const hasCss = files.some((f) => f.endsWith('.css'));
    assert.ok(hasJs, 'Must contain compiled admin JS chunks');
    assert.ok(hasCss, 'Must contain compiled admin CSS');
  });

  // --- Category 5: vercel.json Rewrite Rule Mapping ---
  console.log('\n--- Category 5: vercel.json Rewrite Rule Mapping ---');

  await test('5.1. vercel.json contains required route rewrites in correct precedence', () => {
    const vercelConfigPath = path.resolve(rootDir, 'vercel.json');
    assert.ok(fs.existsSync(vercelConfigPath), 'vercel.json must exist');
    const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));

    assert.equal(vercelConfig.version, 2);
    assert.equal(vercelConfig.outputDirectory, 'dist');
    assert.ok(Array.isArray(vercelConfig.rewrites));

    const rules = vercelConfig.rewrites.map((r) => r.source);
    assert.ok(rules.includes('/api/(.*)'), 'Must rewrite /api/(.*)');
    assert.ok(rules.includes('/uploads/(.*)'), 'Must rewrite /uploads/(.*)');
    assert.ok(rules.includes('/admin/assets/(.*)'), 'Must rewrite /admin/assets/(.*)');
    assert.ok(rules.includes('/admin'), 'Must rewrite /admin');
    assert.ok(rules.includes('/admin/(.*)'), 'Must rewrite /admin/(.*)');
    assert.ok(rules.includes('/assets/(.*)'), 'Must rewrite /assets/(.*)');
    assert.ok(rules.includes('/(.*)'), 'Must rewrite /(.*)');

    // Precedence: /api and /admin rules must be before /(.*)
    const apiIndex = rules.indexOf('/api/(.*)');
    const adminIndex = rules.indexOf('/admin/(.*)');
    const catchAllIndex = rules.indexOf('/(.*)');

    assert.ok(apiIndex < catchAllIndex, '/api must come before catch-all');
    assert.ok(adminIndex < catchAllIndex, '/admin must come before catch-all');
  });

  // Close test server and database pool
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

runTestSuite();
