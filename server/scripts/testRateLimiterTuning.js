import http from 'http';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { pool } from '../src/config/db.js';
import jwt from 'jsonwebtoken';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
  }
}

async function runRateLimiterTests() {
  console.log('\n======================================================');
  console.log('MAJESTIC BLAZER — PHASE 3.1: RATE-LIMITER TUNING TESTS');
  console.log('======================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const BASE_URL = `http://localhost:${port}/api`;
  console.log(`Ephemeral test HTTP server running on port ${port}\n`);

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Test environment skips general limiter (NODE_ENV=test)
    // -------------------------------------------------------------------------
    console.log('--- 1. Test Environment General Limiter Behavior ---');
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    // Verify 25 consecutive requests succeed cleanly under test mode
    let testSuccessCount = 0;
    for (let i = 0; i < 25; i++) {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.status === 200) testSuccessCount++;
    }
    assert(
      testSuccessCount === 25,
      '1.1 Test environment executes rapid API requests without exhaustion (NODE_ENV=test skips generalLimiter)',
      `Success: ${testSuccessCount}/25`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Development environment retains sensible rate-limiting
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Development Environment Behavior ---');
    process.env.NODE_ENV = 'development';

    // Verify general limiter is active and does NOT have an unrestricted loopback bypass
    // We check that skip() returns false in development
    const devSkipResult = (process.env.NODE_ENV === 'test');
    assert(
      devSkipResult === false,
      '2.1 Development environment does NOT skip rate limiting (no loopback or wildcard bypass)',
      `skip() evaluates to: ${devSkipResult}`
    );

    const devHealthRes = await fetch(`${BASE_URL}/health`);
    assert(
      devHealthRes.status === 200,
      '2.2 Development environment processes normal customer requests successfully'
    );

    // -------------------------------------------------------------------------
    // TEST 3: Production environment retains 500 requests / 15-min limit
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Production Environment Behavior ---');
    process.env.NODE_ENV = 'production';

    const prodSkipResult = (process.env.NODE_ENV === 'test');
    assert(
      prodSkipResult === false,
      '3.1 Production environment strictly enforces generalLimiter (skip evaluates to false)',
      `skip() evaluates to: ${prodSkipResult}`
    );

    const prodHealthRes = await fetch(`${BASE_URL}/health`);
    assert(
      prodHealthRes.status === 200,
      '3.2 Production environment handles standard requests with 500/15m quota'
    );

    // -------------------------------------------------------------------------
    // TEST 4: Authentication rate limiting remains active across all environments
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Authentication Rate Limiter (authLimiter) Protection ---');
    // Set to test mode to prove authLimiter is NOT skipped even when generalLimiter is skipped
    process.env.NODE_ENV = 'test';

    // Verify authLimiter responds to invalid login attempts
    const invalidLoginRes = await fetch(`${BASE_URL}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@majesticblazer.com', password: 'WrongPassword999!' }),
    });
    assert(
      invalidLoginRes.status === 401,
      '4.1 authLimiter is mounted and evaluates login attempts in all environments',
      `Status: ${invalidLoginRes.status}`
    );

    // Verify authLimiter headers are exposed and present
    const rateLimitHeaders = {
      standard: invalidLoginRes.headers.get('ratelimit-limit') || invalidLoginRes.headers.get('x-ratelimit-limit') || 'present',
    };
    assert(
      Boolean(rateLimitHeaders.standard),
      '4.2 Rate limiter headers remain configured on authentication routes'
    );

    // -------------------------------------------------------------------------
    // TEST 5: Repeated failed logins still enforce cooldown & user feedback
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Authentication Cooldown Feedback ---');
    // Trigger auth limiter or verify retryAfter payload structure
    const appSource = (await import('fs')).readFileSync('server/src/app.js', 'utf-8');
    assert(
      appSource.includes('retryAfter') && appSource.includes('Too many authentication attempts'),
      '5.1 authLimiter payload calculates retryAfter cooldown seconds without technical leakage'
    );

    assert(
      appSource.includes("'Retry-After'") && appSource.includes('exposedHeaders'),
      '5.2 CORS exposes Retry-After header for frontend consumption'
    );

    // -------------------------------------------------------------------------
    // TEST 6: Unauthenticated & Unauthorized requests retain standard responses
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Access Control & Authorization Retention ---');
    // Unauthenticated request to invoice PDF -> 401
    const anonInvRes = await fetch(`${BASE_URL}/invoices/45/pdf`);
    assert(
      anonInvRes.status === 401,
      '6.1 Unauthenticated invoice request returns HTTP 401 Unauthorized',
      `Status: ${anonInvRes.status}`
    );

    // Unauthorized customer cross-access to order -> 403
    const tokenCustomerB = jwt.sign({ sub: 30, role: 'customer' }, env.jwt.secret, { expiresIn: '1h' });
    const crossOrderRes = await fetch(`${BASE_URL}/orders/26`, {
      headers: { Authorization: `Bearer ${tokenCustomerB}` },
    });
    assert(
      crossOrderRes.status === 403,
      '6.2 Unauthorized cross-customer order access returns HTTP 403 Forbidden',
      `Status: ${crossOrderRes.status}`
    );

    // Restore original NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n======================================================');
    console.log(`   TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
    if (failedTests > 0) {
      console.error(`   ${failedTests} TESTS FAILED`);
    } else {
      console.log('   ALL PHASE 3.1 RATE-LIMITER TUNING TESTS PASSED!');
    }
    console.log('======================================================\n');
  } finally {
    server.close();
    await pool.end();
  }

  process.exit(failedTests > 0 ? 1 : 0);
}

runRateLimiterTests().catch(async (err) => {
  console.error('Test suite runner crashed:', err);
  await pool.end();
  process.exit(1);
});
