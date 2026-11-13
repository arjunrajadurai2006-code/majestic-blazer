import * as Category from '../models/categoryModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

export const list = asyncHandler(async (req, res) => {
  const includeInactive = req.query.all === 'true' && req.user?.role === 'admin';
  const categories = await Category.list({ includeInactive });
  res.json({ success: true, data: categories });
});

export const getById = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new AppError('Category not found', 404);
  res.json({ success: true, data: category });
});

export const create = asyncHandler(async (req, res) => {
  const category = await Category.create(req.body);
  res.status(201).json({ success: true, data: category });
});

export const update = asyncHandler(async (req, res) => {
  const category = await Category.update(req.params.id, req.body);
  if (!category) throw new AppError('Category not found', 404);
  res.json({ success: true, data: category });
});

export const remove = asyncHandler(async (req, res) => {
  const success = await Category.remove(req.params.id);
  if (!success) throw new AppError('Category not found', 404);
  res.json({ success: true, message: 'Category removed' });
});
