import * as Settings from '../models/settingsModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { seedFullDemoData } from '../../scripts/seedFullDemoData.js';

export const get = asyncHandler(async (req, res) => {
  const settings = await Settings.getAll();
  res.json({ success: true, data: settings });
});

export const update = asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    throw new AppError('Settings payload must be an object', 400);
  }

  const { store_name, brand_tagline, store_email, tax_percentage, shipping_fee } = req.body;

  if (store_name !== undefined) {
    if (typeof store_name !== 'string' || !store_name.trim()) {
      throw new AppError('Store brand name cannot be empty', 400);
    }
    req.body.store_name = store_name.trim();
  }

  if (brand_tagline !== undefined) {
    if (typeof brand_tagline !== 'string' || !brand_tagline.trim()) {
      throw new AppError('Official brand tagline cannot be empty', 400);
    }
    req.body.brand_tagline = brand_tagline.trim();
  }

  if (store_email !== undefined && typeof store_email === 'string' && store_email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(store_email.trim())) {
      throw new AppError('Please provide a valid store support email address', 400);
    }
    req.body.store_email = store_email.trim();
  }

  if (tax_percentage !== undefined) {
    const tax = Number(tax_percentage);
    if (isNaN(tax) || tax < 0 || tax > 100) {
      throw new AppError('GST Tax rate must be a valid percentage between 0 and 100', 400);
    }
  }

  if (shipping_fee !== undefined) {
    const fee = Number(shipping_fee);
    if (isNaN(fee) || fee < 0) {
      throw new AppError('Shipping fee must be a non-negative number', 400);
    }
  }

  const settings = await Settings.updateBulk(req.body);
  res.json({ success: true, data: settings });
});

export const seedDemo = asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    throw new AppError('Demo data seeding is permanently disabled in production', 403);
  }
  await seedFullDemoData();
  res.json({ success: true, message: 'Realistic demonstration dataset successfully seeded.' });
});
