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
  body('categoryId').isInt({ min: 1 }).toInt().withMessage('Select a valid category'),
  body('name').trim().isLength({ min: 2, max: 200 }).withMessage('Product name must be 2 to 200 characters'),
  slug,
  body('description').optional({ values: 'falsy' }).trim().isLength({ max: 5000 }).withMessage('Description cannot exceed 5000 characters'),
  body('color').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
  body('material').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
  body('fit').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
  body('careInstructions').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
  body('isPurchasable').optional().isBoolean().toBoolean(),
  body('isFeatured').optional().isBoolean().toBoolean(),
  body('isActive').optional().isBoolean().toBoolean(),
  money('salePrice'),
  money('originalPrice'),
  body('images').optional().isArray().withMessage('Images must be an array'),
  body('images.*.url').optional().isString().trim().notEmpty().withMessage('Each image must have a valid URL'),
  body('variants').optional().isArray().withMessage('Variants must be an array'),
  body('variants').custom((variants) => {
    if (!Array.isArray(variants)) return true;
    const seenSizes = new Set();
    const seenSkus = new Set();
    for (const v of variants) {
      const s = String(v?.size || '').trim();
      const sku = String(v?.sku || '').trim();
      const qty = Number(v?.stockQuantity ?? 0);
      if (!s) throw new Error('Each variant must have a size');
      if (!sku) throw new Error(`SKU is required for size ${s}`);
      if (!Number.isInteger(qty) || qty < 0) throw new Error(`Stock quantity for size ${s} must be a non-negative integer`);
      if (seenSizes.has(s.toLowerCase())) throw new Error(`Duplicate size "${s}" in variants`);
      if (seenSkus.has(sku.toLowerCase())) throw new Error(`Duplicate SKU "${sku}" in variants`);
      seenSizes.add(s.toLowerCase());
      seenSkus.add(sku.toLowerCase());
    }
    return true;
  }),
  body().custom((v) => (v.isPurchasable ?? true)).withMessage('Product must be purchasable'),
];

export const productListRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  query('category').optional().trim().isLength({ max: 120 }),
  query('search').optional().trim().isLength({ max: 120 }),
];
