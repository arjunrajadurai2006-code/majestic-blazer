import * as Coupon from '../models/couponModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

export const validate = asyncHandler(async (req, res) => {
  const { code, cartTotal } = req.body;
  if (!code) throw new AppError('Coupon code is required', 400);
  const result = await Coupon.validate(code, cartTotal);
  res.json({ success: true, data: result });
});

export const list = asyncHandler(async (req, res) => {
  const coupons = await Coupon.listAll();
  res.json({ success: true, data: coupons });
});

export const create = asyncHandler(async (req, res) => {
  const coupon = await Coupon.create(req.body);
  res.status(201).json({ success: true, data: coupon });
});

export const remove = asyncHandler(async (req, res) => {
  const success = await Coupon.remove(req.params.id);
  if (!success) throw new AppError('Coupon not found', 404);
  res.json({ success: true, message: 'Coupon removed' });
});

