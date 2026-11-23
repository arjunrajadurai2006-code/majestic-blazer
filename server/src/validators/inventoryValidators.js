import { AppError } from '../utils/AppError.js';

/**
 * Validates that the :id route parameter is a strictly positive integer.
 * Rejects empty, zero, negative, decimal, alphabetic, and malformed strings.
 * Returns HTTP 400 Bad Request.
 */
export const validateInventoryId = (req, res, next) => {
  const { id } = req.params;

  if (id === undefined || id === null || typeof id !== 'string') {
    return next(new AppError('Invalid inventory variant ID. ID must be a positive integer.', 400));
  }

  const trimmed = id.trim();

  // Strict positive integer regex: only digits 0-9, leading digit 1-9
  if (!/^[1-9]\d*$/.test(trimmed)) {
    return next(new AppError('Invalid inventory variant ID. ID must be a positive integer.', 400));
  }

  const numId = Number(trimmed);
  // Guard against 32-bit integer overflow in PostgreSQL serial/integer column
  if (!Number.isSafeInteger(numId) || numId > 2147483647) {
    return next(new AppError('Invalid inventory variant ID. ID exceeds maximum allowable range.', 400));
  }

  req.params.id = String(numId);
  return next();
};

/**
 * Validates stock quantity payloads for inventory adjustments.
 * Enforces non-negative integers for stockQuantity.
 * Requires stockQuantity to be provided.
 * Returns HTTP 400 Bad Request on validation failure.
 */
export const validateStockQuantities = (req, res, next) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return next(new AppError('Request body must be a valid JSON object.', 400));
  }

  const { stockQuantity } = req.body;

  if (stockQuantity === undefined) {
    return next(new AppError('stockQuantity must be provided.', 400));
  }

  const isValidNonNegativeInt = (val) => {
    if (typeof val === 'number') {
      return Number.isInteger(val) && val >= 0 && val <= 1000000;
    }
    if (typeof val === 'string' && /^(0|[1-9]\d*)$/.test(val.trim())) {
      const num = Number(val.trim());
      return Number.isSafeInteger(num) && num >= 0 && num <= 1000000;
    }
    return false;
  };

  if (stockQuantity === null || !isValidNonNegativeInt(stockQuantity)) {
    return next(new AppError('stockQuantity must be a non-negative integer (0 or greater).', 400));
  }

  return next();
};

export const validateInventoryAdjustment = [validateInventoryId, validateStockQuantities];
