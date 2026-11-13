import * as Rental from '../models/rentalModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

export const checkAvailability = asyncHandler(async (req, res) => {
  const { productId, variantId, startDate, endDate } = req.query;
  if (!productId || !variantId || !startDate || !endDate) {
    throw new AppError('productId, variantId, startDate, and endDate are required', 400);
  }
  const result = await Rental.checkAvailability({
    productId: Number(productId),
    variantId: Number(variantId),
    startDate,
    endDate,
  });
  res.json({ success: true, data: result });
});

export const create = asyncHandler(async (req, res) => {
  const booking = await Rental.createBooking(req.user.id, req.body);
  res.status(201).json({ success: true, data: booking });
});

export const listMine = asyncHandler(async (req, res) => {
  const bookings = await Rental.listMine(req.user.id);
  res.json({ success: true, data: bookings });
});

export const getById = asyncHandler(async (req, res) => {
  const isSuper = req.user?.role === 'admin';
  const booking = await Rental.getById(req.params.id, isSuper ? null : req.user.id);
  if (!booking) throw new AppError('Rental booking not found', 404);
  res.json({ success: true, data: booking });
});

export const list = asyncHandler(async (req, res) => {
  const { status, search, page, limit } = req.query;
  const result = await Rental.listAll({ status, search, page, limit });
  res.json({ success: true, data: result.items, meta: { total: result.total, page: Number(page) || 1, limit: Number(limit) || 20 } });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const booking = await Rental.updateStatus(req.params.id, req.body);
  if (!booking) throw new AppError('Rental booking not found', 404);
  res.json({ success: true, data: booking });
});

export const recordReturn = asyncHandler(async (req, res) => {
  const booking = await Rental.recordReturn(req.params.id, req.body);
  if (!booking) throw new AppError('Rental booking not found', 404);
  res.json({ success: true, data: booking });
});
