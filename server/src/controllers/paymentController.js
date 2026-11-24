import * as Payment from '../models/paymentModel.js';
import * as Reservation from '../models/reservationModel.js';
import { env } from '../config/env.js';
import { pool } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

/**
 * Returns public payment configuration for client checkout.
 * Never exposes keySecret or webhookSecret.
 */
export const getPaymentConfig = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      keyId: env.razorpay.keyId || (env.razorpay.mockMode ? 'rzp_test_mock_mode' : ''),
      mockMode: env.razorpay.mockMode,
      currency: 'INR',
    },
  });
});

/**
 * Creates a Razorpay payment order for an existing order.
 * Amount is derived strictly from trusted database records.
 */
export const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { orderId, amount, receipt } = req.body;
  const userId = req.user?.id || null;

  const order = await Payment.createRazorpayOrder({
    orderId: orderId ? Number(orderId) : null,
    userId,
    amount,
    receipt,
  });

  // Fetch customer prefill details if available
  let customerPrefill = { name: '', email: '', phone: '' };
  if (userId) {
    const { rows } = await pool.query('SELECT full_name, email, phone FROM users WHERE id = $1 LIMIT 1', [userId]);
    if (rows.length) {
      customerPrefill = {
        name: rows[0].full_name || '',
        email: rows[0].email || '',
        phone: rows[0].phone || '',
      };
    }
  }

  res.json({
    success: true,
    data: {
      ...order,
      customer: customerPrefill,
    },
  });
});

/**
 * Verifies Razorpay HMAC SHA-256 payment signature and confirms retail order.
 */
export const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const {
    orderId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    provider: requestedProvider,
  } = req.body;

  // 1. Ownership check: Ensure authenticated user owns target order
  const userId = req.user?.id || null;
  const isAdmin = req.user?.role === 'admin';

  if (orderId) {
    const { rows: oRows } = await pool.query('SELECT user_id, status FROM orders WHERE id = $1 LIMIT 1', [orderId]);
    if (!oRows.length) throw new AppError('Associated order not found', 404);
    if (!isAdmin && userId && oRows[0].user_id !== userId) {
      throw new AppError('You do not have permission to verify payment for this order', 403);
    }
  }

  // 2. Handle Cash on Delivery (COD) explicitly
  if (requestedProvider === 'cod') {
    const payment = await Payment.recordPayment({
      orderId: orderId ? Number(orderId) : null,
      userId,
      provider: 'cod',
      providerOrderId: razorpayOrderId || `cod_ord_${Date.now()}`,
      providerPaymentId: razorpayPaymentId || `cod_pay_${Date.now()}`,
      providerSignature: 'cod_order',
      status: 'created', // Payment is awaiting physical collection at delivery
      actorId: userId,
      actorRole: req.user?.role || 'customer',
      reqIp: req.ip,
    });

    return res.json({
      success: true,
      data: payment,
      message: 'Cash on delivery order confirmed successfully. Payment awaiting collection upon delivery.',
    });
  }

  // 3. Online Razorpay payment verification
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new AppError('Payment verification requires razorpayOrderId, razorpayPaymentId, and razorpaySignature', 400);
  }

  // Cryptographic signature verification
  const valid = Payment.verifyRazorpaySignature({
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    signature: razorpaySignature,
  });

  if (!valid) {
    throw new AppError('Payment signature verification failed. Invalid or fraudulent transaction.', 400);
  }

  // Determine provider
  const isMock = Boolean(
    env.razorpay.mockMode &&
    (razorpaySignature === 'simulated_signature_secure' || razorpaySignature.startsWith('mock_sig_'))
  );
  const provider = isMock ? 'manual' : (requestedProvider === 'manual' ? 'manual' : 'razorpay');

  // Record payment and update order status
  const payment = await Payment.recordPayment({
    orderId: orderId ? Number(orderId) : null,
    userId,
    provider,
    providerOrderId: razorpayOrderId,
    providerPaymentId: razorpayPaymentId,
    providerSignature: razorpaySignature,
    status: 'paid',
    actorId: userId,
    actorRole: req.user?.role || 'customer',
    reqIp: req.ip,
  });

  res.json({
    success: true,
    data: payment,
    message: 'Payment verified and transaction confirmed successfully',
  });
});

/**
 * Handles incoming Razorpay Webhook events with raw body HMAC verification.
 */
