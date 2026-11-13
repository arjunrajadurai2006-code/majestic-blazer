import { pool } from '../config/db.js';

export const list = async ({ includeInactive = false } = {}) => {
  const where = includeInactive ? '' : 'WHERE is_active = true';
  const { rows } = await pool.query(
    `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = true) AS products_count
     FROM categories c ${where} ORDER BY sort_order, name`
  );
  return rows;
};

export const findById = async (id) => {
  const { rows } = await pool.query('SELECT * FROM categories WHERE id = $1 LIMIT 1', [id]);
  return rows[0] || null;
};

export const findBySlug = async (slug) => {
  const { rows } = await pool.query('SELECT * FROM categories WHERE slug = $1 LIMIT 1', [slug]);
  return rows[0] || null;
};

export const create = async ({ name, slug, description = null, parentId = null, sortOrder = 0, isActive = true }) => {
  const { rows } = await pool.query(
    `INSERT INTO categories (name, slug, description, parent_id, sort_order, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [name.trim(), slug.trim().toLowerCase(), description ? description.trim() : null, parentId || null, Number(sortOrder) || 0, Boolean(isActive)]
  );
  return rows[0];
};

export const update = async (id, { name, slug, description = null, parentId = null, sortOrder = 0, isActive = true }) => {
  const { rows } = await pool.query(
    `UPDATE categories SET name = $1, slug = $2, description = $3, parent_id = $4, sort_order = $5, is_active = $6
     WHERE id = $7
     RETURNING *`,
    [name.trim(), slug.trim().toLowerCase(), description ? description.trim() : null, parentId || null, Number(sortOrder) || 0, Boolean(isActive), id]
  );
  return rows[0] || null;
};

export const remove = async (id) => {
  const { rowCount } = await pool.query('DELETE FROM categories WHERE id = $1', [id]);
  return rowCount > 0;
};
