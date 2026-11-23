import { Router } from 'express';
import * as ctrl from '../controllers/orderController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateOrderId, validateOrderStatusPayload } from '../validators/orderValidators.js';

const router = Router();
router.post('/', authenticate, ctrl.create);
router.get('/mine', authenticate, ctrl.listMine);
router.get('/all', authenticate, authorize('admin'), ctrl.list);
router.get('/:id', authenticate, validateOrderId, ctrl.getById);
router.post('/:id/cancel', authenticate, validateOrderId, ctrl.cancel);
router.patch('/:id/cancel', authenticate, validateOrderId, ctrl.cancel);
router.patch('/:id/status', authenticate, authorize('admin'), validateOrderId, validateOrderStatusPayload, ctrl.updateStatus);

export default router;
