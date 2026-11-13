import { Router } from 'express';
import * as ctrl from '../controllers/inventoryController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.get('/', authenticate, authorize('admin'), ctrl.list);
router.patch('/:id', authenticate, authorize('admin'), ctrl.adjustStock);

export default router;
