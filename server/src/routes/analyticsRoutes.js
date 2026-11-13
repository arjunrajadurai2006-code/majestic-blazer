import { Router } from 'express';
import * as ctrl from '../controllers/analyticsController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.get('/summary', authenticate, authorize('admin'), ctrl.getSummary);
router.get('/revenue', authenticate, authorize('admin'), ctrl.getRevenueTrends);
router.get('/top-products', authenticate, authorize('admin'), ctrl.getTopProducts);
router.get('/categories', authenticate, authorize('admin'), ctrl.getCategoryBreakdown);
router.get('/inventory-health', authenticate, authorize('admin'), ctrl.getInventoryHealth);

export default router;
