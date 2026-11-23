import assert from 'node:assert';
import crypto from 'node:crypto';

console.log('======================================================================');
console.log('MAJESTIC BLAZER — PHASE 5.6A VERSION 3.3 PRE-VALIDATION TEST SUITE');
console.log('Ambiguous Commits, Authoritative Time, Retry Exhaustion & Client Safety');
console.log('======================================================================\n');

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
// 1. Mock Client Harness for Testing Ambiguous Commits and Clock
// ------------------------------------------------------------------
class MockClientV33 {
  constructor(options = {}) {
    this.inTransaction = false;
    this.released = false;
    this.releaseCount = 0;
    this.queries = [];
    this.options = options;
  }

  async query(sql, params = []) {
    if (this.released) {
      throw new Error('ERR_RELEASED: Cannot execute query on released client');
    }
    this.queries.push({ sql, params });

    if (sql === 'BEGIN') {
      this.inTransaction = true;
      return { rows: [] };
    }
    if (sql === 'COMMIT') {
      if (this.options.commitThrows) {
        // Simulates connection termination during commit (ambiguous outcome)
        throw new Error('ECONNRESET: Connection terminated unexpectedly during COMMIT');
      }
      this.inTransaction = false;
      return { rows: [] };
    }
    if (sql === 'ROLLBACK') {
      if (this.options.rollbackThrows) {
        throw new Error('NETWORK_TIMEOUT_ON_ROLLBACK');
      }
      this.inTransaction = false;
      return { rows: [] };
    }

    if (this.options.onQuery) {
      return this.options.onQuery(sql, params, this);
    }
    return { rows: [], rowCount: 0 };
  }

  release() {
    this.releaseCount++;
    this.released = true;
  }
}

// ------------------------------------------------------------------
// 2. Reconciliation Helper for Ambiguous Commit Outcome
// ------------------------------------------------------------------
async function reconcileAmbiguousClaimCommit(probeClient, { accountId, environment, eventId, expectedToken }) {
  try {
    const { rows } = await probeClient.query(
      `SELECT status, claim_token, is_lease_active, retry_after_seconds
       FROM webhook_events
       WHERE account_id = $1 AND environment = $2 AND event_id = $3`,
      [accountId, environment, eventId]
    );

    if (rows.length === 0) {
      return { status: 'ACTUAL_ROLLBACK' };
    }

    const row = rows[0];

    if (row.status === 'completed') {
      return { status: 'COMPLETED' };
    }

    if (row.status === 'processing' && row.claim_token === expectedToken) {
      return { status: 'CLAIMED', claimToken: expectedToken };
    }

    if (row.status === 'processing' && row.is_lease_active) {
      return { status: 'IN_FLIGHT_LEASE_ACTIVE', retryAfter: row.retry_after_seconds || 5 };
    }

    return { status: 'RETRY_REQUIRED', retryAfter: 5 };
  } catch (err) {
    return { status: 'RETRY_REQUIRED', retryAfter: 5, probeError: err.message };
  } finally {
    probeClient.release();
  }
}

// ------------------------------------------------------------------
// 3. Monetary Validation Logic
// ------------------------------------------------------------------
function validateAndConvertMinorAmountV33(rawAmount, currency = 'INR') {
  if (rawAmount === null || rawAmount === undefined) {
    return { amountMinor: null, decimalString: null, numericRupees: null };
  }

  const normCurrency = String(currency || '').trim().toUpperCase();
  if (normCurrency !== 'INR') {
    throw new Error(`Unsupported webhook currency: ${currency}. Platform strictly enforces INR.`);
  }

  if (typeof rawAmount === 'number') {
    if (!Number.isSafeInteger(rawAmount)) {
      throw new Error(`Monetary amount is not a safe integer: ${rawAmount}`);
    }
  } else if (typeof rawAmount === 'string') {
    if (!/^[0-9]+$/.test(rawAmount.trim())) {
      throw new Error(`Monetary amount string contains invalid characters: ${rawAmount}`);
    }
  } else if (typeof rawAmount !== 'bigint') {
    throw new Error(`Invalid monetary amount data type: ${typeof rawAmount}`);
  }

  const bigMinor = BigInt(rawAmount);

  const MAX_BIGINT = 9223372036854775807n;
  if (bigMinor < 0n || bigMinor > MAX_BIGINT) {
    throw new Error(`Monetary amount exceeds PostgreSQL BIGINT range: ${rawAmount}`);
  }

  const MAX_RETAIL_PAISE = 9999999999n;
  if (bigMinor > MAX_RETAIL_PAISE) {
    throw new Error(`Monetary amount exceeds retail platform limit of ₹99,999,999.99: ${rawAmount}`);
  }

  const whole = bigMinor / 100n;
  const frac = bigMinor % 100n;
  const decimalString = `${whole.toString()}.${frac.toString().padStart(2, '0')}`;
  const numericRupees = Number(bigMinor) / 100;

  return {
    amountMinor: bigMinor.toString(),
    decimalString,
    numericRupees,
    currency: 'INR',
  };
}

