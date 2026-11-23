import crypto from 'node:crypto';
import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

/**
 * Reconciles ambiguous COMMIT outcomes on a fresh, isolated database client connection.
 * Distinguishes initial INSERT vs existing-row RECLAIM.
 */
export async function reconcileAmbiguousCommit({ accountId, environment, eventId, expectedToken, operation, tableName = 'webhook_events' }) {
  let probeClient;
  try {
    probeClient = await pool.connect();
    const { rows } = await probeClient.query(
      `SELECT status, claim_token, 
              (locked_until > CURRENT_TIMESTAMP) AS is_lease_active,
              GREATEST(1, CEIL(EXTRACT(EPOCH FROM (locked_until - CURRENT_TIMESTAMP))))::int AS retry_after_seconds
       FROM ${tableName}
       WHERE account_id = $1 AND environment = $2 AND event_id = $3`,
      [accountId, environment, eventId]
    );

    // Case 1: Row does not exist
    if (rows.length === 0) {
      if (operation === 'INSERT') {
        // For initial insert, missing row indicates the insert did not commit / rolled back
        return { status: 'ACTUAL_ROLLBACK' };
      }
      // For reclaim, the row existed prior to reclaim. Missing row is an unexpected critical anomaly
      return { status: 'RETRY_REQUIRED', reason: 'UNEXPECTED_MISSING_ROW_ON_RECLAIM', retryAfter: 5 };
    }

    const row = rows[0];

    // Case 2: Event was completed
    if (row.status === 'completed') {
      return { status: 'COMPLETED' };
    }

    // Case 3: Claim token matches AND lease is still active according to PostgreSQL engine
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
  } catch (probeErr) {
    return { status: 'RETRY_REQUIRED', retryAfter: 5, probeError: probeErr.message };
  } finally {
    if (probeClient) {
      probeClient.release();
    }
  }
}

/**
 * Bounded re-read helper for concurrently claimed event rows.
 * Uses PostgreSQL authoritative time for lease evaluation.
 */
