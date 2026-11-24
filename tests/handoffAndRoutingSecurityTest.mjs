/**
 * Comprehensive Test Suite for Cross-Application Handoff Security, CORS Allowlist, and Routing
 *
 * Verifies:
 * 1. Handoff code creation and cryptographic properties.
 * 2. Single-use atomic invalidation upon exchange.
 * 3. Expired code rejection.
 * 4. Reused code rejection.
 * 5. Invalid / malformed code rejection.
 * 6. Audience binding rejection (wrong targetApp).
 * 7. Role escalation rejection (customer cannot gain admin access).
 * 8. CORS explicit allowlist behavior (production vs dev, unapproved origin rejection, no wildcard with credentials).
 * 9. Admin NotFound page & routing consistency.
 * 10. Cross-application navigation URL integrity.
 */

import assert from 'assert';
import {
  initHandoffSchema,
  createHandoffCode,
  exchangeHandoffCode,
  hashHandoffCode,
} from '../server/src/services/handoffService.js';
import { corsOptions } from '../server/src/app.js';
import { env } from '../server/src/config/env.js';
import { pool } from '../server/src/config/db.js';
import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();

console.log('================================================================');
console.log('MAJESTIC BLAZER: AUTH HANDOFF & ROUTING SECURITY TEST SUITE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

let testCustomerId;
let testAdminId;

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}

// -----------------------------------------------------------------
// SETUP: Ensure Schema and Load Test User IDs
// -----------------------------------------------------------------
await test('0.1 Initialize PostgreSQL handoff schema and resolve test users', async () => {
  await initHandoffSchema(pool);
  const custRes = await pool.query("SELECT id FROM users WHERE role = 'customer' AND is_active = true LIMIT 1");
  testCustomerId = custRes.rows[0]?.id || 1;
  const adminRes = await pool.query("SELECT id FROM users WHERE role = 'admin' AND is_active = true LIMIT 1");
  testAdminId = adminRes.rows[0]?.id || 2;
});

// -----------------------------------------------------------------
// SECTION 1: AUTHENTICATION HANDOFF CORE SECURITY TESTS
// -----------------------------------------------------------------
await test('1.1 Generates cryptographically secure 256-bit handoff code with valid parameters', async () => {
  const handoff = await createHandoffCode({
    userId: testAdminId,
    userRole: 'admin',
    targetApp: 'admin',
    ttlSeconds: 60,
  });

  assert.ok(handoff.code, 'Handoff code must be generated');
  assert.strictEqual(typeof handoff.code, 'string');
  assert.strictEqual(handoff.code.length, 64, '256-bit hex string must be 64 characters');
  assert.strictEqual(handoff.targetApp, 'admin');
  assert.ok(handoff.expiresAt > Date.now(), 'Expiration must be in future');
});

await test('1.2 Successfully exchanges valid handoff code on first use', async () => {
  const handoff = await createHandoffCode({
    userId: testAdminId,
    userRole: 'admin',
    targetApp: 'admin',
    ttlSeconds: 60,
  });

  const exchange = await exchangeHandoffCode({
    code: handoff.code,
    targetApp: 'admin',
  });

  assert.strictEqual(exchange.success, true);
  assert.strictEqual(exchange.data.userId, testAdminId);
  assert.strictEqual(exchange.data.userRole, 'admin');
  assert.strictEqual(exchange.data.targetApp, 'admin');
});

await test('1.3 Rejects reused handoff code atomically (single-use guarantee)', async () => {
  const handoff = await createHandoffCode({
    userId: testCustomerId,
    userRole: 'customer',
    targetApp: 'customer',
    ttlSeconds: 60,
  });

  // First exchange must succeed
  const firstExchange = await exchangeHandoffCode({
    code: handoff.code,
    targetApp: 'customer',
  });
  assert.strictEqual(firstExchange.success, true);

  // Second exchange with exact same code must immediately fail
  const secondExchange = await exchangeHandoffCode({
    code: handoff.code,
    targetApp: 'customer',
  });
  assert.strictEqual(secondExchange.success, false);
  assert.strictEqual(secondExchange.statusCode, 401);
  assert.ok(secondExchange.error.includes('already been used') || secondExchange.error.includes('Invalid'));
});

await test('1.4 Rejects expired handoff code', async () => {
  // Create with negative or zero TTL to simulate expired code
  const handoff = await createHandoffCode({
    userId: testAdminId,
    userRole: 'admin',
    targetApp: 'admin',
    ttlSeconds: -1,
  });

  const exchange = await exchangeHandoffCode({
    code: handoff.code,
    targetApp: 'admin',
  });

  assert.strictEqual(exchange.success, false);
  assert.strictEqual(exchange.statusCode, 401);
  assert.ok(exchange.error.includes('expired'));
});

