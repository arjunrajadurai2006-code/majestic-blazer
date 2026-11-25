import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import * as User from '../models/userModel.js';
import * as Address from '../models/addressModel.js';
import { env } from '../config/env.js';
import { pool } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { signToken, revokeToken } from '../utils/token.js';
import { createHandoffCode, exchangeHandoffCode } from '../services/handoffService.js';

const BCRYPT_ROUNDS = 12;
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', BCRYPT_ROUNDS);

const publicUser = (u) => ({
  id: u.id,
  fullName: u.full_name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  createdAt: u.created_at,
});

export const getAuthConfig = (req, res) => {
  res.json({
    success: true,
    data: {
      demoMode: Boolean(env.demoMode),
    },
  });
};

export const ensureDemoAdmin = async () => {
  const adminEmail = (process.env.DEMO_ADMIN_EMAIL || 'admin@majesticblazer.com').trim().toLowerCase();
  const adminPass = process.env.DEMO_ADMIN_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD || 'MajesticAdmin2026!Secure';
  let admin = await User.findByEmail(adminEmail);
  if (!admin) {
    const passwordHash = await bcrypt.hash(adminPass, BCRYPT_ROUNDS);
    await User.create({
      fullName: 'Atelier Administrator',
      email: adminEmail,
      phone: '8903238882',
      passwordHash,
      role: 'admin',
    });
  } else if (admin.role !== 'admin' || !admin.is_active) {
    await pool.query("UPDATE users SET role = 'admin', is_active = true WHERE id = $1", [admin.id]);
  }
};

export const register = asyncHandler(async (req, res) => {
  const { fullName, email, phone, password } = req.body;
  const normalizedEmail = (email || '').trim().toLowerCase();

  const existing = await User.findByEmail(normalizedEmail);
  if (existing) {
    throw new AppError('An account with this email already exists', 409);
  }

  const defaultName = (fullName && fullName.trim()) || (normalizedEmail.split('@')[0] || 'Customer');
  const name = defaultName.charAt(0).toUpperCase() + defaultName.slice(1);
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const id = await User.create({
    fullName: name,
    email: normalizedEmail,
    phone: (phone || '').trim(),
    passwordHash,
    role: 'customer',
  });

  const user = await User.findById(id);
  return res.status(201).json({
    success: true,
    data: { token: signToken(user), user: publicUser(user) },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = (email || '').trim().toLowerCase();

  const user = await User.findByEmail(normalizedEmail);

  // If user does not exist or password is missing
  if (!user) {
    await bcrypt.compare(password || '', DUMMY_HASH);
    throw new AppError('Invalid email or password', 401);
  }

  if (!user.is_active) {
    throw new AppError('Account is inactive', 401);
  }

  // Strictly verify password hash for all accounts using bcrypt
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new AppError('Invalid email or password', 401);
  }

  return res.status(200).json({
    success: true,
    data: { token: signToken(user), user: publicUser(user) },
  });
});

export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = (email || '').trim().toLowerCase();

  const user = await User.findByEmail(normalizedEmail);
  const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

  if (!user || !valid || !user.is_active || user.role !== 'admin') {
    throw new AppError('Invalid email or password', 401);
  }

  res.json({
    success: true,
    data: { token: signToken(user), user: publicUser(user) },
  });
});

export const logout = asyncHandler(async (req, res) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme === 'Bearer' && token) {
    revokeToken(token);
  }
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully' });
});

