import { Router } from 'express';
import * as ctrl from '../controllers/paymentController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.post('/create-order', authenticate, ctrl.createRazorpayOrder);
router.post('/verify', authenticate, ctrl.verifyRazorpayPayment);
router.post('/webhook', ctrl.razorpayWebhook);
router.get('/all', authenticate, authorize('admin'), ctrl.list);
router.post('/:id/refund', authenticate, authorize('admin'), ctrl.refund);

export default router;
