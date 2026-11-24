import crypto from 'node:crypto';
import { pool } from '../config/db.js';

/**
 * Initializes the auth_handoff_codes table and indexes if they do not exist.
 *
 * @param {import('pg').Pool|import('pg').PoolClient} [clientOrPool=pool]
 */
export const initHandoffSchema = async (clientOrPool = pool) => {
  await clientOrPool.query(`
    CREATE TABLE IF NOT EXISTS auth_handoff_codes (
      id BIGSERIAL PRIMARY KEY,
      code_hash VARCHAR(64) NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_role VARCHAR(20) NOT NULL,
      target_app VARCHAR(20) NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      consumed_at TIMESTAMP WITH TIME ZONE NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT uq_auth_handoff_codes_hash
        UNIQUE (code_hash),

      CONSTRAINT chk_auth_handoff_codes_user_role
        CHECK (user_role IN ('admin', 'customer')),

      CONSTRAINT chk_auth_handoff_codes_target_app
        CHECK (target_app IN ('admin', 'customer')),

      CONSTRAINT chk_auth_handoff_codes_role_isolation
        CHECK (target_app != 'admin' OR user_role = 'admin')
    );

    CREATE INDEX IF NOT EXISTS idx_auth_handoff_codes_active
      ON auth_handoff_codes (code_hash)
      WHERE consumed_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_auth_handoff_codes_expires
      ON auth_handoff_codes (expires_at)
      WHERE consumed_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_auth_handoff_codes_user
      ON auth_handoff_codes (user_id);
  `);
};

/**
 * Hashes a plaintext handoff code using SHA-256.
 * Database stores ONLY this one-way hash, never the plaintext code.
 *
 * @param {string} code
 * @returns {string} 64-character lowercase hex string
 */
export const hashHandoffCode = (code) => {
  return crypto.createHash('sha256').update(code).digest('hex');
};

/**
 * Generates a cryptographically secure 256-bit handoff code,
 * computes its SHA-256 hash, and persists the hash to PostgreSQL.
 *
 * @param {Object} params
 * @param {number|string} params.userId
 * @param {string} params.userRole - 'admin' | 'customer'
 * @param {string} params.targetApp - 'admin' | 'customer'
 * @param {number} [params.ttlSeconds=60] - Expiry TTL in seconds (default: 60s)
 * @param {import('pg').Pool|import('pg').PoolClient} [params.clientOrPool=pool]
 * @returns {Promise<{ code: string, targetApp: string, expiresAt: number }>}
 */
export const createHandoffCode = async ({
  userId,
  userRole,
  targetApp,
  ttlSeconds = 60,
  clientOrPool = pool,
}) => {
  if (!userId) {
    throw new Error('userId is required to generate handoff code');
  }
  if (!userRole) {
    throw new Error('userRole is required to generate handoff code');
  }
  if (!targetApp || !['admin', 'customer'].includes(targetApp)) {
    throw new Error('targetApp must be either "admin" or "customer"');
  }

  // Strict role isolation: customer tokens must never be granted an admin handoff code
  if (targetApp === 'admin' && userRole !== 'admin') {
    const error = new Error('Customer accounts cannot generate administrator handoff codes');
    error.statusCode = 403;
    throw error;
  }

  // Generate 256-bit cryptographically secure random plaintext code
  const code = crypto.randomBytes(32).toString('hex');

  // Compute SHA-256 digest
  const codeHash = hashHandoffCode(code);

  const expiresAt = new Date(Date.now() + (ttlSeconds * 1000));

  await clientOrPool.query(
    `INSERT INTO auth_handoff_codes (
      code_hash,
      user_id,
      user_role,
      target_app,
      expires_at
    ) VALUES ($1, $2, $3, $4, $5)`,
    [codeHash, userId, userRole, targetApp, expiresAt]
  );

  return {
    code,
    targetApp,
    expiresAt: expiresAt.getTime(),
  };
};

/**
 * Atomically validates and consumes a single-use handoff code inside a PostgreSQL transaction.
 *
 * Uses row-level locking (SELECT ... FOR UPDATE) to guarantee atomic single-use
 * across multiple concurrent requests, backend instances, or cluster nodes.
 *
 * @param {Object} params
 * @param {string} params.code - Plaintext handoff code presented by client
 * @param {string} params.targetApp - 'admin' | 'customer' (audience verifying the code)
 * @param {import('pg').Pool} [params.poolInstance=pool]
 * @returns {Promise<{ success: boolean, data?: { userId: number, userRole: string, targetApp: string }, error?: string, statusCode?: number }>}
 */
export const exchangeHandoffCode = async ({
  code,
  targetApp,
  poolInstance = pool,
}) => {
  if (!code || typeof code !== 'string') {
    return { success: false, error: 'Handoff code is required', statusCode: 400 };
  }
  if (!targetApp || !['admin', 'customer'].includes(targetApp)) {
    return { success: false, error: 'Valid targetApp ("admin" or "customer") is required', statusCode: 400 };
  }

  const codeHash = hashHandoffCode(code);

  const client = await poolInstance.connect();

  try {
    await client.query('BEGIN');

    // 1. Lock the row exclusively FOR UPDATE to prevent race conditions across concurrent workers/nodes
    const { rows } = await client.query(
      `SELECT id, user_id, user_role, target_app, expires_at, consumed_at
       FROM auth_handoff_codes
       WHERE code_hash = $1
       FOR UPDATE`,
      [codeHash]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Invalid or unrecognized handoff code', statusCode: 401 };
    }

    const row = rows[0];

    // 2. Atomic check: has code already been consumed?
    if (row.consumed_at !== null) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Handoff code has already been used', statusCode: 401 };
    }

    // 3. Expiration check: has the code expired?
    const now = new Date();
    if (new Date(row.expires_at) <= now) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Handoff code has expired', statusCode: 401 };
    }

    // 4. Audience binding check: was this code issued for the requesting target app?
    if (row.target_app !== targetApp) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: `Handoff code audience mismatch: issued for "${row.target_app}", attempted by "${targetApp}"`,
        statusCode: 403,
      };
    }

    // 5. Role isolation check: admin target requires admin role
    if (targetApp === 'admin' && row.user_role !== 'admin') {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: 'Customer credentials cannot be exchanged for administrator access',
        statusCode: 403,
      };
    }

    // 6. Atomically mark as consumed
    await client.query(
      `UPDATE auth_handoff_codes
       SET consumed_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [row.id]
    );

    await client.query('COMMIT');

    return {
      success: true,
      data: {
        userId: row.user_id,
        userRole: row.user_role,
        targetApp: row.target_app,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Periodically purges consumed or expired codes older than retention threshold (default: 24h).
 *
 * @param {number} [retentionHours=24]
 * @param {import('pg').Pool|import('pg').PoolClient} [clientOrPool=pool]
 * @returns {Promise<number>} Number of purged records
 */
export const purgeExpiredHandoffCodes = async (retentionHours = 24, clientOrPool = pool) => {
  const result = await clientOrPool.query(
    `DELETE FROM auth_handoff_codes
     WHERE (consumed_at IS NOT NULL AND consumed_at < NOW() - INTERVAL '1 hour' * $1)
        OR (consumed_at IS NULL AND expires_at < NOW() - INTERVAL '1 hour' * $1)`,
    [retentionHours]
  );
  return result.rowCount;
};
