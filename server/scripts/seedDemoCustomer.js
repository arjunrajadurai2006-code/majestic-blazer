import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';
import * as User from '../src/models/userModel.js';

const DEMO_EMAIL = 'customer.demo@majesticblazer.com';
const DEMO_PASSWORD = 'CustomerDemo2026!';
const BCRYPT_ROUNDS = 12;

async function seedDemoCustomer() {
  if (process.env.NODE_ENV === 'production') {
    console.log('Skipping demo customer seeding: NODE_ENV is production');
    await pool.end();
    return;
  }

  console.log('Checking demo customer account in database...');
  let user = await User.findByEmail(DEMO_EMAIL);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

  if (user) {
    console.log(`Demo customer exists (ID ${user.id}). Updating password hash...`);
    await User.updatePassword(user.id, passwordHash);
    console.log('✓ Demo customer password updated');
  } else {
    console.log('Creating demo customer account...');
    const id = await User.create({
      fullName: 'Demo Patron',
      email: DEMO_EMAIL,
      phone: '8903238882',
      passwordHash,
      role: 'customer'
    });
    console.log(`✓ Demo customer created with ID: ${id}`);
  }

  await pool.end();
}

seedDemoCustomer().catch(err => {
  console.error('Failed to seed demo customer:', err);
  process.exit(1);
});

