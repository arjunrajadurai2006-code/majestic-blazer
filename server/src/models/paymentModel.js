import crypto from 'node:crypto';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import * as Reservation from './reservationModel.js';

/**
 * Creates a Razorpay payment order.
 * Calculates amount strictly from database records (retail order).
 * Calls Razorpay API if keys configured, or generates a deterministic mock in dev.
 */
export const createRazorpayOrder = async ({
  orderId = null,
  userId = null,
  amount: manualAmount = null,
  receipt: customReceipt = null,
}) => {
  let payableAmount = 0;
  let receipt = customReceipt;
  let targetOrder = null;

  // 1. Resolve payable amount from trusted database records
  if (orderId) {
    const { rows: orderRows } = await pool.query('SELECT * FROM orders WHERE id = $1 LIMIT 1', [orderId]);
    targetOrder = orderRows[0];
    if (!targetOrder) throw new AppError('Order not found', 404);

    if (userId && targetOrder.user_id !== userId) {
      const { rows: userRows } = await pool.query('SELECT role FROM users WHERE id = $1 LIMIT 1', [userId]);
      if (userRows[0]?.role !== 'admin') {
        throw new AppError('You do not have permission to initiate payment for this order', 403);
      }
    }

    if (targetOrder.status === 'confirmed' || targetOrder.status === 'paid') {
      throw new AppError('This order has already been paid and confirmed', 400);
    }

    // Validate that order has a valid unexpired inventory reservation (15-min window)
    const resStatus = await Reservation.checkOrderReservationStatus(orderId);
    if (resStatus.isExpired) {
      throw new AppError('The 15-minute inventory reservation for this order has expired. Please re-order available items.', 400);
    }
    if (resStatus.isReleased) {
      throw new AppError('The inventory reservation for this order was cancelled or released.', 400);
    }

    payableAmount = Number(targetOrder.total);
    receipt = receipt || targetOrder.order_number;
  } else if (manualAmount) {
    if (userId) {
      const { rows: userRows } = await pool.query('SELECT role FROM users WHERE id = $1 LIMIT 1', [userId]);
      if (userRows[0]?.role !== 'admin') {
        throw new AppError('Order ID is required. Custom payment amounts can only be initiated by administrators.', 403);
      }
    } else {
      throw new AppError('Order ID is required to initiate payment.', 400);
    }
    payableAmount = Number(manualAmount);
    receipt = receipt || `rcpt_${Date.now()}`;
  } else {
    throw new AppError('Either orderId or a valid amount is required', 400);
  }

  if (!payableAmount || payableAmount <= 0) {
    throw new AppError('Payable amount must be greater than zero', 400);
  }

  const amountInPaise = Math.round(payableAmount * 100);

  // Check if an existing paid payment already exists for this order
  if (orderId) {
    const { rows: existingPaid } = await pool.query(
      `SELECT * FROM payments 
       WHERE order_id = $1 AND status = 'paid' 
       LIMIT 1`,
      [orderId]
    );
    if (existingPaid.length) {
      throw new AppError('A completed payment already exists for this transaction', 400);
    }
  }

  let razorpayOrder;

  // 2. Official Razorpay API call when credentials exist and not in mock mode
  const useRealRazorpay = Boolean(
    env.razorpay.keyId &&
    env.razorpay.keySecret &&
    (!env.razorpay.mockMode || env.isProd)
  );

  if (useRealRazorpay) {
    try {
      const basicAuth = Buffer.from(`${env.razorpay.keyId}:${env.razorpay.keySecret}`).toString('base64');
      const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          receipt: String(receipt).slice(0, 40),
          notes: {
            orderId: orderId ? String(orderId) : undefined,
            userId: userId ? String(userId) : undefined,
          },
        }),
      });

      if (!rzpRes.ok) {
        const errData = await rzpRes.json().catch(() => ({}));
        throw new AppError(
          `Razorpay order gateway error: ${errData.error?.description || rzpRes.statusText}`,
          rzpRes.status === 401 ? 401 : 502
        );
      }

      razorpayOrder = await rzpRes.json();
    } catch (apiErr) {
      if (apiErr instanceof AppError) throw apiErr;
      throw new AppError(`Failed to reach Razorpay gateway: ${apiErr.message}`, 502);
    }
  } else {
    // 3. Explicit development-only offline mock mode
    if (env.isProd) {
      throw new AppError('Offline payment mock mode is strictly forbidden in production', 500);
    }

    const mockOrderId = `order_mock_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    razorpayOrder = {
      id: mockOrderId,
      entity: 'order',
      amount: amountInPaise,
      currency: 'INR',
      receipt: String(receipt).slice(0, 40),
      status: 'created',
      mock: true,
      createdAt: Math.floor(Date.now() / 1000),
    };
  }

  // Record payment in database in 'created' state
  const { rows: paymentRows } = await pool.query(
    `INSERT INTO payments (
      order_id, user_id, provider, provider_order_id,
      amount, currency, status
    ) VALUES ($1, $2, $3, $4, $5, 'INR', 'created')
    RETURNING *`,
    [
      orderId || null,
      userId || null,
      razorpayOrder.mock ? 'manual' : 'razorpay',
      razorpayOrder.id,
      payableAmount,
    ]
  );

  return {
    ...razorpayOrder,
    paymentRecordId: paymentRows[0]?.id,
    key: env.razorpay.keyId || 'rzp_test_mock_key',
    keyId: env.razorpay.keyId || 'rzp_test_mock_key',
    mock: Boolean(razorpayOrder.mock),
    mockMode: env.razorpay.mockMode,
  };
};

/**
 * Verifies Razorpay HMAC SHA-256 signature using timing-safe cryptographic comparison.
 */
export const verifyRazorpaySignature = ({ orderId, paymentId, signature }) => {
  if (!orderId || !paymentId || !signature) return false;

  // In production, mock signatures are strictly rejected
  if (env.isProd) {
    if (!env.razorpay.keySecret) return false;
    try {
      const hmac = crypto.createHmac('sha256', env.razorpay.keySecret);
      hmac.update(`${orderId}|${paymentId}`);
      const expected = hmac.digest('hex');
      if (expected.length !== signature.length) return false;
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  // In development / test mode with live secret configured
  if (env.razorpay.keySecret && !env.razorpay.mockMode) {
    try {
      const hmac = crypto.createHmac('sha256', env.razorpay.keySecret);
      hmac.update(`${orderId}|${paymentId}`);
      const expected = hmac.digest('hex');
      if (expected.length !== signature.length) return false;
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  // Offline mock mode evaluation
  if (env.razorpay.mockMode) {
    // Explicit deterministic mock test failure signature
    if (signature === 'mock_sig_fail' || signature.includes('fail')) {
      return false;
    }

    if (signature === 'simulated_signature_secure' || signature.startsWith('mock_sig_')) {
      return true;
    }

    // Also support valid HMAC if test secret is supplied in mock mode
    if (env.razorpay.keySecret) {
      try {
        const hmac = crypto.createHmac('sha256', env.razorpay.keySecret);
        hmac.update(`${orderId}|${paymentId}`);
        const expected = hmac.digest('hex');
        if (expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
          return true;
        }
      } catch {}
    }
  }

  return false;
};

/**
 * Verifies Razorpay Webhook HMAC SHA-256 signature using timing-safe comparison.
 */
export const verifyWebhookSignature = (rawBody, signature, secret) => {
  if (!secret || !signature || !rawBody) return false;
  try {
    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
    const expected = crypto.createHmac('sha256', secret).update(bodyBuffer).digest('hex');
    if (expected.length !== signature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
};

/**
 * Records payment completion and transitions order status to 'confirmed'.
 * Strictly idempotent: repeated verification returns existing payment without duplicating.
 */
/**
 * Records payment completion and transitions order status to 'confirmed'.
 * Strictly idempotent with transactional order locking.
 * Safely handles race conditions with customer cancellation.
 */
export const recordPayment = async ({
  orderId = null,
  userId = null,
  provider = 'razorpay',
  providerOrderId = null,
  providerPaymentId = null,
  providerSignature = null,
  amount: providedAmount = null,
  currency = 'INR',
  status = 'paid',
  actorId = null,
  actorRole = 'system',
  reqIp = null,
}) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Check if payment with this provider_payment_id already exists
    if (providerPaymentId) {
      const { rows: existing } = await client.query(
        'SELECT * FROM payments WHERE provider_payment_id = $1 LIMIT 1',
        [providerPaymentId]
      );
      if (existing.length) {
        await client.query('COMMIT');
        return existing[0];
      }
    }

    // 2. Resolve target order with row-level lock
    let targetOrderId = orderId;
    if (!targetOrderId && providerOrderId) {
      const { rows: existingCreated } = await client.query(
        'SELECT order_id FROM payments WHERE provider_order_id = $1 LIMIT 1',
        [providerOrderId]
      );
      if (existingCreated.length && existingCreated[0].order_id) {
        targetOrderId = existingCreated[0].order_id;
      }
    }

    let targetOrder = null;
    if (targetOrderId) {
      const { rows: oRows } = await client.query(
        'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
        [targetOrderId]
      );
      if (oRows.length) {
        targetOrder = oRows[0];
        userId = userId || targetOrder.user_id;
      }
    }

    // 3. Idempotency: Check if a payment for this order is already recorded
    if (targetOrderId) {
      // If a paid payment already exists, return it immediately
      const { rows: existingForTarget } = await client.query(
        `SELECT * FROM payments 
         WHERE order_id = $1 AND status = 'paid' 
         ORDER BY id DESC LIMIT 1`,
        [targetOrderId]
      );
      if (existingForTarget.length) {
        await client.query('COMMIT');
        return existingForTarget[0];
      }

      // If this is a COD verification call and a COD payment already exists, return it
      if (provider === 'cod') {
        const { rows: existingCod } = await client.query(
          `SELECT * FROM payments 
           WHERE order_id = $1 AND provider = 'cod' 
           ORDER BY id DESC LIMIT 1`,
          [targetOrderId]
        );
        if (existingCod.length) {
          await client.query('COMMIT');
          return existingCod[0];
        }
      }
    }

    // 4. Resolve true amount from target order if not provided
    let amount = providedAmount;
    if (targetOrder && (amount === null || amount === undefined)) {
      amount = Number(targetOrder.total);
    }

    // 5. Check if an existing 'created' payment record exists to update
    let updatedPayment = null;
    if (providerOrderId) {
      const { rows: createdRows } = await client.query(
        `UPDATE payments SET
          provider_payment_id = COALESCE($1, provider_payment_id),
          provider_signature = COALESCE($2, provider_signature),
          status = $3,
          provider = $4
         WHERE provider_order_id = $5 AND status = 'created'
         RETURNING *`,
        [providerPaymentId, providerSignature, status, provider, providerOrderId]
      );
      if (createdRows.length) {
        updatedPayment = createdRows[0];
      }
    }

    // 6. If not updated from 'created', insert new record
    if (!updatedPayment) {
      const { rows: insertedRows } = await client.query(
        `INSERT INTO payments (
          order_id, user_id, provider, provider_order_id,
          provider_payment_id, provider_signature, amount, currency, status, refund_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)
        RETURNING *`,
        [
          targetOrderId,
          userId,
          provider,
          providerOrderId,
          providerPaymentId,
          providerSignature,
          amount,
          currency,
          status,
        ]
      );
      updatedPayment = insertedRows[0];
    }

    // 7. Order status and inventory synchronization
    if (targetOrder) {
      if (targetOrder.status === 'cancelled') {
        // Race condition: Order was already cancelled by customer or admin!
        // Do NOT reopen the order and do NOT convert reservations.
        // Mark payment as requiring refund.
        await client.query(
          `UPDATE payments SET refund_status = 'pending' WHERE id = $1`,
          [updatedPayment.id]
        );
        updatedPayment.refund_status = 'pending';

        await client.query(
          `INSERT INTO audit_logs (
            user_id, action, entity_type, entity_id, details, ip_address, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
          [
            actorId || userId,
            'PAYMENT_ON_CANCELLED_ORDER',
            'payments',
            String(updatedPayment.id),
            JSON.stringify({
              orderId: targetOrder.id,
              orderNumber: targetOrder.order_number,
              providerPaymentId,
              amount,
              warning: 'Payment verified after order cancellation. Refund marked pending.',
            }),
            reqIp || null,
          ]
        );
      } else if ((status === 'paid' || provider === 'cod') && targetOrder.status === 'pending') {
        // Convert reservations to completed stock deductions
        await Reservation.confirmReservationsForOrder(targetOrder.id, updatedPayment.id, client);

        // Update order status to 'confirmed'
        await client.query(
          "UPDATE orders SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
          [targetOrder.id]
        );

        // Record atomic audit log
        await client.query(
          `INSERT INTO audit_logs (
            user_id, action, entity_type, entity_id, details, ip_address, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
          [
            actorId || userId,
            'ORDER_STATUS_UPDATE',
            'orders',
            String(targetOrder.id),
            JSON.stringify({
              orderId: targetOrder.id,
              orderNumber: targetOrder.order_number,
              previousStatus: 'pending',
              newStatus: 'confirmed',
              actionSource: provider === 'cod' ? 'checkout_cod' : 'payment_gateway',
              provider,
              providerPaymentId,
              amount,
              paymentStatus: status,
            }),
            reqIp || null,
          ]
        );
      } else if (status === 'failed') {
        // Release active reservations
        await Reservation.releaseReservationsForOrder(targetOrder.id, 'released', client);

        await client.query(
          `INSERT INTO audit_logs (
            user_id, action, entity_type, entity_id, details, ip_address, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
          [
            actorId || userId,
            'PAYMENT_FAILED',
            'payments',
            String(updatedPayment.id),
            JSON.stringify({
              orderId: targetOrder.id,
              providerOrderId,
              providerPaymentId,
            }),
            reqIp || null,
          ]
        );
      }
    }

    await client.query('COMMIT');
    return updatedPayment;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const listAll = async ({ page = 1, limit = 20 }) => {
  const offset = (Number(page) - 1) * Number(limit);
  const countRes = await pool.query('SELECT COUNT(*) AS total FROM payments');
  const total = Number(countRes.rows[0]?.total || 0);

  const { rows: items } = await pool.query(
    `SELECT p.*, u.full_name AS customer_name, u.email AS customer_email,
       o.order_number
     FROM payments p
     LEFT JOIN users u ON u.id = p.user_id
     LEFT JOIN orders o ON o.id = p.order_id
     ORDER BY p.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return { items, total };
};

/**
 * Hardened Refund Recording with Gateway Status Safeguards.
 * - Without gateway confirmation: marks refund_status = 'pending', preserves status = 'paid'.
 * - With gateway confirmation: marks status = 'refunded', refund_status = 'processed'.
 * - On failure: marks refund_status = 'failed'.
 * - Atomically inserts audit log entry.
 */
export const recordRefund = async (
  id,
  {
    refundAmount,
    refundStatus = null,
    isGatewayConfirmed = false,
    actorId = null,
    actorRole = 'admin',
    reqIp = null,
    reason = null,
  } = {}
) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const isNumeric = /^\d+$/.test(String(id || '').trim());
    const where = isNumeric ? 'WHERE id = $1' : 'WHERE provider_payment_id = $1';
    const param = isNumeric ? parseInt(id, 10) : String(id || '').trim();

    const { rows: existing } = await client.query(
      `SELECT * FROM payments ${where} FOR UPDATE`,
      [param]
    );

    if (!existing.length) {
      throw new AppError('Payment transaction not found', 404);
    }

    const payment = existing[0];

    // Status validation: payment must have been successful
    if (payment.status !== 'paid' && payment.status !== 'refunded') {
      throw new AppError(
        `Cannot refund payment in "${payment.status}" status. Only confirmed paid transactions can be refunded.`,
        400
      );
    }

    // Amount validation
    const parsedAmount = refundAmount !== undefined && refundAmount !== null
      ? Number(refundAmount)
      : Number(payment.amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new AppError('Refund amount must be a positive number greater than zero', 400);
    }

    const paymentTotal = Number(payment.amount);
    if (parsedAmount > paymentTotal) {
      throw new AppError(
        `Refund amount (₹${parsedAmount}) exceeds maximum transaction total (₹${paymentTotal})`,
        400
      );
    }

    // Determine target statuses based on gateway confirmation
    let targetPaymentStatus = payment.status;
    let targetRefundStatus = refundStatus;

    if (refundStatus === 'failed') {
      targetRefundStatus = 'failed';
    } else if (isGatewayConfirmed) {
      targetPaymentStatus = 'refunded';
      targetRefundStatus = refundStatus || 'processed';
    } else {
      // Gateway confirmation is unavailable (test mode / manual admin initiation)
      // Represent refund accurately as pending rather than falsely claiming completed
      targetRefundStatus = 'pending';
    }

    // Idempotency: If payment already matches target payment and refund statuses, return existing record without duplicate audit log
    if (
      payment.status === targetPaymentStatus &&
      payment.refund_status === targetRefundStatus &&
      Number(payment.refund_amount) === parsedAmount
    ) {
      await client.query('COMMIT');
      return payment;
    }

    const { rows: updated } = await client.query(
      `UPDATE payments SET
        refund_amount = $1,
        refund_status = $2,
        status = $3
       WHERE id = $4
       RETURNING *`,
      [parsedAmount, targetRefundStatus, targetPaymentStatus, payment.id]
    );

    const auditAction = isGatewayConfirmed
      ? 'REFUND_PROCESSED'
      : (targetRefundStatus === 'failed' ? 'REFUND_FAILED' : 'REFUND_REQUESTED');

    await client.query(
      `INSERT INTO audit_logs (
        user_id, action, entity_type, entity_id, details, ip_address, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [
        actorId,
        auditAction,
        'payments',
        String(payment.id),
        JSON.stringify({
          paymentId: payment.id,
          orderId: payment.order_id,
          previousPaymentStatus: payment.status,
          newPaymentStatus: targetPaymentStatus,
          previousRefundStatus: payment.refund_status,
          newRefundStatus: targetRefundStatus,
          refundAmount: parsedAmount,
          isGatewayConfirmed,
          reason: reason || null,
          actorId,
          actorRole,
        }),
        reqIp || null,
      ]
    );

    await client.query('COMMIT');
    return updated[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Confirms physical cash collection for a Cash on Delivery (COD) order.
 * - Enforces row-level locking (FOR UPDATE)
 * - Transitions status from 'created' to 'paid'
 * - Strictly idempotent: duplicate calls return existing paid payment without duplicate logs
 * - Writes atomic audit log entry
 */
export const confirmCodPayment = async ({
  paymentId = null,
  orderId = null,
  actorId = null,
  actorRole = 'admin',
  reqIp = null,
} = {}) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let payment = null;
    if (paymentId) {
      const isNumeric = /^\d+$/.test(String(paymentId).trim());
      const where = isNumeric ? 'WHERE id = $1' : 'WHERE provider_payment_id = $1';
      const param = isNumeric ? parseInt(paymentId, 10) : String(paymentId).trim();
      const { rows } = await client.query(`SELECT * FROM payments ${where} FOR UPDATE`, [param]);
      payment = rows[0];
    } else if (orderId) {
      const { rows } = await client.query(
        "SELECT * FROM payments WHERE order_id = $1 AND provider = 'cod' ORDER BY id DESC LIMIT 1 FOR UPDATE",
        [orderId]
      );
      payment = rows[0];
    }

    if (!payment) {
      throw new AppError('COD payment transaction not found', 404);
    }

    if (payment.provider !== 'cod') {
      throw new AppError('Only Cash on Delivery transactions can have collection confirmed', 400);
    }

    // Idempotency: If already marked as paid, return existing payment without duplicating
    if (payment.status === 'paid') {
      await client.query('COMMIT');
      return payment;
    }

    if (payment.status !== 'created') {
      throw new AppError(`Cannot collect COD payment in "${payment.status}" status`, 400);
    }

    const { rows: updated } = await client.query(
      "UPDATE payments SET status = 'paid' WHERE id = $1 RETURNING *",
      [payment.id]
    );

    await client.query(
      `INSERT INTO audit_logs (
        user_id, action, entity_type, entity_id, details, ip_address, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [
        actorId,
        'COD_PAYMENT_COLLECTED',
        'payments',
        String(payment.id),
        JSON.stringify({
          paymentId: payment.id,
          orderId: payment.order_id,
          previousStatus: 'created',
          newStatus: 'paid',
          amount: Number(payment.amount),
          actorId,
          actorRole,
        }),
        reqIp || null,
      ]
    );

    await client.query('COMMIT');
    return updated[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
