/**
 * Comprehensive PostgreSQL Integration Test Suite for Cross-Application Handoff
 *
 * Verifies:
 * 1. PostgreSQL Persistent Storage & Schema Integrity:
 *    - Table created with constraints & indexes.
 *    - Database stores ONLY SHA-256 hashes (never plaintext codes).
 * 2. Atomic Single-Use Consumption:
 *    - Success on first exchange.
 *    - Immediate rejection on reuse.
 * 3. Concurrent Exchanges:
 *    - 10 simultaneous workers race to exchange the same handoff code.
 *    - Row-level locking (SELECT ... FOR UPDATE) ensures EXACTLY ONE succeeds.
 * 4. Backend Restarts:
 *    - Code generated in one process context survives memory reset.
 *    - Fresh process successfully validates and consumes the persisted code.
 * 5. Multiple Backend Instances:
 *    - Two completely independent pool instances (simulating distinct nodes in a cluster).
 *    - Node A creates, Node B consumes.
 *    - Node A & Node B race on the same code -> exactly one succeeds.
 * 6. Audience & Role Isolation:
 *    - Customer account cannot create an admin code.
 *    - TargetApp audience mismatch rejected with 403.
 *    - Expired code rejected with 401.
 * 7. Live HTTP Server Concurrency & Flow:
 *    - End-to-end HTTP request roundtrip against Express app.
 */

import assert from 'assert';
import crypto from 'node:crypto';
import http from 'http';
import pg from '../server/node_modules/pg/lib/index.js';
import { pool } from '../server/src/config/db.js';
import { env } from '../server/src/config/env.js';
import app from '../server/src/app.js';
import {
  initHandoffSchema,
  hashHandoffCode,
  createHandoffCode,
  exchangeHandoffCode,
} from '../server/src/services/handoffService.js';
import { signToken } from '../server/src/utils/token.js';

const { Pool } = pg;

console.log('================================================================================');
console.log('MAJESTIC BLAZER: POSTGRESQL AUTH HANDOFF & CONCURRENCY TEST SUITE');
console.log('================================================================================\n');

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

// --------------------------------------------------------------------------------
// SETUP: Initialize Schema & Fetch Test User Accounts
// --------------------------------------------------------------------------------
await test('0.1 Initialize auth_handoff_codes PostgreSQL schema & load test accounts', async () => {
  await initHandoffSchema(pool);

  const custRes = await pool.query("SELECT id FROM users WHERE role = 'customer' AND is_active = true LIMIT 1");
  if (!custRes.rows.length) throw new Error('No active customer account found in test DB');
  testCustomerId = custRes.rows[0].id;

  const adminRes = await pool.query("SELECT id FROM users WHERE role = 'admin' AND is_active = true LIMIT 1");
  if (!adminRes.rows.length) throw new Error('No active admin account found in test DB');
  testAdminId = adminRes.rows[0].id;

  assert.ok(testCustomerId, 'Customer ID resolved');
  assert.ok(testAdminId, 'Admin ID resolved');
});

// --------------------------------------------------------------------------------
// SECTION 1: PERSISTENCE & SHA-256 HASH STORAGE
// --------------------------------------------------------------------------------
await test('1.1 Stores ONLY SHA-256 hashes in PostgreSQL (plaintext code never persisted)', async () => {
  const handoff = await createHandoffCode({
    userId: testAdminId,
    userRole: 'admin',
    targetApp: 'admin',
    ttlSeconds: 60,
  });

  assert.strictEqual(typeof handoff.code, 'string');
  assert.strictEqual(handoff.code.length, 64, 'Plaintext code must be 256 bits (64 hex characters)');

  const expectedHash = hashHandoffCode(handoff.code);

  // Directly inspect PostgreSQL row
  const { rows } = await pool.query(
    'SELECT id, code_hash, user_id, user_role, target_app, consumed_at FROM auth_handoff_codes WHERE code_hash = $1',
    [expectedHash]
  );

  assert.strictEqual(rows.length, 1, 'Exactly one row must exist in PostgreSQL');
  assert.strictEqual(rows[0].code_hash, expectedHash, 'Database must store exact SHA-256 hash');
  assert.strictEqual(rows[0].user_id, testAdminId);
  assert.strictEqual(rows[0].user_role, 'admin');
  assert.strictEqual(rows[0].target_app, 'admin');
  assert.strictEqual(rows[0].consumed_at, null, 'Must be unconsumed on creation');

  // Verify that querying by the plaintext code yields zero rows (proves plaintext is not stored)
  const plainCheck = await pool.query(
    'SELECT id FROM auth_handoff_codes WHERE code_hash = $1',
    [handoff.code]
  );
  assert.strictEqual(plainCheck.rows.length, 0, 'Plaintext code must NEVER match code_hash column');
});

