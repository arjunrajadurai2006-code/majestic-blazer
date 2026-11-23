import { AppError } from '../utils/AppError.js';

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
];

export const PERMITTED_STATUS_TRANSITIONS = {
  pending: ['pending', 'confirmed', 'cancelled'],
  confirmed: ['confirmed', 'shipped', 'delivered', 'cancelled', 'refunded'],
  shipped: ['shipped', 'delivered', 'cancelled', 'refunded'],
  delivered: ['delivered', 'refunded'],
  cancelled: ['cancelled'],
  refunded: ['refunded'],
};

/**
 * Validates order ID route parameter.
 */
export const validateOrderId = (req, res, next) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string' || !id.trim()) {
    return next(new AppError('Invalid order identifier.', 400));
  }
  req.params.id = id.trim();
  next();
};

/**
 * Validates payload for order status updates.
 * Unknown statuses return HTTP 400 Bad Request.
 */
export const validateOrderStatusPayload = (req, res, next) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return next(new AppError('Request body must be a valid JSON object.', 400));
  }

  const { status, trackingNumber, notes, reason } = req.body;

  if (status === undefined || status === null || typeof status !== 'string' || !status.trim()) {
    return next(new AppError('Order status is required and must be a valid non-empty string.', 400));
  }

  const cleanStatus = status.trim().toLowerCase();

  if (!ORDER_STATUSES.includes(cleanStatus)) {
    return next(
      new AppError(
        `Invalid order status: "${status}". Permitted statuses are: ${ORDER_STATUSES.join(', ')}`,
        400
      )
    );
  }

  if (trackingNumber !== undefined && trackingNumber !== null) {
    if (typeof trackingNumber !== 'string') {
      return next(new AppError('trackingNumber must be a string.', 400));
    }
    if (trackingNumber.length > 100) {
      return next(new AppError('trackingNumber cannot exceed 100 characters.', 400));
    }
  }

  if (notes !== undefined && notes !== null && typeof notes !== 'string') {
    return next(new AppError('notes must be a string.', 400));
  }

  if (reason !== undefined && reason !== null && typeof reason !== 'string') {
    return next(new AppError('reason must be a string.', 400));
  }

  if (req.body.restock !== undefined && req.body.restock !== null && typeof req.body.restock !== 'boolean') {
    return next(new AppError('restock must be a boolean flag.', 400));
  }

  req.body.status = cleanStatus;
  next();
};
