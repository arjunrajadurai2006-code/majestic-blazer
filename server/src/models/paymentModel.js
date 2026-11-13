import crypto from 'node:crypto';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export const createRazorpayOrder = async ({ amount, currency = 'INR', receipt }) => {
  // If Razorpay API keys are configured, could call Razorpay client.orders.create
  // Returns formatted order payload
  const orderId = `order_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
  return {
    id: orderId,
    entity: 'order',
    amount: Math.round(Number(amount) * 100), // in paise
    currency,
    receipt: receipt || `rcpt_${Date.now()}`,
    status: 'created',
  };
};

export const verifyRazorpaySignature = ({ orderId, paymentId, signature }) => {
  if (!env.razorpay.keySecret) {
    // Development fallback when API keys have not been filled in
    return true;
  }
  try {
    const hmac = crypto.createHmac('sha256', env.razorpay.keySecret);
    hmac.update(`${orderId}|${paymentId}`);
    const expectedSignature = hmac.digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
  } catch {
    return false;
  }
};

export const verifyWebhookSignature = (rawBody, signature, secret) => {
  if (!secret || !signature) return false;
  try {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
};

export const recordPayment = async ({
  orderId = null,
  rentalBookingId = null,
  userId = null,
  provider = 'razorpay',
  providerOrderId = null,
  providerPaymentId = null,
  providerSignature = null,
  amount,
  currency = 'INR',
  status = 'paid',
}) => {
  // Prevent duplicate payment records if providerPaymentId exists
  if (providerPaymentId) {
    const { rows: existing } = await pool.query(
      'SELECT * FROM payments WHERE provider_payment_id = $1 LIMIT 1',
      [providerPaymentId]
    );
    if (existing.length) {
      return existing[0];
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO payments (
      order_id, rental_booking_id, user_id, provider, provider_order_id,
      provider_payment_id, provider_signature, amount, currency, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      orderId,
      rentalBookingId,
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

  // If order paid, update order status to confirmed
  if (orderId && status === 'paid') {
    await pool.query("UPDATE orders SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [orderId]);
  }
  // If rental paid, update rental status to confirmed
  if (rentalBookingId && status === 'paid') {
    await pool.query("UPDATE rental_bookings SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [rentalBookingId]);
  }

  return rows[0];
};

export const listAll = async ({ page = 1, limit = 20 }) => {
  const offset = (Number(page) - 1) * Number(limit);
  const countRes = await pool.query('SELECT COUNT(*) AS total FROM payments');
  const total = Number(countRes.rows[0]?.total || 0);

  const { rows: items } = await pool.query(
    `SELECT p.*, u.full_name AS customer_name, u.email AS customer_email,
       o.order_number, rb.booking_number
     FROM payments p
     LEFT JOIN users u ON u.id = p.user_id
     LEFT JOIN orders o ON o.id = p.order_id
     LEFT JOIN rental_bookings rb ON rb.id = p.rental_booking_id
     ORDER BY p.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return { items, total };
};

export const recordRefund = async (id, { refundAmount, refundStatus = 'refunded' }) => {
  const { rows } = await pool.query(
    `UPDATE payments SET
      refund_amount = $1,
      refund_status = $2,
      status = 'refunded'
     WHERE id = $3
     RETURNING *`,
    [Number(refundAmount), refundStatus, id]
  );
  return rows[0] || null;
};
