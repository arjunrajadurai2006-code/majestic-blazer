import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// In-memory token revocation cache for invalidated sessions
const revokedTokens = new Set();

export const signToken = (user) =>
  jwt.sign({ role: user.role }, env.jwt.secret, { subject: String(user.id), expiresIn: env.jwt.expiresIn });

export const revokeToken = (token) => {
  if (token) revokedTokens.add(token);
};

export const isTokenRevoked = (token) => {
  return revokedTokens.has(token);
};
