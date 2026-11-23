import { pool } from '../config/db.js';

export const listByUser = async (userId) => {
  const { rows } = await pool.query(
    `SELECT w.id, w.created_at, p.id AS product_id, p.name, p.slug, p.sale_price,
       p.is_purchasable, c.name AS category_name,
       (SELECT url FROM product_images img WHERE img.product_id = p.id ORDER BY img.is_primary DESC LIMIT 1) AS image_url
     FROM wishlists w
     JOIN products p ON p.id = w.product_id
     JOIN categories c ON c.id = p.category_id
     WHERE w.user_id = $1
     ORDER BY w.created_at DESC`,
    [userId]
  );
  return rows;
};

export const add = async (userId, productId) => {
  await pool.query(
    `INSERT INTO wishlists (user_id, product_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, product_id) DO NOTHING`,
    [userId, productId]
  );
  return true;
};

export const remove = async (userId, productId) => {
  const { rowCount } = await pool.query(
    'DELETE FROM wishlists WHERE user_id = $1 AND product_id = $2',
    [userId, productId]
  );
  return rowCount > 0;
};

export const check = async (userId, productId) => {
  const { rows } = await pool.query(
    'SELECT id FROM wishlists WHERE user_id = $1 AND product_id = $2 LIMIT 1',
    [userId, productId]
  );
  return rows.length > 0;
};