// --------------------------------------------------------------------------------
// SECTION 2: ATOMIC SINGLE-USE CONSUMPTION
// --------------------------------------------------------------------------------
await test('2.1 Successfully consumes code on first exchange and records consumed_at timestamp', async () => {
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

  // Verify PostgreSQL row is now stamped as consumed
  const expectedHash = hashHandoffCode(handoff.code);
  const { rows } = await pool.query(
    'SELECT consumed_at FROM auth_handoff_codes WHERE code_hash = $1',
    [expectedHash]
  );
  assert.ok(rows[0].consumed_at !== null, 'consumed_at must be populated in database');

  // Second exchange attempt must be rejected immediately
  const reuse = await exchangeHandoffCode({
    code: handoff.code,
    targetApp: 'admin',
  });
  assert.strictEqual(reuse.success, false);
  assert.strictEqual(reuse.statusCode, 401);
  assert.ok(reuse.error.includes('already been used'));
});

// --------------------------------------------------------------------------------
// SECTION 3: CONCURRENT EXCHANGES (RACE CONDITIONS & ROW-LEVEL LOCKING)
// --------------------------------------------------------------------------------
await test('3.1 Ten concurrent exchange attempts race for the same code: EXACTLY ONE succeeds', async () => {
  const handoff = await createHandoffCode({
    userId: testCustomerId,
    userRole: 'customer',
    targetApp: 'customer',
    ttlSeconds: 60,
  });

  // Launch 10 simultaneous asynchronous exchange requests
  const concurrencyLevel = 10;
  const promises = [];

  for (let i = 0; i < concurrencyLevel; i++) {
    promises.push(exchangeHandoffCode({
      code: handoff.code,
      targetApp: 'customer',
    }));
  }

  const results = await Promise.all(promises);

  const successful = results.filter((r) => r.success === true);
  const rejected = results.filter((r) => r.success === false);

  assert.strictEqual(successful.length, 1, `Exactly 1 exchange must succeed (got ${successful.length})`);
  assert.strictEqual(rejected.length, 9, `Exactly 9 exchanges must fail (got ${rejected.length})`);

  for (const failure of rejected) {
    assert.strictEqual(failure.statusCode, 401);
    assert.ok(failure.error.includes('already been used'));
  }

  // Verify database record has exactly one consumed_at timestamp
  const codeHash = hashHandoffCode(handoff.code);
  const { rows } = await pool.query(
    'SELECT consumed_at FROM auth_handoff_codes WHERE code_hash = $1',
    [codeHash]
  );
  assert.strictEqual(rows.length, 1);
  assert.ok(rows[0].consumed_at !== null);
});

// --------------------------------------------------------------------------------
// SECTION 4: BACKEND RESTARTS SIMULATION
// --------------------------------------------------------------------------------
await test('4.1 Backend restart simulation: code persists in PostgreSQL and is exchanged by new process', async () => {
  // Step 1: Process 1 generates handoff code and stores it in PostgreSQL
  const handoff = await createHandoffCode({
    userId: testAdminId,
    userRole: 'admin',
    targetApp: 'admin',
    ttlSeconds: 60,
  });

  // Step 2: Simulate process termination & restart by creating a completely fresh pool
  const restartedPool = new Pool({
    connectionString: env.db.connectionString || undefined,
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    ssl: env.db.ssl,
    max: 2,
  });

  try {
    // Step 3: Fresh process receives client request and exchanges code
    const exchange = await exchangeHandoffCode({
      code: handoff.code,
      targetApp: 'admin',
      poolInstance: restartedPool,
    });

    assert.strictEqual(exchange.success, true, 'Restarted process must exchange persisted code');
    assert.strictEqual(exchange.data.userId, testAdminId);

    // Step 4: Ensure second attempt on restarted process fails
    const secondAttempt = await exchangeHandoffCode({
      code: handoff.code,
      targetApp: 'admin',
      poolInstance: restartedPool,
    });

    assert.strictEqual(secondAttempt.success, false);
    assert.strictEqual(secondAttempt.statusCode, 401);
  } finally {
    await restartedPool.end();
  }
});

