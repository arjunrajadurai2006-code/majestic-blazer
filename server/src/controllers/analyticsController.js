import * as Analytics from '../models/analyticsModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getSummary = asyncHandler(async (req, res) => {
  const overview = await Analytics.getOverview();
  res.json({ success: true, data: overview });
});

export const getRevenueTrends = asyncHandler(async (req, res) => {
  const trends = await Analytics.getRevenueTrends({ range: req.query.range || '30d' });
  res.json({ success: true, data: trends });
});

export const getTopProducts = asyncHandler(async (req, res) => {
  const products = await Analytics.getTopBlazers(Number(req.query.limit) || 5);
  res.json({ success: true, data: products });
});

export const getCategoryBreakdown = asyncHandler(async (req, res) => {
  const categories = await Analytics.getCategoryBreakdown();
  res.json({ success: true, data: categories });
});

export const getInventoryHealth = asyncHandler(async (req, res) => {
  const lowStock = await Analytics.getInventoryHealth();
  res.json({ success: true, data: lowStock });
});
