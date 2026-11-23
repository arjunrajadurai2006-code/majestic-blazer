import { pool } from '../src/config/db.js';

async function checkRefunds() {
  const { rows } = await pool.query(`
    SELECT id, order_id, provider, status, refund_status, refund_amount, amount
    FROM payments 
    WHERE refund_amount > 0 OR refund_status IS NOT NULL OR status = 'refunded'
  `);
  console.log('Payments with refund info:', rows);
  await pool.end();
}

checkRefunds().catch(console.error);
