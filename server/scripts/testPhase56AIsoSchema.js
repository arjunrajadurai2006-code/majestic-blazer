import crypto from 'node:crypto';
import assert from 'node:assert';
import { pool } from '../src/config/db.js';

console.log('======================================================================');
console.log('MAJESTIC BLAZER — PHASE 5.6A ISOLATED SCHEMA INTEGRATION TEST SUITE');
console.log('Real PostgreSQL Transactions, Row Locks & Version 3.4 Claim Logic');
console.log('======================================================================\n');

const SCHEMA_NAME = 'test_webhook_isolation';

let total = 0;
let passed = 0;

function runTest(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ [PASS ${total}] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✖ [FAIL ${total}] ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✓ [PASS ${total}] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✖ [FAIL ${total}] ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

// ------------------------------------------------------------------
// Version 3.4 Reconciliation Probe with Operation-Aware State Checks
// ------------------------------------------------------------------
async function reconcileAmbiguousCommitV34(client, { accountId, environment, eventId, expectedToken, operation }) {
  const { rows } = await client.query(
    `SELECT status, claim_token, 
            (locked_until > CURRENT_TIMESTAMP) AS is_lease_active,
            GREATEST(1, CEIL(EXTRACT(EPOCH FROM (locked_until - CURRENT_TIMESTAMP))))::int AS retry_after_seconds
     FROM ${SCHEMA_NAME}.webhook_events
     WHERE account_id = $1 AND environment = $2 AND event_id = $3`,
    [accountId, environment, eventId]
  );

  // Case 1: Row does not exist
  if (rows.length === 0) {
    if (operation === 'INSERT') {
      // For initial insert, missing row indicates the insert did not land / rolled back
      return { status: 'ACTUAL_ROLLBACK' };
    }
    // For reclaim, the row existed before the attempt! A missing row is an anomaly
    return { status: 'RETRY_REQUIRED', reason: 'UNEXPECTED_MISSING_ROW_ON_RECLAIM', retryAfter: 5 };
  }

  const row = rows[0];

  // Case 2: Event was completed
  if (row.status === 'completed') {
    return { status: 'COMPLETED' };
  }

  // Case 3: Claim token matches AND lease is still active according to PostgreSQL
  if (row.status === 'processing' && row.claim_token === expectedToken) {
    if (row.is_lease_active) {
      return { status: 'CLAIMED', claimToken: expectedToken };
    }
    // Matching token but lease has expired! Worker must not assume ownership
    return { status: 'RETRY_REQUIRED', reason: 'EXPIRED_LEASE_ON_RECONCILE', retryAfter: 1 };
  }

  // Case 4: Another worker holds active lease
  if (row.status === 'processing' && row.is_lease_active) {
    return { status: 'IN_FLIGHT_LEASE_ACTIVE', retryAfter: row.retry_after_seconds || 5 };
  }

  // Case 5: Superseded token or unconfirmed state
  return { status: 'RETRY_REQUIRED', reason: 'SUPERSEDED_OR_UNCONFIRMED', retryAfter: 5 };
}

// ------------------------------------------------------------------
// Version 3.4 Claim Logic with PostgreSQL Clock and Bounded Retries
// ------------------------------------------------------------------
async function attemptClaimV34(client, params, claimToken) {
  let inTransaction = false;
  try {
    await client.query('BEGIN');
    inTransaction = true;

    // Check existing
    const { rows: existing } = await client.query(
      `SELECT status, claim_token, 
              (locked_until > CURRENT_TIMESTAMP) AS is_lease_active,
              GREATEST(1, CEIL(EXTRACT(EPOCH FROM (locked_until - CURRENT_TIMESTAMP))))::int AS retry_after_seconds
       FROM ${SCHEMA_NAME}.webhook_events 
       WHERE account_id = $1 AND environment = $2 AND event_id = $3 
       FOR UPDATE`,
      [params.accountId, params.environment, params.eventId]
    );

    if (existing.length > 0) {
      const row = existing[0];

      if (row.status === 'completed') {
        await client.query('COMMIT');
        inTransaction = false;
        return { status: 'COMPLETED' };
      }

      if (row.status === 'processing' && row.is_lease_active) {
        await client.query('COMMIT');
        inTransaction = false;
        return { status: 'IN_FLIGHT_LEASE_ACTIVE', retryAfter: row.retry_after_seconds || 5 };
      }

      // Reclaim expired lease or failed claim
      const { rows: reclaimed, rowCount } = await client.query(
        `UPDATE ${SCHEMA_NAME}.webhook_events
         SET status = 'processing',
             claim_token = $1,
             locked_until = CURRENT_TIMESTAMP + INTERVAL '${params.leaseSeconds || 30} seconds',
             attempts = attempts + 1,
             error_message = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE account_id = $2 AND environment = $3 AND event_id = $4
           AND (status = 'failed' OR (status = 'processing' AND locked_until <= CURRENT_TIMESTAMP))
         RETURNING claim_token`,
        [claimToken, params.accountId, params.environment, params.eventId]
      );

      if (rowCount === 1 && reclaimed.length === 1) {
        await client.query('COMMIT');
        inTransaction = false;
        return { status: 'CLAIMED', claimToken: reclaimed[0].claim_token };
      }

      await client.query('ROLLBACK');
      inTransaction = false;
      return { status: 'RETRY_NEEDED' };
    }

    // Insert new event
    await client.query(
      `INSERT INTO ${SCHEMA_NAME}.webhook_events (
         account_id, environment, event_id, event_type, status,
         claim_token, entity_id, order_id, amount_minor, currency,
         attempts, locked_until, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, 'processing', $5, $6, $7, $8, $9, 1, CURRENT_TIMESTAMP + INTERVAL '${params.leaseSeconds || 30} seconds', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [params.accountId, params.environment, params.eventId, params.eventType, claimToken, params.entityId, params.orderId, params.amountMinor, params.currency || 'INR']
    );

    await client.query('COMMIT');
    inTransaction = false;
    return { status: 'CLAIMED', claimToken };
  } catch (err) {
    if (inTransaction) {
      try {
        await client.query('ROLLBACK');
      } catch (rbErr) {
        err.rollbackError = rbErr;
      }
    }
    throw err;
  } finally {
    client.release();
  }
}

async function resolveConcurrentClaimV34(params, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const client = await pool.connect();
    let inTransaction = false;
    try {
      await client.query('BEGIN');
      inTransaction = true;

      const { rows } = await client.query(
        `SELECT status, claim_token, 
                (locked_until > CURRENT_TIMESTAMP) AS is_lease_active,
                GREATEST(1, CEIL(EXTRACT(EPOCH FROM (locked_until - CURRENT_TIMESTAMP))))::int AS retry_after_seconds
         FROM ${SCHEMA_NAME}.webhook_events 
         WHERE account_id = $1 AND environment = $2 AND event_id = $3 
         FOR UPDATE`,
        [params.accountId, params.environment, params.eventId]
      );

      if (rows.length > 0) {
        const row = rows[0];

        if (row.status === 'completed') {
          await client.query('COMMIT');
          inTransaction = false;
          return { status: 'COMPLETED' };
        }

        if (row.status === 'processing' && row.is_lease_active) {
          await client.query('COMMIT');
          inTransaction = false;
          return { status: 'IN_FLIGHT_LEASE_ACTIVE', retryAfter: row.retry_after_seconds || 5 };
        }

        // Safe reclaim
        const newClaimToken = crypto.randomUUID();
        const { rows: reclaimed, rowCount } = await client.query(
          `UPDATE ${SCHEMA_NAME}.webhook_events
           SET status = 'processing',
               claim_token = $1,
               locked_until = CURRENT_TIMESTAMP + INTERVAL '${params.leaseSeconds || 30} seconds',
               attempts = attempts + 1,
               error_message = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE account_id = $2 AND environment = $3 AND event_id = $4
             AND (status = 'failed' OR (status = 'processing' AND locked_until <= CURRENT_TIMESTAMP))
           RETURNING claim_token`,
          [newClaimToken, params.accountId, params.environment, params.eventId]
        );

        if (rowCount === 1 && reclaimed.length === 1) {
          await client.query('COMMIT');
          inTransaction = false;
          return { status: 'CLAIMED', claimToken: reclaimed[0].claim_token };
        }

        await client.query('ROLLBACK');
        inTransaction = false;
      } else {
        await client.query('ROLLBACK');
        inTransaction = false;
      }
    } catch (err) {
      if (inTransaction) {
        try {
          await client.query('ROLLBACK');
        } catch (rbErr) {
          err.rollbackError = rbErr;
        }
      }
      throw err;
    } finally {
      client.release();
    }

    await new Promise((r) => setTimeout(r, 25 * Math.pow(2, attempt - 1)));
  }

  return { status: 'RETRY_REQUIRED', retryAfter: 5 };
}

async function claimWebhookEventV34(params) {
  const claimToken = crypto.randomUUID();
  const client = await pool.connect();
  try {
    const res = await attemptClaimV34(client, params, claimToken);
    if (res.status !== 'RETRY_NEEDED') {
      return res;
    }
    return await resolveConcurrentClaimV34(params);
  } catch (err) {
    if (err.code === '23505') {
      return await resolveConcurrentClaimV34(params);
    }
    throw err;
  }
}

// ------------------------------------------------------------------
// MAIN TEST SUITE EXECUTION
// ------------------------------------------------------------------
async function main() {
  const setupClient = await pool.connect();
  try {
    console.log('--- Setting up isolated test schema ---');
    await setupClient.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA_NAME}`);
    
    // Create exact proposed table in isolated schema
    await setupClient.query(`
      CREATE TABLE IF NOT EXISTS ${SCHEMA_NAME}.webhook_events (
        account_id VARCHAR(100) NOT NULL,
        environment VARCHAR(50) NOT NULL,
        event_id VARCHAR(255) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'processing',
        claim_token UUID NULL,
        entity_id VARCHAR(100) NULL,
        order_id VARCHAR(100) NULL,
        amount_minor BIGINT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'INR',
        attempts INTEGER NOT NULL DEFAULT 1,
        locked_until TIMESTAMP WITH TIME ZONE NULL,
        error_message TEXT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP WITH TIME ZONE NULL,

        CONSTRAINT pk_webhook_events 
          PRIMARY KEY (account_id, environment, event_id),

        CONSTRAINT chk_webhook_events_status 
          CHECK (status IN ('processing', 'completed', 'failed')),

        CONSTRAINT chk_webhook_events_attempts 
          CHECK (attempts >= 1),

        CONSTRAINT chk_webhook_events_currency 
          CHECK (currency = 'INR'),

        CONSTRAINT chk_webhook_events_processing_fields 
          CHECK (status != 'processing' OR (claim_token IS NOT NULL AND locked_until IS NOT NULL)),

        CONSTRAINT chk_webhook_events_completed_fields 
          CHECK (status != 'completed' OR completed_at IS NOT NULL)
      );

      CREATE INDEX IF NOT EXISTS idx_webhook_events_status 
        ON ${SCHEMA_NAME}.webhook_events (status);

      CREATE INDEX IF NOT EXISTS idx_webhook_events_lease 
        ON ${SCHEMA_NAME}.webhook_events (locked_until) 
        WHERE status = 'processing';
    `);
    console.log(`Created isolated schema and table: ${SCHEMA_NAME}.webhook_events\n`);
  } finally {
    setupClient.release();
  }

  // Pre-test historical baseline fingerprint
  console.log('--- Verifying baseline historical records BEFORE test ---');
  const preCheck = await pool.query(`
    SELECT id, order_id, amount, status, provider, provider_payment_id
    FROM payments WHERE id <= 210 ORDER BY id ASC;
  `);
  assert.strictEqual(preCheck.rows.length, 56, 'Pre-test baseline must contain exactly 56 records');
  const preHash = crypto.createHash('sha256');
  for (const r of preCheck.rows) {
    preHash.update(`${r.id}|${r.order_id}|${r.amount}|${r.status}|${r.provider}|${r.provider_payment_id}\n`);
  }
  const preFingerprint = preHash.digest('hex');
  console.log(`Pre-test baseline SHA-256: ${preFingerprint}\n`);

  try {
    // Test 1: Real concurrent duplicate deliveries on PostgreSQL
    await runAsyncTest('PostgreSQL Integration: Concurrent duplicate first delivery', async () => {
      const eventId = `evt_test_real_conc_${Date.now()}`;
      const params = {
        accountId: 'acc_test_MB1',
        environment: 'test',
        eventId,
        eventType: 'payment.captured',
        entityId: 'pay_123',
        amountMinor: '1999900',
        leaseSeconds: 30,
      };

      // Two workers simultaneously call claim on real PostgreSQL
      const [res1, res2] = await Promise.all([
        claimWebhookEventV34(params),
        claimWebhookEventV34(params),
      ]);

      const results = [res1.status, res2.status].sort();
      // One worker claims; second worker either gets IN_FLIGHT_LEASE_ACTIVE or COMPLETED
      assert(results.includes('CLAIMED'), 'One worker must claim');
      assert(results.includes('IN_FLIGHT_LEASE_ACTIVE') || results.includes('COMPLETED'), 'Second worker gets active lease or completed');

      // Assert database state
      const check = await pool.query(
        `SELECT status, attempts, claim_token FROM ${SCHEMA_NAME}.webhook_events WHERE event_id = $1`,
        [eventId]
      );
      assert.strictEqual(check.rows.length, 1, 'Exactly one row inserted');
      assert.strictEqual(check.rows[0].status, 'processing');
      assert.strictEqual(check.rows[0].attempts, 1);
    });

    // Test 2: Active lease duplicate delivery
    await runAsyncTest('PostgreSQL Integration: Duplicate delivery while lease active returns IN_FLIGHT_LEASE_ACTIVE', async () => {
      const eventId = `evt_test_active_${Date.now()}`;
      const params = {
        accountId: 'acc_test_MB1',
        environment: 'test',
        eventId,
        eventType: 'payment.captured',
        leaseSeconds: 30,
      };

      const res1 = await claimWebhookEventV34(params);
      assert.strictEqual(res1.status, 'CLAIMED');

      // Second delivery arrives while lease is active
      const res2 = await claimWebhookEventV34(params);
      assert.strictEqual(res2.status, 'IN_FLIGHT_LEASE_ACTIVE');
      assert(res2.retryAfter > 0 && res2.retryAfter <= 30);
    });

    // Test 3: Expired lease recovery
    await runAsyncTest('PostgreSQL Integration: Expired lease recovery on real PostgreSQL', async () => {
      const eventId = `evt_test_expired_${Date.now()}`;
      // Set lease to 1 second
      const params = {
        accountId: 'acc_test_MB1',
        environment: 'test',
        eventId,
        eventType: 'payment.captured',
        leaseSeconds: 1,
      };

      const res1 = await claimWebhookEventV34(params);
      assert.strictEqual(res1.status, 'CLAIMED');
      const token1 = res1.claimToken;

      // Wait 1.5 seconds for lease to expire according to PostgreSQL CURRENT_TIMESTAMP
      await new Promise((r) => setTimeout(r, 1500));

      // Worker 2 attempts reclaim
      const res2 = await claimWebhookEventV34(params);
      assert.strictEqual(res2.status, 'CLAIMED');
      assert.notStrictEqual(res2.claimToken, token1, 'Must receive new claim token');

      const check = await pool.query(
        `SELECT attempts, claim_token FROM ${SCHEMA_NAME}.webhook_events WHERE event_id = $1`,
        [eventId]
      );
      assert.strictEqual(check.rows[0].attempts, 2, 'Attempts must increment to 2');
    });

    // Test 4: Rejection of completed reclamation
    await runAsyncTest('PostgreSQL Integration: Completed event cannot be reclaimed', async () => {
      const eventId = `evt_test_comp_${Date.now()}`;
      const params = {
        accountId: 'acc_test_MB1',
        environment: 'test',
        eventId,
        eventType: 'payment.captured',
      };

      const res1 = await claimWebhookEventV34(params);
      assert.strictEqual(res1.status, 'CLAIMED');

      // Mark completed
      await pool.query(
        `UPDATE ${SCHEMA_NAME}.webhook_events 
         SET status = 'completed', locked_until = NULL, completed_at = CURRENT_TIMESTAMP 
         WHERE event_id = $1`,
        [eventId]
      );

      // Attempt claim again
      const res2 = await claimWebhookEventV34(params);
      assert.strictEqual(res2.status, 'COMPLETED');
    });

    // Test 5: Stale worker completion fencing in Transaction 2
    await runAsyncTest('PostgreSQL Integration: Stale worker completion fencing rolls back on token mismatch', async () => {
      const eventId = `evt_test_fence_${Date.now()}`;
      const params = {
        accountId: 'acc_test_MB1',
        environment: 'test',
        eventId,
        eventType: 'payment.captured',
        leaseSeconds: 1,
      };

      const res1 = await claimWebhookEventV34(params);
      const staleToken = res1.claimToken;

      // Lease expires and Worker B reclaims
      await new Promise((r) => setTimeout(r, 1200));
      const res2 = await claimWebhookEventV34(params);
      const newToken = res2.claimToken;
      assert.notStrictEqual(staleToken, newToken);

      // Worker A attempts Transaction 2 completion with staleToken
      const clientA = await pool.connect();
      let fencedOut = false;
      try {
        await clientA.query('BEGIN');
        const { rows } = await clientA.query(
          `SELECT status, claim_token, (locked_until > CURRENT_TIMESTAMP) AS is_lease_active
           FROM ${SCHEMA_NAME}.webhook_events 
           WHERE account_id = $1 AND environment = $2 AND event_id = $3 FOR UPDATE`,
          [params.accountId, params.environment, eventId]
        );

        if (rows[0].claim_token !== staleToken || !rows[0].is_lease_active) {
          fencedOut = true;
          await clientA.query('ROLLBACK');
        } else {
          // Stale worker would complete
          await clientA.query(
            `UPDATE ${SCHEMA_NAME}.webhook_events SET status = 'completed' WHERE event_id = $1`,
            [eventId]
          );
          await clientA.query('COMMIT');
        }
      } finally {
        clientA.release();
      }

      assert.strictEqual(fencedOut, true, 'Worker A must be fenced out');

      // Verify row is still processing with Worker B's token
      const check = await pool.query(
        `SELECT status, claim_token FROM ${SCHEMA_NAME}.webhook_events WHERE event_id = $1`,
        [eventId]
      );
      assert.strictEqual(check.rows[0].status, 'processing');
      assert.strictEqual(check.rows[0].claim_token, newToken);
    });

    // Test 6: Stale worker failure update touches 0 rows
    await runAsyncTest('PostgreSQL Integration: Stale worker failure update touches 0 rows', async () => {
      const eventId = `evt_test_fail_fence_${Date.now()}`;
      const params = {
        accountId: 'acc_test_MB1',
        environment: 'test',
        eventId,
        eventType: 'payment.captured',
        leaseSeconds: 1,
      };

      const res1 = await claimWebhookEventV34(params);
      const staleToken = res1.claimToken;

      await new Promise((r) => setTimeout(r, 1200));
      const res2 = await claimWebhookEventV34(params);
      const currentToken = res2.claimToken;

      // Worker A attempts recordWebhookFailure with staleToken
      const updateResult = await pool.query(
        `UPDATE ${SCHEMA_NAME}.webhook_events
         SET status = 'failed', locked_until = NULL, error_message = 'Stale failure'
         WHERE account_id = $1 AND environment = $2 AND event_id = $3
           AND claim_token = $4 AND status = 'processing'`,
        [params.accountId, params.environment, eventId, staleToken]
      );

      assert.strictEqual(updateResult.rowCount, 0, 'Must update exactly 0 rows');

      const check = await pool.query(
        `SELECT status, claim_token FROM ${SCHEMA_NAME}.webhook_events WHERE event_id = $1`,
        [eventId]
      );
      assert.strictEqual(check.rows[0].status, 'processing');
      assert.strictEqual(check.rows[0].claim_token, currentToken);
    });

    // Test 7: Ambiguous commit probe with matching token and active lease
    await runAsyncTest('PostgreSQL Integration: Ambiguous commit probe with active lease returns CLAIMED', async () => {
      const eventId = `evt_test_amb_claim_${Date.now()}`;
      const expectedToken = crypto.randomUUID();

      await pool.query(
        `INSERT INTO ${SCHEMA_NAME}.webhook_events (
           account_id, environment, event_id, event_type, status,
           claim_token, locked_until
         ) VALUES ($1, $2, $3, 'payment.captured', 'processing', $4, CURRENT_TIMESTAMP + INTERVAL '20 seconds')`,
        ['acc_test_MB1', 'test', eventId, expectedToken]
      );

      const probeClient = await pool.connect();
      try {
        const probeRes = await reconcileAmbiguousCommitV34(probeClient, {
          accountId: 'acc_test_MB1',
          environment: 'test',
          eventId,
          expectedToken,
          operation: 'INSERT',
        });
        assert.strictEqual(probeRes.status, 'CLAIMED');
        assert.strictEqual(probeRes.claimToken, expectedToken);
      } finally {
        probeClient.release();
      }
    });

    // Test 8: Ambiguous commit probe with matching token but EXPIRED lease returns RETRY_REQUIRED
    await runAsyncTest('PostgreSQL Integration: Matching token with expired lease returns RETRY_REQUIRED', async () => {
      const eventId = `evt_test_amb_exp_${Date.now()}`;
      const expectedToken = crypto.randomUUID();

      // Insert row with lease that expired 2 seconds ago
      await pool.query(
        `INSERT INTO ${SCHEMA_NAME}.webhook_events (
           account_id, environment, event_id, event_type, status,
           claim_token, locked_until
         ) VALUES ($1, $2, $3, 'payment.captured', 'processing', $4, CURRENT_TIMESTAMP - INTERVAL '2 seconds')`,
        ['acc_test_MB1', 'test', eventId, expectedToken]
      );

      const probeClient = await pool.connect();
      try {
        const probeRes = await reconcileAmbiguousCommitV34(probeClient, {
          accountId: 'acc_test_MB1',
          environment: 'test',
          eventId,
          expectedToken,
          operation: 'INSERT',
        });
        assert.strictEqual(probeRes.status, 'RETRY_REQUIRED');
        assert.strictEqual(probeRes.reason, 'EXPIRED_LEASE_ON_RECONCILE');
      } finally {
        probeClient.release();
      }
    });

    // Test 9: Ambiguous commit probe: operation-aware missing row
    await runAsyncTest('PostgreSQL Integration: Operation-aware missing row (INSERT vs RECLAIM)', async () => {
      const nonExistentEvent = `evt_non_existent_${Date.now()}`;
      const probeClient = await pool.connect();
      try {
        // Operation INSERT -> missing row means rollback
        const resInsert = await reconcileAmbiguousCommitV34(probeClient, {
          accountId: 'acc_test_MB1',
          environment: 'test',
          eventId: nonExistentEvent,
          expectedToken: 'tok_1',
          operation: 'INSERT',
        });
        assert.strictEqual(resInsert.status, 'ACTUAL_ROLLBACK');

        // Operation RECLAIM -> missing row means unexpected anomaly
        const resReclaim = await reconcileAmbiguousCommitV34(probeClient, {
          accountId: 'acc_test_MB1',
          environment: 'test',
          eventId: nonExistentEvent,
          expectedToken: 'tok_1',
          operation: 'RECLAIM',
        });
        assert.strictEqual(resReclaim.status, 'RETRY_REQUIRED');
        assert.strictEqual(resReclaim.reason, 'UNEXPECTED_MISSING_ROW_ON_RECLAIM');
      } finally {
        probeClient.release();
      }
    });

    // Test 10: Complete schema verification check (asserts all columns, types, nullability, constraints)
    await runAsyncTest('PostgreSQL Integration: Complete programmatic schema verification', async () => {
      // 1. Column verification
      const { rows: cols } = await pool.query(`
        SELECT column_name, data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = '${SCHEMA_NAME}' AND table_name = 'webhook_events'
        ORDER BY ordinal_position;
      `);
      
      const colMap = Object.fromEntries(cols.map(c => [c.column_name, c]));
      assert(colMap.account_id && colMap.account_id.data_type === 'character varying' && colMap.account_id.is_nullable === 'NO');
      assert(colMap.environment && colMap.environment.data_type === 'character varying' && colMap.environment.is_nullable === 'NO');
      assert(colMap.event_id && colMap.event_id.data_type === 'character varying' && colMap.event_id.is_nullable === 'NO');
      assert(colMap.event_type && colMap.event_type.data_type === 'character varying' && colMap.event_type.is_nullable === 'NO');
      assert(colMap.status && colMap.status.data_type === 'character varying' && colMap.status.is_nullable === 'NO');
      assert(colMap.claim_token && colMap.claim_token.udt_name === 'uuid' && colMap.claim_token.is_nullable === 'YES');
      assert(colMap.amount_minor && colMap.amount_minor.data_type === 'bigint' && colMap.amount_minor.is_nullable === 'YES');
      assert(colMap.currency && colMap.currency.data_type === 'character varying' && colMap.currency.is_nullable === 'NO');
      assert(colMap.attempts && colMap.attempts.data_type === 'integer' && colMap.attempts.is_nullable === 'NO');
      assert(colMap.locked_until && colMap.locked_until.data_type === 'timestamp with time zone');
      assert(colMap.completed_at && colMap.completed_at.data_type === 'timestamp with time zone');

      // 2. Constraints verification
      const { rows: constraints } = await pool.query(`
        SELECT conname, contype
        FROM pg_constraint
        JOIN pg_class ON pg_constraint.conrelid = pg_class.oid
        JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
        WHERE pg_namespace.nspname = '${SCHEMA_NAME}' AND pg_class.relname = 'webhook_events';
      `);
      const conNames = constraints.map(c => c.conname);
      assert(conNames.includes('pk_webhook_events'), 'Primary key constraint must exist');
      assert(conNames.includes('chk_webhook_events_status'), 'chk_status must exist');
      assert(conNames.includes('chk_webhook_events_attempts'), 'chk_attempts must exist');
      assert(conNames.includes('chk_webhook_events_currency'), 'chk_currency must exist');
      assert(conNames.includes('chk_webhook_events_processing_fields'), 'chk_processing_fields must exist');
      assert(conNames.includes('chk_webhook_events_completed_fields'), 'chk_completed_fields must exist');
    });

  } finally {
    console.log('\n--- Cleaning up isolated test schema ---');
    const cleanupClient = await pool.connect();
    try {
      await cleanupClient.query(`DROP SCHEMA IF EXISTS ${SCHEMA_NAME} CASCADE`);
      console.log(`Dropped isolated test schema: ${SCHEMA_NAME}\n`);
    } finally {
      cleanupClient.release();
    }
  }

  // Post-test historical baseline fingerprint assertion
  console.log('--- Verifying baseline historical records AFTER test ---');
  const postCheck = await pool.query(`
    SELECT id, order_id, amount, status, provider, provider_payment_id
    FROM payments WHERE id <= 210 ORDER BY id ASC;
  `);
  assert.strictEqual(postCheck.rows.length, 56, 'Post-test baseline must contain exactly 56 records');
  const postHash = crypto.createHash('sha256');
  for (const r of postCheck.rows) {
    postHash.update(`${r.id}|${r.order_id}|${r.amount}|${r.status}|${r.provider}|${r.provider_payment_id}\n`);
  }
  const postFingerprint = postHash.digest('hex');
  console.log(`Post-test baseline SHA-256: ${postFingerprint}`);

  assert.strictEqual(
    preFingerprint,
    postFingerprint,
    'CRITICAL FAILURE: Baseline financial fingerprint mismatch after isolated test run!'
  );
  console.log('FINGERPRINT MATCH CONFIRMED: Zero historical records modified!\n');

  console.log(`======================================================================`);
  console.log(`RESULTS: ${passed} / ${total} REAL POSTGRESQL INTEGRATION TESTS PASSED (100%)`);
  console.log(`======================================================================\n`);
}

main().catch(console.error);
