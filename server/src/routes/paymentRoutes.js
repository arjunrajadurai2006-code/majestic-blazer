import { Router } from 'express';
import * as ctrl from '../controllers/paymentController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Public payment configuration (Key ID, mockMode, currency)
router.get('/config', ctrl.getPaymentConfig);

// Payment order creation (Authenticated customer)
router.post('/create-order', authenticate, ctrl.createRazorpayOrder);
router.post('/razorpay-order', authenticate, ctrl.createRazorpayOrder);

// Payment verification (HMAC SHA-256 signature verification)
router.post('/verify', authenticate, ctrl.verifyRazorpayPayment);

// Razorpay webhook endpoint (Raw Buffer verification)
router.post('/webhook', ctrl.razorpayWebhook);
router.post('/razorpay/webhook', ctrl.razorpayWebhook);

// Admin reporting & refund endpoints
router.get('/all', authenticate, authorize('admin'), ctrl.list);
router.post('/:id/refund', authenticate, authorize('admin'), ctrl.refund);
router.post('/:id/collect-cod', authenticate, authorize('admin'), ctrl.collectCodPayment);

export default router;
