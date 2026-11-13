import { validationResult } from 'express-validator';
import { AppError } from '../utils/AppError.js';

// Usage: router.post('/', validate(rules), controller)
export const validate = (rules) => [
  ...rules,
  (req, res, next) => {
    const result = validationResult(req);
    if (result.isEmpty()) return next();
    const details = result.array().map((e) => ({ field: e.path, message: e.msg }));
    return next(new AppError('Validation failed', 422, details));
  },
];
