import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

export const validate = async (code, cartTotal) => {
  const { rows } = await pool.query(
    'SELECT * FROM coupons WHERE UPPER(code) = $1 AND is_active = true LIMIT 1',
    [code.trim().toUpperCase()]
  );
  const coupon = rows[0];
  if (!coupon) throw new AppError('Invalid coupon code', 404);

  const now = new Date();
  if (coupon.valid_from && new Date(coupon.valid_from) > now) {
    throw new AppError('This coupon is not yet active', 400);
  }
  if (coupon.valid_to && new Date(coupon.valid_to) < now) {
    throw new AppError('This coupon has expired', 400);
  }
  if (coupon.usage_limit && coupon.times_used >= coupon.usage_limit) {
    throw new AppError('This coupon usage limit has been reached', 400);
  }
  if (Number(cartTotal) < Number(coupon.min_order_value)) {
    throw new AppError(`Minimum order value of ₹${coupon.min_order_value} required for this coupon`, 400);
  }

  let discount = 0;
  if (coupon.discount_type === 'percentage') {
    discount = (Number(cartTotal) * Number(coupon.discount_value)) / 100;
    if (coupon.max_discount && discount > Number(coupon.max_discount)) {
      discount = Number(coupon.max_discount);
    }
  } else {
    discount = Number(coupon.discount_value);
  }
  discount = Math.min(discount, Number(cartTotal));

  return {
    code: coupon.code,
    discountType: coupon.discount_type,
    discountValue: Number(coupon.discount_value),
    discountAmount: Math.round(discount * 100) / 100,
  };
};

export const listAll = async () => {
  const { rows } = await pool.query('SELECT * FROM coupons ORDER BY created_at DESC');
  return rows;
};

export const create = async (c) => {
  const { rows } = await pool.query(
    `INSERT INTO coupons (code, discount_type, discount_value, min_order_value, max_discount, valid_from, valid_to, usage_limit, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      c.code.trim().toUpperCase(),
      c.discountType,
      Number(c.discountValue),
      Number(c.minOrderValue) || 0,
      c.maxDiscount ? Number(c.maxDiscount) : null,
      c.validFrom || null,
      c.validTo || null,
      c.usageLimit ? Number(c.usageLimit) : null,
      c.isActive ?? true,
    ]
  );
  return rows[0];
};

export const remove = async (id) => {
  const { rowCount } = await pool.query('DELETE FROM coupons WHERE id = $1', [id]);
  return rowCount > 0;
};

