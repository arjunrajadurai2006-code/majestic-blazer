import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import * as User from '../models/userModel.js';
import * as Address from '../models/addressModel.js';
import { env } from '../config/env.js';
import { pool } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { signToken, revokeToken } from '../utils/token.js';

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
  const adminEmail = 'admin@majesticblazer.com';
  const adminPass = 'MajesticAdmin2026!Secure';
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

  if (env.demoMode) {
    if (existing) {
      if (existing.role !== 'customer') {
        throw new AppError('An account with this email already exists', 409);
      }
      return res.status(200).json({
        success: true,
        data: { token: signToken(existing), user: publicUser(existing) },
      });
    }

    const defaultName = (fullName && fullName.trim()) || (normalizedEmail.split('@')[0] || 'Patron');
    const name = defaultName.charAt(0).toUpperCase() + defaultName.slice(1);
    const passwordHash = await bcrypt.hash(password || 'DemoPassword123!', BCRYPT_ROUNDS);
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
  }

  // Non-demo mode
  if (existing) throw new AppError('An account with this email already exists', 409);
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const id = await User.create({
    fullName: fullName.trim(),
    email: normalizedEmail,
    phone: (phone || '').trim(),
    passwordHash,
    role: 'customer',
  });
  const user = await User.findById(id);
  res.status(201).json({ success: true, data: { token: signToken(user), user: publicUser(user) } });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = (email || '').trim().toLowerCase();

  let user = await User.findByEmail(normalizedEmail);

  if (env.demoMode) {
    if (user) {
      if (user.role !== 'customer') {
        throw new AppError('Invalid email or password', 401);
      }
      if (!user.is_active) {
        throw new AppError('Account is inactive', 401);
      }
      // In demo mode: accept any valid password without blocking customer
      return res.json({
        success: true,
        data: { token: signToken(user), user: publicUser(user) },
      });
    } else {
      // Auto-create customer in demo mode
      const namePrefix = normalizedEmail.split('@')[0] || 'Demo Patron';
      const formattedName = namePrefix.charAt(0).toUpperCase() + namePrefix.slice(1);
      const passwordHash = await bcrypt.hash(password || 'DemoPassword123!', BCRYPT_ROUNDS);
      const id = await User.create({
        fullName: formattedName,
        email: normalizedEmail,
        phone: '',
        passwordHash,
        role: 'customer',
      });
      user = await User.findById(id);
      return res.status(200).json({
        success: true,
        data: { token: signToken(user), user: publicUser(user) },
      });
    }
  }

  // DEMO_MODE=false: strict customer verification
  const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !valid || !user.is_active || user.role !== 'customer') {
    throw new AppError('Invalid email or password', 401);
  }
  res.json({
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

// Demo customer info endpoint (controlled by DEMO_MODE)
export const getDemoCustomer = asyncHandler(async (req, res) => {
  if (!env.demoMode) {
    throw new AppError('Demo customer access is disabled', 403);
  }
  const demoEmail = 'customer.demo@majesticblazer.com';
  let user = await User.findByEmail(demoEmail);
  if (!user) {
    const passwordHash = await bcrypt.hash('CustomerDemo2026!', BCRYPT_ROUNDS);
    const id = await User.create({
      fullName: 'Demo Patron',
      email: demoEmail,
      phone: '8903238882',
      passwordHash,
      role: 'customer',
    });
    user = await User.findById(id);
  }
  res.json({
    success: true,
    data: {
      email: demoEmail,
      role: 'customer',
      note: 'Demo mode active: Any valid email and password are accepted.',
    },
  });
});

// Demo admin info endpoint (controlled by DEMO_MODE)
export const getDemoAdmin = asyncHandler(async (req, res) => {
  if (!env.demoMode) {
    throw new AppError('Demo admin access is disabled', 403);
  }
  await ensureDemoAdmin();
  res.json({
    success: true,
    data: {
      email: 'admin@majesticblazer.com',
      role: 'admin',
      note: 'Enter the designated administrator credentials',
    },
  });
});
