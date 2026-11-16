import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';
import * as User from '../src/models/userModel.js';

const DEMO_ADMIN_EMAIL = 'admin@majesticblazer.com';
const DEMO_ADMIN_PASSWORD = 'MajesticAdmin2026!Secure';
const BCRYPT_ROUNDS = 12;

async function seedDemoAdmin() {
  if (process.env.NODE_ENV === 'production') {
    console.log('Skipping demo admin seeding: NODE_ENV is production');
    await pool.end();
    return;
  }

  console.log('Checking demo admin account in database...');
  let user = await User.findByEmail(DEMO_ADMIN_EMAIL);
  const passwordHash = await bcrypt.hash(DEMO_ADMIN_PASSWORD, BCRYPT_ROUNDS);

  if (user) {
    console.log(`Demo admin exists (ID ${user.id}). Updating password hash and ensuring admin role...`);
    await pool.query(
      `UPDATE users SET password_hash = $1, role = 'admin', is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [passwordHash, user.id]
    );
    console.log('✓ Demo admin account updated');
  } else {
    console.log('Creating demo admin account...');
    const id = await User.create({
      fullName: 'Atelier Demo Administrator',
      email: DEMO_ADMIN_EMAIL,
      phone: '8903238882',
      passwordHash,
      role: 'admin'
    });
    console.log(`✓ Demo admin created with ID: ${id}`);
  }

  await pool.end();
}

seedDemoAdmin().catch(err => {
  console.error('Failed to seed demo admin:', err);
  process.exit(1);
});

