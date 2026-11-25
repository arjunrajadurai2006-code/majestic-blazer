import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as ctrl from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginRules, registerRules } from '../validators/authValidators.js';

const router = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: (req) => {
    const resetMs = req.rateLimit?.resetTime ? req.rateLimit.resetTime.getTime() - Date.now() : 15 * 60 * 1000;
    const retryAfter = Math.max(1, Math.ceil(resetMs / 1000));
    return {
      success: false,
      message: `Too many authentication attempts. Please wait ${retryAfter} seconds before trying again.`,
      retryAfter,
    };
  },
});

router.post('/register', authLimiter, validate(registerRules), ctrl.register);
router.post('/login', authLimiter, validate(loginRules), ctrl.login);
router.post('/admin/login', authLimiter, validate(loginRules), ctrl.adminLogin);
router.post('/logout', ctrl.logout);
router.get('/me', authenticate, ctrl.me);
router.put('/profile', authenticate, ctrl.updateProfile);
router.put('/password', authenticate, ctrl.changePassword);
router.post('/forgot-password', authLimiter, ctrl.forgotPassword);
router.post('/reset-password', authLimiter, ctrl.resetPassword);

// Cross-application secure authentication handoff
router.post('/handoff/create', authenticate, ctrl.createHandoff);
router.post('/handoff/exchange', authLimiter, ctrl.exchangeHandoff);

// Saved addresses
router.get('/addresses', authenticate, ctrl.listAddresses);
router.post('/addresses', authenticate, ctrl.addAddress);
router.put('/addresses/:id', authenticate, ctrl.updateAddress);
router.delete('/addresses/:id', authenticate, ctrl.deleteAddress);

export default router;