// --------------------------------------------------------------------------------
// SECTION 5: MULTIPLE BACKEND INSTANCES (CLUSTER / LOAD BALANCER SIMULATION)
// --------------------------------------------------------------------------------
await test('5.1 Multiple instances: Instance A creates code, Instance B consumes code seamlessly', async () => {
  // Simulate Node A (Server 1)
  const instanceA = new Pool({
    connectionString: env.db.connectionString || undefined,
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    ssl: env.db.ssl,
    max: 2,
  });

  // Simulate Node B (Server 2)
  const instanceB = new Pool({
    connectionString: env.db.connectionString || undefined,
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    ssl: env.db.ssl,
    max: 2,
  });

  try {
    // Server A creates code
    const handoff = await createHandoffCode({
      userId: testCustomerId,
      userRole: 'customer',
      targetApp: 'customer',
      clientOrPool: instanceA,
    });

    // Client is routed by load balancer to Server B
    const exchangeResult = await exchangeHandoffCode({
      code: handoff.code,
      targetApp: 'customer',
      poolInstance: instanceB,
    });

    assert.strictEqual(exchangeResult.success, true);
    assert.strictEqual(exchangeResult.data.userId, testCustomerId);

    // Concurrent race between Instance A and Instance B on another code
    const raceHandoff = await createHandoffCode({
      userId: testAdminId,
      userRole: 'admin',
      targetApp: 'admin',
      clientOrPool: instanceA,
    });

    const [raceResA, raceResB] = await Promise.all([
      exchangeHandoffCode({ code: raceHandoff.code, targetApp: 'admin', poolInstance: instanceA }),
      exchangeHandoffCode({ code: raceHandoff.code, targetApp: 'admin', poolInstance: instanceB }),
    ]);

    const successes = [raceResA, raceResB].filter((r) => r.success === true);
    const failures = [raceResA, raceResB].filter((r) => r.success === false);

    assert.strictEqual(successes.length, 1, 'Exactly one cluster node must win the race');
    assert.strictEqual(failures.length, 1, 'Losing cluster node must receive rejection');
    assert.strictEqual(failures[0].statusCode, 401);
  } finally {
    await instanceA.end();
    await instanceB.end();
  }
});

// --------------------------------------------------------------------------------
// SECTION 6: ROLE ISOLATION & AUDIENCE MISMATCH ENFORCEMENT
// --------------------------------------------------------------------------------
await test('6.1 Role escalation prevention: customer cannot generate admin handoff code', async () => {
  await assert.rejects(
    async () => {
      await createHandoffCode({
        userId: testCustomerId,
        userRole: 'customer',
        targetApp: 'admin',
      });
    },
    (err) => err.statusCode === 403 || err.message.includes('Customer accounts cannot')
  );
});

await test('6.2 Audience mismatch: code issued for customer cannot be exchanged at admin app', async () => {
  const handoff = await createHandoffCode({
    userId: testCustomerId,
    userRole: 'customer',
    targetApp: 'customer',
  });

  const exchange = await exchangeHandoffCode({
    code: handoff.code,
    targetApp: 'admin',
  });

  assert.strictEqual(exchange.success, false);
  assert.strictEqual(exchange.statusCode, 403);
  assert.ok(exchange.error.includes('audience mismatch'));
});

await test('6.3 Expiration enforcement: expired code is rejected', async () => {
  const handoff = await createHandoffCode({
    userId: testAdminId,
    userRole: 'admin',
    targetApp: 'admin',
    ttlSeconds: -1, // Expired immediately
  });

  const exchange = await exchangeHandoffCode({
    code: handoff.code,
    targetApp: 'admin',
  });

  assert.strictEqual(exchange.success, false);
  assert.strictEqual(exchange.statusCode, 401);
  assert.ok(exchange.error.includes('expired'));
});

// --------------------------------------------------------------------------------
// SECTION 7: LIVE HTTP INTEGRATION TESTS & CONCURRENT HTTP EXCHANGE
// --------------------------------------------------------------------------------
let testHttpServer;
let httpBaseUrl;

await test('7.1 Start HTTP server and test concurrent HTTP exchange requests', async () => {
  await new Promise((resolve) => {
    testHttpServer = http.createServer(app);
    testHttpServer.listen(0, () => {
      const port = testHttpServer.address().port;
      httpBaseUrl = `http://localhost:${port}/api`;
      resolve();
    });
  });

  const adminToken = signToken({ id: testAdminId, role: 'admin' });

  // 1. Create code via HTTP
  const createRes = await fetch(`${httpBaseUrl}/auth/handoff/create`, {
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
  assert.ok(code);

  // 2. Launch 6 concurrent HTTP exchange requests
  const httpConcurrency = 6;
  const httpPromises = [];

  for (let i = 0; i < httpConcurrency; i++) {
    httpPromises.push(
      fetch(`${httpBaseUrl}/auth/handoff/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, targetApp: 'admin' }),
      })
    );
  }

  const httpResponses = await Promise.all(httpPromises);
  const statuses = httpResponses.map((r) => r.status);

  const status200 = statuses.filter((s) => s === 200);
  const status401 = statuses.filter((s) => s === 401);

  assert.strictEqual(status200.length, 1, `Exactly one HTTP request must succeed with 200 (got ${status200.length})`);
  assert.strictEqual(status401.length, httpConcurrency - 1, `All other HTTP requests must return 401 (got ${status401.length})`);

  // Close HTTP server and database pool
  await new Promise((resolve) => testHttpServer.close(resolve));
  await pool.end();
});

console.log('\n--------------------------------------------------------------------------------');
console.log(`TEST SUMMARY: ${passedTests}/${totalTests} tests passed.`);
console.log('--------------------------------------------------------------------------------');

if (passedTests === totalTests) {
  console.log('ALL POSTGRESQL AUTH HANDOFF & CONCURRENCY TESTS PASSED SUCCESSFULLY!\n');
} else {
  process.exit(1);
}
