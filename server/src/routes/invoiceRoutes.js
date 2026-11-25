import { Router } from 'express';
import * as ctrl from '../controllers/invoiceController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Admin-only endpoints
router.get('/all', authenticate, authorize('admin'), ctrl.list);
router.get('/:id/thermal-data', authenticate, authorize('admin'), ctrl.getThermalData);
router.get('/:id/thermal-pdf', authenticate, authorize('admin'), ctrl.downloadThermalPdf);

// Existing customer and admin invoice endpoints (unchanged)
router.get('/:id', authenticate, ctrl.getByNumberOrId);
router.get('/:id/pdf', authenticate, ctrl.downloadPdf);

export default router;