await test('1.5 Rejects invalid, non-existent, or malformed handoff code', async () => {
  const res1 = await exchangeHandoffCode({ code: 'non-existent-code-12345', targetApp: 'admin' });
  assert.strictEqual(res1.success, false);
  assert.strictEqual(res1.statusCode, 401);

  const res2 = await exchangeHandoffCode({ code: '', targetApp: 'admin' });
  assert.strictEqual(res2.success, false);
  assert.strictEqual(res2.statusCode, 400);

  const res3 = await exchangeHandoffCode({ code: null, targetApp: 'admin' });
  assert.strictEqual(res3.success, false);
  assert.strictEqual(res3.statusCode, 400);
});

await test('1.6 Rejects wrong-audience handoff code (audience mismatch)', async () => {
  // Code generated for customer storefront
  const customerHandoff = await createHandoffCode({
    userId: testCustomerId,
    userRole: 'customer',
    targetApp: 'customer',
    ttlSeconds: 60,
  });

  // Attacker attempts to exchange it at admin portal
  const exchange = await exchangeHandoffCode({
    code: customerHandoff.code,
    targetApp: 'admin',
  });

  assert.strictEqual(exchange.success, false);
  assert.strictEqual(exchange.statusCode, 403);
  assert.ok(exchange.error.includes('audience mismatch'));
});

await test('1.7 Prevents customer role escalation to administrator access', async () => {
  // Customer role trying to generate an admin handoff code
  await assert.rejects(
    async () => {
      await createHandoffCode({
        userId: testCustomerId,
        userRole: 'customer',
        targetApp: 'admin',
        ttlSeconds: 60,
      });
    },
    (err) => err.statusCode === 403 || err.message.includes('Customer accounts cannot')
  );
});

// -----------------------------------------------------------------
// SECTION 2: CORS EXPLICIT ALLOWLIST SECURITY TESTS
// -----------------------------------------------------------------
await test('2.1 Allows official production customer origin', async () => {
  await new Promise((resolve, reject) => {
    corsOptions.origin('https://majestic-blazer.vercel.app', (err, allow) => {
      if (err || !allow) return reject(new Error('Should allow customer origin'));
      resolve();
    });
  });
});

await test('2.2 Allows official production admin origin', async () => {
  await new Promise((resolve, reject) => {
    corsOptions.origin('https://majestic-blazer-miup.vercel.app', (err, allow) => {
      if (err || !allow) return reject(new Error('Should allow admin origin'));
      resolve();
    });
  });
});

await test('2.3 Rejects arbitrary unapproved Vercel origins', async () => {
  await new Promise((resolve, reject) => {
    corsOptions.origin('https://majestic-blazer-phishing.vercel.app', (err, allow) => {
      if (err && !allow) return resolve();
      reject(new Error('Should reject phishing / unauthorized vercel origin'));
    });
  });
});

await test('2.4 Rejects arbitrary external domains', async () => {
  await new Promise((resolve, reject) => {
    corsOptions.origin('https://evil-attacker.com', (err, allow) => {
      if (err && !allow) return resolve();
      reject(new Error('Should reject external origin'));
    });
  });
});

await test('2.5 Preserves credentials and allowed methods/headers without wildcard origin', async () => {
  assert.strictEqual(corsOptions.credentials, true, 'Credentials must be allowed for secure cookies/sessions');
  assert.ok(Array.isArray(corsOptions.methods), 'Methods array must be defined');
  assert.ok(corsOptions.methods.includes('POST') && corsOptions.methods.includes('GET'));
  assert.ok(typeof corsOptions.origin === 'function', 'Origin must be a dynamic validation function, never wildcard "*"');
});

// -----------------------------------------------------------------
// SECTION 3: ADMIN 404 AND ROUTING VERIFICATIONS
// -----------------------------------------------------------------
await test('3.1 Admin NotFound component exists with luxury styling and Dashboard link', async () => {
  const notFoundJsx = path.join(ROOT_DIR, 'admin', 'src', 'pages', 'NotFound.jsx');
  const notFoundCss = path.join(ROOT_DIR, 'admin', 'src', 'pages', 'NotFound.module.css');

  assert.ok(fs.existsSync(notFoundJsx), 'NotFound.jsx must exist in admin/src/pages');
  assert.ok(fs.existsSync(notFoundCss), 'NotFound.module.css must exist in admin/src/pages');

  const content = fs.readFileSync(notFoundJsx, 'utf8');
  assert.ok(content.includes('404'), 'Must display 404');
  assert.ok(content.includes('to="/"'), 'Must have link to dashboard');
  assert.ok(content.includes('Return to Dashboard'), 'Must include Return to Dashboard button');
});

await test('3.2 admin/src/App.jsx routes unmatched routes to NotFound within AdminLayout', async () => {
  const appJsx = path.join(ROOT_DIR, 'admin', 'src', 'App.jsx');
  const content = fs.readFileSync(appJsx, 'utf8');
  assert.ok(content.includes('<Route path="*" element={<NotFound />} />'), 'App.jsx must route * to <NotFound />');
  assert.ok(!content.includes('<Route path="*" element={<Navigate to="/" replace />} />'), 'App.jsx must not blindly redirect to /');
});

