import { pool } from '../config/db.js';

export const findByEmail = async (email) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email.trim().toLowerCase()]);
  return rows[0] || null;
};

export const findById = async (id) => {
  const { rows } = await pool.query(
    'SELECT id, full_name, email, phone, role, is_active, created_at, updated_at FROM users WHERE id = $1 LIMIT 1',
    [id]
  );
  return rows[0] || null;
};

export const create = async ({ fullName, email, phone = null, passwordHash, role = 'customer' }) => {
  const { rows } = await pool.query(
    'INSERT INTO users (full_name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [fullName.trim(), email.trim().toLowerCase(), phone ? phone.trim() : null, passwordHash, role]
  );
  return rows[0].id;
};

export const updateProfile = async (id, { fullName, phone }) => {
  const { rows } = await pool.query(
    'UPDATE users SET full_name = $1, phone = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING id, full_name, email, phone, role',
    [fullName.trim(), phone ? phone.trim() : null, id]
  );
  return rows[0] || null;
};

export const updatePassword = async (id, passwordHash) => {
  await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [passwordHash, id]
  );
};

export const setResetToken = async (email, token, expires) => {
  const { rows } = await pool.query(
    'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3 RETURNING id',
    [token, expires, email.trim().toLowerCase()]
  );
  return rows[0] || null;
};

export const findByResetToken = async (token) => {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > CURRENT_TIMESTAMP LIMIT 1',
    [token]
  );
  return rows[0] || null;
};

export const clearResetToken = async (id, passwordHash) => {
  await pool.query(
    'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [passwordHash, id]
  );
};

export const listCustomers = async ({ search, page = 1, limit = 20 }) => {
  const where = ["role = 'customer'"];
  const params = [];
  if (search) {
    params.push(`%${search.trim()}%`);
    const p1 = params.length;
    params.push(`%${search.trim()}%`);
    const p2 = params.length;
    where.push(`(full_name ILIKE $${p1} OR email ILIKE $${p2} OR phone ILIKE $${p2})`);
  }
  const whereSql = where.join(' AND ');
  const offset = (page - 1) * limit;

  const countRes = await pool.query(`SELECT COUNT(*) AS total FROM users WHERE ${whereSql}`, params);
  const total = Number(countRes.rows[0]?.total || 0);

  const queryParams = [...params, limit, offset];
  const { rows: items } = await pool.query(
    `SELECT id, full_name, email, phone, role, is_active, created_at,
       (SELECT COUNT(*) FROM orders o WHERE o.user_id = users.id) AS orders_count,
       (SELECT COUNT(*) FROM rental_bookings r WHERE r.user_id = users.id) AS rentals_count
     FROM users
     WHERE ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    queryParams
  );

  return { items, total };
};

export const updateActiveStatus = async (id, isActive) => {
  const { rows } = await pool.query(
    'UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, is_active',
    [Boolean(isActive), id]
  );
  return rows[0] || null;
};
