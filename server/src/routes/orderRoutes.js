import { Router } from 'express';
import * as ctrl from '../controllers/orderController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.post('/', authenticate, ctrl.create);
router.get('/mine', authenticate, ctrl.listMine);
router.get('/all', authenticate, authorize('admin'), ctrl.list);
router.get('/:id', authenticate, ctrl.getById);
router.patch('/:id/status', authenticate, authorize('admin'), ctrl.updateStatus);

export default router;
