import { Router } from 'express';
import * as ctrl from '../controllers/invoiceController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.get('/all', authenticate, authorize('admin'), ctrl.list);
router.get('/:id', authenticate, ctrl.getByNumberOrId);
router.get('/:id/pdf', authenticate, ctrl.downloadPdf);

export default router;
