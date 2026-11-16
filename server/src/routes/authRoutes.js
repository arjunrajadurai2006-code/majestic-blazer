import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as ctrl from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginRules, registerRules } from '../validators/authValidators.js';

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

router.post('/register', authLimiter, validate(registerRules), ctrl.register);
router.post('/login', authLimiter, validate(loginRules), ctrl.login);
router.post('/admin/login', authLimiter, validate(loginRules), ctrl.adminLogin);
router.post('/logout', ctrl.logout);
router.get('/me', authenticate, ctrl.me);
router.put('/profile', authenticate, ctrl.updateProfile);
router.put('/password', authenticate, ctrl.changePassword);
router.post('/forgot-password', authLimiter, ctrl.forgotPassword);
router.post('/reset-password', authLimiter, ctrl.resetPassword);
router.get('/config', ctrl.getAuthConfig);
router.get('/demo-customer', ctrl.getDemoCustomer);
router.get('/demo-admin', ctrl.getDemoAdmin);

// Saved addresses
router.get('/addresses', authenticate, ctrl.listAddresses);
router.post('/addresses', authenticate, ctrl.addAddress);
router.put('/addresses/:id', authenticate, ctrl.updateAddress);
router.delete('/addresses/:id', authenticate, ctrl.deleteAddress);

export default router;
