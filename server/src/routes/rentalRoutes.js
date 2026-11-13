import { Router } from 'express';
import * as ctrl from '../controllers/rentalController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.get('/check', ctrl.checkAvailability);
router.post('/', authenticate, ctrl.create);
router.get('/mine', authenticate, ctrl.listMine);
router.get('/all', authenticate, authorize('admin'), ctrl.list);
router.get('/:id', authenticate, ctrl.getById);
router.patch('/:id/status', authenticate, authorize('admin'), ctrl.updateStatus);
router.post('/:id/return', authenticate, authorize('admin'), ctrl.recordReturn);

export default router;
