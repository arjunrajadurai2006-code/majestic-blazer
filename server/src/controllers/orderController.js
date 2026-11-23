import * as Order from '../models/orderModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

export const create = asyncHandler(async (req, res) => {
  const order = await Order.create(req.user.id, req.body);
  res.status(201).json({ success: true, data: order });
});

export const listMine = asyncHandler(async (req, res) => {
  const orders = await Order.listMine(req.user.id);
  res.json({ success: true, data: orders });
});

export const getById = asyncHandler(async (req, res) => {
  const isSuper = req.user?.role === 'admin';
  const { id } = req.params;

  const order = await Order.getById(id, isSuper ? null : req.user.id);
  if (!order) {
    if (!isSuper) {
      const anyOrder = await Order.getById(id, null);
      if (anyOrder && anyOrder.user_id !== req.user.id) {
        throw new AppError('You do not have permission to access this order', 403);
      }
    }
    throw new AppError('Order not found', 404);
  }
  res.json({ success: true, data: order });
});

export const list = asyncHandler(async (req, res) => {
  const { status, search, page, limit } = req.query;
  const result = await Order.listAll({ status, search, page, limit });
  res.json({ success: true, data: result.items, meta: { total: result.total, page: Number(page) || 1, limit: Number(limit) || 20 } });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const order = await Order.updateStatus(req.params.id, {
    status: req.body.status,
    trackingNumber: req.body.trackingNumber,
    notes: req.body.notes,
    reason: req.body.reason,
    restock: req.body.restock,
    actorId: req.user?.id,
    actorRole: req.user?.role || 'admin',
    reqIp: req.ip,
  });
  res.json({ success: true, data: order });
});

export const cancel = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isSuper = req.user?.role === 'admin';
  const order = await Order.getById(id, isSuper ? null : req.user.id);
  if (!order) {
    if (!isSuper) {
      const anyOrder = await Order.getById(id, null);
      if (anyOrder && anyOrder.user_id !== req.user.id) {
        throw new AppError('You do not have permission to cancel this order', 403);
      }
    }
    throw new AppError('Order not found', 404);
  }

  // Idempotency: if already cancelled, return success immediately
  if (order.status === 'cancelled') {
    return res.json({
      success: true,
      data: order,
      message: 'Order is already cancelled',
    });
  }

  if (order.status !== 'pending' && !isSuper) {
    throw new AppError('Only pending orders can be cancelled by customers', 400);
  }

  // Phase 3.3: Predefined customer cancellation reasons
  const VALID_CANCELLATION_REASONS = [
    'Ordered incorrect size',
    'Event rescheduled',
    'Selected alternate blazer style',
    'Delivery timing no longer suitable',
    'Other',
  ];

  const { reason, explanation, notes } = req.body || {};

  let formattedReason = 'Cancelled by customer';

  if (reason) {
    if (!VALID_CANCELLATION_REASONS.includes(reason)) {
      throw new AppError(
        `Invalid cancellation reason. Allowed reasons: ${VALID_CANCELLATION_REASONS.join(', ')}`,
        400
      );
    }
    const cleanExplanation = typeof explanation === 'string' ? explanation.trim().slice(0, 500) : '';
    if (reason === 'Other' && cleanExplanation) {
      formattedReason = `Cancelled: Other - ${cleanExplanation}`;
    } else if (cleanExplanation) {
      formattedReason = `Cancelled: ${reason} - ${cleanExplanation}`;
    } else {
      formattedReason = `Cancelled: ${reason}`;
    }
  } else if (notes) {
    // Preserve backwards compatibility for automated test scripts passing notes directly
    formattedReason = String(notes).trim().slice(0, 500);
  }

  // Preserve initial order fitting notes if present
  let updatedNotes = formattedReason;
  if (order.notes && !order.notes.startsWith('Cancelled')) {
    updatedNotes = `${formattedReason} | Original fitting notes: ${order.notes}`;
  }

  const updated = await Order.updateStatus(order.id, {
    status: 'cancelled',
    notes: updatedNotes,
    reason: formattedReason,
    actorId: req.user?.id,
    actorRole: req.user?.role || 'customer',
    reqIp: req.ip,
  });

  res.json({
    success: true,
    data: updated,
    message: 'Order cancelled successfully and reserved inventory released',
  });
});
