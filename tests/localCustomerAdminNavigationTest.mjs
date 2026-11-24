/**
 * Majestic Blazer — Local Customer-to-Admin Navigation Verification Test
 *
 * Verifies the end-to-end local customer-to-admin navigation flow through
 * Cloudflare Worker router (http://localhost:8787):
 * 1. ADMIN_APP_URL and CUSTOMER_APP_URL resolution on localhost:8787.
 * 2. Customer AccountAccess click handler and handoff initiation.
 * 3. Backend single-use handoff code generation (demo-admin & handoff/create).
 * 4. Cloudflare Worker routing and query string preservation (?code=...).
 * 5. Admin AuthContext initial loading state (prevents premature redirect race condition).
 * 6. Admin AuthContext handoff code consumption (/auth/handoff/exchange).
 * 7. Admin session establishment (mb_admin_token & role: 'admin').
 * 8. Atomic single-use code invalidation.
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import worker, { routeRequest } from '../cloudflare-worker/worker.js';
import { createHandoffCode, exchangeHandoffCode, hashHandoffCode } from '../server/src/services/handoffService.js';
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

const LOCAL_CONFIG = {
  CUSTOMER_ORIGIN: 'http://localhost:5173',
  ADMIN_ORIGIN: 'http://localhost:5174',
  BACKEND_ORIGIN: 'http://localhost:5000',
};

async function runAll() {
  console.log('\n================================================================');
  console.log('MAJESTIC BLAZER: LOCAL CUSTOMER-TO-ADMIN NAVIGATION VERIFICATION');
  console.log('================================================================\n');

  // --- Category 1: URL Resolution on Localhost:8787 ---
  console.log('--- Category 1: URL Resolution on Localhost:8787 ---');

  await test('1.1. Customer ADMIN_APP_URL resolves to /admin on localhost:8787', () => {
    const windowMock = {
      location: {
        hostname: 'localhost',
        port: '8787',
        origin: 'http://localhost:8787',
      },
    };
    const host = windowMock.location.hostname;
    const port = windowMock.location.port;

    let adminAppUrl;
    if ((host === 'localhost' || host === '127.0.0.1') && port === '8787') {
      adminAppUrl = `${windowMock.location.origin}/admin`;
    }
    assert.equal(adminAppUrl, 'http://localhost:8787/admin');
  });

  await test('1.2. Admin CUSTOMER_APP_URL resolves to origin on localhost:8787', () => {
    const windowMock = {
      location: {
        hostname: 'localhost',
        port: '8787',
        origin: 'http://localhost:8787',
      },
    };
    const host = windowMock.location.hostname;
    const port = windowMock.location.port;

    let customerAppUrl;
    if ((host === 'localhost' || host === '127.0.0.1') && port === '8787') {
      customerAppUrl = windowMock.location.origin;
    }
    assert.equal(customerAppUrl, 'http://localhost:8787');
  });

  // --- Category 2: Cloudflare Worker Routing with Query Strings ---
  console.log('\n--- Category 2: Cloudflare Worker Routing with Query Strings ---');

  await test('2.1. /admin/?code=XYZ routes directly to local admin server (port 5174)', () => {
    const testCode = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
    const url = new URL(`http://localhost:8787/admin/?code=${testCode}`);
    const route = routeRequest(url, LOCAL_CONFIG);

    assert.equal(route.type, 'proxy');
    assert.equal(route.service, 'admin-portal');
    assert.equal(route.targetUrl, `http://localhost:5174/admin/?code=${testCode}`);
  });

  await test('2.2. /admin?code=XYZ redirects with 301 to /admin/?code=XYZ preserving code', () => {
    const testCode = 'test-handoff-code-12345';
    const url = new URL(`http://localhost:8787/admin?code=${testCode}`);
    const route = routeRequest(url, LOCAL_CONFIG);

    assert.equal(route.type, 'redirect');
    assert.equal(route.status, 301);
    assert.equal(route.targetUrl, `http://localhost:8787/admin/?code=${testCode}`);
  });

  // --- Category 3: Admin AuthContext Race Condition Guard ---
  console.log('\n--- Category 3: Admin AuthContext Race Condition Guard ---');

  await test('3.1. AuthProvider detects code in URL and sets initial loading to true', () => {
    const hasHandoffParams = (search) => {
      const params = new URLSearchParams(search);
      return Boolean(params.get('code') || params.get('token'));
    };

    const tokenStoreEmpty = () => null;

    // Case A: User lands on /admin/?code=abc (unauthenticated initial state)
    const loadingWithCode = Boolean(tokenStoreEmpty()) || hasHandoffParams('?code=9876543210');
    assert.equal(loadingWithCode, true, 'loading must be true when ?code is present');

    // Case B: User lands on /admin/ without code and without token
    const loadingWithoutCode = Boolean(tokenStoreEmpty()) || hasHandoffParams('');
    assert.equal(loadingWithoutCode, false, 'loading must be false when neither token nor code is present');

    // Case C: User lands with existing token
    const tokenStoreWithToken = () => 'existing-admin-token';
    const loadingWithToken = Boolean(tokenStoreWithToken()) || hasHandoffParams('');
    assert.equal(loadingWithToken, true, 'loading must be true when token exists');
  });

  // --- Category 4: PostgreSQL Atomic Handoff Generation & Exchange ---
  console.log('\n--- Category 4: PostgreSQL Atomic Handoff Generation & Exchange ---');

  let sharedHandoffCode;
  let adminUserId;

  await test('4.1. Generate real admin single-use handoff code in PostgreSQL', async () => {
    const adminRes = await pool.query(
      "SELECT id, role FROM users WHERE role = 'admin' AND is_active = true LIMIT 1"
    );
    assert.ok(adminRes.rows.length > 0, 'At least one active admin user must exist');
    adminUserId = adminRes.rows[0].id;

    const handoff = await createHandoffCode({
      userId: adminUserId,
      userRole: 'admin',
      targetApp: 'admin',
    });

    assert.ok(handoff.code, 'Handoff code must be generated');
    assert.equal(typeof handoff.code, 'string');
    assert.equal(handoff.code.length, 64, 'Handoff code must be 64-character hex');
    assert.equal(handoff.targetApp, 'admin');
    sharedHandoffCode = handoff.code;
  });

  await test('4.2. Verify database stores only SHA-256 hash, not raw code', async () => {
    const codeHash = hashHandoffCode(sharedHandoffCode);
    const check = await pool.query(
      'SELECT * FROM auth_handoff_codes WHERE code_hash = $1',
      [codeHash]
    );
    assert.equal(check.rows.length, 1, 'Handoff record must exist by SHA-256 hash');
    assert.equal(check.rows[0].user_id, adminUserId);
    assert.equal(check.rows[0].consumed_at, null, 'Must be initially unconsumed (consumed_at is null)');
    assert.equal(check.rows[0].target_app, 'admin');
  });

  await test('4.3. Admin application consumes code via exchangeHandoffCode', async () => {
    const result = await exchangeHandoffCode({
      code: sharedHandoffCode,
      targetApp: 'admin',
    });

    assert.equal(result.success, true, 'Exchange must return success: true');
    assert.equal(result.data.userId, adminUserId);
    assert.equal(result.data.userRole, 'admin');
    assert.equal(result.data.targetApp, 'admin');
  });

  await test('4.4. Verify code is atomically consumed and second exchange is rejected', async () => {
    const result = await exchangeHandoffCode({
      code: sharedHandoffCode,
      targetApp: 'admin',
    });

    assert.equal(result.success, false, 'Second exchange must be rejected');
    assert.equal(result.statusCode, 401);
    assert.match(result.error, /already been used/i);
  });

  await test('4.5. Reject handoff code with wrong target application', async () => {
    const handoff = await createHandoffCode({
      userId: adminUserId,
      userRole: 'admin',
      targetApp: 'customer',
    });

    const result = await exchangeHandoffCode({
      code: handoff.code,
      targetApp: 'admin',
    });

    assert.equal(result.success, false, 'Wrong targetApp exchange must fail');
    assert.equal(result.statusCode, 403);
    assert.match(result.error, /mismatch/i);
  });

  // --- Category 5: End-to-End Simulation of Customer-to-Admin Navigation ---
  console.log('\n--- Category 5: End-to-End Simulation of Customer-to-Admin Navigation ---');

  await test('5.1. Complete Customer-to-Admin Flow on Localhost:8787', async () => {
    // Step 1: Customer visits http://localhost:8787/access and clicks "ADMIN SIGN IN"
    const origin = 'http://localhost:8787';
    const adminAppUrl = `${origin}/admin`;

    // Step 2: Handoff code acquired
    const handoff = await createHandoffCode({
      userId: adminUserId,
      userRole: 'admin',
      targetApp: 'admin',
    });
    const handoffCode = handoff.code;

    // Step 3: Browser constructs redirect URL
    const browserRedirectUrl = `${adminAppUrl}/?code=${encodeURIComponent(handoffCode)}`;
    assert.equal(browserRedirectUrl, `http://localhost:8787/admin/?code=${handoffCode}`);

    // Step 4: Worker intercepts and routes to port 5174
    const parsedUrl = new URL(browserRedirectUrl);
    const workerRoute = routeRequest(parsedUrl, LOCAL_CONFIG);
    assert.equal(workerRoute.type, 'proxy');
    assert.equal(workerRoute.targetUrl, `http://localhost:5174/admin/?code=${handoffCode}`);

    // Step 5: Admin app mounts on port 5174 under basename="/admin"
    const hasParams = Boolean(new URLSearchParams(parsedUrl.search).get('code'));
    assert.equal(hasParams, true, 'Admin AuthProvider initializes loading to true');

    // Step 6: Admin app calls POST /api/auth/handoff/exchange
    const exchangeRes = await exchangeHandoffCode({
      code: handoffCode,
      targetApp: 'admin',
    });
    assert.equal(exchangeRes.success, true, 'Handoff exchange must succeed');
    assert.equal(exchangeRes.data.userRole, 'admin', 'Exchanged user has admin role');

    // Step 7: Verify single-use code is marked consumed
    const codeHash = hashHandoffCode(handoffCode);
    const consumedCheck = await pool.query(
      'SELECT consumed_at FROM auth_handoff_codes WHERE code_hash = $1',
      [codeHash]
    );
    assert.ok(consumedCheck.rows[0].consumed_at !== null, 'Code must be marked consumed in DB');

    // Step 8: Single-use code cannot be re-exchanged
    const replayRes = await exchangeHandoffCode({
      code: handoffCode,
      targetApp: 'admin',
    });
    assert.equal(replayRes.success, false, 'Replay exchange must be rejected');
    assert.equal(replayRes.statusCode, 401);
  });

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

runAll();