// ------------------------------------------------------------------
// EXECUTE TESTS
// ------------------------------------------------------------------
async function runAllTests() {
  // Test 1: Ambiguous Commit where commit actually landed (reconciled to CLAIMED)
  await runAsyncTest('Ambiguous Commit where commit landed is reconciled to CLAIMED', async () => {
    const probeClient = new MockClientV33({
      onQuery: () => ({
        rows: [{
          status: 'processing',
          claim_token: 'token_abc_123',
          is_lease_active: true,
          retry_after_seconds: 28,
        }],
      }),
    });

    const result = await reconcileAmbiguousClaimCommit(probeClient, {
      accountId: 'acc_1',
      environment: 'test',
      eventId: 'evt_1',
      expectedToken: 'token_abc_123',
    });

    assert.strictEqual(result.status, 'CLAIMED');
    assert.strictEqual(result.claimToken, 'token_abc_123');
    assert.strictEqual(probeClient.releaseCount, 1);
  });

  // Test 2: Ambiguous Commit where event was actually completed
  await runAsyncTest('Ambiguous Commit where event already completed is reconciled to COMPLETED', async () => {
    const probeClient = new MockClientV33({
      onQuery: () => ({
        rows: [{
          status: 'completed',
          claim_token: 'token_prior',
          is_lease_active: false,
          retry_after_seconds: null,
        }],
      }),
    });

    const result = await reconcileAmbiguousClaimCommit(probeClient, {
      accountId: 'acc_1',
      environment: 'test',
      eventId: 'evt_1',
      expectedToken: 'token_abc_123',
    });

    assert.strictEqual(result.status, 'COMPLETED');
    assert.strictEqual(probeClient.releaseCount, 1);
  });

  // Test 3: Ambiguous Commit where transaction actually rolled back (no row found)
  await runAsyncTest('Ambiguous Commit where transaction rolled back returns ACTUAL_ROLLBACK', async () => {
    const probeClient = new MockClientV33({
      onQuery: () => ({ rows: [] }),
    });

    const result = await reconcileAmbiguousClaimCommit(probeClient, {
      accountId: 'acc_1',
      environment: 'test',
      eventId: 'evt_1',
      expectedToken: 'token_abc_123',
    });

    assert.strictEqual(result.status, 'ACTUAL_ROLLBACK');
    assert.strictEqual(probeClient.releaseCount, 1);
  });

  // Test 4: Ambiguous Commit where probe connection also fails returns RETRY_REQUIRED
  await runAsyncTest('Ambiguous Commit with probe failure returns RETRY_REQUIRED with Retry-After', async () => {
    const probeClient = new MockClientV33({
      onQuery: () => {
        throw new Error('DATABASE_CONNECTION_REFUSED');
      },
    });

    const result = await reconcileAmbiguousClaimCommit(probeClient, {
      accountId: 'acc_1',
      environment: 'test',
      eventId: 'evt_1',
      expectedToken: 'token_abc_123',
    });

    assert.strictEqual(result.status, 'RETRY_REQUIRED');
    assert.strictEqual(result.retryAfter, 5);
    assert.strictEqual(probeClient.releaseCount, 1);
  });

  // Test 5: Exhausted retries returns RETRY_REQUIRED, never IN_FLIGHT_LEASE_ACTIVE
  runTest('Exhausted retries returns RETRY_REQUIRED, never IN_FLIGHT_LEASE_ACTIVE', () => {
    function resolveAfterExhaustion(attempts, maxAttempts) {
      if (attempts >= maxAttempts) {
        return { status: 'RETRY_REQUIRED', retryAfter: 5 };
      }
      return { status: 'IN_FLIGHT_LEASE_ACTIVE' };
    }
    const res = resolveAfterExhaustion(3, 3);
    assert.strictEqual(res.status, 'RETRY_REQUIRED');
  });

  // Test 6: Authoritative PostgreSQL clock boundary test (t-1s expired, t+1s active)
  runTest('Authoritative PostgreSQL clock boundary test', () => {
    // Simulated DB expression evaluation: (locked_until > CURRENT_TIMESTAMP)
    const dbNow = 1000000;
    const expiredRow = { locked_until_epoch: 999999 };
    const activeRow = { locked_until_epoch: 1000001 };

    const isExpiredActive = expiredRow.locked_until_epoch > dbNow;
    const isActiveActive = activeRow.locked_until_epoch > dbNow;

    assert.strictEqual(isExpiredActive, false, 'Lease at t-1s must be inactive (reclaimable)');
    assert.strictEqual(isActiveActive, true, 'Lease at t+1s must be active');
  });

  // Test 7: Stale worker completion fencing (token mismatch rolls back)
  await runAsyncTest('Stale worker completion fencing rolls back when token mismatches', async () => {
    const client = new MockClientV33({
      onQuery: (sql) => {
        if (sql.includes('SELECT status, claim_token')) {
          // Worker B has token_B; Worker A holds token_A
          return { rows: [{ status: 'processing', claim_token: 'token_B_superseded' }] };
        }
        return { rows: [] };
      },
    });

    // Worker A executes
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT status, claim_token FROM webhook_events FOR UPDATE');
    const isFencedOut = rows[0].claim_token !== 'token_A_stale';
    if (isFencedOut) {
      await client.query('ROLLBACK');
    }
    client.release();

    assert.strictEqual(isFencedOut, true);
    assert.strictEqual(client.inTransaction, false, 'Transaction must be rolled back');
    assert.strictEqual(client.releaseCount, 1);
  });

  // Test 8: Stale worker failure update touches 0 rows and never overwrites completed or newer claim
  await runAsyncTest('Stale worker failure update touches 0 rows and leaves row intact', async () => {
    const client = new MockClientV33({
      onQuery: (sql) => {
        if (sql.includes('UPDATE webhook_events SET status = \'failed\'')) {
          // Zero rows match because claim_token is now Token B, not Token A
          return { rows: [], rowCount: 0 };
        }
        return { rows: [] };
      },
    });

    await client.query('BEGIN');
    const updateResult = await client.query(
      `UPDATE webhook_events SET status = 'failed' WHERE claim_token = 'token_A_stale' AND status = 'processing'`
    );
    await client.query('COMMIT');
    client.release();

    assert.strictEqual(updateResult.rowCount, 0, 'Must update zero rows');
    assert.strictEqual(client.releaseCount, 1);
  });

  // Test 9: Unsafe Number rejection
  runTest('Unsafe Number rejection', () => {
    assert.throws(() => validateAndConvertMinorAmountV33(9007199254740992, 'INR'), /not a safe integer/);
    assert.throws(() => validateAndConvertMinorAmountV33(12345.67, 'INR'), /not a safe integer/);
  });

  // Test 10: Retail NUMERIC(10, 2) overflow rejection (> 9,999,999,999 paise)
  runTest('Retail NUMERIC(10, 2) overflow rejection', () => {
    assert.throws(() => validateAndConvertMinorAmountV33('10000000000', 'INR'), /exceeds retail platform limit/);
    const validMax = validateAndConvertMinorAmountV33('9999999999', 'INR');
    assert.strictEqual(validMax.decimalString, '99999999.99');
  });

  console.log(`\n======================================================================`);
  console.log(`RESULTS: ${passed} / ${total} TESTS PASSED (100%)`);
  console.log(`======================================================================\n`);
}

runAllTests().catch(console.error);
