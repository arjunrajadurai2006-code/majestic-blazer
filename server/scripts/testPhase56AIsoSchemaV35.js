import crypto from 'node:crypto';
import assert from 'node:assert';
import { pool } from '../src/config/db.js';
import {
  claimWebhookEvent,
  executeFencedWebhookMutations,
  reconcileAmbiguousCommit,
} from '../src/services/webhookClaimService.js';
import {
  verifyWebhookEventsSchema,
} from '../src/utils/webhookSchemaVerifier.js';

console.log('======================================================================');
console.log('MAJESTIC BLAZER — PHASE 5.6A VERSION 3.5 PRODUCTION VALIDATION SUITE');
console.log('Production Service Imports, Exhaustive Verifier & Non-CASCADE Cleanup');
console.log('======================================================================\n');

const SCHEMA_NAME = 'test_webhook_isolation_v35';

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
    throw err;
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
    throw err;
  }
}

// ------------------------------------------------------------------
// Canonical Serialization and SHA-256 Fingerprint Generator
// ------------------------------------------------------------------
export function serializePaymentRow(row) {
  const sanitize = (val) => {
    if (val === null || val === undefined) return '\\N';
    return String(val).replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
  };

  const normalizeAmount = (amt) => {
    if (amt === null || amt === undefined) return '\\N';
    return Number(amt).toFixed(2);
  };

  return [
    sanitize(row.id),
    sanitize(row.order_id),
    normalizeAmount(row.amount),
    sanitize(row.status),
    sanitize(row.provider),
    sanitize(row.provider_payment_id),
  ].join('|') + '\n';
}

export async function computeHistoricalBaselineFingerprint(client) {
  const { rows } = await client.query(`
    SELECT id, order_id, amount, status, provider, provider_payment_id
    FROM payments 
    WHERE id <= 210 
    ORDER BY id ASC;
  `);

  if (rows.length !== 56) {
    throw new Error(`BASELINE_VIOLATION: Expected 56 historical records, found ${rows.length}`);
  }

  const hash = crypto.createHash('sha256');
  for (const row of rows) {
    const canonicalLine = serializePaymentRow(row);
    hash.update(Buffer.from(canonicalLine, 'utf8'));
  }

  return {
    count: rows.length,
    minId: rows[0].id,
    maxId: rows[rows.length - 1].id,
    fingerprint: hash.digest('hex'),
  };
}

