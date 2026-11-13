import * as Review from '../models/reviewModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

export const listByProduct = asyncHandler(async (req, res) => {
  const reviews = await Review.listByProduct(req.params.productId);
  res.json({ success: true, data: reviews });
});

export const create = asyncHandler(async (req, res) => {
  const { productId, rating, title, comment } = req.body;
  if (!productId || !rating || !comment) {
    throw new AppError('productId, rating, and comment are required', 400);
  }
  const review = await Review.create(req.user.id, { productId, rating, title, comment });
  res.status(201).json({ success: true, data: review });
});

export const listAll = asyncHandler(async (req, res) => {
  const reviews = await Review.listAll();
  res.json({ success: true, data: reviews });
});

export const toggleApprove = asyncHandler(async (req, res) => {
  const review = await Review.toggleApprove(req.params.id, req.body.isApproved);
  if (!review) throw new AppError('Review not found', 404);
  res.json({ success: true, data: review });
});

