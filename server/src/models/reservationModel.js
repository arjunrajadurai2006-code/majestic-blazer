import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

/**
 * Initializes the inventory_reservations schema and indexes if they do not exist.
 */
export const initReservationSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_reservations (
      id SERIAL PRIMARY KEY,
      reservation_code VARCHAR(60) NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      order_id INTEGER NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'released', 'expired')),
      payment_id INTEGER NULL REFERENCES payments(id) ON DELETE SET NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_inv_res_variant_active ON inventory_reservations (variant_id, status, expires_at);
    CREATE INDEX IF NOT EXISTS idx_inv_res_order ON inventory_reservations (order_id);
    CREATE INDEX IF NOT EXISTS idx_inv_res_user ON inventory_reservations (user_id);
  `);
};

/**
 * Calculates current available purchase stock for a variant (physical stock minus active reservations).
 */
export const getAvailableStock = async (variantId, clientOrPool = pool) => {
  const { rows } = await clientOrPool.query(
    `SELECT GREATEST(0, pv.stock_quantity - COALESCE((
      SELECT SUM(ir.quantity)
      FROM inventory_reservations ir
      WHERE ir.variant_id = pv.id
        AND ir.status = 'active'
        AND ir.expires_at > NOW()
    ), 0)) AS available_stock,
    pv.stock_quantity AS total_stock
    FROM product_variants pv
    WHERE pv.id = $1 LIMIT 1`,
    [variantId]
  );
  if (!rows.length) return 0;
  return Number(rows[0].available_stock);
};

/**
 * Reserves inventory for an order within an ongoing database transaction.
 * Uses row-level locks (FOR UPDATE) to prevent overselling under concurrent requests.
 * 
 * @param {Object} params
 * @param {number} params.userId - Authenticated customer ID
 * @param {number} params.orderId - Associated pending order ID
 * @param {Array<{variantId: number, quantity: number, productId: number, productName?: string, size?: string}>} params.items
 * @param {number} [params.expiryMinutes=15] - Reservation expiry duration (default 15 mins)
 * @param {Object} client - PostgreSQL transaction client
 */
export const reserveInventory = async ({ userId, orderId, items, expiryMinutes = 15 }, client) => {
  if (!items || !items.length) {
    throw new AppError('Cannot reserve empty inventory items', 400);
  }

  const reservations = [];

  for (const item of items) {
    // 1. Lock the variant row to serialize concurrent checks
    const { rows: vRows } = await client.query(
      `SELECT pv.*, p.name AS product_name, p.is_purchasable, p.is_active
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       WHERE pv.id = $1 FOR UPDATE`,
      [item.variantId]
    );

    const variant = vRows[0];
    if (!variant || !variant.is_active || !variant.is_purchasable) {
      throw new AppError(`Item "${item.productName || 'product'}" is not available for purchase`, 400);
    }

    // 2. Calculate currently active (unexpired) reservations for this variant
    const { rows: rRows } = await client.query(
      `SELECT COALESCE(SUM(quantity), 0) AS reserved_quantity
       FROM inventory_reservations
       WHERE variant_id = $1
         AND status = 'active'
         AND expires_at > NOW()`,
      [item.variantId]
    );

    const activeReserved = Number(rRows[0]?.reserved_quantity || 0);
    const availableStock = variant.stock_quantity - activeReserved;

    if (availableStock < item.quantity) {
      throw new AppError(
        `Insufficient available stock for "${variant.product_name}" (Size: ${variant.size}). Available: ${Math.max(0, availableStock)}, Requested: ${item.quantity}`,
        400
      );
    }

    // 3. Insert reservation record with 15-minute expiry
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const reservationCode = `RES-${Date.now().toString().slice(-6)}-${item.variantId}-${randomSuffix}`;

    const { rows: resRows } = await client.query(
      `INSERT INTO inventory_reservations (
        reservation_code, user_id, order_id, product_id, variant_id,
        quantity, status, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW() + ($7 || ' minutes')::INTERVAL)
      RETURNING *`,
      [
        reservationCode,
        userId,
        orderId,
        variant.product_id,
        variant.id,
        item.quantity,
        expiryMinutes,
      ]
    );

    reservations.push(resRows[0]);
  }

  return reservations;
};

/**
 * Converts active reservations for an order into permanent stock decrements.
 * Strictly idempotent: already completed reservations are ignored.
 * Rejects stale/expired reservations if stock is no longer available.
 */
export const confirmReservationsForOrder = async (orderId, paymentId = null, clientOrPool = pool) => {
  const isDirectClient = Boolean(clientOrPool.release);
  const client = isDirectClient ? clientOrPool : await pool.connect();

  try {
    if (!isDirectClient) await client.query('BEGIN');

    // 1. Fetch active reservations for this order with row locks
    const { rows: activeReservations } = await client.query(
      `SELECT * FROM inventory_reservations
       WHERE order_id = $1 AND status = 'active'
       FOR UPDATE`,
      [orderId]
    );

    // If no active reservations, check other statuses
    if (!activeReservations.length) {
      // A. Check if already completed (idempotent duplicate call)
      const { rows: completedRows } = await client.query(
        `SELECT * FROM inventory_reservations WHERE order_id = $1 AND status = 'completed'`,
        [orderId]
      );
      if (completedRows.length) {
        if (!isDirectClient) await client.query('COMMIT');
        return { success: true, count: completedRows.length, alreadyCompleted: true };
      }

      // B. Check if already marked expired
      const { rows: expiredRows } = await client.query(
        `SELECT * FROM inventory_reservations WHERE order_id = $1 AND status = 'expired'`,
        [orderId]
      );
      if (expiredRows.length) {
        throw new AppError('The inventory reservation for this order has expired. Payment cannot be completed with a stale session.', 400);
      }

      // C. Check if released
      const { rows: releasedRows } = await client.query(
        `SELECT * FROM inventory_reservations WHERE order_id = $1 AND status = 'released'`,
        [orderId]
      );
      if (releasedRows.length) {
        throw new AppError('The inventory reservation for this order was cancelled or released.', 400);
      }

      // If no reservation rows at all exist (e.g. legacy test orders without reservations)
      if (!isDirectClient) await client.query('COMMIT');
      return { success: true, count: 0, alreadyCompleted: false };
    }

    // 2. Validate expiration timestamp on active reservations
    const now = new Date();
    for (const res of activeReservations) {
      if (new Date(res.expires_at) <= now) {
        // Expired reservation attempted via stale session!
        // Lock variant to check if current available stock can still satisfy it
        const { rows: vRows } = await client.query(
          `SELECT stock_quantity FROM product_variants WHERE id = $1 FOR UPDATE`,
          [res.variant_id]
        );
        const currentStock = Number(vRows[0]?.stock_quantity || 0);

        const { rows: otherRes } = await client.query(
          `SELECT COALESCE(SUM(quantity), 0) AS other_reserved
           FROM inventory_reservations
           WHERE variant_id = $1
             AND status = 'active'
             AND expires_at > NOW()
             AND order_id != $2`,
          [res.variant_id, orderId]
        );
        const otherReserved = Number(otherRes[0]?.other_reserved || 0);
        const available = currentStock - otherReserved;

        if (available < res.quantity) {
          // Mark as expired
          await client.query(
            `UPDATE inventory_reservations SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [res.id]
          );
          throw new AppError(
            'Inventory reservation expired and item is no longer available in stock. Payment cannot be confirmed.',
            400
          );
        }
      }
    }

    // 3. Decrement physical stock exactly once and mark reservation completed
    for (const res of activeReservations) {
      await client.query(
        `UPDATE product_variants
         SET stock_quantity = GREATEST(0, stock_quantity - $1)
         WHERE id = $2`,
        [res.quantity, res.variant_id]
      );

      await client.query(
        `UPDATE inventory_reservations
         SET status = 'completed',
             payment_id = COALESCE($1, payment_id),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [paymentId, res.id]
      );
    }

    if (!isDirectClient) await client.query('COMMIT');
    return { success: true, count: activeReservations.length, alreadyCompleted: false };
  } catch (err) {
    if (!isDirectClient) await client.query('ROLLBACK');
    throw err;
  } finally {
    if (!isDirectClient) client.release();
  }
};

/**
 * Releases active reservations for an order (e.g. upon payment failure, definitive cancellation, or expiry).
 * Strictly idempotent.
 */
export const releaseReservationsForOrder = async (orderId, targetStatus = 'released', clientOrPool = pool) => {
  const { rows } = await clientOrPool.query(
    `UPDATE inventory_reservations
     SET status = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE order_id = $2 AND status = 'active'
     RETURNING id, variant_id, quantity`,
    [targetStatus, orderId]
  );
  return rows;
};

/**
 * Background / on-demand cleaner: Marks all expired active reservations as 'expired'.
 * Safe for concurrent executions across multiple worker instances.
 */
export const cleanupExpiredReservations = async (clientOrPool = pool) => {
  const { rows } = await clientOrPool.query(
    `UPDATE inventory_reservations
     SET status = 'expired',
         updated_at = CURRENT_TIMESTAMP
     WHERE status = 'active' AND expires_at <= NOW()
     RETURNING id, order_id, variant_id, quantity`
  );
  return rows;
};

/**
 * Validates whether an order still holds an active, unexpired reservation.
 */
export const checkOrderReservationStatus = async (orderId, clientOrPool = pool) => {
  const { rows } = await clientOrPool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'active' AND expires_at > NOW()) AS active_valid_count,
       COUNT(*) FILTER (WHERE status = 'expired' OR (status = 'active' AND expires_at <= NOW())) AS expired_count,
       COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
       COUNT(*) FILTER (WHERE status = 'released') AS released_count,
       MIN(expires_at) AS earliest_expiry
     FROM inventory_reservations
     WHERE order_id = $1`,
    [orderId]
  );

  const stats = rows[0] || {};
  const activeValid = Number(stats.active_valid_count || 0);
  const expired = Number(stats.expired_count || 0);
  const completed = Number(stats.completed_count || 0);
  const released = Number(stats.released_count || 0);

  return {
    isValid: activeValid > 0,
    isCompleted: completed > 0,
    isExpired: expired > 0 && activeValid === 0 && completed === 0,
    isReleased: released > 0 && activeValid === 0 && completed === 0,
    earliestExpiry: stats.earliest_expiry,
  };
};
