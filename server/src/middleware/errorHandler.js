import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export const notFound = (req, res, next) =>
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));

// Centralized error handling preventing internal leaks in production
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.message;

  // PostgreSQL error code mappings
  if (err.code === '23505' || err.code === 'ER_DUP_ENTRY') {
    status = 409;
    message = 'A record with these details already exists';
  } else if (err.code === '23503') {
    status = 400;
    message = 'Referenced related item cannot be found or linked';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON body syntax';
  } else if (err.message && err.message.startsWith('CORS policy:')) {
    status = err.statusCode || 403;
  }

  if (status >= 500) {
    console.error('Unhandled Server Error:', err);
    if (env.isProd) {
      message = 'Internal server error. Please try again later.';
    }
  }

  res.status(status).json({
    success: false,
    message,
    ...(err.details && { details: err.details }),
    ...(!env.isProd && status >= 500 && { stack: err.stack }),
  });
};
