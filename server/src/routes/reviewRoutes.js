import { Router } from 'express';
import * as ctrl from '../controllers/reviewController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.get('/product/:productId', ctrl.listByProduct);
router.post('/', authenticate, ctrl.create);
router.get('/all', authenticate, authorize('admin'), ctrl.listAll);
router.patch('/:id/approve', authenticate, authorize('admin'), ctrl.toggleApprove);

export default router;

