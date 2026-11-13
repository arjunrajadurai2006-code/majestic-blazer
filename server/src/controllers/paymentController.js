import * as Payment from '../models/paymentModel.js';
import { env } from '../config/env.js';
import { pool } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

export const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { amount, receipt } = req.body;
  if (!amount || Number(amount) <= 0) throw new AppError('Valid amount is required', 400);
  const order = await Payment.createRazorpayOrder({ amount, receipt });
  res.json({ success: true, data: order });
});

export const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const { orderId, rentalBookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature, amount, provider = 'razorpay' } = req.body;

  const valid = Payment.verifyRazorpaySignature({
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    signature: razorpaySignature,
  });

  if (!valid) throw new AppError('Payment signature verification failed', 400);

  const payment = await Payment.recordPayment({
    orderId: orderId || null,
    rentalBookingId: rentalBookingId || null,
    userId: req.user?.id || null,
    provider,
    providerOrderId: razorpayOrderId,
    providerPaymentId: razorpayPaymentId,
    providerSignature: razorpaySignature,
    amount,
    status: 'paid',
  });

  res.json({ success: true, data: payment });
});

export const razorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.body;

  if (env.razorpay.webhookSecret) {
    const isValid = Payment.verifyWebhookSignature(rawBody, signature, env.razorpay.webhookSecret);
    if (!isValid) {
      throw new AppError('Invalid webhook signature', 400);
    }
  }

  let eventData;
  try {
    eventData = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
  } catch {
    eventData = {};
  }

  const event = eventData.event;
  const payload = eventData.payload;

  if (event === 'payment.captured' && payload?.payment?.entity) {
    const p = payload.payment.entity;
    const paymentId = p.id;
    const orderId = p.order_id;
    const amount = p.amount / 100;

    await Payment.recordPayment({
      providerOrderId: orderId,
      providerPaymentId: paymentId,
      amount,
      status: 'paid',
    });
  } else if (event === 'payment.failed' && payload?.payment?.entity) {
    const p = payload.payment.entity;
    await pool.query(
      `UPDATE payments SET status = 'failed' WHERE provider_payment_id = $1`,
      [p.id]
    );
  }

  res.json({ status: 'ok', eventReceived: event });
});

export const list = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await Payment.listAll({ page, limit });
  res.json({ success: true, data: result.items, meta: { total: result.total } });
});

export const refund = asyncHandler(async (req, res) => {
  const payment = await Payment.recordRefund(req.params.id, req.body);
  if (!payment) throw new AppError('Payment not found', 404);
  res.json({ success: true, data: payment });
});
