import * as Product from '../models/productModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

export const list = asyncHandler(async (req, res) => {
  const { type, category, search, color, material, fit, size, minPrice, maxPrice, featured, sort } = req.query;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 12;
  const includeInactive = req.query.all === 'true' && req.user?.role === 'admin';

  const { items, total } = await Product.list({
    type,
    category,
    search,
    color,
    material,
    fit,
    size,
    minPrice,
    maxPrice,
    featured,
    sort,
    page,
    limit,
    includeInactive,
  });

  res.json({
    success: true,
    data: items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
});

export const getBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findBySlug(req.params.slug);
  if (!product) throw new AppError('Product not found', 404);
  const related = await Product.getRelated(product.id, product.category_id, 4);
  res.json({ success: true, data: { ...product, related } });
});

export const getById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);
  res.json({ success: true, data: product });
});

export const create = asyncHandler(async (req, res) => {
  const id = await Product.create(req.body);
  const product = await Product.findById(id);
  res.status(201).json({ success: true, data: product });
});

export const update = asyncHandler(async (req, res) => {
  const id = await Product.update(req.params.id, req.body);
  if (!id) throw new AppError('Product not found', 404);
  const product = await Product.findById(id);
  res.json({ success: true, data: product });
});

export const remove = asyncHandler(async (req, res) => {
  const success = await Product.remove(req.params.id);
  if (!success) throw new AppError('Product not found', 404);
  res.json({ success: true, message: 'Product removed' });
});
