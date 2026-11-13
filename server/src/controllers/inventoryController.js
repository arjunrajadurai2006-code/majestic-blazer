import { pool } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

export const list = asyncHandler(async (req, res) => {
  const { search, lowStockOnly } = req.query;
  const where = [];
  const params = [];

  if (lowStockOnly === 'true') {
    where.push('(pv.stock_quantity <= 2 OR pv.rental_stock_quantity <= 1)');
  }

  if (search) {
    params.push(`%${search.trim()}%`);
    const p1 = params.length;
    where.push(`(p.name ILIKE $${p1} OR pv.sku ILIKE $${p1})`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT pv.*, p.name AS product_name, p.slug AS product_slug, p.is_purchasable, p.is_rentable,
       c.name AS category_name,
       (SELECT url FROM product_images img WHERE img.product_id = p.id ORDER BY img.is_primary DESC LIMIT 1) AS image_url
     FROM product_variants pv
     JOIN products p ON p.id = pv.product_id
     JOIN categories c ON c.id = p.category_id
     ${whereSql}
     ORDER BY p.name ASC, pv.size ASC`,
    params
  );
  res.json({ success: true, data: rows });
});

export const adjustStock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { stockQuantity, rentalStockQuantity } = req.body;

  const { rows } = await pool.query(
    `UPDATE product_variants SET
      stock_quantity = COALESCE($1, stock_quantity),
      rental_stock_quantity = COALESCE($2, rental_stock_quantity)
     WHERE id = $3
     RETURNING *`,
    [
      stockQuantity != null ? Math.max(0, Number(stockQuantity)) : null,
      rentalStockQuantity != null ? Math.max(0, Number(rentalStockQuantity)) : null,
      id,
    ]
  );

  if (!rows.length) throw new AppError('Variant not found', 404);
  res.json({ success: true, data: rows[0] });
});
