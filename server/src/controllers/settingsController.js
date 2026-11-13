import * as Settings from '../models/settingsModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const get = asyncHandler(async (req, res) => {
  const settings = await Settings.getAll();
  res.json({ success: true, data: settings });
});

export const update = asyncHandler(async (req, res) => {
  const settings = await Settings.updateBulk(req.body);
  res.json({ success: true, data: settings });
});
