import * as User from '../models/userModel.js';
import * as Order from '../models/orderModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

export const list = asyncHandler(async (req, res) => {
  const { search, page, limit } = req.query;
  const result = await User.listCustomers({ search, page, limit });
  res.json({ success: true, data: result.items, meta: { total: result.total } });
});

export const getById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('Customer not found', 404);
  const orders = await Order.listMine(user.id);
  res.json({
    success: true,
    data: {
      ...user,
      orders,
    },
  });
});

export const toggleActive = asyncHandler(async (req, res) => {
  const user = await User.updateActiveStatus(req.params.id, req.body.isActive);
  if (!user) throw new AppError('Customer not found', 404);
  res.json({ success: true, data: user });
});
