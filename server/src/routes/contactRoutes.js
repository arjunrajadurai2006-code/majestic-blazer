import { Router } from 'express';
import * as ctrl from '../controllers/contactController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.post('/', ctrl.create);
router.get('/all', authenticate, authorize('admin'), ctrl.list);
router.patch('/:id/status', authenticate, authorize('admin'), ctrl.updateStatus);

export default router;

