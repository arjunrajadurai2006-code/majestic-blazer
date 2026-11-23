import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { isTokenRevoked } from '../utils/token.js';

// Verifies the Bearer token or query token, validates account status against database, and attaches { id, role } to req.user.
export const authenticate = async (req, res, next) => {
  let token = null;
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query?.token && typeof req.query.token === 'string') {
    token = req.query.token.trim();
  }

  if (!token) return next(new AppError('Authentication required', 401));

  if (isTokenRevoked(token)) {
    return next(new AppError('Session has ended or token was revoked. Please sign in again.', 401));
  }

  let userId;
  try {
    const payload = jwt.verify(token, env.jwt.secret);
    userId = Number(payload.sub);
  } catch (jwtErr) {
    return next(new AppError('Invalid or expired token', 401));
  }

  try {
    // Verify user exists and is active in database
    const { rows } = await pool.query('SELECT id, role, is_active FROM users WHERE id = $1 LIMIT 1', [userId]);
    if (!rows.length || !rows[0].is_active) {
      return next(new AppError('Account is inactive, suspended, or no longer exists', 401));
    }

    req.user = { id: rows[0].id, role: rows[0].role };
    return next();
  } catch (dbErr) {
    if (dbErr instanceof AppError) return next(dbErr);
    return next(dbErr);
  }
};

export const authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role)
    ? next()
    : next(new AppError('You do not have permission to perform this action', 403));
