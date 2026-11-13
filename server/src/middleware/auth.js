import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

// Verifies the Bearer token, validates account status against database, and attaches { id, role } to req.user.
export const authenticate = async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return next(new AppError('Authentication required', 401));

  try {
    const payload = jwt.verify(token, env.jwt.secret);
    const userId = Number(payload.sub);

    // Verify user exists and is active in database
    const { rows } = await pool.query('SELECT id, role, is_active FROM users WHERE id = $1 LIMIT 1', [userId]);
    if (!rows.length || !rows[0].is_active) {
      return next(new AppError('Account is inactive, suspended, or no longer exists', 401));
    }

    req.user = { id: rows[0].id, role: rows[0].role };
    return next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    return next(new AppError('Invalid or expired token', 401));
  }
};

export const authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role)
    ? next()
    : next(new AppError('You do not have permission to perform this action', 403));