export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user || !user.is_active) throw new AppError('Account not found or inactive', 401);
  const addresses = await Address.listByUser(user.id);
  res.json({ success: true, data: { user: publicUser(user), addresses } });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, phone } = req.body;
  const user = await User.updateProfile(req.user.id, { fullName, phone });
  res.json({ success: true, data: { user: publicUser(user) } });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findByEmail((await User.findById(req.user.id)).email);
  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) throw new AppError('Current password is incorrect', 400);

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await User.updatePassword(req.user.id, passwordHash);
  res.json({ success: true, message: 'Password updated successfully' });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findByEmail(email);
  if (!user) {
    // Return success to avoid email enumeration
    return res.json({ success: true, message: 'If an account exists, password reset instructions have been generated.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 3600000); // 1 hour
  await User.setResetToken(email, token, expires);

  res.json({
    success: true,
    message: 'Password reset token generated.',
    data: { resetToken: token }, // provided for dev/demo testing
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const user = await User.findByResetToken(token);
  if (!user) throw new AppError('Invalid or expired password reset token', 400);

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await User.clearResetToken(user.id, passwordHash);
  res.json({ success: true, message: 'Password reset successfully. You can now sign in with your new password.' });
});

// Customer Address endpoints
export const listAddresses = asyncHandler(async (req, res) => {
  const addresses = await Address.listByUser(req.user.id);
  res.json({ success: true, data: addresses });
});

export const addAddress = asyncHandler(async (req, res) => {
  const address = await Address.create(req.user.id, req.body);
  res.status(201).json({ success: true, data: address });
});

export const updateAddress = asyncHandler(async (req, res) => {
  const address = await Address.update(req.params.id, req.user.id, req.body);
  if (!address) throw new AppError('Address not found', 404);
  res.json({ success: true, data: address });
});

export const deleteAddress = asyncHandler(async (req, res) => {
  const success = await Address.remove(req.params.id, req.user.id);
  if (!success) throw new AppError('Address not found', 404);
  res.json({ success: true, message: 'Address removed' });
});

// Demo customer auto-login endpoint
export const demoCustomerLogin = asyncHandler(async (req, res) => {
  if (!env.demoMode) {
    throw new AppError('Demo customer access is disabled', 403);
  }
  const uniqueId = crypto.randomBytes(4).toString('hex');
  const demoEmail = `patron.demo.${uniqueId}@majesticblazer.com`;
  const passwordHash = await bcrypt.hash(`DemoPass_${uniqueId}!`, BCRYPT_ROUNDS);
  const id = await User.create({
    fullName: `Demo Patron ${uniqueId.toUpperCase()}`,
    email: demoEmail,
    phone: '8903238882',
    passwordHash,
    role: 'customer',
  });
  const user = await User.findById(id);

  const handoffRequested = req.query.handoff === 'true' || req.body?.handoff === true;
  let handoffCode;
  if (handoffRequested) {
    const handoff = await createHandoffCode({ userId: user.id, userRole: user.role, targetApp: 'customer' });
    handoffCode = handoff.code;
  }

  res.status(200).json({
    success: true,
    data: {
      token: signToken(user),
      user: publicUser(user),
      ...(handoffCode ? { handoffCode } : {}),
    },
  });
});

// Demo admin auto-login endpoint
export const demoAdminLogin = asyncHandler(async (req, res) => {
  if (!env.demoMode) {
    throw new AppError('Demo administrator access is disabled', 403);
  }
  await ensureDemoAdmin();
  const adminEmail = (process.env.DEMO_ADMIN_EMAIL || 'admin@majesticblazer.com').trim().toLowerCase();
  const user = await User.findByEmail(adminEmail);
  if (!user || user.role !== 'admin' || !user.is_active) {
    throw new AppError('Configured administrator account not found or inactive', 404);
  }

  const handoffRequested = req.query.handoff === 'true' || req.body?.handoff === true;
  let handoffCode;
  if (handoffRequested) {
    const handoff = await createHandoffCode({ userId: user.id, userRole: user.role, targetApp: 'admin' });
    handoffCode = handoff.code;
  }

  res.status(200).json({
    success: true,
    data: {
      token: signToken(user),
      user: publicUser(user),
      ...(handoffCode ? { handoffCode } : {}),
    },
  });
});

// Generate a secure single-use cross-application handoff code for the authenticated user
export const createHandoff = asyncHandler(async (req, res) => {
  const { targetApp } = req.body;
  if (!targetApp || !['admin', 'customer'].includes(targetApp)) {
    throw new AppError('Valid targetApp ("admin" or "customer") is required', 400);
  }
  if (targetApp === 'admin' && req.user.role !== 'admin') {
    throw new AppError('Customer accounts cannot generate administrator handoff codes', 403);
  }

  const handoff = await createHandoffCode({
    userId: req.user.id,
    userRole: req.user.role,
    targetApp,
  });

  res.status(200).json({
    success: true,
    data: {
      handoffCode: handoff.code,
      targetApp: handoff.targetApp,
      expiresAt: handoff.expiresAt,
    },
  });
});

// Atomically exchange a single-use handoff code for an authentic session token
export const exchangeHandoff = asyncHandler(async (req, res) => {
  const { code, targetApp } = req.body;
  const result = await exchangeHandoffCode({ code, targetApp });

  if (!result.success) {
    throw new AppError(result.error, result.statusCode || 401);
  }

  const user = await User.findById(result.data.userId);
  if (!user || !user.is_active) {
    throw new AppError('Authenticated account not found or is inactive', 401);
  }

  if (targetApp === 'admin' && user.role !== 'admin') {
    throw new AppError('Customer credentials cannot access administrator portal', 403);
  }

  const token = signToken(user);
  res.status(200).json({
    success: true,
    data: {
      token,
      user: publicUser(user),
    },
  });
});
