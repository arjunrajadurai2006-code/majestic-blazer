import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import * as User from '../models/userModel.js';
import * as Address from '../models/addressModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { signToken } from '../utils/token.js';

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

export const register = asyncHandler(async (req, res) => {
  const { fullName, email, phone, password } = req.body;
  if (await User.findByEmail(email)) throw new AppError('An account with this email already exists', 409);
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const id = await User.create({ fullName, email, phone, passwordHash, role: 'customer' });
  const user = await User.findById(id);
  res.status(201).json({ success: true, data: { token: signToken(user), user: publicUser(user) } });
});

const buildLogin = (requiredRole) =>
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findByEmail(email);
    const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !valid || !user.is_active || user.role !== requiredRole) {
      throw new AppError('Invalid email or password', 401);
    }
    res.json({ success: true, data: { token: signToken(user), user: publicUser(user) } });
  });

export const login = buildLogin('customer');
export const adminLogin = buildLogin('admin');

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