await test('3.3 Customer App.jsx routes * to customer NotFound page', async () => {
  const appJsx = path.join(ROOT_DIR, 'client', 'src', 'App.jsx');
  const content = fs.readFileSync(appJsx, 'utf8');
  assert.ok(content.includes('<Route path="*" element={<NotFound />} />'), 'Client App.jsx must route * to <NotFound />');
});

// -----------------------------------------------------------------
// SECTION 4: NO REUSABLE JWT TOKENS EXPOSED IN REDIRECT URLS
// -----------------------------------------------------------------
await test('4.1 Zero query-parameter reusable token redirects in AuthForm or Login', async () => {
  const clientAuth = fs.readFileSync(path.join(ROOT_DIR, 'client', 'src', 'components', 'common', 'AuthForm.jsx'), 'utf8');
  const adminLogin = fs.readFileSync(path.join(ROOT_DIR, 'admin', 'src', 'pages', 'Login.jsx'), 'utf8');

  assert.ok(!clientAuth.includes('/?token='), 'Client AuthForm must NOT redirect with /?token=');
  assert.ok(!adminLogin.includes('/?token='), 'Admin Login must NOT redirect with /?token=');
  assert.ok(clientAuth.includes('/?code='), 'Client AuthForm must use /?code= for handoff');
  assert.ok(adminLogin.includes('/?code='), 'Admin Login must use /?code= for handoff');
});

// -----------------------------------------------------------------
// SECTION 5: HTTP ENDPOINT INTEGRATION TESTS (REAL HTTP REQUESTS)
// -----------------------------------------------------------------
import http from 'http';
import app from '../server/src/app.js';
import { signToken } from '../server/src/utils/token.js';

let server;
let baseUrl;

await test('5.0 Start ephemeral test HTTP server and load active test accounts', async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}/api`;
      resolve();
    });
  });

  const custRes = await pool.query("SELECT id FROM users WHERE role = 'customer' AND is_active = true LIMIT 1");
  testCustomerId = custRes.rows[0]?.id || 1;

  const adminRes = await pool.query("SELECT id FROM users WHERE role = 'admin' AND is_active = true LIMIT 1");
  testAdminId = adminRes.rows[0]?.id || 2;
});

await test('5.1 POST /api/auth/handoff/create without token is rejected with 401', async () => {
  const res = await fetch(`${baseUrl}/auth/handoff/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetApp: 'customer' }),
  });
  assert.strictEqual(res.status, 401);
});

await test('5.2 Customer user cannot generate admin handoff code (403 Forbidden)', async () => {
  const customerToken = signToken({ id: testCustomerId, role: 'customer' });
  const res = await fetch(`${baseUrl}/auth/handoff/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({ targetApp: 'admin' }),
  });
  assert.strictEqual(res.status, 403);
  const json = await res.json();
  assert.ok(json.message.includes('Customer accounts cannot') || json.message.includes('cannot generate'));
});

await test('5.3 Customer user generates customer handoff code (200 OK)', async () => {
  const customerToken = signToken({ id: testCustomerId, role: 'customer' });
  const res = await fetch(`${baseUrl}/auth/handoff/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({ targetApp: 'customer' }),
  });
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.ok(json.data.handoffCode);
  assert.strictEqual(json.data.targetApp, 'customer');

  // Attempt exchange at wrong app (admin) -> must be 403
  const wrongExchange = await fetch(`${baseUrl}/auth/handoff/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: json.data.handoffCode, targetApp: 'admin' }),
  });
  assert.strictEqual(wrongExchange.status, 403);
});

await test('5.4 Admin user generates admin handoff code and successfully exchanges it', async () => {
  const adminToken = signToken({ id: testAdminId, role: 'admin' });
  const createRes = await fetch(`${baseUrl}/auth/handoff/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ targetApp: 'admin' }),
  });
  assert.strictEqual(createRes.status, 200);
  const createJson = await createRes.json();
  const code = createJson.data.handoffCode;

  // Exchange with correct audience
  const exchangeRes = await fetch(`${baseUrl}/auth/handoff/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, targetApp: 'admin' }),
  });
  assert.strictEqual(exchangeRes.status, 200);
  const exchangeJson = await exchangeRes.json();
  assert.ok(exchangeJson.data.token, 'Must return authentic JWT');

  // Reused code must fail immediately
  const reuseRes = await fetch(`${baseUrl}/auth/handoff/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, targetApp: 'admin' }),
  });
  assert.strictEqual(reuseRes.status, 401);
});

await test('5.5 Close test HTTP server and database pool', async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await pool.end();
});

console.log('\n----------------------------------------------------------------');
console.log(`TEST SUMMARY: ${passedTests}/${totalTests} tests passed.`);
console.log('----------------------------------------------------------------');

if (passedTests === totalTests) {
  console.log('ALL AUTH HANDOFF & ROUTING SECURITY TESTS PASSED SUCCESSFULLY!\n');
} else {
  process.exit(1);
}
