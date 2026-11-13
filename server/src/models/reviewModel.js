import { pool } from '../config/db.js';

export const listByProduct = async (productId) => {
  const { rows } = await pool.query(
    `SELECT r.*, u.full_name AS user_name
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     WHERE r.product_id = $1 AND r.is_approved = true
     ORDER BY r.created_at DESC`,
    [productId]
  );
  return rows;
};

export const create = async (userId, { productId, rating, title = null, comment }) => {
  const { rows } = await pool.query(
    `INSERT INTO reviews (user_id, product_id, rating, title, comment, is_approved)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING *`,
    [userId, productId, Math.min(5, Math.max(1, Number(rating))), title || null, comment.trim()]
  );
  return rows[0];
};

export const listAll = async () => {
  const { rows } = await pool.query(
    `SELECT r.*, u.full_name AS user_name, u.email AS user_email, p.name AS product_name, p.slug AS product_slug
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     JOIN products p ON p.id = r.product_id
     ORDER BY r.created_at DESC`
  );
  return rows;
};

export const toggleApprove = async (id, isApproved) => {
  const { rows } = await pool.query(
    'UPDATE reviews SET is_approved = $1 WHERE id = $2 RETURNING *',
    [Boolean(isApproved), id]
  );
  return rows[0] || null;
};