// ------------------------------------------------------------------
// MAIN EXECUTION
// ------------------------------------------------------------------
async function main() {
  const initClient = await pool.connect();
  let preTestResult;
  try {
    console.log('--- Step 1: Generating Canonical Historical Baseline Fingerprint ---');
    preTestResult = await computeHistoricalBaselineFingerprint(initClient);
    console.log(`Baseline Record Count : ${preTestResult.count} rows (IDs ${preTestResult.minId} to ${preTestResult.maxId})`);
    console.log(`Baseline Fingerprint  : ${preTestResult.fingerprint}\n`);

    // Setup dedicated test schema
    await initClient.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA_NAME}`);
  } finally {
    initClient.release();
  }

  try {
    // ------------------------------------------------------------------
    // PHASE A: Exhaustive Schema Verifier Tests (7 Scenarios)
    // ------------------------------------------------------------------
    console.log('--- Step 2: Testing Exhaustive Schema Verifier Against 7 Cases ---');

    // Case 1: Correct Schema
    await runAsyncTest('Schema Verifier: Correct schema passes completely', async () => {
      const client = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE ${SCHEMA_NAME}.webhook_events (
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

            CONSTRAINT pk_webhook_events PRIMARY KEY (account_id, environment, event_id),
            CONSTRAINT chk_webhook_events_status CHECK (status IN ('processing', 'completed', 'failed')),
            CONSTRAINT chk_webhook_events_attempts CHECK (attempts >= 1),
            CONSTRAINT chk_webhook_events_currency CHECK (currency = 'INR'),
            CONSTRAINT chk_webhook_events_processing_fields CHECK (status != 'processing' OR (claim_token IS NOT NULL AND locked_until IS NOT NULL)),
            CONSTRAINT chk_webhook_events_completed_fields CHECK (status != 'completed' OR completed_at IS NOT NULL)
          );

          CREATE INDEX idx_webhook_events_status ON ${SCHEMA_NAME}.webhook_events USING btree (status);
          CREATE INDEX idx_webhook_events_lease ON ${SCHEMA_NAME}.webhook_events USING btree (locked_until) WHERE status = 'processing';
          CREATE INDEX idx_webhook_events_entity ON ${SCHEMA_NAME}.webhook_events USING btree (account_id, environment, entity_id);
          CREATE INDEX idx_webhook_events_order ON ${SCHEMA_NAME}.webhook_events USING btree (account_id, environment, order_id);
        `);

        const res = await verifyWebhookEventsSchema(client, SCHEMA_NAME);
        assert.strictEqual(res.valid, true);
      } finally {
        await client.query(`DROP TABLE ${SCHEMA_NAME}.webhook_events RESTRICT`);
        client.release();
      }
    });

    // Case 2: Missing Column
    await runAsyncTest('Schema Verifier: Rejects missing column', async () => {
      const client = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE ${SCHEMA_NAME}.webhook_events (
            account_id VARCHAR(100) NOT NULL,
            environment VARCHAR(50) NOT NULL,
            event_id VARCHAR(255) NOT NULL,
            -- event_type is intentionally missing
            status VARCHAR(30) NOT NULL DEFAULT 'processing',
            CONSTRAINT pk_webhook_events PRIMARY KEY (account_id, environment, event_id)
          );
        `);
        await assert.rejects(
          async () => verifyWebhookEventsSchema(client, SCHEMA_NAME),
          /Missing required column 'event_type'/
        );
      } finally {
        await client.query(`DROP TABLE ${SCHEMA_NAME}.webhook_events RESTRICT`);
        client.release();
      }
    });

    // Case 3: Extra Column
    await runAsyncTest('Schema Verifier: Rejects unexpected extra column', async () => {
      const client = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE ${SCHEMA_NAME}.webhook_events (
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
            rogue_untrusted_col TEXT NULL, -- Extra column
            CONSTRAINT pk_webhook_events PRIMARY KEY (account_id, environment, event_id),
            CONSTRAINT chk_webhook_events_status CHECK (status IN ('processing', 'completed', 'failed')),
            CONSTRAINT chk_webhook_events_attempts CHECK (attempts >= 1),
            CONSTRAINT chk_webhook_events_currency CHECK (currency = 'INR'),
            CONSTRAINT chk_webhook_events_processing_fields CHECK (status != 'processing' OR (claim_token IS NOT NULL AND locked_until IS NOT NULL)),
            CONSTRAINT chk_webhook_events_completed_fields CHECK (status != 'completed' OR completed_at IS NOT NULL)
          );
          CREATE INDEX idx_webhook_events_status ON ${SCHEMA_NAME}.webhook_events (status);
          CREATE INDEX idx_webhook_events_lease ON ${SCHEMA_NAME}.webhook_events (locked_until) WHERE status = 'processing';
          CREATE INDEX idx_webhook_events_entity ON ${SCHEMA_NAME}.webhook_events (account_id, environment, entity_id);
          CREATE INDEX idx_webhook_events_order ON ${SCHEMA_NAME}.webhook_events (account_id, environment, order_id);
        `);
        await assert.rejects(
          async () => verifyWebhookEventsSchema(client, SCHEMA_NAME),
          /Unexpected extra column 'rogue_untrusted_col'/
        );
      } finally {
        await client.query(`DROP TABLE ${SCHEMA_NAME}.webhook_events RESTRICT`);
        client.release();
      }
    });

    // Case 4: Incorrect Default
    await runAsyncTest('Schema Verifier: Rejects incorrect column default', async () => {
      const client = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE ${SCHEMA_NAME}.webhook_events (
            account_id VARCHAR(100) NOT NULL,
            environment VARCHAR(50) NOT NULL,
            event_id VARCHAR(255) NOT NULL,
            event_type VARCHAR(100) NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'pending', -- Wrong default!
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
            CONSTRAINT pk_webhook_events PRIMARY KEY (account_id, environment, event_id),
            CONSTRAINT chk_webhook_events_status CHECK (status IN ('processing', 'completed', 'failed')),
            CONSTRAINT chk_webhook_events_attempts CHECK (attempts >= 1),
            CONSTRAINT chk_webhook_events_currency CHECK (currency = 'INR'),
            CONSTRAINT chk_webhook_events_processing_fields CHECK (status != 'processing' OR (claim_token IS NOT NULL AND locked_until IS NOT NULL)),
            CONSTRAINT chk_webhook_events_completed_fields CHECK (status != 'completed' OR completed_at IS NOT NULL)
          );
          CREATE INDEX idx_webhook_events_status ON ${SCHEMA_NAME}.webhook_events (status);
          CREATE INDEX idx_webhook_events_lease ON ${SCHEMA_NAME}.webhook_events (locked_until) WHERE status = 'processing';
          CREATE INDEX idx_webhook_events_entity ON ${SCHEMA_NAME}.webhook_events (account_id, environment, entity_id);
          CREATE INDEX idx_webhook_events_order ON ${SCHEMA_NAME}.webhook_events (account_id, environment, order_id);
        `);
        await assert.rejects(
          async () => verifyWebhookEventsSchema(client, SCHEMA_NAME),
          /Column 'status' default mismatch/
        );
      } finally {
        await client.query(`DROP TABLE ${SCHEMA_NAME}.webhook_events RESTRICT`);
        client.release();
      }
    });

    // Case 5: CHECK Constraint with Wrong Expression
    await runAsyncTest('Schema Verifier: Rejects check constraint with wrong expression', async () => {
      const client = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE ${SCHEMA_NAME}.webhook_events (
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
            CONSTRAINT pk_webhook_events PRIMARY KEY (account_id, environment, event_id),
            CONSTRAINT chk_webhook_events_status CHECK (status IN ('processing', 'failed')), -- Missing 'completed'!
            CONSTRAINT chk_webhook_events_attempts CHECK (attempts >= 1),
            CONSTRAINT chk_webhook_events_currency CHECK (currency = 'INR'),
            CONSTRAINT chk_webhook_events_processing_fields CHECK (status != 'processing' OR (claim_token IS NOT NULL AND locked_until IS NOT NULL)),
            CONSTRAINT chk_webhook_events_completed_fields CHECK (status != 'completed' OR completed_at IS NOT NULL)
          );
          CREATE INDEX idx_webhook_events_status ON ${SCHEMA_NAME}.webhook_events (status);
          CREATE INDEX idx_webhook_events_lease ON ${SCHEMA_NAME}.webhook_events (locked_until) WHERE status = 'processing';
          CREATE INDEX idx_webhook_events_entity ON ${SCHEMA_NAME}.webhook_events (account_id, environment, entity_id);
          CREATE INDEX idx_webhook_events_order ON ${SCHEMA_NAME}.webhook_events (account_id, environment, order_id);
        `);
        await assert.rejects(
          async () => verifyWebhookEventsSchema(client, SCHEMA_NAME),
          /Check constraint 'chk_webhook_events_status' expression mismatch/
        );
      } finally {
        await client.query(`DROP TABLE ${SCHEMA_NAME}.webhook_events RESTRICT`);
        client.release();
      }
    });

    // Case 6: Missing or Incorrect Index Definition
    await runAsyncTest('Schema Verifier: Rejects missing or misconfigured index', async () => {
      const client = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE ${SCHEMA_NAME}.webhook_events (
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
            CONSTRAINT pk_webhook_events PRIMARY KEY (account_id, environment, event_id),
            CONSTRAINT chk_webhook_events_status CHECK (status IN ('processing', 'completed', 'failed')),
            CONSTRAINT chk_webhook_events_attempts CHECK (attempts >= 1),
            CONSTRAINT chk_webhook_events_currency CHECK (currency = 'INR'),
            CONSTRAINT chk_webhook_events_processing_fields CHECK (status != 'processing' OR (claim_token IS NOT NULL AND locked_until IS NOT NULL)),
            CONSTRAINT chk_webhook_events_completed_fields CHECK (status != 'completed' OR completed_at IS NOT NULL)
          );
          -- idx_webhook_events_status is intentionally omitted
          CREATE INDEX idx_webhook_events_lease ON ${SCHEMA_NAME}.webhook_events (locked_until) WHERE status = 'processing';
          CREATE INDEX idx_webhook_events_entity ON ${SCHEMA_NAME}.webhook_events (account_id, environment, entity_id);
          CREATE INDEX idx_webhook_events_order ON ${SCHEMA_NAME}.webhook_events (account_id, environment, order_id);
        `);
        await assert.rejects(
          async () => verifyWebhookEventsSchema(client, SCHEMA_NAME),
          /Missing required index 'idx_webhook_events_status'/
        );
      } finally {
        await client.query(`DROP TABLE ${SCHEMA_NAME}.webhook_events RESTRICT`);
        client.release();
      }
    });

    // Case 7: Incorrect Primary Key
    await runAsyncTest('Schema Verifier: Rejects incorrect primary key definition', async () => {
      const client = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE ${SCHEMA_NAME}.webhook_events (
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
            CONSTRAINT pk_webhook_events PRIMARY KEY (event_id), -- Missing account_id and environment!
            CONSTRAINT chk_webhook_events_status CHECK (status IN ('processing', 'completed', 'failed')),
            CONSTRAINT chk_webhook_events_attempts CHECK (attempts >= 1),
            CONSTRAINT chk_webhook_events_currency CHECK (currency = 'INR'),
            CONSTRAINT chk_webhook_events_processing_fields CHECK (status != 'processing' OR (claim_token IS NOT NULL AND locked_until IS NOT NULL)),
            CONSTRAINT chk_webhook_events_completed_fields CHECK (status != 'completed' OR completed_at IS NOT NULL)
          );
          CREATE INDEX idx_webhook_events_status ON ${SCHEMA_NAME}.webhook_events (status);
          CREATE INDEX idx_webhook_events_lease ON ${SCHEMA_NAME}.webhook_events (locked_until) WHERE status = 'processing';
          CREATE INDEX idx_webhook_events_entity ON ${SCHEMA_NAME}.webhook_events (account_id, environment, entity_id);
          CREATE INDEX idx_webhook_events_order ON ${SCHEMA_NAME}.webhook_events (account_id, environment, order_id);
        `);
        await assert.rejects(
          async () => verifyWebhookEventsSchema(client, SCHEMA_NAME),
          /Primary key columns mismatch/
        );
      } finally {
        await client.query(`DROP TABLE ${SCHEMA_NAME}.webhook_events RESTRICT`);
        client.release();
      }
    });

    // ------------------------------------------------------------------
    // PHASE B: Real PostgreSQL Integration Tests with Production Module
    // ------------------------------------------------------------------
    console.log('\n--- Step 3: Executing Real PostgreSQL Integration Tests with Production Module ---');
    
    // Set up valid table for integration testing
    const setupClient = await pool.connect();
    try {
      await setupClient.query(`
        CREATE TABLE ${SCHEMA_NAME}.webhook_events (
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

          CONSTRAINT pk_webhook_events PRIMARY KEY (account_id, environment, event_id),
          CONSTRAINT chk_webhook_events_status CHECK (status IN ('processing', 'completed', 'failed')),
          CONSTRAINT chk_webhook_events_attempts CHECK (attempts >= 1),
          CONSTRAINT chk_webhook_events_currency CHECK (currency = 'INR'),
          CONSTRAINT chk_webhook_events_processing_fields CHECK (status != 'processing' OR (claim_token IS NOT NULL AND locked_until IS NOT NULL)),
          CONSTRAINT chk_webhook_events_completed_fields CHECK (status != 'completed' OR completed_at IS NOT NULL)
        );

        CREATE INDEX idx_webhook_events_status ON ${SCHEMA_NAME}.webhook_events (status);
        CREATE INDEX idx_webhook_events_lease ON ${SCHEMA_NAME}.webhook_events (locked_until) WHERE status = 'processing';
        CREATE INDEX idx_webhook_events_entity ON ${SCHEMA_NAME}.webhook_events (account_id, environment, entity_id);
        CREATE INDEX idx_webhook_events_order ON ${SCHEMA_NAME}.webhook_events (account_id, environment, order_id);
      `);
    } finally {
      setupClient.release();
    }

    const testTable = `${SCHEMA_NAME}.webhook_events`;

    // Test 8: Concurrent duplicate deliveries using production service
    await runAsyncTest('Production Module: Concurrent duplicate first deliveries', async () => {
      const eventId = `evt_prod_conc_${Date.now()}`;
      const params = {
        accountId: 'acc_MB_prod1',
        environment: 'test',
        eventId,
        eventType: 'payment.captured',
        tableName: testTable,
        leaseSeconds: 30,
      };

      const [res1, res2] = await Promise.all([
        claimWebhookEvent(params),
        claimWebhookEvent(params),
      ]);

      const results = [res1.status, res2.status].sort();
      assert(results.includes('CLAIMED'), 'One worker must claim');
      assert(results.includes('IN_FLIGHT_LEASE_ACTIVE') || results.includes('COMPLETED'));
    });

    // Test 9: Active lease duplicate delivery
    await runAsyncTest('Production Module: Duplicate delivery during active lease returns IN_FLIGHT_LEASE_ACTIVE', async () => {
      const eventId = `evt_prod_active_${Date.now()}`;
      const params = {
        accountId: 'acc_MB_prod1',
        environment: 'test',
        eventId,
        eventType: 'payment.captured',
        tableName: testTable,
        leaseSeconds: 30,
      };

      const res1 = await claimWebhookEvent(params);
      assert.strictEqual(res1.status, 'CLAIMED');

      const res2 = await claimWebhookEvent(params);
      assert.strictEqual(res2.status, 'IN_FLIGHT_LEASE_ACTIVE');
      assert(res2.retryAfter > 0 && res2.retryAfter <= 30);
    });

    // Test 10: Expired lease recovery
    await runAsyncTest('Production Module: Expired lease recovery on real PostgreSQL', async () => {
      const eventId = `evt_prod_exp_${Date.now()}`;
      const params = {
        accountId: 'acc_MB_prod1',
        environment: 'test',
        eventId,
        eventType: 'payment.captured',
        tableName: testTable,
        leaseSeconds: 1, // 1s lease
      };

      const res1 = await claimWebhookEvent(params);
      assert.strictEqual(res1.status, 'CLAIMED');
      const token1 = res1.claimToken;

      await new Promise((r) => setTimeout(r, 1500)); // Wait for lease to expire

      const res2 = await claimWebhookEvent(params);
      assert.strictEqual(res2.status, 'CLAIMED');
      assert.notStrictEqual(res2.claimToken, token1, 'Must assign new token');
    });

    // Test 11: Stale worker completion fencing in Transaction 2
    await runAsyncTest('Production Module: Transaction 2 fences out stale worker token', async () => {
      const eventId = `evt_prod_fence_${Date.now()}`;
      const params = {
        accountId: 'acc_MB_prod1',
        environment: 'test',
        eventId,
        eventType: 'payment.captured',
        tableName: testTable,
        leaseSeconds: 1,
      };

      const res1 = await claimWebhookEvent(params);
      const staleToken = res1.claimToken;

      await new Promise((r) => setTimeout(r, 1200)); // Lease expires
      const res2 = await claimWebhookEvent(params); // Worker B reclaims
      const currentToken = res2.claimToken;

      // Worker A attempts Transaction 2 with staleToken
      const txRes = await executeFencedWebhookMutations({
        accountId: params.accountId,
        environment: params.environment,
        eventId,
        claimToken: staleToken,
        tableName: testTable,
        mutationFn: async () => {},
      });

      assert.strictEqual(txRes.fencedOut, true);
    });

    // Test 12: Worker whose lease expires between reconciliation and Transaction 2
    await runAsyncTest('Production Module: Fences worker whose lease expires between reconciliation and Tx 2', async () => {
      const eventId = `evt_prod_expire_mid_${Date.now()}`;
      const params = {
        accountId: 'acc_MB_prod1',
        environment: 'test',
        eventId,
        eventType: 'payment.captured',
        tableName: testTable,
        leaseSeconds: 1,
      };

      const res1 = await claimWebhookEvent(params);
      const token1 = res1.claimToken;

      // Worker pauses until lease expires
      await new Promise((r) => setTimeout(r, 1200));

      const txRes = await executeFencedWebhookMutations({
        accountId: params.accountId,
        environment: params.environment,
        eventId,
        claimToken: token1,
        tableName: testTable,
        mutationFn: async () => {},
      });

      assert.strictEqual(txRes.fencedOut, true);
      assert.strictEqual(txRes.reason, 'LEASE_EXPIRED');
    });

    // Test 13: Operation-aware missing row in reconcileAmbiguousCommit
    await runAsyncTest('Production Module: Operation-aware ambiguous commit reconciliation', async () => {
      const missingId = `evt_missing_${Date.now()}`;

      // INSERT operation -> ACTUAL_ROLLBACK
      const resInsert = await reconcileAmbiguousCommit({
        accountId: 'acc_MB_prod1',
        environment: 'test',
        eventId: missingId,
        expectedToken: 'tok_1',
        operation: 'INSERT',
        tableName: testTable,
      });
      assert.strictEqual(resInsert.status, 'ACTUAL_ROLLBACK');

      // RECLAIM operation -> RETRY_REQUIRED
      const resReclaim = await reconcileAmbiguousCommit({
        accountId: 'acc_MB_prod1',
        environment: 'test',
        eventId: missingId,
        expectedToken: 'tok_1',
        operation: 'RECLAIM',
        tableName: testTable,
      });
      assert.strictEqual(resReclaim.status, 'RETRY_REQUIRED');
      assert.strictEqual(resReclaim.reason, 'UNEXPECTED_MISSING_ROW_ON_RECLAIM');
    });

  } finally {
    // ------------------------------------------------------------------
    // SAFE NON-CASCADE TEST SCHEMA CLEANUP
    // ------------------------------------------------------------------
    console.log('\n--- Step 4: Executing Safe Non-CASCADE Test Schema Cleanup ---');
    const cleanupClient = await pool.connect();
    try {
      // 1. Explicitly drop table without CASCADE
      await cleanupClient.query(`DROP TABLE IF EXISTS ${SCHEMA_NAME}.webhook_events RESTRICT`);

      // 2. Verify zero unexpected objects remain in test schema
      const { rows: remaining } = await cleanupClient.query(`
        SELECT table_name FROM information_schema.tables WHERE table_schema = $1
      `, [SCHEMA_NAME]);

      if (remaining.length > 0) {
        throw new Error(`CLEANUP_ABORTED: Unexpected tables found in test schema: ${JSON.stringify(remaining)}`);
      }

      // 3. Drop test schema without CASCADE
      await cleanupClient.query(`DROP SCHEMA ${SCHEMA_NAME} RESTRICT`);
      console.log(`Successfully verified and dropped test schema: ${SCHEMA_NAME} (RESTRICT)\n`);
    } finally {
      cleanupClient.release();
    }
  }

  // ------------------------------------------------------------------
  // POST-TEST HISTORICAL FINGERPRINT VERIFICATION
  // ------------------------------------------------------------------
  console.log('--- Step 5: Generating Post-Test Historical Financial Fingerprint ---');
  const postTestClient = await pool.connect();
  let postTestResult;
  try {
    postTestResult = await computeHistoricalBaselineFingerprint(postTestClient);
    console.log(`Post-Test Record Count: ${postTestResult.count} rows (IDs ${postTestResult.minId} to ${postTestResult.maxId})`);
    console.log(`Post-Test Fingerprint : ${postTestResult.fingerprint}\n`);

    assert.strictEqual(
      preTestResult.fingerprint,
      postTestResult.fingerprint,
      'CRITICAL_INTEGRITY_BREACH: Baseline historical financial fingerprint changed during test execution!'
    );
    console.log('FINGERPRINT MATCH CONFIRMED (100%): Pre-test and post-test cryptographic fingerprints are IDENTICAL!\n');
  } finally {
    postTestClient.release();
  }

  console.log(`======================================================================`);
  console.log(`RESULTS: ${passed} / ${total} PRODUCTION & REAL POSTGRESQL TESTS PASSED (100%)`);
  console.log(`======================================================================\n`);
}

main().catch((err) => {
  console.error('\nFATAL ERROR DURING TEST EXECUTION:', err);
  process.exit(1);
});
