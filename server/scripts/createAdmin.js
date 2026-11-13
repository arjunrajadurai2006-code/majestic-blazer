// Creates or updates the admin account from ADMIN_* variables in .env. Remove them afterwards.
import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';

const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (min 12 characters) in server/.env, then run again.');
  process.exit(1);
}

try {
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO UPDATE SET
       full_name = EXCLUDED.full_name,
       password_hash = EXCLUDED.password_hash,
       role = 'admin',
       is_active = true`,
    [ADMIN_NAME || 'Administrator', ADMIN_EMAIL.trim().toLowerCase(), hash]
  );
  console.log('Admin account ready. Now remove ADMIN_* values from .env.');
} catch (err) {
  console.error('Failed to create or update admin account:', err);
  process.exit(1);
} finally {
  await pool.end();
}
