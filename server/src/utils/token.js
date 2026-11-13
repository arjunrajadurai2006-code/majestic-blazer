import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const signToken = (user) =>
  jwt.sign({ role: user.role }, env.jwt.secret, { subject: String(user.id), expiresIn: env.jwt.expiresIn });
