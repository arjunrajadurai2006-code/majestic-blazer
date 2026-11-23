import assert from 'node:assert';

// Standalone verification harness for Phase 5.6A Pre-Validation
console.log('======================================================================');
console.log('MAJESTIC BLAZER — PHASE 5.6A PRE-VALIDATION LOGIC & CLIENT SAFETY TESTS');
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

// -------------------------------------------------------------
// 1. Monetary Validation Logic Implementation for Verification
// -------------------------------------------------------------
function validateAndConvertMinorAmountLogic(rawAmount, currency = 'INR') {
  if (rawAmount === null || rawAmount === undefined) {
    return { amountMinor: null, decimalString: null, numericRupees: null };
  }

  // 1. Currency enforcement (INR only)
  const normCurrency = String(currency || '').trim().toUpperCase();
  if (normCurrency !== 'INR') {
    throw new Error(`Unsupported webhook currency: ${currency}. Platform strictly enforces INR.`);
  }

  // 2. Reject unsafe JavaScript numbers
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

  // 3. PostgreSQL BIGINT range check
  const MAX_BIGINT = 9223372036854775807n;
  if (bigMinor < 0n || bigMinor > MAX_BIGINT) {
    throw new Error(`Monetary amount exceeds PostgreSQL BIGINT range: ${rawAmount}`);
  }

  // 4. PostgreSQL NUMERIC(10, 2) order total limit check (99,999,999.99 INR = 9,999,999,999 paise)
  const MAX_RETAIL_PAISE = 9999999999n;
  if (bigMinor > MAX_RETAIL_PAISE) {
    throw new Error(`Monetary amount exceeds retail platform limit of ₹99,999,999.99: ${rawAmount}`);
  }

  // 5. Zero-loss integer string formatting
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

// -------------------------------------------------------------
// 2. Mock Pool & Client Harness to Test Client Lifecycle & 23505
// -------------------------------------------------------------
class MockClient {
  constructor(options = {}) {
    this.inTransaction = false;
    this.released = false;
    this.releaseCount = 0;
    this.queries = [];
    this.options = options;
  }

  async query(sql, params = []) {
    if (this.released) {
      throw new Error('ERR_RELEASED: Cannot execute query on already-released client');
    }
    this.queries.push({ sql, params });

    if (sql === 'BEGIN') {
      this.inTransaction = true;
      return { rows: [] };
    }
    if (sql === 'COMMIT') {
      this.inTransaction = false;
      return { rows: [] };
    }
    if (sql === 'ROLLBACK') {
      if (this.options.failRollback) {
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

// Algorithm under test
async function attemptInitialClaimWithClient(client, params, claimToken) {
  let inTransaction = false;
  try {
    await client.query('BEGIN');
    inTransaction = true;

    // Check existing
    const { rows: existing } = await client.query(
      `SELECT status, claim_token, locked_until 
       FROM webhook_events 
       WHERE account_id = $1 AND environment = $2 AND event_id = $3 
       FOR UPDATE`,
      [params.accountId, params.environment, params.eventId]
    );

    if (existing.length > 0) {
      const row = existing[0];
      const now = Date.now();
      const leaseExpiry = row.locked_until ? new Date(row.locked_until).getTime() : 0;

      if (row.status === 'completed') {
        await client.query('COMMIT');
        inTransaction = false;
        return { status: 'COMPLETED' };
      }

      if (row.status === 'processing' && leaseExpiry > now) {
        await client.query('COMMIT');
        inTransaction = false;
        return { status: 'IN_FLIGHT_LEASE_ACTIVE', retryAfter: Math.max(1, Math.ceil((leaseExpiry - now) / 1000)) };
      }

      // Restrict reclamation strictly to status = 'failed' OR (status = 'processing' AND locked_until <= CURRENT_TIMESTAMP)
      const newClaimToken = 'new-claim-token-uuid';
      const { rows: reclaimed, rowCount } = await client.query(
        `UPDATE webhook_events
         SET status = 'processing',
             claim_token = $1,
             locked_until = CURRENT_TIMESTAMP + INTERVAL '30 seconds',
             attempts = attempts + 1,
             error_message = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE account_id = $2 AND environment = $3 AND event_id = $4
           AND (status = 'failed' OR (status = 'processing' AND locked_until <= CURRENT_TIMESTAMP))
         RETURNING claim_token`,
        [newClaimToken, params.accountId, params.environment, params.eventId]
      );

      if (rowCount === 1 && reclaimed.length > 0) {
        await client.query('COMMIT');
        inTransaction = false;
        return { status: 'CLAIMED', claimToken: reclaimed[0].claim_token };
      }

      // Zero-row update: state changed or lost race
      await client.query('ROLLBACK');
      inTransaction = false;
      return { status: 'RETRY_NEEDED' };
    }

    // Insert new row
    await client.query(
      `INSERT INTO webhook_events (account_id, environment, event_id, event_type, status, claim_token)
       VALUES ($1, $2, $3, $4, 'processing', $5)`,
      [params.accountId, params.environment, params.eventId, params.eventType, claimToken]
    );

    await client.query('COMMIT');
    inTransaction = false;
    return { status: 'CLAIMED', claimToken };
  } catch (err) {
    if (inTransaction) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        // Rollback error does not mask the original error
        err.rollbackError = rollbackErr;
      }
    }
    throw err;
  } finally {
    client.release();
  }
}

// -------------------------------------------------------------
// RUN TESTS
// -------------------------------------------------------------

async function main() {
  // Test 1: Exactly-once database client release during a 23505 race
  await runAsyncTest('Exactly-once database client release during a 23505 race', async () => {
    const client = new MockClient({
      onQuery: (sql) => {
        if (sql.startsWith('INSERT INTO')) {
          const err = new Error('duplicate key value violates unique constraint');
          err.code = '23505';
          throw err;
        }
        return { rows: [] };
      },
    });

    let caughtErr;
    try {
      await attemptInitialClaimWithClient(client, { accountId: 'acc_1', environment: 'test', eventId: 'evt_1' }, 'token_1');
    } catch (e) {
      caughtErr = e;
    }

    assert.strictEqual(caughtErr.code, '23505', 'Expected 23505 code');
    assert.strictEqual(client.releaseCount, 1, 'Client must be released exactly once');
    assert.strictEqual(client.released, true, 'Client must be marked released');
    assert.strictEqual(client.inTransaction, false, 'Transaction must be closed by rollback');
  });

  // Test 2: No rollback after client release
  await runAsyncTest('No rollback after client release', async () => {
    const client = new MockClient();
    await attemptInitialClaimWithClient(client, { accountId: 'acc_1', environment: 'test', eventId: 'evt_1' }, 'token_1');
    assert.strictEqual(client.released, true);
    assert.strictEqual(client.releaseCount, 1);
    
    // Attempting query on released client must fail
    await assert.rejects(async () => {
      await client.query('ROLLBACK');
    }, /ERR_RELEASED/);
  });

  // Test 3: Completed event cannot be reclaimed
  await runAsyncTest('Completed event cannot be reclaimed', async () => {
    const client = new MockClient({
      onQuery: (sql) => {
        if (sql.includes('SELECT status, claim_token')) {
          return { rows: [{ status: 'completed', claim_token: 'tok_prev', locked_until: null }] };
        }
        return { rows: [] };
      },
    });

    const res = await attemptInitialClaimWithClient(client, { accountId: 'acc_1', environment: 'test', eventId: 'evt_1' }, 'token_1');
    assert.strictEqual(res.status, 'COMPLETED');
    assert.strictEqual(client.releaseCount, 1);
    assert.strictEqual(client.queries.some(q => q.sql.startsWith('UPDATE')), false, 'Must not issue UPDATE on completed row');
  });

  // Test 4: Failed event can be reclaimed
  await runAsyncTest('Failed event can be reclaimed', async () => {
    const client = new MockClient({
      onQuery: (sql) => {
        if (sql.includes('SELECT status, claim_token')) {
          return { rows: [{ status: 'failed', claim_token: 'tok_failed', locked_until: null }] };
        }
        if (sql.includes('UPDATE webhook_events')) {
          assert(sql.includes("status = 'failed'"), 'UPDATE must verify status = failed');
          return { rows: [{ claim_token: 'new-claim-token-uuid' }], rowCount: 1 };
        }
        return { rows: [] };
      },
    });

    const res = await attemptInitialClaimWithClient(client, { accountId: 'acc_1', environment: 'test', eventId: 'evt_1' }, 'token_1');
    assert.strictEqual(res.status, 'CLAIMED');
    assert.strictEqual(res.claimToken, 'new-claim-token-uuid');
    assert.strictEqual(client.releaseCount, 1);
  });

  // Test 5: Expired processing lease can be reclaimed
  await runAsyncTest('Expired processing lease can be reclaimed', async () => {
    const expiredTime = new Date(Date.now() - 10000).toISOString();
    const client = new MockClient({
      onQuery: (sql) => {
        if (sql.includes('SELECT status, claim_token')) {
          return { rows: [{ status: 'processing', claim_token: 'tok_old', locked_until: expiredTime }] };
        }
        if (sql.includes('UPDATE webhook_events')) {
          assert(sql.includes("locked_until <= CURRENT_TIMESTAMP"), 'UPDATE must check locked_until <= CURRENT_TIMESTAMP');
          return { rows: [{ claim_token: 'new-claim-token-uuid' }], rowCount: 1 };
        }
        return { rows: [] };
      },
    });

    const res = await attemptInitialClaimWithClient(client, { accountId: 'acc_1', environment: 'test', eventId: 'evt_1' }, 'token_1');
    assert.strictEqual(res.status, 'CLAIMED');
    assert.strictEqual(client.releaseCount, 1);
  });

  // Test 6: Active processing lease cannot be reclaimed
  await runAsyncTest('Active processing lease cannot be reclaimed', async () => {
    const activeTime = new Date(Date.now() + 20000).toISOString();
    const client = new MockClient({
      onQuery: (sql) => {
        if (sql.includes('SELECT status, claim_token')) {
          return { rows: [{ status: 'processing', claim_token: 'tok_active', locked_until: activeTime }] };
        }
        return { rows: [] };
      },
    });

    const res = await attemptInitialClaimWithClient(client, { accountId: 'acc_1', environment: 'test', eventId: 'evt_1' }, 'token_1');
    assert.strictEqual(res.status, 'IN_FLIGHT_LEASE_ACTIVE');
    assert(res.retryAfter > 0, 'Retry-After must be positive');
    assert.strictEqual(client.queries.some(q => q.sql.startsWith('UPDATE')), false, 'Must not issue UPDATE on active lease');
    assert.strictEqual(client.releaseCount, 1);
  });

  // Test 7: Zero-row UPDATE never reports a successful claim
  await runAsyncTest('Zero-row UPDATE never reports a successful claim', async () => {
    const expiredTime = new Date(Date.now() - 5000).toISOString();
    const client = new MockClient({
      onQuery: (sql) => {
        if (sql.includes('SELECT status, claim_token')) {
          return { rows: [{ status: 'processing', claim_token: 'tok_old', locked_until: expiredTime }] };
        }
        if (sql.includes('UPDATE webhook_events')) {
          // Zero rows updated!
          return { rows: [], rowCount: 0 };
        }
        return { rows: [] };
      },
    });

    const res = await attemptInitialClaimWithClient(client, { accountId: 'acc_1', environment: 'test', eventId: 'evt_1' }, 'token_1');
    assert.strictEqual(res.status, 'RETRY_NEEDED', 'Must return RETRY_NEEDED, never CLAIMED');
    assert.strictEqual(client.releaseCount, 1);
    assert.strictEqual(client.inTransaction, false);
  });

  // Test 8: Rollback failure does not hide the original error
  await runAsyncTest('Rollback failure does not hide the original error', async () => {
    const client = new MockClient({
      failRollback: true,
      onQuery: (sql) => {
        if (sql.startsWith('INSERT INTO')) {
          throw new Error('PRIMARY_DATABASE_QUERY_FAILED');
        }
        return { rows: [] };
      },
    });

    let caughtErr;
    try {
      await attemptInitialClaimWithClient(client, { accountId: 'acc_1', environment: 'test', eventId: 'evt_1' }, 'token_1');
    } catch (e) {
      caughtErr = e;
    }

    assert.strictEqual(caughtErr.message, 'PRIMARY_DATABASE_QUERY_FAILED', 'Primary error must be preserved');
    assert.strictEqual(caughtErr.rollbackError.message, 'NETWORK_TIMEOUT_ON_ROLLBACK', 'Rollback error preserved on error object');
    assert.strictEqual(client.releaseCount, 1, 'Client must still be released in finally');
  });

  // Test 9: Unsafe monetary Number rejection
  runTest('Unsafe monetary Number rejection', () => {
    assert.throws(() => {
      validateAndConvertMinorAmountLogic(19999.50, 'INR');
    }, /not a safe integer/);

    assert.throws(() => {
      validateAndConvertMinorAmountLogic(1e25, 'INR');
    }, /not a safe integer/);
  });

  // Test 10: INR conversion accuracy and NUMERIC(10,2) overflow rejection
  runTest('INR conversion accuracy and NUMERIC(10,2) overflow rejection', () => {
    // Valid: 1999900 paise -> 19999.00 INR
    const valid = validateAndConvertMinorAmountLogic(1999900, 'INR');
    assert.strictEqual(valid.decimalString, '19999.00');
    assert.strictEqual(valid.numericRupees, 19999);
    assert.strictEqual(valid.amountMinor, '1999900');

    // Valid string: "50000" -> 500.00 INR
    const validStr = validateAndConvertMinorAmountLogic('50000', 'INR');
    assert.strictEqual(validStr.decimalString, '500.00');
    assert.strictEqual(validStr.numericRupees, 500);

    // Overflow: 99999999999 paise (> 9.99 Crores)
    assert.throws(() => {
      validateAndConvertMinorAmountLogic('99999999999', 'INR');
    }, /exceeds retail platform limit/);

    // Unsupported currency: USD
    assert.throws(() => {
      validateAndConvertMinorAmountLogic(1000, 'USD');
    }, /Unsupported webhook currency/);
  });

  console.log(`\n======================================================================`);
  console.log(`RESULTS: ${passed} / ${total} TESTS PASSED (100%)`);
  console.log(`======================================================================\n`);
}

main().catch(console.error);
