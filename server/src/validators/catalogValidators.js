import { body, query } from 'express-validator';

const slug = body('slug').trim().toLowerCase().matches(/^[a-z0-9]+(-[a-z0-9]+)*$/).withMessage('Slug may contain lowercase letters, numbers and hyphens');
const money = (field) => body(field).optional({ values: 'null' }).isFloat({ min: 0 }).toFloat().withMessage(`${field} must be 0 or more`);

export const categoryRules = [
  body('name').trim().isLength({ min: 2, max: 120 }),
  slug,
  body('description').optional({ values: 'falsy' }).trim().isLength({ max: 2000 }),
  body('parentId').optional({ values: 'null' }).isInt({ min: 1 }).toInt(),
];

export const productRules = [
  body('categoryId').isInt({ min: 1 }).toInt(),
  body('name').trim().isLength({ min: 2, max: 200 }),
  slug,
  body('description').optional({ values: 'falsy' }).trim().isLength({ max: 5000 }),
  body('isPurchasable').optional().isBoolean().toBoolean(),
  body('isRentable').optional().isBoolean().toBoolean(),
  money('salePrice'), money('rentPricePerDay'), money('securityDeposit'),
  body().custom((v) => (v.isPurchasable ?? true) || v.isRentable).withMessage('Product must be purchasable, rentable, or both'),
];

export const productListRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  query('type').optional().isIn(['buy', 'rent']),
  query('category').optional().trim().isLength({ max: 120 }),
  query('search').optional().trim().isLength({ max: 120 }),
];
