import { Router } from 'express';
import * as ctrl from '../controllers/customerController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.get('/', authenticate, authorize('admin'), ctrl.list);
router.get('/:id', authenticate, authorize('admin'), ctrl.getById);
router.patch('/:id/status', authenticate, authorize('admin'), ctrl.toggleActive);

export default router;