export const razorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.body;

  if (env.isProd && !env.razorpay.webhookSecret) {
    throw new AppError('Razorpay webhook secret is not configured in production environment', 500);
  }

  if (env.razorpay.webhookSecret) {
    if (!signature) {
      throw new AppError('Missing x-razorpay-signature header on webhook request', 400);
    }
    const isValid = Payment.verifyWebhookSignature(rawBody, signature, env.razorpay.webhookSecret);
    if (!isValid) {
      throw new AppError('Invalid webhook signature', 400);
    }
  }

  let eventData = {};
  try {
    if (Buffer.isBuffer(rawBody)) {
      eventData = JSON.parse(rawBody.toString('utf8'));
    } else if (typeof rawBody === 'string') {
      eventData = JSON.parse(rawBody);
    } else if (typeof rawBody === 'object' && rawBody !== null) {
      eventData = rawBody;
    }
  } catch {
    throw new AppError('Invalid webhook payload format', 400);
  }

  const event = eventData.event;
  const payload = eventData.payload;

  // Event identifier deduplication (Razorpay event ID or entity event hash)
  const eventId =
    eventData.id ||
    eventData.event_id ||
    (payload?.refund?.entity?.id ? `${event}_${payload.refund.entity.id}` : null) ||
    (payload?.payment?.entity?.id ? `${event}_${payload.payment.entity.id}` : null);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (eventId) {
      // 1. Transaction-scoped PostgreSQL advisory lock using hashtext
      const lockKey = `webhook_${eventId}`;
      const { rows: lockResult } = await client.query(
        'SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired',
        [lockKey]
      );

      if (!lockResult[0]?.acquired) {
        // Another concurrent request is actively processing this exact webhook event right now
        await client.query('ROLLBACK');
        return res.json({
          status: 'ok',
          duplicate: true,
          eventReceived: event,
          message: 'Simultaneous duplicate webhook delivery detected and deduplicated',
        });
      }

      // 2. Atomic check in audit_logs inside the locked transaction
      const { rows: processedEvents } = await client.query(
        "SELECT id FROM audit_logs WHERE action = 'WEBHOOK_EVENT_PROCESSED' AND entity_id = $1 LIMIT 1",
        [String(eventId)]
      );
      if (processedEvents.length) {
        await client.query('ROLLBACK');
        return res.json({
          status: 'ok',
          duplicate: true,
          eventReceived: event,
          message: 'Webhook event already processed (idempotent)',
        });
      }
    }

    const SUPPORTED_EVENTS = [
      'payment.captured',
      'payment.failed',
      'order.paid',
      'refund.processed',
      'payment.refunded',
      'refund.failed',
    ];

    if (!SUPPORTED_EVENTS.includes(event)) {
      // Safely log unsupported or unexpected webhook event without mutating database
      await client.query(
        `INSERT INTO audit_logs (
          user_id, action, entity_type, entity_id, details, ip_address, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [
          null,
          'WEBHOOK_EVENT_IGNORED',
          'webhook_events',
          eventId ? String(eventId) : `evt_unsupported_${Date.now()}`,
          JSON.stringify({ event, reason: 'Unsupported or unhandled webhook event type' }),
          req.ip || null,
        ]
      );
      await client.query('COMMIT');
      return res.json({ status: 'ok', ignored: true, eventReceived: event });
    }

    if (event === 'payment.captured' && payload?.payment?.entity) {
      const p = payload.payment.entity;
      const paymentId = p.id;
      const orderId = p.order_id;
      const amount = Number(p.amount) / 100;

      await Payment.recordPayment({
        providerOrderId: orderId,
        providerPaymentId: paymentId,
        amount,
        status: 'paid',
        actorRole: 'webhook',
        reqIp: req.ip,
      });
    } else if (event === 'payment.failed' && payload?.payment?.entity) {
      const p = payload.payment.entity;
      await Payment.recordPayment({
        providerOrderId: p.order_id,
        providerPaymentId: p.id,
        status: 'failed',
        actorRole: 'webhook',
        reqIp: req.ip,
      });
    } else if (event === 'order.paid' && payload?.order?.entity) {
      const o = payload.order.entity;
      await Payment.recordPayment({
        providerOrderId: o.id,
        status: 'paid',
        actorRole: 'webhook',
        reqIp: req.ip,
      });
    } else if ((event === 'refund.processed' || event === 'payment.refunded') && payload?.refund?.entity) {
      const r = payload.refund.entity;
      const paymentId = r.payment_id;
      const refundAmount = Number(r.amount) / 100;

      await Payment.recordRefund(paymentId, {
        refundAmount,
        refundStatus: 'processed',
        isGatewayConfirmed: true,
        actorRole: 'webhook',
        reqIp: req.ip,
      });
    } else if (event === 'refund.failed' && payload?.refund?.entity) {
      const r = payload.refund.entity;
      const paymentId = r.payment_id;
      await Payment.recordRefund(paymentId, {
        refundStatus: 'failed',
        actorRole: 'webhook',
        reqIp: req.ip,
      });
    }

    // Atomically mark webhook event as processed for subsequent deduplication
    if (eventId) {
      await client.query(
        `INSERT INTO audit_logs (
          user_id, action, entity_type, entity_id, details, ip_address, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [
          null,
          'WEBHOOK_EVENT_PROCESSED',
          'webhook_events',
          String(eventId),
          JSON.stringify({ event, eventId }),
          req.ip || null,
        ]
      );
    }

    await client.query('COMMIT');
    res.json({ status: 'ok', eventReceived: event });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

export const list = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await Payment.listAll({ page, limit });
  res.json({ success: true, data: result.items, meta: { total: result.total } });
});

export const refund = asyncHandler(async (req, res) => {
  const payment = await Payment.recordRefund(req.params.id, {
    ...req.body,
    actorId: req.user?.id,
    actorRole: req.user?.role || 'admin',
    reqIp: req.ip,
  });
  if (!payment) throw new AppError('Payment not found', 404);
  res.json({ success: true, data: payment });
});

/**
 * Confirms Cash on Delivery payment collection by authorized administrator.
 */
export const collectCodPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const payment = await Payment.confirmCodPayment({
    paymentId: id,
    actorId: req.user?.id,
    actorRole: req.user?.role || 'admin',
    reqIp: req.ip,
  });
  res.json({
    success: true,
    data: payment,
    message: 'Cash on delivery payment collected and recorded as paid successfully',
  });
});
