import { body } from 'express-validator';

const email = body('email').trim().toLowerCase().isEmail().withMessage('Enter a valid email address');

export const registerRules = [
  body('fullName').trim().isLength({ min: 2, max: 120 }).withMessage('Enter your full name'),
  email,
  body('phone').optional({ values: 'falsy' }).trim().matches(/^[0-9+\-\s]{8,15}$/).withMessage('Enter a valid phone number'),
  body('password')
    .isLength({ min: 8, max: 72 }).withMessage('Password must be 8 to 72 characters')
    .matches(/[A-Za-z]/).withMessage('Password must include a letter')
    .matches(/\d/).withMessage('Password must include a number'),
];

export const loginRules = [email, body('password').isString().notEmpty().withMessage('Enter your password')];