export async function resolveConcurrentClaim({ accountId, environment, eventId, maxRetries = 3, tableName = 'webhook_events', leaseSeconds = 30 }) {
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
         FROM ${tableName} 
         WHERE account_id = $1 AND environment = $2 AND event_id = $3 
         FOR UPDATE`,
        [accountId, environment, eventId]
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

        // Permitted state reclamation strictly enforced
        const newClaimToken = crypto.randomUUID();
        const { rows: reclaimed, rowCount } = await client.query(
          `UPDATE ${tableName}
           SET status = 'processing',
               claim_token = $1,
               locked_until = CURRENT_TIMESTAMP + INTERVAL '${leaseSeconds} seconds',
               attempts = attempts + 1,
               error_message = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE account_id = $2 AND environment = $3 AND event_id = $4
             AND (status = 'failed' OR (status = 'processing' AND locked_until <= CURRENT_TIMESTAMP))
           RETURNING claim_token`,
          [newClaimToken, accountId, environment, eventId]
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

  // Exhausted bounded attempts: return safe retryable 503
  return { status: 'RETRY_REQUIRED', retryAfter: 5 };
}

/**
 * Attempts initial claim or reclamation on an isolated client.
 */
export async function attemptInitialClaim({ accountId, environment, eventId, eventType, entityId, orderId, amountMinor, currency = 'INR', claimToken, tableName = 'webhook_events', leaseSeconds = 30 }) {
  const client = await pool.connect();
  let inTransaction = false;
  try {
    await client.query('BEGIN');
    inTransaction = true;

    // Check existing
    const { rows: existing } = await client.query(
      `SELECT status, claim_token, 
              (locked_until > CURRENT_TIMESTAMP) AS is_lease_active,
              GREATEST(1, CEIL(EXTRACT(EPOCH FROM (locked_until - CURRENT_TIMESTAMP))))::int AS retry_after_seconds
       FROM ${tableName} 
       WHERE account_id = $1 AND environment = $2 AND event_id = $3 
       FOR UPDATE`,
      [accountId, environment, eventId]
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

      // Reclaim failed or expired lease
      const newClaimToken = crypto.randomUUID();
      const { rows: reclaimed, rowCount } = await client.query(
        `UPDATE ${tableName}
         SET status = 'processing',
             claim_token = $1,
             locked_until = CURRENT_TIMESTAMP + INTERVAL '${leaseSeconds} seconds',
             attempts = attempts + 1,
             error_message = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE account_id = $2 AND environment = $3 AND event_id = $4
           AND (status = 'failed' OR (status = 'processing' AND locked_until <= CURRENT_TIMESTAMP))
         RETURNING claim_token`,
        [newClaimToken, accountId, environment, eventId]
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

    // Insert new row
    await client.query(
      `INSERT INTO ${tableName} (
         account_id, environment, event_id, event_type, status,
         claim_token, entity_id, order_id, amount_minor, currency,
         attempts, locked_until, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, 'processing', $5, $6, $7, $8, $9, 1, CURRENT_TIMESTAMP + INTERVAL '${leaseSeconds} seconds', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [accountId, environment, eventId, eventType, claimToken, entityId, orderId, amountMinor, currency]
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

/**
 * Primary Claim Entrypoint
 */
export async function claimWebhookEvent(params) {
  const initialClaimToken = crypto.randomUUID();
  try {
    const res = await attemptInitialClaim({ ...params, claimToken: initialClaimToken });
    if (res.status !== 'RETRY_NEEDED') {
      return res;
    }
    return await resolveConcurrentClaim(params);
  } catch (err) {
    if (err.code === '23505') {
      return await resolveConcurrentClaim(params);
    }
    throw err;
  }
}

/**
 * Executes Transaction 2 business mutations with strict claim token fencing and row lock continuity.
 */
export async function executeFencedWebhookMutations({
  accountId,
  environment,
  eventId,
  claimToken,
  mutationFn,
  tableName = 'webhook_events',
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Step 1: Lock row FOR UPDATE and verify claim token and active lease
    const { rows: lockRows } = await client.query(
      `SELECT status, claim_token, (locked_until > CURRENT_TIMESTAMP) AS is_lease_active
       FROM ${tableName} 
       WHERE account_id = $1 AND environment = $2 AND event_id = $3 
       FOR UPDATE`,
      [accountId, environment, eventId]
    );

    if (lockRows.length === 0) {
      await client.query('ROLLBACK');
      return { fencedOut: true, reason: 'CLAIM_ROW_NOT_FOUND' };
    }

    const { status, claim_token: currentToken, is_lease_active } = lockRows[0];

    // FENCE CHECK: Verify status is processing, token matches, and lease is still active
    if (status !== 'processing' || currentToken !== claimToken || !is_lease_active) {
      await client.query('ROLLBACK');
      return { 
        fencedOut: true, 
        reason: status === 'completed' ? 'ALREADY_COMPLETED' : (!is_lease_active ? 'LEASE_EXPIRED' : 'TOKEN_SUPERSEDED') 
      };
    }

    // Step 2: Execute all business mutations using THIS client instance
    await mutationFn(client);

    // Step 3: Complete event using THIS client instance with exact row count assertion
    const { rowCount: completionCount } = await client.query(
      `UPDATE ${tableName} 
       SET status = 'completed',
           locked_until = NULL,
           completed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE account_id = $1 
         AND environment = $2 
         AND event_id = $3 
         AND claim_token = $4 
         AND status = 'processing'`,
      [accountId, environment, eventId, claimToken]
    );

    if (completionCount !== 1) {
      await client.query('ROLLBACK');
      throw new Error(`CRITICAL_FENCING_BREACH: Completion affected ${completionCount} rows instead of 1. Rolled back.`);
    }

    // Step 4: Atomic Commit
    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
