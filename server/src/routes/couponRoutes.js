import { Router } from 'express';
import * as ctrl from '../controllers/couponController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.post('/validate', ctrl.validate);
router.get('/', authenticate, authorize('admin'), ctrl.list);
router.post('/', authenticate, authorize('admin'), ctrl.create);
router.delete('/:id', authenticate, authorize('admin'), ctrl.remove);

export default router;

