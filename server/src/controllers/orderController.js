import * as Order from '../models/orderModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

export const create = asyncHandler(async (req, res) => {
  const order = await Order.create(req.user.id, req.body);
  res.status(201).json({ success: true, data: order });
});

export const listMine = asyncHandler(async (req, res) => {
  const orders = await Order.listMine(req.user.id);
  res.json({ success: true, data: orders });
});

export const getById = asyncHandler(async (req, res) => {
  const isSuper = req.user?.role === 'admin';
  const order = await Order.getById(req.params.id, isSuper ? null : req.user.id);
  if (!order) throw new AppError('Order not found', 404);
  res.json({ success: true, data: order });
});

export const list = asyncHandler(async (req, res) => {
  const { status, search, page, limit } = req.query;
  const result = await Order.listAll({ status, search, page, limit });
  res.json({ success: true, data: result.items, meta: { total: result.total, page: Number(page) || 1, limit: Number(limit) || 20 } });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const order = await Order.updateStatus(req.params.id, req.body);
  res.json({ success: true, data: order });
});
