import { pool } from '../config/db.js';

export const listByUser = async (userId) => {
  const { rows } = await pool.query(
    'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, id DESC',
    [userId]
  );
  return rows;
};

export const findById = async (id, userId) => {
  const { rows } = await pool.query(
    'SELECT * FROM addresses WHERE id = $1 AND user_id = $2 LIMIT 1',
    [id, userId]
  );
  return rows[0] || null;
};

export const create = async (userId, { line1, line2 = null, city, state, pincode, isDefault = false }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (isDefault) {
      await client.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [userId]);
    }
    const { rows } = await client.query(
      `INSERT INTO addresses (user_id, line1, line2, city, state, pincode, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, line1.trim(), line2 ? line2.trim() : null, city.trim(), state.trim(), pincode.trim(), Boolean(isDefault)]
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const update = async (id, userId, { line1, line2 = null, city, state, pincode, isDefault = false }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (isDefault) {
      await client.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [userId]);
    }
    const { rows } = await client.query(
      `UPDATE addresses SET line1 = $1, line2 = $2, city = $3, state = $4, pincode = $5, is_default = $6
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
      [line1.trim(), line2 ? line2.trim() : null, city.trim(), state.trim(), pincode.trim(), Boolean(isDefault), id, userId]
    );
    await client.query('COMMIT');
    return rows[0] || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const remove = async (id, userId) => {
  const { rowCount } = await pool.query('DELETE FROM addresses WHERE id = $1 AND user_id = $2', [id, userId]);
  return rowCount > 0;
};

