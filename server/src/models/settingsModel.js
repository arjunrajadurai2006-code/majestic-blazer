import { pool } from '../config/db.js';

export const getAll = async () => {
  const { rows } = await pool.query('SELECT key, value, description FROM store_settings ORDER BY key');
  const result = {};
  for (const r of rows) {
    result[r.key] = r.value;
  }
  return result;
};

export const get = async (key) => {
  const { rows } = await pool.query('SELECT value FROM store_settings WHERE key = $1 LIMIT 1', [key]);
  return rows[0] ? rows[0].value : null;
};

export const set = async (key, value, description = null) => {
  const { rows } = await pool.query(
    `INSERT INTO store_settings (key, value, description, updated_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = COALESCE(EXCLUDED.description, store_settings.description), updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [key, String(value), description]
  );
  // mirror in settings table for backwards compatibility
  await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, String(value)]);
  return rows[0];
};

export const updateBulk = async (settingsObj) => {
  for (const [k, v] of Object.entries(settingsObj)) {
    await set(k, v);
  }
  return getAll();
};

