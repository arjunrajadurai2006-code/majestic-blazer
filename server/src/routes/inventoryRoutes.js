import { Router } from 'express';
import * as ctrl from '../controllers/inventoryController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateInventoryAdjustment } from '../validators/inventoryValidators.js';

const router = Router();
router.get('/', authenticate, authorize('admin'), ctrl.list);
router.patch('/:id', authenticate, authorize('admin'), validateInventoryAdjustment, ctrl.adjustStock);

export default router;
