import * as Wishlist from '../models/wishlistModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

export const list = asyncHandler(async (req, res) => {
  const items = await Wishlist.listByUser(req.user.id);
  res.json({ success: true, data: items });
});

export const add = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  if (!productId) throw new AppError('productId is required', 400);
  await Wishlist.add(req.user.id, productId);
  res.json({ success: true, message: 'Added to wishlist' });
});

export const remove = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  await Wishlist.remove(req.user.id, productId);
  res.json({ success: true, message: 'Removed from wishlist' });
});

export const check = asyncHandler(async (req, res) => {
  const isWishlisted = await Wishlist.check(req.user.id, req.params.productId);
  res.json({ success: true, data: { isWishlisted } });
});

