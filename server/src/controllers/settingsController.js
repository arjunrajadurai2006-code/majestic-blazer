import * as Settings from '../models/settingsModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { seedFullDemoData } from '../../scripts/seedFullDemoData.js';

export const get = asyncHandler(async (req, res) => {
  const settings = await Settings.getAll();
  res.json({ success: true, data: settings });
});

export const update = asyncHandler(async (req, res) => {
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
