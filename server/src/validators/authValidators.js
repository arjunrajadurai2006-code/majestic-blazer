import { body } from 'express-validator';

const email = body('email').trim().toLowerCase().isEmail().withMessage('Enter a valid email address');

export const registerRules = [
  body('fullName').optional({ values: 'falsy' }).trim().isLength({ max: 120 }).withMessage('Full name cannot exceed 120 characters'),
  email,
  body('phone').optional({ values: 'falsy' }).trim().matches(/^[0-9+\-\s]{8,15}$/).withMessage('Enter a valid phone number'),
  body('password').custom((val) => {
    if (!val || typeof val !== 'string' || !val.trim()) {
      throw new Error('Password is required');
    }
    if (val.length < 8 || val.length > 72) {
      throw new Error('Password must be 8 to 72 characters');
    }
    if (!/[A-Za-z]/.test(val)) {
      throw new Error('Password must include a letter');
    }
    if (!/\d/.test(val)) {
      throw new Error('Password must include a number');
    }
    return true;
  }),
];

export const loginRules = [email, body('password').isString().notEmpty().withMessage('Enter your password')];
